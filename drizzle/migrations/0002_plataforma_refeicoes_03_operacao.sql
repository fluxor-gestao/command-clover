-- =====================================================================
-- Plataforma de refeições — 03: pagamentos, recebimento (NF-e), estoque,
-- produção por lote, rastreabilidade, financeiro, nutricionista e LGPD.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Financeiro (lançamentos) e repasses do provedor
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'simulado',
  payout_ref text NOT NULL UNIQUE,
  payout_date date NOT NULL,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  refund_amount numeric(14,2) NOT NULL DEFAULT 0,
  net_amount numeric(14,2) NOT NULL DEFAULT 0, -- valor efetivamente depositado
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_payouts TO authenticated;
GRANT ALL ON public.provider_payouts TO service_role;
ALTER TABLE public.provider_payouts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  ALTER TABLE public.payments ADD CONSTRAINT payments_payout_fk FOREIGN KEY (payout_id) REFERENCES public.provider_payouts(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('receita_venda','taxa_pagamento','reembolso','contestacao','despesa','compra_insumo')),
  direction text NOT NULL CHECK (direction IN ('entrada','saida')),
  description text NOT NULL,
  category text,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  competence_date date NOT NULL DEFAULT current_date,
  due_date date,
  settled_date date,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','liquidado','cancelado')),
  order_id uuid REFERENCES public.orders(id),
  payment_id uuid REFERENCES public.payments(id),
  payout_id uuid REFERENCES public.provider_payouts(id),
  nfe_import_id uuid REFERENCES public.nfe_imports(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entries TO authenticated;
GRANT ALL ON public.financial_entries TO service_role;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
-- Um único registro financeiro de venda por pagamento/pedido, mesmo com reenvio do provedor.
CREATE UNIQUE INDEX IF NOT EXISTS fin_one_per_payment_kind ON public.financial_entries (payment_id, kind) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fin_one_sale_per_order ON public.financial_entries (order_id) WHERE kind = 'receita_venda';
CREATE UNIQUE INDEX IF NOT EXISTS fin_one_per_nfe ON public.financial_entries (nfe_import_id) WHERE kind = 'compra_insumo';

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  provider_charge_id text,
  status text NOT NULL,
  payload jsonb,
  result text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2. Processamento idempotente de eventos de pagamento
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_payment_event(
  p_provider text, p_event_id text, p_charge_id text, p_status text,
  p_amount numeric DEFAULT NULL, p_fee numeric DEFAULT NULL, p_payload jsonb DEFAULT '{}', p_receipt_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_evt uuid;
  pay public.payments%ROWTYPE;
  o public.orders%ROWTYPE;
  s public.platform_settings%ROWTYPE;
  v_fee numeric;
  v_result text;
BEGIN
  -- Webhook (service_role) ou operação/financeiro simulando o provedor.
  IF COALESCE(auth.role(), '') <> 'service_role' AND NOT public.has_any_role(ARRAY['operacao','financeiro']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.payment_events (provider, event_id, provider_charge_id, status, payload)
  VALUES (p_provider, p_event_id, p_charge_id, p_status, p_payload)
  ON CONFLICT (provider, event_id) DO NOTHING
  RETURNING id INTO v_evt;
  IF v_evt IS NULL THEN
    RETURN jsonb_build_object('result', 'evento_duplicado_ignorado', 'event_id', p_event_id);
  END IF;

  SELECT * INTO pay FROM public.payments WHERE provider_charge_id = p_charge_id FOR UPDATE;
  IF pay.id IS NULL THEN
    UPDATE public.payment_events SET result = 'cobranca_desconhecida' WHERE id = v_evt;
    RETURN jsonb_build_object('result', 'cobranca_desconhecida');
  END IF;
  SELECT * INTO o FROM public.orders WHERE id = pay.order_id FOR UPDATE;
  SELECT * INTO s FROM public.platform_settings LIMIT 1;

  IF p_status = 'aprovado' THEN
    IF pay.status = 'aprovado' THEN
      v_result := 'ja_aprovado';
    ELSE
      v_fee := COALESCE(p_fee, round(pay.amount * CASE WHEN pay.method = 'cartao' THEN s.card_fee_pct ELSE s.pix_fee_pct END, 2));
      UPDATE public.payments SET status = 'aprovado', paid_at = now(), fee_amount = v_fee,
             net_amount = COALESCE(p_amount, pay.amount) - v_fee, receipt_url = COALESCE(p_receipt_url, receipt_url),
             next_retry_at = NULL, updated_at = now()
       WHERE id = pay.id;
      INSERT INTO public.financial_entries (kind, direction, description, category, amount, competence_date, order_id, payment_id, status)
      VALUES ('receita_venda', 'entrada', 'Venda ' || o.code, 'vendas', COALESCE(p_amount, pay.amount), current_date, o.id, pay.id, 'aberto')
      ON CONFLICT DO NOTHING;
      INSERT INTO public.financial_entries (kind, direction, description, category, amount, competence_date, order_id, payment_id, status)
      VALUES ('taxa_pagamento', 'saida', 'Taxa do provedor ' || o.code, 'taxas_pagamento', v_fee, current_date, o.id, pay.id, 'aberto')
      ON CONFLICT DO NOTHING;
      IF o.status = 'aguardando_pagamento' THEN
        UPDATE public.orders SET status = 'confirmado', updated_at = now() WHERE id = o.id;
        v_result := 'aprovado_pedido_confirmado';
      ELSE
        UPDATE public.orders SET needs_attention = 'Pagamento aprovado com pedido ' || o.status || ': avaliar reembolso' WHERE id = o.id;
        v_result := 'aprovado_tardio_requer_analise';
      END IF;
      IF pay.subscription_id IS NOT NULL THEN
        UPDATE public.subscriptions SET status = 'ativa' WHERE id = pay.subscription_id AND status = 'inadimplente';
      END IF;
    END IF;

  ELSIF p_status = 'recusado' THEN
    IF pay.status IN ('aprovado','reembolsado') THEN
      v_result := 'ignorado_status_final';
    ELSE
      UPDATE public.payments SET attempts = attempts + 1, updated_at = now(),
             status = CASE WHEN attempts + 1 >= s.payment_max_retries THEN 'expirado' ELSE 'recusado' END,
             next_retry_at = CASE WHEN attempts + 1 >= s.payment_max_retries THEN NULL ELSE now() + make_interval(hours => s.payment_retry_hours) END
       WHERE id = pay.id RETURNING * INTO pay;
      IF pay.status = 'expirado' THEN
        IF s.release_reservation_on_failure AND o.status = 'aguardando_pagamento' THEN
          PERFORM public._release_order_reservations(o.id);
          UPDATE public.orders SET status = 'expirado', updated_at = now() WHERE id = o.id;
        END IF;
        IF pay.subscription_id IS NOT NULL THEN
          UPDATE public.subscriptions SET status = 'inadimplente' WHERE id = pay.subscription_id AND status = 'ativa';
        END IF;
        INSERT INTO public.notifications (customer_id, kind, message)
        VALUES (pay.customer_id, 'pagamento', 'Não conseguimos cobrar o pedido ' || o.code || ' após ' || pay.attempts || ' tentativas. A reserva foi liberada.');
        v_result := 'recusado_limite_atingido_reserva_liberada';
      ELSE
        INSERT INTO public.notifications (customer_id, kind, message)
        VALUES (pay.customer_id, 'pagamento', 'O pagamento do pedido ' || o.code || ' foi recusado. Nova tentativa em ' || s.payment_retry_hours || 'h.');
        v_result := 'recusado_nova_tentativa_agendada';
      END IF;
    END IF;

  ELSIF p_status = 'expirado' THEN
    IF pay.status IN ('pendente','recusado') THEN
      UPDATE public.payments SET status = 'expirado', updated_at = now() WHERE id = pay.id;
      IF o.status = 'aguardando_pagamento' THEN
        PERFORM public._release_order_reservations(o.id);
        UPDATE public.orders SET status = 'expirado', updated_at = now() WHERE id = o.id;
      END IF;
      v_result := 'expirado_reserva_liberada';
    ELSE
      v_result := 'ignorado_status_final';
    END IF;

  ELSIF p_status = 'reembolsado' THEN
    IF pay.status = 'reembolsado' THEN
      v_result := 'ja_reembolsado';
    ELSE
      UPDATE public.payments SET status = 'reembolsado', refunded_at = now(), updated_at = now() WHERE id = pay.id;
      INSERT INTO public.financial_entries (kind, direction, description, category, amount, order_id, payment_id)
      VALUES ('reembolso', 'saida', 'Reembolso ' || o.code, 'reembolsos', COALESCE(p_amount, pay.amount), o.id, pay.id)
      ON CONFLICT DO NOTHING;
      IF o.status IN ('aguardando_pagamento','confirmado') THEN
        PERFORM public._release_order_reservations(o.id);
        UPDATE public.orders SET status = 'cancelado', cancel_reason = 'Reembolsado', cancelled_at = now() WHERE id = o.id;
      END IF;
      v_result := 'reembolso_registrado';
    END IF;

  ELSIF p_status = 'contestado' THEN
    UPDATE public.payments SET status = 'contestado', updated_at = now() WHERE id = pay.id;
    INSERT INTO public.financial_entries (kind, direction, description, category, amount, order_id, payment_id)
    VALUES ('contestacao', 'saida', 'Contestação ' || o.code, 'contestacoes', COALESCE(p_amount, pay.amount), o.id, pay.id)
    ON CONFLICT DO NOTHING;
    UPDATE public.orders SET needs_attention = 'Pagamento contestado pelo titular' WHERE id = o.id;
    v_result := 'contestacao_registrada';
  ELSE
    v_result := 'status_ignorado';
  END IF;

  UPDATE public.payment_events SET result = v_result WHERE id = v_evt;
  RETURN jsonb_build_object('result', v_result, 'payment_id', pay.id, 'order_id', o.id);
END $$;

-- Expira Pix vencidos e pedidos não pagos (rodar por agendamento ou no corte).
CREATE OR REPLACE FUNCTION public.expire_overdue_payments()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay record; v_n int := 0;
BEGIN
  FOR pay IN SELECT * FROM public.payments WHERE status = 'pendente' AND expires_at IS NOT NULL AND expires_at < now() LOOP
    PERFORM public.process_payment_event(pay.provider, 'auto_expire_' || pay.id, pay.provider_charge_id, 'expirado');
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;

-- ---------------------------------------------------------------------
-- 3. Recebimento de insumos (manual ou via NF-e) e realocação de reservas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reallocate_pending_reservations(p_ingredient_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; l record; v_left numeric; v_take numeric;
BEGIN
  PERFORM 1 FROM public.ingredients WHERE id = p_ingredient_id FOR UPDATE;
  FOR r IN SELECT * FROM public.stock_reservations WHERE ingredient_id = p_ingredient_id AND status = 'ativa' AND lot_id IS NULL
             ORDER BY needed_by, created_at LOOP
    v_left := r.quantity;
    FOR l IN SELECT il.id, il.quantity_on_hand - COALESCE((SELECT sum(sr.quantity) FROM public.stock_reservations sr
                                                          WHERE sr.lot_id = il.id AND sr.status = 'ativa'), 0) AS avail
               FROM public.ingredient_lots il
              WHERE il.ingredient_id = p_ingredient_id AND il.status = 'disponivel'
                AND (il.expires_at IS NULL OR il.expires_at >= r.needed_by)
              ORDER BY il.expires_at NULLS LAST, il.received_at LOOP
      EXIT WHEN v_left <= 0;
      v_take := least(l.avail, v_left);
      IF v_take > 0 THEN
        INSERT INTO public.stock_reservations (order_id, order_item_id, ingredient_id, lot_id, purchase_item_id, quantity, needed_by)
        VALUES (r.order_id, r.order_item_id, r.ingredient_id, l.id, r.purchase_item_id, v_take, r.needed_by);
        v_left := v_left - v_take;
      END IF;
    END LOOP;
    IF v_left <= 0 THEN
      UPDATE public.stock_reservations SET status = 'liberada', released_at = now() WHERE id = r.id;
    ELSIF v_left < r.quantity THEN
      UPDATE public.stock_reservations SET quantity = v_left WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._receive_lot(
  p_ingredient_id uuid, p_supplier_id uuid, p_lot_code text, p_qty_usage numeric, p_unit_cost numeric,
  p_expires_at date, p_manufactured_at date, p_storage text, p_nfe_item_id uuid, p_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lot uuid; v_left numeric := p_qty_usage; poi record; v_take numeric;
BEGIN
  IF p_qty_usage <= 0 THEN RAISE EXCEPTION 'Quantidade do lote deve ser positiva'; END IF;
  IF p_lot_code IS NULL OR btrim(p_lot_code) = '' THEN RAISE EXCEPTION 'Informe o código do lote'; END IF;
  INSERT INTO public.ingredient_lots (ingredient_id, supplier_id, lot_code, quantity_received, quantity_on_hand, unit_cost,
                                      expires_at, manufactured_at, storage, nfe_item_id,
                                      status)
  VALUES (p_ingredient_id, p_supplier_id, p_lot_code, p_qty_usage, p_qty_usage, COALESCE(p_unit_cost, 0),
          p_expires_at, p_manufactured_at, p_storage, p_nfe_item_id,
          CASE WHEN p_expires_at IS NOT NULL AND p_expires_at < current_date THEN 'bloqueado' ELSE 'disponivel' END)
  RETURNING id INTO v_lot;
  INSERT INTO public.stock_movements (ingredient_id, lot_id, kind, quantity, unit_cost, reason, reference)
  VALUES (p_ingredient_id, v_lot, 'entrada', p_qty_usage, p_unit_cost, 'Recebimento conferido', p_reference);
  IF p_unit_cost IS NOT NULL AND p_unit_cost > 0 THEN
    UPDATE public.ingredients SET unit_cost = p_unit_cost, updated_at = now() WHERE id = p_ingredient_id;
  END IF;

  -- Baixa compras previstas desse ingrediente (mais antigas primeiro).
  FOR poi IN SELECT x.* FROM public.purchase_order_items x JOIN public.purchase_orders po ON po.id = x.purchase_order_id
              WHERE x.ingredient_id = p_ingredient_id AND po.status IN ('prevista','recebida_parcial')
                AND (p_supplier_id IS NULL OR po.supplier_id IS NULL OR po.supplier_id = p_supplier_id)
                AND x.quantity_received < x.quantity
              ORDER BY po.expected_date FOR UPDATE OF x LOOP
    EXIT WHEN v_left <= 0;
    v_take := least(poi.quantity - poi.quantity_received, v_left);
    UPDATE public.purchase_order_items SET quantity_received = quantity_received + v_take WHERE id = poi.id;
    v_left := v_left - v_take;
  END LOOP;
  UPDATE public.purchase_orders po SET status = CASE
           WHEN NOT EXISTS (SELECT 1 FROM public.purchase_order_items x WHERE x.purchase_order_id = po.id AND x.quantity_received < x.quantity) THEN 'recebida'
           ELSE 'recebida_parcial' END
   WHERE po.status IN ('prevista','recebida_parcial')
     AND EXISTS (SELECT 1 FROM public.purchase_order_items x WHERE x.purchase_order_id = po.id AND x.ingredient_id = p_ingredient_id AND x.quantity_received > 0);

  PERFORM public._reallocate_pending_reservations(p_ingredient_id);
  RETURN v_lot;
END $$;

CREATE OR REPLACE FUNCTION public.receive_manual_lot(
  p_ingredient_id uuid, p_supplier_id uuid, p_lot_code text, p_quantity_purchase_unit numeric,
  p_total_cost numeric, p_expires_at date, p_manufactured_at date DEFAULT NULL, p_storage text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.ingredients%ROWTYPE; v_qty numeric;
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO i FROM public.ingredients WHERE id = p_ingredient_id;
  v_qty := p_quantity_purchase_unit * i.conversion_factor;
  RETURN public._receive_lot(p_ingredient_id, p_supplier_id, p_lot_code, v_qty,
                             CASE WHEN v_qty > 0 THEN p_total_cost / v_qty END,
                             p_expires_at, p_manufactured_at, COALESCE(p_storage, i.storage), NULL, 'Entrada manual');
END $$;

-- Importação de NF-e já interpretada no app (o XML original é guardado para auditoria).
CREATE OR REPLACE FUNCTION public.import_nfe(p_header jsonb, p_items jsonb, p_raw_xml text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_supplier uuid; v_import uuid; it jsonb; v_map public.supplier_item_map%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF EXISTS (SELECT 1 FROM public.nfe_imports WHERE access_key = p_header->>'access_key') THEN
    RAISE EXCEPTION 'Esta NF-e já foi importada';
  END IF;
  SELECT id INTO v_supplier FROM public.suppliers WHERE cnpj = p_header->>'supplier_cnpj';
  IF v_supplier IS NULL THEN
    INSERT INTO public.suppliers (name, cnpj) VALUES (p_header->>'supplier_name', p_header->>'supplier_cnpj') RETURNING id INTO v_supplier;
  END IF;
  INSERT INTO public.nfe_imports (access_key, number, series, issued_at, supplier_id, supplier_cnpj, supplier_name, total_amount, due_date, raw_xml)
  VALUES (p_header->>'access_key', p_header->>'number', p_header->>'series', (p_header->>'issued_at')::timestamptz, v_supplier,
          p_header->>'supplier_cnpj', p_header->>'supplier_name', (p_header->>'total_amount')::numeric,
          COALESCE((p_header->>'due_date')::date, ((p_header->>'issued_at')::timestamptz)::date + 28), p_raw_xml)
  RETURNING id INTO v_import;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_map FROM public.supplier_item_map WHERE supplier_id = v_supplier AND supplier_code = it->>'supplier_code';
    INSERT INTO public.nfe_items (import_id, item_number, supplier_code, description, ncm, unit, quantity, unit_price, total,
                                  ingredient_id, conversion_factor, lots)
    VALUES (v_import, (it->>'item_number')::int, it->>'supplier_code', it->>'description', it->>'ncm', it->>'unit',
            (it->>'quantity')::numeric, (it->>'unit_price')::numeric, (it->>'total')::numeric,
            v_map.ingredient_id, v_map.conversion_factor, COALESCE(it->'lots', '[]'));
    v_map := NULL;
  END LOOP;
  RETURN v_import;
END $$;

-- Fecha a conferência quando não há itens pendentes e lança a conta a pagar (uma vez por nota).
CREATE OR REPLACE FUNCTION public._finish_nfe_if_done(p_import_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE imp public.nfe_imports%ROWTYPE;
BEGIN
  SELECT * INTO imp FROM public.nfe_imports WHERE id = p_import_id FOR UPDATE;
  IF imp.status <> 'em_conferencia' OR EXISTS (SELECT 1 FROM public.nfe_items WHERE import_id = imp.id AND status = 'pendente') THEN
    RETURN;
  END IF;
  UPDATE public.nfe_imports SET status = 'conferida', checked_by = auth.uid(), checked_at = now() WHERE id = imp.id;
  INSERT INTO public.financial_entries (kind, direction, description, category, amount, competence_date, due_date, nfe_import_id, supplier_id)
  VALUES ('compra_insumo', 'saida', 'NF-e ' || COALESCE(imp.number, '') || ' · ' || COALESCE(imp.supplier_name, ''), 'insumos',
          COALESCE(imp.total_amount, 0), COALESCE(imp.issued_at::date, current_date), imp.due_date, imp.id, imp.supplier_id)
  ON CONFLICT DO NOTHING;
END $$;

-- Conferência física de um item: vários lotes, dados ausentes preenchidos à mão.
-- p_lots: [{lot_code, quantity (unidade da nota), expires_at, manufactured_at}]
CREATE OR REPLACE FUNCTION public.confirm_nfe_item(
  p_item_id uuid, p_ingredient_id uuid, p_conversion_factor numeric, p_lots jsonb, p_divergence_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.nfe_items%ROWTYPE; imp public.nfe_imports%ROWTYPE; l jsonb; v_total_qty numeric := 0; v_ing public.ingredients%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO it FROM public.nfe_items WHERE id = p_item_id FOR UPDATE;
  IF it.status <> 'pendente' THEN RAISE EXCEPTION 'Item já conferido'; END IF;
  SELECT * INTO imp FROM public.nfe_imports WHERE id = it.import_id;
  SELECT * INTO v_ing FROM public.ingredients WHERE id = p_ingredient_id;
  IF v_ing.id IS NULL THEN RAISE EXCEPTION 'Vincule o item a um ingrediente'; END IF;
  IF p_conversion_factor IS NULL OR p_conversion_factor <= 0 THEN RAISE EXCEPTION 'Fator de conversão inválido'; END IF;
  IF jsonb_array_length(COALESCE(p_lots, '[]')) = 0 THEN RAISE EXCEPTION 'Informe ao menos um lote'; END IF;

  FOR l IN SELECT * FROM jsonb_array_elements(p_lots) LOOP
    IF NULLIF(l->>'expires_at', '') IS NULL THEN RAISE EXCEPTION 'Informe a validade do lote %', l->>'lot_code'; END IF;
    PERFORM public._receive_lot(p_ingredient_id, imp.supplier_id, l->>'lot_code',
                                (l->>'quantity')::numeric * p_conversion_factor,
                                it.unit_price / p_conversion_factor,
                                (l->>'expires_at')::date, NULLIF(l->>'manufactured_at', '')::date, v_ing.storage, it.id,
                                'NF-e ' || COALESCE(imp.number, ''));
    v_total_qty := v_total_qty + (l->>'quantity')::numeric;
  END LOOP;

  UPDATE public.nfe_items SET ingredient_id = p_ingredient_id, conversion_factor = p_conversion_factor, lots = p_lots,
         status = CASE WHEN abs(v_total_qty - it.quantity) > 0.0001 OR p_divergence_note IS NOT NULL THEN 'divergente' ELSE 'conferido' END,
         divergence_note = COALESCE(p_divergence_note, CASE WHEN abs(v_total_qty - it.quantity) > 0.0001
                                    THEN 'Recebido ' || v_total_qty || ' de ' || it.quantity || ' ' || COALESCE(it.unit, '') END)
   WHERE id = it.id;

  IF it.supplier_code IS NOT NULL AND imp.supplier_id IS NOT NULL THEN
    INSERT INTO public.supplier_item_map (supplier_id, supplier_code, ingredient_id, conversion_factor)
    VALUES (imp.supplier_id, it.supplier_code, p_ingredient_id, p_conversion_factor)
    ON CONFLICT (supplier_id, supplier_code) DO UPDATE SET ingredient_id = EXCLUDED.ingredient_id, conversion_factor = EXCLUDED.conversion_factor;
  END IF;

  PERFORM public._finish_nfe_if_done(imp.id);
END $$;

CREATE OR REPLACE FUNCTION public.ignore_nfe_item(p_item_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.nfe_items SET status = 'ignorado', divergence_note = p_note WHERE id = p_item_id AND status = 'pendente';
  PERFORM public._finish_nfe_if_done((SELECT import_id FROM public.nfe_items WHERE id = p_item_id));
END $$;

-- Perdas, devoluções, baixas e ajustes de inventário (sempre com motivo e responsável).
CREATE OR REPLACE FUNCTION public.register_stock_movement(p_lot_id uuid, p_kind text, p_quantity numeric, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.ingredient_lots%ROWTYPE; v_delta numeric; v_reserved numeric;
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao','cozinha']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_kind NOT IN ('perda','devolucao','baixa','ajuste') THEN RAISE EXCEPTION 'Tipo de movimento inválido'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  SELECT * INTO l FROM public.ingredient_lots WHERE id = p_lot_id FOR UPDATE;
  -- ajuste aceita sinal; demais tipos sempre retiram do estoque
  v_delta := CASE WHEN p_kind = 'ajuste' THEN p_quantity ELSE -abs(p_quantity) END;
  IF l.quantity_on_hand + v_delta < 0 THEN RAISE EXCEPTION 'Saldo físico insuficiente no lote'; END IF;
  UPDATE public.ingredient_lots SET quantity_on_hand = quantity_on_hand + v_delta,
         status = CASE WHEN quantity_on_hand + v_delta = 0 THEN 'esgotado' WHEN status = 'esgotado' THEN 'disponivel' ELSE status END
   WHERE id = l.id;
  INSERT INTO public.stock_movements (ingredient_id, lot_id, kind, quantity, unit_cost, reason)
  VALUES (l.ingredient_id, l.id, p_kind, v_delta, l.unit_cost, p_reason);
  SELECT COALESCE(sum(quantity), 0) INTO v_reserved FROM public.stock_reservations WHERE lot_id = l.id AND status = 'ativa';
  RETURN jsonb_build_object('on_hand', l.quantity_on_hand + v_delta, 'reserved', v_reserved,
                            'warning', CASE WHEN l.quantity_on_hand + v_delta < v_reserved THEN 'Saldo físico menor que o reservado: revise a produção' END);
END $$;

CREATE OR REPLACE FUNCTION public.set_lot_blocked(p_lot_id uuid, p_blocked boolean, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.ingredient_lots SET status = CASE WHEN p_blocked THEN 'bloqueado' ELSE 'disponivel' END,
         notes = concat_ws(' | ', notes, p_reason)
   WHERE id = p_lot_id;
END $$;

-- ---------------------------------------------------------------------
-- 4. Corte semanal e produção por lote
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_cycle(p_cycle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pay record; v_expired int := 0;
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.menu_cycles SET status = 'corte' WHERE id = p_cycle_id AND status IN ('aberto','rascunho');
  FOR pay IN SELECT p.* FROM public.payments p JOIN public.orders o ON o.id = p.order_id
              WHERE o.cycle_id = p_cycle_id AND o.status = 'aguardando_pagamento' AND p.status IN ('pendente','recusado') LOOP
    PERFORM public.process_payment_event(pay.provider, 'cutoff_expire_' || pay.id, pay.provider_charge_id, 'expirado');
    v_expired := v_expired + 1;
  END LOOP;
  RETURN jsonb_build_object('expired_unpaid_orders', v_expired);
END $$;

CREATE TABLE IF NOT EXISTS public.production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_code text NOT NULL UNIQUE,
  dish_id uuid NOT NULL REFERENCES public.dishes(id),
  dish_version int NOT NULL,
  cycle_day_id uuid NOT NULL REFERENCES public.menu_cycle_days(id),
  production_date date NOT NULL,
  portions_planned int NOT NULL,
  portions_produced int,
  expires_at date NOT NULL,
  storage_instructions text NOT NULL,
  status text NOT NULL DEFAULT 'em_producao' CHECK (status IN ('em_producao','concluido','descartado')),
  produced_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (cycle_day_id, dish_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches TO authenticated;
GRANT ALL ON public.production_batches TO service_role;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  ALTER TABLE public.order_items ADD CONSTRAINT order_items_batch_fk FOREIGN KEY (production_batch_id) REFERENCES public.production_batches(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.batch_ingredient_lots (
  batch_id uuid NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.ingredient_lots(id),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  quantity numeric(14,4) NOT NULL,
  PRIMARY KEY (batch_id, lot_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batch_ingredient_lots TO authenticated;
GRANT ALL ON public.batch_ingredient_lots TO service_role;
ALTER TABLE public.batch_ingredient_lots ENABLE ROW LEVEL SECURITY;

-- Plano de produção consolidado (pedidos confirmados).
CREATE OR REPLACE VIEW public.v_production_plan WITH (security_invoker = on) AS
SELECT cd.cycle_id, cd.id AS cycle_day_id, cd.production_date, cd.delivery_date, d.id AS dish_id, d.name AS dish_name, d.meal_type,
       sum(oi.quantity)::int AS portions,
       count(DISTINCT o.id)::int AS orders,
       (SELECT b.id FROM public.production_batches b WHERE b.cycle_day_id = cd.id AND b.dish_id = d.id) AS batch_id,
       (SELECT b.lot_code FROM public.production_batches b WHERE b.cycle_day_id = cd.id AND b.dish_id = d.id) AS batch_lot_code,
       (SELECT b.status FROM public.production_batches b WHERE b.cycle_day_id = cd.id AND b.dish_id = d.id) AS batch_status
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id AND o.status IN ('confirmado','em_producao','pronto','separado','em_rota','entregue')
  JOIN public.menu_cycle_days cd ON cd.id = oi.cycle_day_id
  JOIN public.dishes d ON d.id = oi.dish_id
 GROUP BY cd.id, d.id;

-- Ordem de produção: ingredientes necessários por prato/dia a partir da ficha técnica.
CREATE OR REPLACE VIEW public.v_production_ingredients WITH (security_invoker = on) AS
SELECT pp.cycle_id, pp.cycle_day_id, pp.production_date, pp.dish_id, pp.dish_name, pp.portions,
       i.id AS ingredient_id, i.name AS ingredient_name, i.usage_unit,
       round(di.quantity * pp.portions / d.portions, 3) AS gross_quantity,
       COALESCE(di.prep_loss_pct, 1 - i.yield_pct) AS prep_loss_pct
  FROM public.v_production_plan pp
  JOIN public.dishes d ON d.id = pp.dish_id
  JOIN public.dish_items di ON di.dish_id = d.id
  JOIN public.ingredients i ON i.id = di.ingredient_id;

-- Lista de compras: o que ainda depende de compra prevista ou falta comprar.
CREATE OR REPLACE VIEW public.v_shopping_list WITH (security_invoker = on) AS
SELECT o.cycle_id, i.id AS ingredient_id, i.name AS ingredient_name, i.usage_unit, i.purchase_unit, i.conversion_factor,
       sum(sr.quantity) FILTER (WHERE sr.status IN ('ativa','consumida')) AS needed,
       COALESCE(sum(sr.quantity) FILTER (WHERE sr.status = 'ativa' AND sr.lot_id IS NOT NULL), 0) AS reserved_in_stock,
       COALESCE(sum(sr.quantity) FILTER (WHERE sr.status = 'ativa' AND sr.lot_id IS NULL), 0) AS awaiting_purchase,
       COALESCE(sum(sr.quantity) FILTER (WHERE sr.status = 'consumida'), 0) AS consumed,
       min(sr.needed_by) FILTER (WHERE sr.status = 'ativa' AND sr.lot_id IS NULL) AS first_needed_by
  FROM public.stock_reservations sr
  JOIN public.orders o ON o.id = sr.order_id AND o.status NOT IN ('cancelado','expirado')
  JOIN public.ingredients i ON i.id = sr.ingredient_id
 GROUP BY o.cycle_id, i.id;

CREATE OR REPLACE FUNCTION public.start_production(p_cycle_day_id uuid, p_dish_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cd public.menu_cycle_days%ROWTYPE; d public.dishes%ROWTYPE; v_portions int; v_batch uuid; v_code text;
  r record; v_pending text;
BEGIN
  IF NOT public.has_any_role(ARRAY['cozinha','operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO cd FROM public.menu_cycle_days WHERE id = p_cycle_day_id;
  SELECT * INTO d FROM public.dishes WHERE id = p_dish_id;
  IF EXISTS (SELECT 1 FROM public.production_batches WHERE cycle_day_id = cd.id AND dish_id = d.id) THEN
    RAISE EXCEPTION 'Lote de produção já iniciado para este prato e dia';
  END IF;
  SELECT COALESCE(sum(oi.quantity), 0) INTO v_portions FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
   WHERE oi.cycle_day_id = cd.id AND oi.dish_id = d.id AND o.status IN ('confirmado','em_producao') AND oi.production_batch_id IS NULL;
  IF v_portions = 0 THEN RAISE EXCEPTION 'Não há porções confirmadas para produzir'; END IF;

  SELECT string_agg(DISTINCT i.name, ', ') INTO v_pending
    FROM public.stock_reservations sr JOIN public.order_items oi ON oi.id = sr.order_item_id
    JOIN public.orders o ON o.id = oi.order_id JOIN public.ingredients i ON i.id = sr.ingredient_id
   WHERE oi.cycle_day_id = cd.id AND oi.dish_id = d.id AND o.status IN ('confirmado','em_producao') AND oi.production_batch_id IS NULL
     AND sr.status = 'ativa' AND sr.lot_id IS NULL;
  IF v_pending IS NOT NULL THEN RAISE EXCEPTION 'Aguardando recebimento de: %', v_pending; END IF;

  v_code := 'P' || to_char(cd.production_date, 'YYMMDD') || '-' || upper(COALESCE(d.code, substr(replace(d.id::text, '-', ''), 1, 4)));
  INSERT INTO public.production_batches (lot_code, dish_id, dish_version, cycle_day_id, production_date, portions_planned, expires_at, storage_instructions)
  VALUES (v_code, d.id, d.version, cd.id, cd.production_date, v_portions, cd.production_date + d.shelf_life_days, d.storage_instructions)
  RETURNING id INTO v_batch;

  FOR r IN SELECT sr.* FROM public.stock_reservations sr JOIN public.order_items oi ON oi.id = sr.order_item_id
             JOIN public.orders o ON o.id = oi.order_id
            WHERE oi.cycle_day_id = cd.id AND oi.dish_id = d.id AND o.status IN ('confirmado','em_producao')
              AND oi.production_batch_id IS NULL AND sr.status = 'ativa'
            FOR UPDATE OF sr LOOP
    UPDATE public.ingredient_lots SET quantity_on_hand = quantity_on_hand - r.quantity,
           status = CASE WHEN quantity_on_hand - r.quantity <= 0 THEN 'esgotado' ELSE status END
     WHERE id = r.lot_id;
    INSERT INTO public.stock_movements (ingredient_id, lot_id, kind, quantity, unit_cost, reason, reference)
    SELECT r.ingredient_id, r.lot_id, 'consumo', -r.quantity, l.unit_cost, 'Produção', v_code FROM public.ingredient_lots l WHERE l.id = r.lot_id;
    INSERT INTO public.batch_ingredient_lots (batch_id, lot_id, ingredient_id, quantity)
    VALUES (v_batch, r.lot_id, r.ingredient_id, r.quantity)
    ON CONFLICT (batch_id, lot_id) DO UPDATE SET quantity = public.batch_ingredient_lots.quantity + EXCLUDED.quantity;
    UPDATE public.stock_reservations SET status = 'consumida' WHERE id = r.id;
  END LOOP;

  UPDATE public.order_items oi SET production_batch_id = v_batch
    FROM public.orders o WHERE o.id = oi.order_id AND oi.cycle_day_id = cd.id AND oi.dish_id = d.id
     AND o.status IN ('confirmado','em_producao') AND oi.production_batch_id IS NULL;
  UPDATE public.orders o SET status = 'em_producao', updated_at = now()
   WHERE o.status = 'confirmado' AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.production_batch_id = v_batch);
  UPDATE public.menu_cycles SET status = 'producao' WHERE id = cd.cycle_id AND status = 'corte';
  RETURN v_batch;
END $$;

CREATE OR REPLACE FUNCTION public.complete_batch(p_batch_id uuid, p_portions_produced int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(ARRAY['cozinha','operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  UPDATE public.production_batches SET status = 'concluido', portions_produced = p_portions_produced, completed_at = now()
   WHERE id = p_batch_id AND status = 'em_producao';
  -- Pedido fica pronto quando todos os seus itens estão em lotes concluídos.
  UPDATE public.orders o SET status = 'pronto', updated_at = now()
   WHERE o.status = 'em_producao'
     AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id AND oi.production_batch_id = p_batch_id)
     AND NOT EXISTS (SELECT 1 FROM public.order_items oi LEFT JOIN public.production_batches b ON b.id = oi.production_batch_id
                      WHERE oi.order_id = o.id AND (b.id IS NULL OR b.status <> 'concluido'));
END $$;

CREATE OR REPLACE FUNCTION public.set_order_status(p_order_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cur text;
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT status INTO v_cur FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT ((v_cur = 'pronto' AND p_status = 'separado') OR (v_cur = 'separado' AND p_status = 'em_rota')
       OR (v_cur = 'em_rota' AND p_status = 'entregue') OR (v_cur = 'separado' AND p_status = 'entregue')) THEN
    RAISE EXCEPTION 'Transição inválida: % → %', v_cur, p_status;
  END IF;
  UPDATE public.orders SET status = p_status, updated_at = now() WHERE id = p_order_id;
END $$;

-- Etiquetas: prato, lote, preparo, validade e conservação.
CREATE OR REPLACE VIEW public.v_batch_labels WITH (security_invoker = on) AS
SELECT b.id AS batch_id, b.lot_code, b.production_date, b.expires_at, b.storage_instructions, b.portions_planned, b.portions_produced, b.status,
       d.name AS dish_name, d.meal_type, f.kcal, f.protein_g, f.carbs_g, f.fat_g, f.portion_weight_g, f.allergens, f.may_contain,
       cd.delivery_date
  FROM public.production_batches b
  JOIN public.dishes d ON d.id = b.dish_id
  JOIN public.v_dish_facts f ON f.dish_id = d.id
  JOIN public.menu_cycle_days cd ON cd.id = b.cycle_day_id;

-- Rastreabilidade nos dois sentidos.
CREATE OR REPLACE VIEW public.v_trace AS
SELECT o.id AS order_id, o.code AS order_code, o.customer_id, o.status AS order_status,
       oi.id AS order_item_id, d.name AS dish_name, cd.delivery_date,
       b.id AS batch_id, b.lot_code AS batch_lot_code, b.production_date, b.expires_at AS batch_expires_at,
       il.id AS ingredient_lot_id, il.lot_code AS ingredient_lot_code, i.name AS ingredient_name, il.expires_at AS ingredient_lot_expires_at,
       s.name AS supplier_name, bil.quantity AS batch_lot_quantity
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.dishes d ON d.id = oi.dish_id
  JOIN public.menu_cycle_days cd ON cd.id = oi.cycle_day_id
  JOIN public.production_batches b ON b.id = oi.production_batch_id
  LEFT JOIN public.batch_ingredient_lots bil ON bil.batch_id = b.id
  LEFT JOIN public.ingredient_lots il ON il.id = bil.lot_id
  LEFT JOIN public.ingredients i ON i.id = il.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = il.supplier_id;
ALTER VIEW public.v_trace SET (security_invoker = on);

-- Cozinha: só as restrições relevantes ao preparo (sem peso, altura, objetivos).
CREATE OR REPLACE FUNCTION public.kitchen_restrictions(p_cycle_day_id uuid)
RETURNS TABLE (order_code text, customer_label text, dish_name text, quantity int, allergies text[], restrictions text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_any_role(ARRAY['cozinha','operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  SELECT o.code, COALESCE(split_part(a.full_name, ' ', 1), 'Cliente') || ' · ' || right(o.code, 4),
         d.name, oi.quantity, p.allergies, p.restrictions
    FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    JOIN public.dishes d ON d.id = oi.dish_id
    LEFT JOIN public.customer_accounts a ON a.customer_id = o.customer_id
    LEFT JOIN public.customer_profiles p ON p.customer_id = o.customer_id
   WHERE oi.cycle_day_id = p_cycle_day_id AND o.status IN ('confirmado','em_producao','pronto')
     AND (cardinality(p.allergies) > 0 OR cardinality(p.restrictions) > 0)
   ORDER BY d.name, o.code;
END $$;

-- ---------------------------------------------------------------------
-- 5. Visões financeiras
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_finance_payments WITH (security_invoker = on) AS
SELECT p.*, o.code AS order_code, o.cycle_id, po.payout_ref, po.payout_date,
       CASE WHEN p.status = 'aprovado' AND p.payout_id IS NULL THEN 'a_receber'
            WHEN p.status = 'aprovado' AND p.payout_id IS NOT NULL THEN 'recebido'
            ELSE p.status END AS cash_status
  FROM public.payments p JOIN public.orders o ON o.id = p.order_id
  LEFT JOIN public.provider_payouts po ON po.id = p.payout_id;

CREATE OR REPLACE VIEW public.v_payout_reconciliation WITH (security_invoker = on) AS
SELECT po.id AS payout_id, po.payout_ref, po.payout_date, po.provider,
       po.gross_amount AS reported_gross, po.fee_amount AS reported_fees, po.refund_amount AS reported_refunds, po.net_amount AS deposited_net,
       COALESCE(sum(p.amount) FILTER (WHERE p.status IN ('aprovado','reembolsado','contestado')), 0) AS sales_gross,
       COALESCE(sum(p.fee_amount), 0) AS sales_fees,
       COALESCE(sum(p.amount) FILTER (WHERE p.status = 'reembolsado'), 0) AS sales_refunds,
       COALESCE(sum(p.amount) FILTER (WHERE p.status IN ('aprovado','reembolsado','contestado')), 0) - COALESCE(sum(p.fee_amount), 0)
         - COALESCE(sum(p.amount) FILTER (WHERE p.status = 'reembolsado'), 0) AS expected_net,
       po.net_amount - (COALESCE(sum(p.amount) FILTER (WHERE p.status IN ('aprovado','reembolsado','contestado')), 0) - COALESCE(sum(p.fee_amount), 0)
         - COALESCE(sum(p.amount) FILTER (WHERE p.status = 'reembolsado'), 0)) AS difference,
       count(p.id)::int AS payments
  FROM public.provider_payouts po LEFT JOIN public.payments p ON p.payout_id = po.id
 GROUP BY po.id;

-- Registra um repasse e vincula os pagamentos aprovados ainda não repassados.
CREATE OR REPLACE FUNCTION public.register_payout(p_payout_ref text, p_payout_date date, p_net_amount numeric, p_payment_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.has_any_role(ARRAY['financeiro']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  INSERT INTO public.provider_payouts (payout_ref, payout_date, net_amount) VALUES (p_payout_ref, p_payout_date, p_net_amount)
  RETURNING id INTO v_id;
  UPDATE public.payments SET payout_id = v_id WHERE id = ANY(p_payment_ids) AND payout_id IS NULL
     AND status IN ('aprovado','reembolsado','contestado');
  UPDATE public.provider_payouts po SET
    gross_amount = x.gross, fee_amount = x.fees, refund_amount = x.refunds
    FROM (SELECT COALESCE(sum(amount), 0) gross, COALESCE(sum(fee_amount), 0) fees,
                 COALESCE(sum(amount) FILTER (WHERE status = 'reembolsado'), 0) refunds
            FROM public.payments WHERE payout_id = v_id) x
   WHERE po.id = v_id;
  UPDATE public.financial_entries SET status = 'liquidado', settled_date = p_payout_date, payout_id = v_id
   WHERE payment_id = ANY(p_payment_ids) AND kind IN ('receita_venda','taxa_pagamento','reembolso');
  RETURN v_id;
END $$;

CREATE OR REPLACE VIEW public.v_dish_margin WITH (security_invoker = on) AS
SELECT oi.dish_id, d.name AS dish_name, date_trunc('month', o.created_at)::date AS month,
       sum(oi.quantity)::int AS portions,
       sum(oi.quantity * oi.unit_price) AS revenue,
       sum(oi.quantity * f.cost_per_portion) AS expected_cost,
       sum(oi.quantity * oi.unit_price) - sum(oi.quantity * f.cost_per_portion) AS gross_margin
  FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelado','expirado','aguardando_pagamento')
  JOIN public.dishes d ON d.id = oi.dish_id
  JOIN public.v_dish_facts f ON f.dish_id = d.id
 GROUP BY oi.dish_id, d.name, 3;

CREATE OR REPLACE VIEW public.v_batch_cost WITH (security_invoker = on) AS
SELECT b.id AS batch_id, b.lot_code, b.dish_id, b.production_date, b.portions_planned, COALESCE(b.portions_produced, b.portions_planned) AS portions,
       f.cost_per_portion * b.portions_planned AS expected_cost,
       COALESCE((SELECT sum(bil.quantity * il.unit_cost) FROM public.batch_ingredient_lots bil JOIN public.ingredient_lots il ON il.id = bil.lot_id
                  WHERE bil.batch_id = b.id), 0)
         + (f.packaging_cost_per_portion + f.labor_cost_per_portion) * COALESCE(b.portions_produced, b.portions_planned) AS actual_cost
  FROM public.production_batches b JOIN public.v_dish_facts f ON f.dish_id = b.dish_id;

-- ---------------------------------------------------------------------
-- 6. Plano alimentar individualizado (nutricionista aprova e publica)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nutrition_parameters (
  goal text NOT NULL CHECK (goal IN ('manutencao','hipertrofia','reducao_peso')),
  activity_level text NOT NULL CHECK (activity_level IN ('baixo','moderado','alto')),
  kcal_per_kg numeric(6,2) NOT NULL,
  protein_g_per_kg numeric(5,2) NOT NULL,
  carbs_pct numeric(5,4) NOT NULL,
  fat_pct numeric(5,4) NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal, activity_level)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_parameters TO authenticated;
GRANT ALL ON public.nutrition_parameters TO service_role;
ALTER TABLE public.nutrition_parameters ENABLE ROW LEVEL SECURITY;
-- Valores iniciais de exemplo: o nutricionista responsável deve revisar antes do uso.
INSERT INTO public.nutrition_parameters (goal, activity_level, kcal_per_kg, protein_g_per_kg, carbs_pct, fat_pct) VALUES
  ('manutencao','baixo',28,1.4,0.45,0.30), ('manutencao','moderado',31,1.6,0.47,0.28), ('manutencao','alto',35,1.8,0.50,0.25),
  ('hipertrofia','baixo',32,1.8,0.47,0.25), ('hipertrofia','moderado',36,2.0,0.50,0.25), ('hipertrofia','alto',40,2.2,0.52,0.23),
  ('reducao_peso','baixo',23,1.8,0.40,0.30), ('reducao_peso','moderado',26,2.0,0.40,0.28), ('reducao_peso','alto',29,2.0,0.42,0.27)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  version int NOT NULL,
  status text NOT NULL DEFAULT 'proposta' CHECK (status IN ('proposta','em_revisao','publicado','substituido','descartado')),
  origin text NOT NULL DEFAULT 'solicitacao',
  profile_snapshot jsonb NOT NULL DEFAULT '{}',
  targets jsonb NOT NULL DEFAULT '{}',
  meal_distribution jsonb NOT NULL DEFAULT '[]',
  portion_adjustments jsonb NOT NULL DEFAULT '[]',
  substitutions jsonb NOT NULL DEFAULT '[]',
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nutrition_plans TO authenticated;
GRANT ALL ON public.nutrition_plans TO service_role;
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._generate_plan_proposal(p_customer_id uuid, p_origin text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.customer_profiles%ROWTYPE; np public.nutrition_parameters%ROWTYPE; v_kcal numeric; v_prot numeric;
        v_id uuid; v_dist jsonb := '[]'; v_meals text[]; v_share numeric; mt text;
BEGIN
  SELECT * INTO p FROM public.customer_profiles WHERE customer_id = p_customer_id;
  IF p.weight_kg IS NULL OR p.height_cm IS NULL THEN RAISE EXCEPTION 'Preencha peso e altura no perfil'; END IF;
  SELECT * INTO np FROM public.nutrition_parameters WHERE goal = p.goal AND activity_level = p.activity_level;
  v_kcal := round(p.weight_kg * np.kcal_per_kg);
  v_prot := round(p.weight_kg * np.protein_g_per_kg);
  v_meals := COALESCE(NULLIF(p.meal_types, '{}'), '{almoco}');
  FOREACH mt IN ARRAY v_meals LOOP
    -- parcela do dia coberta pelo kit (as demais refeições ficam a cargo do cliente)
    v_share := CASE mt WHEN 'almoco' THEN 0.35 WHEN 'jantar' THEN 0.30 ELSE 0.12 END;
    v_dist := v_dist || jsonb_build_object('meal_type', mt, 'pct', v_share, 'kcal', round(v_kcal * v_share), 'protein_g', round(v_prot * v_share));
  END LOOP;
  -- descarta propostas antigas não publicadas
  UPDATE public.nutrition_plans SET status = 'descartado' WHERE customer_id = p_customer_id AND status IN ('proposta','em_revisao');
  INSERT INTO public.nutrition_plans (customer_id, version, origin, profile_snapshot, targets, meal_distribution)
  VALUES (p_customer_id,
          COALESCE((SELECT max(version) FROM public.nutrition_plans WHERE customer_id = p_customer_id), 0) + 1,
          p_origin,
          jsonb_build_object('weight_kg', p.weight_kg, 'height_cm', p.height_cm, 'age_range', p.age_range, 'goal', p.goal,
                             'activity_level', p.activity_level, 'training_frequency', p.training_frequency, 'training_type', p.training_type,
                             'allergies', p.allergies, 'restrictions', p.restrictions, 'meal_types', p.meal_types),
          jsonb_build_object('kcal', v_kcal, 'protein_g', v_prot,
                             'carbs_g', round(v_kcal * np.carbs_pct / 4), 'fat_g', round(v_kcal * np.fat_pct / 9)),
          v_dist)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.request_nutrition_plan()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  UPDATE public.customer_profiles SET personalization_mode = 'plano_individual' WHERE customer_id = auth.uid();
  RETURN public._generate_plan_proposal(auth.uid(), 'solicitacao');
END $$;

-- Nutricionista revisa (porções, metas, distribuição e substituições) e publica.
CREATE OR REPLACE FUNCTION public.review_nutrition_plan(p_plan_id uuid, p_targets jsonb, p_meal_distribution jsonb,
  p_portion_adjustments jsonb, p_substitutions jsonb, p_notes text, p_publish boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.nutrition_plans%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(ARRAY['nutricionista']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Somente o nutricionista revisa e publica planos';
  END IF;
  SELECT * INTO pl FROM public.nutrition_plans WHERE id = p_plan_id FOR UPDATE;
  IF pl.status NOT IN ('proposta','em_revisao') THEN
    RAISE EXCEPTION 'Plano publicado não pode ser alterado: gere uma nova revisão';
  END IF;
  UPDATE public.nutrition_plans SET targets = COALESCE(p_targets, targets), meal_distribution = COALESCE(p_meal_distribution, meal_distribution),
         portion_adjustments = COALESCE(p_portion_adjustments, portion_adjustments), substitutions = COALESCE(p_substitutions, substitutions),
         notes = p_notes, reviewed_by = auth.uid(), reviewed_at = now(),
         status = CASE WHEN p_publish THEN 'publicado' ELSE 'em_revisao' END,
         published_at = CASE WHEN p_publish THEN now() END
   WHERE id = pl.id;
  IF p_publish THEN
    UPDATE public.nutrition_plans SET status = 'substituido'
     WHERE customer_id = pl.customer_id AND status = 'publicado' AND id <> pl.id;
    INSERT INTO public.notifications (customer_id, kind, message)
    VALUES (pl.customer_id, 'plano', 'Seu plano alimentar (versão ' || pl.version || ') foi revisado e publicado pelo nutricionista.');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.revise_nutrition_plan(p_plan_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.nutrition_plans%ROWTYPE; v_id uuid;
BEGIN
  IF NOT public.has_any_role(ARRAY['nutricionista']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO pl FROM public.nutrition_plans WHERE id = p_plan_id;
  UPDATE public.nutrition_plans SET status = 'descartado' WHERE customer_id = pl.customer_id AND status IN ('proposta','em_revisao');
  INSERT INTO public.nutrition_plans (customer_id, version, origin, profile_snapshot, targets, meal_distribution, portion_adjustments, substitutions, notes)
  VALUES (pl.customer_id, (SELECT max(version) + 1 FROM public.nutrition_plans WHERE customer_id = pl.customer_id), 'revisao_nutricionista',
          pl.profile_snapshot, pl.targets, pl.meal_distribution, pl.portion_adjustments, pl.substitutions, pl.notes)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Mudança relevante no perfil gera nova revisão do plano.
CREATE OR REPLACE FUNCTION public.profile_change_requires_plan_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.personalization_mode = 'plano_individual'
     AND EXISTS (SELECT 1 FROM public.nutrition_plans WHERE customer_id = NEW.customer_id AND status IN ('publicado','proposta','em_revisao'))
     AND (abs(COALESCE(NEW.weight_kg, 0) - COALESCE(OLD.weight_kg, 0)) >= 2
          OR NEW.goal IS DISTINCT FROM OLD.goal OR NEW.activity_level IS DISTINCT FROM OLD.activity_level
          OR NEW.allergies IS DISTINCT FROM OLD.allergies OR NEW.restrictions IS DISTINCT FROM OLD.restrictions
          OR NEW.meal_types IS DISTINCT FROM OLD.meal_types OR NEW.training_frequency IS DISTINCT FROM OLD.training_frequency) THEN
    PERFORM public._generate_plan_proposal(NEW.customer_id, 'alteracao_perfil');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS customer_profiles_plan_review ON public.customer_profiles;
CREATE TRIGGER customer_profiles_plan_review AFTER UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_change_requires_plan_review();

-- ---------------------------------------------------------------------
-- 7. LGPD: acesso, correção e exclusão
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('acesso','correcao','exclusao')),
  details text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_atendimento','concluida','recusada')),
  response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.privacy_requests TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'gerado_em', now(),
    'conta', (SELECT to_jsonb(a) FROM public.customer_accounts a WHERE a.customer_id = auth.uid()),
    'perfil_alimentar', (SELECT to_jsonb(p) FROM public.customer_profiles p WHERE p.customer_id = auth.uid()),
    'planos', (SELECT COALESCE(jsonb_agg(to_jsonb(n)), '[]') FROM public.nutrition_plans n WHERE n.customer_id = auth.uid() AND n.status IN ('publicado','substituido')),
    'assinaturas', (SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]') FROM public.subscriptions s WHERE s.customer_id = auth.uid()),
    'pedidos', (SELECT COALESCE(jsonb_agg(to_jsonb(o)), '[]') FROM public.orders o WHERE o.customer_id = auth.uid()),
    'pagamentos', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'status', p.status, 'valor', p.amount, 'metodo', p.method, 'pago_em', p.paid_at)), '[]')
                     FROM public.payments p WHERE p.customer_id = auth.uid()),
    'solicitacoes_privacidade', (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') FROM public.privacy_requests r WHERE r.customer_id = auth.uid())
  )
$$;

-- Exclusão: apaga perfil alimentar e planos; mantém pedidos e pagamentos anonimizados (obrigação fiscal).
CREATE OR REPLACE FUNCTION public.anonymize_customer(p_customer_id uuid, p_request_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(ARRAY['admin']::public.platform_role[]) THEN RAISE EXCEPTION 'Somente o administrador executa exclusões'; END IF;
  UPDATE public.subscriptions SET status = 'cancelada', cancelled_at = now() WHERE customer_id = p_customer_id AND status <> 'cancelada';
  DELETE FROM public.nutrition_plans WHERE customer_id = p_customer_id;
  UPDATE public.customer_profiles SET weight_kg = NULL, height_cm = NULL, age_range = NULL, training_frequency = NULL, training_type = NULL,
         preferences = '{}', avoid_ingredient_ids = '{}', allergies = '{}', restrictions = '{}', consent_at = NULL
   WHERE customer_id = p_customer_id;
  UPDATE public.customer_accounts SET full_name = 'Titular removido', phone = NULL, address = NULL, delivery_notes = NULL, anonymized_at = now()
   WHERE customer_id = p_customer_id;
  UPDATE public.orders SET delivery_address = NULL WHERE customer_id = p_customer_id;
  IF p_request_id IS NOT NULL THEN
    UPDATE public.privacy_requests SET status = 'concluida', resolved_at = now(), resolved_by = auth.uid(),
           response = 'Dados pessoais e alimentares removidos; registros fiscais mantidos de forma anonimizada.'
     WHERE id = p_request_id;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 8. Auditoria nas tabelas sensíveis
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customer_profiles','customer_accounts','nutrition_plans','dishes','dish_items','dish_prices',
                           'platform_settings','platform_user_roles','orders','payments','subscriptions','ingredient_lots',
                           'nutrition_parameters','privacy_requests'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
    EXECUTE format('CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.audit_row()', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS customer_accounts_touch ON public.customer_accounts;
CREATE TRIGGER customer_accounts_touch BEFORE UPDATE ON public.customer_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_row_updated_at();
DROP TRIGGER IF EXISTS customer_profiles_touch ON public.customer_profiles;
CREATE TRIGGER customer_profiles_touch BEFORE UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_row_updated_at();
DROP TRIGGER IF EXISTS ingredients_touch ON public.ingredients;
CREATE TRIGGER ingredients_touch BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.touch_row_updated_at();
