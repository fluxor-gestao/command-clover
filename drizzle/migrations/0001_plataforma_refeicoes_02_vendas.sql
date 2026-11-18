-- =====================================================================
-- Plataforma de refeições — 02: cardápio semanal, preços, assinaturas,
-- pedidos, reserva de insumos/capacidade e pagamentos idempotentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Ciclos semanais e cardápio
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sales_start timestamptz NOT NULL,
  cutoff_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aberto','corte','producao','encerrado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cutoff_at > sales_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_cycles TO authenticated;
GRANT ALL ON public.menu_cycles TO service_role;
ALTER TABLE public.menu_cycles ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.menu_cycle_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.menu_cycles(id) ON DELETE CASCADE,
  production_date date NOT NULL,
  delivery_date date NOT NULL,
  capacity_portions int NOT NULL CHECK (capacity_portions >= 0),
  UNIQUE (cycle_id, delivery_date),
  CHECK (delivery_date >= production_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_cycle_days TO authenticated;
GRANT ALL ON public.menu_cycle_days TO service_role;
ALTER TABLE public.menu_cycle_days ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.menu_cycles(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES public.dishes(id),
  max_portions int CHECK (max_portions >= 0),
  UNIQUE (cycle_id, dish_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2. Preços (aprovados pelo gestor) e planos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dish_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL CHECK (price > 0),
  suggested_price numeric(12,2),
  cost_snapshot jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'proposto' CHECK (status IN ('proposto','aprovado','rejeitado')),
  valid_from date NOT NULL DEFAULT current_date,
  created_by uuid DEFAULT auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dish_prices TO authenticated;
GRANT ALL ON public.dish_prices TO service_role;
ALTER TABLE public.dish_prices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS dish_prices_lookup_idx ON public.dish_prices (dish_id, status, valid_from DESC);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  meal_types text[] NOT NULL DEFAULT '{almoco}',
  discount_pct numeric(6,4) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct < 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
INSERT INTO public.subscription_plans (name, description, meal_types, discount_pct)
SELECT * FROM (VALUES
  ('Avulso', 'Kit da semana sem recorrência', '{almoco,jantar,lanche}'::text[], 0::numeric),
  ('Semanal Almoço', 'Almoços de segunda a sexta, cobrança semanal', '{almoco}'::text[], 0.05::numeric),
  ('Semanal Completo', 'Almoço, jantar e lanche, cobrança semanal', '{almoco,jantar,lanche}'::text[], 0.10::numeric)
) v WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans);

CREATE OR REPLACE FUNCTION public.current_dish_price(p_dish_id uuid, p_on date DEFAULT current_date)
RETURNS TABLE (price_id uuid, price numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, price FROM public.dish_prices
   WHERE dish_id = p_dish_id AND status = 'aprovado' AND valid_from <= p_on
   ORDER BY valid_from DESC, approved_at DESC LIMIT 1
$$;

-- Composição do preço: custo, taxas, tributos, entrega e margem.
CREATE OR REPLACE FUNCTION public.price_breakdown(p_dish_id uuid, p_discount_pct numeric DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.platform_settings%ROWTYPE;
  f record;
  v_delivery numeric;
  v_fee numeric;
  v_den numeric;
  v_suggested numeric;
  v_current numeric;
  v_net numeric;
  v_margin numeric;
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao','financeiro']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT * INTO s FROM public.platform_settings LIMIT 1;
  SELECT * INTO f FROM public.v_dish_facts WHERE dish_id = p_dish_id;
  v_delivery := CASE WHEN s.delivery_included_in_price THEN s.delivery_cost_per_order / NULLIF(s.avg_portions_per_order, 0) ELSE 0 END;
  v_fee := s.card_fee_pct;
  v_den := 1 - v_fee - s.tax_pct - s.target_margin_pct;
  v_suggested := CASE WHEN v_den > 0 THEN round(ceil(((f.cost_per_portion + COALESCE(v_delivery,0)) / v_den) * 10) / 10, 2) END;
  SELECT cp.price INTO v_current FROM public.current_dish_price(p_dish_id) cp;
  v_net := COALESCE(v_current, v_suggested) * (1 - COALESCE(p_discount_pct, 0));
  v_margin := CASE WHEN v_net > 0 THEN (v_net * (1 - v_fee - s.tax_pct) - f.cost_per_portion - COALESCE(v_delivery,0)) / v_net END;
  RETURN jsonb_build_object(
    'dish_id', p_dish_id,
    'ingredients', f.ingredient_cost_per_portion,
    'packaging', f.packaging_cost_per_portion,
    'labor', f.labor_cost_per_portion,
    'cost_per_portion', f.cost_per_portion,
    'delivery_per_portion', round(COALESCE(v_delivery,0), 4),
    'payment_fee_pct', v_fee,
    'tax_pct', s.tax_pct,
    'target_margin_pct', s.target_margin_pct,
    'min_margin_pct', s.min_margin_pct,
    'suggested_price', v_suggested,
    'current_price', v_current,
    'discount_pct', COALESCE(p_discount_pct, 0),
    'net_price', round(v_net, 2),
    'contribution_margin_pct', round(v_margin, 4),
    'below_min_margin', COALESCE(v_margin < s.min_margin_pct, false)
  );
END $$;

CREATE OR REPLACE FUNCTION public.propose_dish_price(p_dish_id uuid, p_price numeric, p_valid_from date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_b jsonb;
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao','financeiro']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  v_b := public.price_breakdown(p_dish_id);
  INSERT INTO public.dish_prices (dish_id, price, suggested_price, cost_snapshot, valid_from)
  VALUES (p_dish_id, p_price, (v_b->>'suggested_price')::numeric, v_b, p_valid_from) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.approve_dish_price(p_price_id uuid, p_approve boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.dish_prices%ROWTYPE;
BEGIN
  IF NOT public.has_any_role(ARRAY['admin','financeiro']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Somente o gestor aprova preços';
  END IF;
  UPDATE public.dish_prices SET status = CASE WHEN p_approve THEN 'aprovado' ELSE 'rejeitado' END,
         approved_by = auth.uid(), approved_at = now()
   WHERE id = p_price_id AND status = 'proposto' RETURNING * INTO r;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Preço não está pendente de aprovação'; END IF;
END $$;

-- Mudanças de preço já aprovadas para datas futuras (exibidas ao cliente antes de valer).
CREATE OR REPLACE VIEW public.v_upcoming_price_changes AS
SELECT p.dish_id, d.name AS dish_name, p.price AS new_price, p.valid_from,
       (SELECT cp.price FROM public.current_dish_price(p.dish_id) cp) AS current_price
  FROM public.dish_prices p JOIN public.dishes d ON d.id = p.dish_id
 WHERE p.status = 'aprovado' AND p.valid_from > current_date;

-- ---------------------------------------------------------------------
-- 3. Assinaturas (controle separado do pedido semanal)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','cancelada','inadimplente')),
  payment_method text NOT NULL DEFAULT 'cartao' CHECK (payment_method IN ('cartao','pix','pix_automatico')),
  provider_subscription_id text,
  kit_template jsonb NOT NULL DEFAULT '[]',
  paused_until date,
  started_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_idx ON public.subscriptions (customer_id)
  WHERE status IN ('ativa','pausada','inadimplente');

-- ---------------------------------------------------------------------
-- 4. Pedidos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL DEFAULT ('PED-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  customer_id uuid NOT NULL,
  cycle_id uuid NOT NULL REFERENCES public.menu_cycles(id),
  subscription_id uuid REFERENCES public.subscriptions(id),
  status text NOT NULL DEFAULT 'aguardando_pagamento' CHECK (status IN (
    'aguardando_pagamento','confirmado','em_producao','pronto','separado','em_rota','entregue','cancelado','expirado')),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  pricing_snapshot jsonb NOT NULL DEFAULT '{}',
  payment_method text,
  delivery_address text,
  needs_attention text,
  cancel_reason text,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
-- Um único pedido válido por ciclo de assinatura.
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_per_subscription_cycle ON public.orders (subscription_id, cycle_id)
  WHERE subscription_id IS NOT NULL AND status NOT IN ('cancelado','expirado');

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES public.dishes(id),
  cycle_day_id uuid NOT NULL REFERENCES public.menu_cycle_days(id),
  meal_type text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL,
  production_batch_id uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS order_items_day_dish_idx ON public.order_items (cycle_day_id, dish_id);

CREATE TABLE IF NOT EXISTS public.subscription_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.menu_cycles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado','pulado','pedido_gerado','falhou','cancelado')),
  order_id uuid REFERENCES public.orders(id),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, cycle_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_cycles TO authenticated;
GRANT ALL ON public.subscription_cycles TO service_role;
ALTER TABLE public.subscription_cycles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  lot_id uuid REFERENCES public.ingredient_lots(id),
  purchase_item_id uuid REFERENCES public.purchase_order_items(id),
  quantity numeric(14,4) NOT NULL CHECK (quantity > 0),
  needed_by date NOT NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','consumida','liberada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  CHECK (lot_id IS NOT NULL OR purchase_item_id IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_reservations TO authenticated;
GRANT ALL ON public.stock_reservations TO service_role;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS stock_reservations_lot_idx ON public.stock_reservations (lot_id) WHERE status = 'ativa';
CREATE INDEX IF NOT EXISTS stock_reservations_po_idx ON public.stock_reservations (purchase_item_id) WHERE status = 'ativa';

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  kind text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Saldos por lote: físico, reservado e disponível.
CREATE OR REPLACE VIEW public.v_stock_lots WITH (security_invoker = on) AS
SELECT l.*, i.name AS ingredient_name, i.usage_unit, s.name AS supplier_name,
       COALESCE(r.reserved, 0) AS quantity_reserved,
       GREATEST(l.quantity_on_hand - COALESCE(r.reserved, 0), 0) AS quantity_available,
       (l.expires_at IS NOT NULL AND l.expires_at < current_date) AS is_expired,
       (l.expires_at IS NOT NULL AND l.expires_at >= current_date
          AND l.expires_at <= current_date + (SELECT expiry_alert_days FROM public.platform_settings LIMIT 1)) AS expiring_soon
  FROM public.ingredient_lots l
  JOIN public.ingredients i ON i.id = l.ingredient_id
  LEFT JOIN public.suppliers s ON s.id = l.supplier_id
  LEFT JOIN (SELECT lot_id, sum(quantity) reserved FROM public.stock_reservations WHERE status = 'ativa' AND lot_id IS NOT NULL GROUP BY lot_id) r
    ON r.lot_id = l.id;

CREATE OR REPLACE VIEW public.v_stock_ingredients WITH (security_invoker = on) AS
SELECT i.id AS ingredient_id, i.name, i.usage_unit, i.unit_cost,
       COALESCE(sum(l.quantity_on_hand) FILTER (WHERE l.status <> 'bloqueado'), 0) AS physical,
       COALESCE(sum(l.quantity_reserved) FILTER (WHERE l.status <> 'bloqueado'), 0) AS reserved,
       COALESCE(sum(l.quantity_available) FILTER (WHERE l.status = 'disponivel' AND NOT l.is_expired), 0) AS available,
       COALESCE(sum(l.quantity_on_hand) FILTER (WHERE l.is_expired), 0) AS expired,
       COALESCE(sum(l.quantity_on_hand) FILTER (WHERE l.expiring_soon), 0) AS expiring_soon,
       (SELECT COALESCE(sum(poi.quantity - poi.quantity_received), 0)
          FROM public.purchase_order_items poi JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
         WHERE poi.ingredient_id = i.id AND po.status IN ('prevista','recebida_parcial')) AS pending_purchase,
       (SELECT COALESCE(sum(sr.quantity), 0) FROM public.stock_reservations sr
         WHERE sr.ingredient_id = i.id AND sr.status = 'ativa' AND sr.lot_id IS NULL) AS reserved_on_purchase
  FROM public.ingredients i
  LEFT JOIN public.v_stock_lots l ON l.ingredient_id = i.id
 GROUP BY i.id;

-- ---------------------------------------------------------------------
-- 5. Reserva de insumos (FEFO, com trava por ingrediente)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reserve_ingredient(
  p_order_id uuid, p_order_item_id uuid, p_ingredient_id uuid, p_qty numeric, p_needed_by date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_left numeric := p_qty;
  v_take numeric;
  l record;
  po record;
  v_name text;
BEGIN
  -- Serializa reservas concorrentes do mesmo ingrediente: dois pedidos nunca consomem o mesmo saldo.
  SELECT name INTO v_name FROM public.ingredients WHERE id = p_ingredient_id FOR UPDATE;

  FOR l IN
    SELECT il.id, il.quantity_on_hand - COALESCE((
             SELECT sum(sr.quantity) FROM public.stock_reservations sr WHERE sr.lot_id = il.id AND sr.status = 'ativa'), 0) AS avail
      FROM public.ingredient_lots il
     WHERE il.ingredient_id = p_ingredient_id AND il.status = 'disponivel'
       AND (il.expires_at IS NULL OR il.expires_at >= p_needed_by)
     ORDER BY il.expires_at NULLS LAST, il.received_at, il.created_at
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := least(l.avail, v_left);
    IF v_take > 0 THEN
      INSERT INTO public.stock_reservations (order_id, order_item_id, ingredient_id, lot_id, quantity, needed_by)
      VALUES (p_order_id, p_order_item_id, p_ingredient_id, l.id, v_take, p_needed_by);
      v_left := v_left - v_take;
    END IF;
  END LOOP;

  -- Compras previstas que chegam antes da produção entram como pendência.
  IF v_left > 0 THEN
    FOR po IN
      SELECT poi.id, poi.quantity - poi.quantity_received - COALESCE((
               SELECT sum(sr.quantity) FROM public.stock_reservations sr
                WHERE sr.purchase_item_id = poi.id AND sr.lot_id IS NULL AND sr.status = 'ativa'), 0) AS avail
        FROM public.purchase_order_items poi JOIN public.purchase_orders p ON p.id = poi.purchase_order_id
       WHERE poi.ingredient_id = p_ingredient_id AND p.status IN ('prevista','recebida_parcial')
         AND p.expected_date < p_needed_by
       ORDER BY p.expected_date
    LOOP
      EXIT WHEN v_left <= 0;
      v_take := least(po.avail, v_left);
      IF v_take > 0 THEN
        INSERT INTO public.stock_reservations (order_id, order_item_id, ingredient_id, purchase_item_id, quantity, needed_by)
        VALUES (p_order_id, p_order_item_id, p_ingredient_id, po.id, v_take, p_needed_by);
        v_left := v_left - v_take;
      END IF;
    END LOOP;
  END IF;

  IF v_left > 0 THEN
    RAISE EXCEPTION 'Insumo insuficiente para o pedido: % (faltam %)', v_name, round(v_left, 2) USING ERRCODE = 'P0001';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._release_order_reservations(p_order_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int;
BEGIN
  UPDATE public.stock_reservations SET status = 'liberada', released_at = now()
   WHERE order_id = p_order_id AND status = 'ativa';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- Saldo disponível suficiente para N porções de um prato numa data (sem reservar).
CREATE OR REPLACE FUNCTION public.dish_stock_ok(p_dish_id uuid, p_portions int, p_needed_by date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.dish_items di JOIN public.dishes d ON d.id = di.dish_id
     WHERE di.dish_id = p_dish_id
       AND di.quantity * p_portions / d.portions > (
         COALESCE((SELECT sum(il.quantity_on_hand - COALESCE((SELECT sum(sr.quantity) FROM public.stock_reservations sr
                                                             WHERE sr.lot_id = il.id AND sr.status = 'ativa'), 0))
                     FROM public.ingredient_lots il
                    WHERE il.ingredient_id = di.ingredient_id AND il.status = 'disponivel'
                      AND (il.expires_at IS NULL OR il.expires_at >= p_needed_by)), 0)
       + COALESCE((SELECT sum(poi.quantity - poi.quantity_received) - COALESCE((SELECT sum(sr.quantity) FROM public.stock_reservations sr
                      JOIN public.purchase_order_items x ON x.id = sr.purchase_item_id
                     WHERE x.ingredient_id = di.ingredient_id AND sr.lot_id IS NULL AND sr.status = 'ativa'), 0)
                     FROM public.purchase_order_items poi JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
                    WHERE poi.ingredient_id = di.ingredient_id AND po.status IN ('prevista','recebida_parcial')
                      AND po.expected_date < p_needed_by), 0))
  )
$$;

-- Ocupação de capacidade por dia e por prato (pedidos ativos).
CREATE OR REPLACE VIEW public.v_cycle_capacity WITH (security_invoker = on) AS
SELECT cd.id AS cycle_day_id, cd.cycle_id, cd.production_date, cd.delivery_date, cd.capacity_portions,
       COALESCE((SELECT sum(oi.quantity) FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
                  WHERE oi.cycle_day_id = cd.id AND o.status NOT IN ('cancelado','expirado')), 0) AS used_portions
  FROM public.menu_cycle_days cd;

-- ---------------------------------------------------------------------
-- 6. Elegibilidade, sugestão de kit e criação do pedido
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eligible_dishes_for(p_customer_id uuid, p_cycle_day_id uuid, p_meal_type text DEFAULT NULL)
RETURNS TABLE (dish_id uuid, dish_name text, meal_type text, description text, tags text[], price numeric,
               kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, portion_weight_g numeric,
               allergens text[], may_contain text[], compatible boolean, reason text, remaining int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE cd public.menu_cycle_days%ROWTYPE; v_day_left int;
BEGIN
  SELECT * INTO cd FROM public.menu_cycle_days WHERE id = p_cycle_day_id;
  SELECT cd.capacity_portions - c.used_portions INTO v_day_left FROM public.v_cycle_capacity c WHERE c.cycle_day_id = cd.id;
  RETURN QUERY
  SELECT d.id, d.name, d.meal_type, d.description, d.tags, cp.price,
         f.kcal, f.protein_g, f.carbs_g, f.fat_g, f.portion_weight_g, f.allergens, f.may_contain,
         (c.compatible AND cp.price IS NOT NULL AND rem.left_ > 0 AND public.dish_stock_ok(d.id, 1, cd.production_date)) AS compatible,
         CASE WHEN NOT c.compatible THEN c.reason
              WHEN cp.price IS NULL THEN 'Sem preço aprovado'
              WHEN rem.left_ <= 0 THEN 'Esgotado para este dia'
              WHEN NOT public.dish_stock_ok(d.id, 1, cd.production_date) THEN 'Insumos indisponíveis'
         END,
         rem.left_
    FROM public.menu_items mi
    JOIN public.dishes d ON d.id = mi.dish_id AND d.status = 'aprovado'
    JOIN public.v_dish_facts f ON f.dish_id = d.id
    LEFT JOIN LATERAL public.current_dish_price(d.id, cd.delivery_date) cp ON true
    CROSS JOIN LATERAL public.dish_compatibility(d.id, p_customer_id) c
    CROSS JOIN LATERAL (
      SELECT least(COALESCE(v_day_left, 0),
                   COALESCE(mi.max_portions - COALESCE((SELECT sum(oi.quantity) FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
                                                         WHERE oi.dish_id = d.id AND o.cycle_id = mi.cycle_id AND o.status NOT IN ('cancelado','expirado')), 0),
                            2147483647))::int AS left_
    ) rem
   WHERE mi.cycle_id = cd.cycle_id AND (p_meal_type IS NULL OR d.meal_type = p_meal_type)
   ORDER BY 14 DESC, d.name;
END $$;

CREATE OR REPLACE FUNCTION public.eligible_dishes(p_cycle_day_id uuid, p_meal_type text DEFAULT NULL)
RETURNS TABLE (dish_id uuid, dish_name text, meal_type text, description text, tags text[], price numeric,
               kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, portion_weight_g numeric,
               allergens text[], may_contain text[], compatible boolean, reason text, remaining int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.eligible_dishes_for(auth.uid(), p_cycle_day_id, p_meal_type)
$$;

CREATE OR REPLACE FUNCTION public.suggest_kit_for(p_customer_id uuid, p_cycle_id uuid)
RETURNS TABLE (cycle_day_id uuid, delivery_date date, meal_type text, dish_id uuid, dish_name text, price numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  p public.customer_profiles%ROWTYPE;
  cd record;
  mt text;
  v_pick record;
  v_used uuid[] := '{}';
BEGIN
  SELECT * INTO p FROM public.customer_profiles WHERE customer_id = p_customer_id;
  FOR cd IN SELECT * FROM public.menu_cycle_days WHERE cycle_id = p_cycle_id
             AND extract(isodow FROM delivery_date)::int = ANY(COALESCE(p.delivery_weekdays, '{1,2,3,4,5}'))
             ORDER BY delivery_date LOOP
    FOREACH mt IN ARRAY COALESCE(p.meal_types, '{almoco}') LOOP
      SELECT e.dish_id, e.dish_name, e.price INTO v_pick
        FROM public.eligible_dishes_for(p_customer_id, cd.id, mt) e
       WHERE e.compatible
       ORDER BY (SELECT count(*) FROM unnest(v_used) u WHERE u = e.dish_id),           -- variedade
                (CASE WHEN e.tags && COALESCE(p.preferences, '{}') THEN 0 ELSE 1 END),  -- preferências
                md5(e.dish_id::text || cd.id::text)                                     -- desempate estável
       LIMIT 1;
      IF v_pick.dish_id IS NOT NULL THEN
        v_used := v_used || v_pick.dish_id;
        cycle_day_id := cd.id; delivery_date := cd.delivery_date; meal_type := mt;
        dish_id := v_pick.dish_id; dish_name := v_pick.dish_name; price := v_pick.price;
        RETURN NEXT;
      END IF;
      v_pick := NULL;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.suggest_kit(p_cycle_id uuid)
RETURNS TABLE (cycle_day_id uuid, delivery_date date, meal_type text, dish_id uuid, dish_name text, price numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.suggest_kit_for(auth.uid(), p_cycle_id)
$$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id),
  subscription_id uuid REFERENCES public.subscriptions(id),
  customer_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'simulado',
  provider_charge_id text NOT NULL UNIQUE,
  method text NOT NULL CHECK (method IN ('cartao','pix','pix_automatico')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado','expirado','reembolsado','contestado','cancelado')),
  amount numeric(12,2) NOT NULL,
  fee_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2),
  attempts int NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  expires_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  receipt_url text,
  payout_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payments_order_idx ON public.payments (order_id);

-- Núcleo de criação de pedido (usado pelo cliente e pela renovação de assinaturas).
CREATE OR REPLACE FUNCTION public._create_order(
  p_customer_id uuid, p_cycle_id uuid, p_items jsonb, p_payment_method text, p_subscription_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.menu_cycles%ROWTYPE;
  s public.platform_settings%ROWTYPE;
  v_item jsonb;
  v_day public.menu_cycle_days%ROWTYPE;
  v_dish public.dishes%ROWTYPE;
  v_mi public.menu_items%ROWTYPE;
  v_compat record;
  v_price record;
  v_qty int;
  v_used int;
  v_order_id uuid;
  v_oi_id uuid;
  v_subtotal numeric := 0;
  v_discount_pct numeric := 0;
  v_plan_id uuid;
  v_plan_name text;
  v_lines jsonb := '[]';
  v_delivery numeric;
  v_total numeric;
  di record;
  v_address text;
BEGIN
  SELECT * INTO c FROM public.menu_cycles WHERE id = p_cycle_id;
  IF c.id IS NULL OR c.status <> 'aberto' OR now() < c.sales_start OR now() >= c.cutoff_at THEN
    RAISE EXCEPTION 'O cardápio desta semana não está aberto para pedidos (prazo de corte: %)', to_char(c.cutoff_at AT TIME ZONE 'America/Fortaleza', 'DD/MM HH24:MI');
  END IF;
  IF p_payment_method NOT IN ('cartao','pix','pix_automatico') THEN RAISE EXCEPTION 'Forma de pagamento inválida'; END IF;
  IF jsonb_array_length(COALESCE(p_items, '[]')) = 0 THEN RAISE EXCEPTION 'O kit está vazio'; END IF;
  SELECT * INTO s FROM public.platform_settings LIMIT 1;

  IF p_subscription_id IS NOT NULL THEN
    SELECT sp.id, sp.name, sp.discount_pct INTO v_plan_id, v_plan_name, v_discount_pct
      FROM public.subscriptions su JOIN public.subscription_plans sp ON sp.id = su.plan_id
     WHERE su.id = p_subscription_id AND su.customer_id = p_customer_id AND su.status = 'ativa';
    IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Assinatura não está ativa'; END IF;
    IF EXISTS (SELECT 1 FROM public.orders WHERE subscription_id = p_subscription_id AND cycle_id = p_cycle_id
                AND status NOT IN ('cancelado','expirado')) THEN
      RAISE EXCEPTION 'Já existe um pedido desta assinatura para esta semana: edite ou cancele o pedido atual';
    END IF;
  END IF;

  SELECT address INTO v_address FROM public.customer_accounts WHERE customer_id = p_customer_id;

  INSERT INTO public.orders (customer_id, cycle_id, subscription_id, payment_method, delivery_address)
  VALUES (p_customer_id, p_cycle_id, p_subscription_id, p_payment_method, v_address)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    IF v_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

    -- Trava o dia para a checagem de capacidade.
    SELECT * INTO v_day FROM public.menu_cycle_days WHERE id = (v_item->>'cycle_day_id')::uuid AND cycle_id = p_cycle_id FOR UPDATE;
    IF v_day.id IS NULL THEN RAISE EXCEPTION 'Dia de entrega inválido'; END IF;
    SELECT * INTO v_mi FROM public.menu_items WHERE cycle_id = p_cycle_id AND dish_id = (v_item->>'dish_id')::uuid FOR UPDATE;
    IF v_mi.id IS NULL THEN RAISE EXCEPTION 'Prato fora do cardápio desta semana'; END IF;
    SELECT * INTO v_dish FROM public.dishes WHERE id = v_mi.dish_id;
    IF v_dish.status <> 'aprovado' THEN RAISE EXCEPTION 'Prato % não está disponível', v_dish.name; END IF;

    SELECT * INTO v_compat FROM public.dish_compatibility(v_dish.id, p_customer_id);
    IF NOT v_compat.compatible THEN
      RAISE EXCEPTION 'Prato "%" bloqueado para o seu perfil: %', v_dish.name, v_compat.reason USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(sum(oi.quantity), 0) INTO v_used FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
     WHERE oi.cycle_day_id = v_day.id AND o.status NOT IN ('cancelado','expirado') AND o.id <> v_order_id;
    v_used := v_used + COALESCE((SELECT sum(quantity) FROM public.order_items WHERE order_id = v_order_id AND cycle_day_id = v_day.id), 0);
    IF v_used + v_qty > v_day.capacity_portions THEN
      RAISE EXCEPTION 'Capacidade de produção esgotada para %', to_char(v_day.delivery_date, 'DD/MM');
    END IF;
    IF v_mi.max_portions IS NOT NULL THEN
      SELECT COALESCE(sum(oi.quantity), 0) INTO v_used FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
       WHERE oi.dish_id = v_dish.id AND o.cycle_id = p_cycle_id AND o.status NOT IN ('cancelado','expirado');
      IF v_used + v_qty > v_mi.max_portions THEN
        RAISE EXCEPTION 'Prato "%" esgotado nesta semana', v_dish.name;
      END IF;
    END IF;

    SELECT * INTO v_price FROM public.current_dish_price(v_dish.id, v_day.delivery_date);
    IF v_price.price IS NULL THEN RAISE EXCEPTION 'Prato "%" sem preço aprovado', v_dish.name; END IF;

    INSERT INTO public.order_items (order_id, dish_id, cycle_day_id, meal_type, quantity, unit_price)
    VALUES (v_order_id, v_dish.id, v_day.id, v_dish.meal_type, v_qty, v_price.price)
    RETURNING id INTO v_oi_id;

    FOR di IN SELECT ingredient_id, quantity FROM public.dish_items WHERE dish_id = v_dish.id LOOP
      PERFORM public._reserve_ingredient(v_order_id, v_oi_id, di.ingredient_id,
                                         di.quantity * v_qty / v_dish.portions, v_day.production_date);
    END LOOP;

    v_subtotal := v_subtotal + v_price.price * v_qty;
    v_lines := v_lines || jsonb_build_object('dish_id', v_dish.id, 'dish', v_dish.name, 'dish_version', v_dish.version,
               'delivery_date', v_day.delivery_date, 'quantity', v_qty, 'unit_price', v_price.price, 'price_id', v_price.price_id);
  END LOOP;

  v_delivery := CASE WHEN s.delivery_included_in_price THEN 0 ELSE s.delivery_price END;
  v_total := round(v_subtotal * (1 - v_discount_pct), 2) + v_delivery;

  UPDATE public.orders SET
    subtotal = v_subtotal,
    discount = round(v_subtotal * v_discount_pct, 2),
    delivery_fee = v_delivery,
    total = v_total,
    pricing_snapshot = jsonb_build_object(
      'captured_at', now(), 'lines', v_lines, 'plan', CASE WHEN v_plan_id IS NOT NULL THEN jsonb_build_object('id', v_plan_id, 'name', v_plan_name) END,
      'discount_pct', v_discount_pct, 'delivery_fee', v_delivery, 'cutoff_at', c.cutoff_at,
      'conditions', 'Edição, pausa ou cancelamento até o prazo de corte. Após o corte, o pedido segue para produção.')
  WHERE id = v_order_id;

  INSERT INTO public.payments (order_id, subscription_id, customer_id, provider_charge_id, method, amount, expires_at)
  VALUES (v_order_id, p_subscription_id, p_customer_id, 'sim_' || replace(v_order_id::text, '-', ''), p_payment_method, v_total,
          CASE WHEN p_payment_method = 'pix' THEN now() + make_interval(mins => s.pix_expiration_minutes) END);

  IF p_subscription_id IS NOT NULL THEN
    INSERT INTO public.subscription_cycles (subscription_id, cycle_id, status, order_id)
    VALUES (p_subscription_id, p_cycle_id, 'pedido_gerado', v_order_id)
    ON CONFLICT (subscription_id, cycle_id) DO UPDATE SET status = 'pedido_gerado', order_id = EXCLUDED.order_id, updated_at = now();
  END IF;

  RETURN v_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.place_order(p_cycle_id uuid, p_items jsonb, p_payment_method text, p_subscription_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para concluir o pedido'; END IF;
  RETURN public._create_order(auth.uid(), p_cycle_id, p_items, p_payment_method, p_subscription_id);
END $$;

-- Cancelamento: libera reserva conforme estágio da produção.
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders%ROWTYPE; c public.menu_cycles%ROWTYPE; v_staff boolean; v_released int := 0;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  v_staff := public.has_any_role(ARRAY['operacao']::public.platform_role[]);
  IF o.customer_id <> auth.uid() AND NOT v_staff THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF o.status IN ('cancelado','expirado','entregue') THEN RAISE EXCEPTION 'Pedido já está %', o.status; END IF;
  SELECT * INTO c FROM public.menu_cycles WHERE id = o.cycle_id;

  IF o.status IN ('aguardando_pagamento','confirmado') THEN
    IF NOT v_staff AND now() >= c.cutoff_at THEN
      RAISE EXCEPTION 'Prazo de corte encerrado: fale com a operação para cancelar';
    END IF;
    v_released := public._release_order_reservations(o.id);
  ELSIF NOT v_staff THEN
    RAISE EXCEPTION 'Pedido já está em produção';
  END IF;
  -- Em produção ou depois: os insumos já foram consumidos e não voltam ao estoque.

  UPDATE public.orders SET status = 'cancelado', cancel_reason = p_reason, cancelled_at = now(), updated_at = now()
   WHERE id = o.id;
  UPDATE public.payments SET status = 'cancelado', updated_at = now() WHERE order_id = o.id AND status = 'pendente';
  IF EXISTS (SELECT 1 FROM public.payments WHERE order_id = o.id AND status = 'aprovado') THEN
    UPDATE public.orders SET needs_attention = 'Pedido pago cancelado: solicitar reembolso no provedor' WHERE id = o.id;
  END IF;
  IF o.subscription_id IS NOT NULL THEN
    UPDATE public.subscription_cycles SET status = 'cancelado', updated_at = now()
     WHERE subscription_id = o.subscription_id AND cycle_id = o.cycle_id;
  END IF;
  RETURN jsonb_build_object('order_id', o.id, 'previous_status', o.status, 'reservations_released', v_released);
END $$;

-- ---------------------------------------------------------------------
-- 7. Assinatura: pausar, pular ciclo, cancelar, renovar
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.subscribe(p_plan_id uuid, p_payment_method text, p_kit_template jsonb DEFAULT '[]')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  INSERT INTO public.subscriptions (customer_id, plan_id, payment_method, kit_template)
  VALUES (auth.uid(), p_plan_id, p_payment_method, COALESCE(p_kit_template, '[]'))
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Você já tem uma assinatura ativa';
END $$;

CREATE OR REPLACE FUNCTION public.set_subscription_status(p_subscription_id uuid, p_action text, p_until date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE su public.subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO su FROM public.subscriptions WHERE id = p_subscription_id FOR UPDATE;
  IF su.id IS NULL OR (su.customer_id <> auth.uid() AND NOT public.has_any_role(ARRAY['operacao']::public.platform_role[])) THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;
  IF p_action = 'pausar' THEN
    UPDATE public.subscriptions SET status = 'pausada', paused_until = p_until WHERE id = su.id;
  ELSIF p_action = 'retomar' THEN
    UPDATE public.subscriptions SET status = 'ativa', paused_until = NULL WHERE id = su.id;
  ELSIF p_action = 'cancelar' THEN
    UPDATE public.subscriptions SET status = 'cancelada', cancelled_at = now() WHERE id = su.id;
  ELSE
    RAISE EXCEPTION 'Ação inválida';
  END IF;
END $$;

-- Pular um ciclo: a assinatura continua ativa; o pedido desse ciclo (se houver) é cancelado.
CREATE OR REPLACE FUNCTION public.skip_subscription_cycle(p_subscription_id uuid, p_cycle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE su public.subscriptions%ROWTYPE; c public.menu_cycles%ROWTYPE; v_order uuid;
BEGIN
  SELECT * INTO su FROM public.subscriptions WHERE id = p_subscription_id;
  IF su.id IS NULL OR su.customer_id <> auth.uid() THEN RAISE EXCEPTION 'Assinatura não encontrada'; END IF;
  SELECT * INTO c FROM public.menu_cycles WHERE id = p_cycle_id;
  IF now() >= c.cutoff_at THEN RAISE EXCEPTION 'Prazo de corte encerrado para esta semana'; END IF;
  SELECT order_id INTO v_order FROM public.subscription_cycles WHERE subscription_id = su.id AND cycle_id = c.id;
  IF v_order IS NOT NULL AND EXISTS (SELECT 1 FROM public.orders WHERE id = v_order AND status IN ('aguardando_pagamento','confirmado')) THEN
    PERFORM public.cancel_order(v_order, 'Ciclo pulado pelo cliente');
  END IF;
  INSERT INTO public.subscription_cycles (subscription_id, cycle_id, status)
  VALUES (su.id, c.id, 'pulado')
  ON CONFLICT (subscription_id, cycle_id) DO UPDATE SET status = 'pulado', updated_at = now();
END $$;

-- Renovação semanal: um pedido por assinatura ativa, usando o modelo do kit ou a sugestão pelo perfil.
CREATE OR REPLACE FUNCTION public.generate_subscription_orders(p_cycle_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE su record; v_items jsonb; v_created int := 0; v_skipped int := 0; v_failed int := 0; v_order uuid;
BEGIN
  IF NOT public.has_any_role(ARRAY['operacao']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  FOR su IN SELECT s.* FROM public.subscriptions s WHERE s.status = 'ativa'
               OR (s.status = 'pausada' AND s.paused_until IS NOT NULL AND s.paused_until < current_date) LOOP
    IF EXISTS (SELECT 1 FROM public.subscription_cycles sc WHERE sc.subscription_id = su.id AND sc.cycle_id = p_cycle_id
                AND sc.status IN ('pulado','pedido_gerado','cancelado')) THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    IF su.status = 'pausada' THEN UPDATE public.subscriptions SET status = 'ativa', paused_until = NULL WHERE id = su.id; END IF;
    SELECT jsonb_agg(jsonb_build_object('cycle_day_id', k.cycle_day_id, 'dish_id', k.dish_id, 'quantity', 1))
      INTO v_items FROM public.suggest_kit_for(su.customer_id, p_cycle_id) k;
    BEGIN
      v_order := public._create_order(su.customer_id, p_cycle_id, COALESCE(v_items, '[]'), su.payment_method, su.id);
      v_created := v_created + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      INSERT INTO public.subscription_cycles (subscription_id, cycle_id, status, note)
      VALUES (su.id, p_cycle_id, 'falhou', SQLERRM)
      ON CONFLICT (subscription_id, cycle_id) DO UPDATE SET status = 'falhou', note = EXCLUDED.note, updated_at = now();
    END;
  END LOOP;
  RETURN jsonb_build_object('created', v_created, 'skipped', v_skipped, 'failed', v_failed);
END $$;
