-- 1. Redefinir v_portfolio_summary para alinhar com os indicadores oficiais solicitados
CREATE OR REPLACE VIEW public.v_portfolio_summary
AS
WITH metrics AS (
  SELECT
    COALESCE(SUM(initial_capital), 0) AS capital_inicial,
    COALESCE((SELECT SUM(amount) FROM investment_contributions WHERE cancelled_at IS NULL), 0) AS total_aportes,
    COALESCE((SELECT SUM(amount) FROM investment_receipt_allocations WHERE cancelled_at IS NULL), 0) AS total_recebido,
    COUNT(*) AS total_operations,
    (SELECT COUNT(*) FROM v_operation_position WHERE overdue_receivable > 0) AS overdue_operations,
    (SELECT COUNT(*) FROM v_operation_position WHERE outstanding_amount > 0 AND financial_status = 'EM_DIA') AS review_operations,
    (SELECT COUNT(*) FROM investment_operations WHERE import_status = 'VALIDADO' AND id NOT IN (SELECT operation_id FROM v_installments WHERE outstanding_amount > 0)) AS closed_operations
  FROM investment_operations
  WHERE import_status = 'VALIDADO'
),
sums AS (
  SELECT
    COALESCE(SUM(expected_amount), 0) AS total_previsto_carteira,
    COALESCE(SUM(outstanding_amount), 0) AS total_a_receber,
    COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN outstanding_amount ELSE 0 END), 0) AS inadimplencia,
    COALESCE(SUM(CASE WHEN due_date >= CURRENT_DATE THEN outstanding_amount ELSE 0 END), 0) AS a_receber_futuro,
    COUNT(CASE WHEN due_date < CURRENT_DATE AND outstanding_amount > 0 THEN 1 END) AS overdue_installments
  FROM v_installments
)
SELECT
  -- CAPITAL INVESTIDO = capital_inicial + aportes válidos
  (m.capital_inicial + m.total_aportes) AS total_invested,
  -- TOTAL RECEBIDO
  m.total_recebido AS total_received,
  -- CAPITAL A RECUPERAR = MAX(Capital Investido - Total Recebido, 0)
  GREATEST((m.capital_inicial + m.total_aportes) - m.total_recebido, 0) AS capital_to_recover,
  -- TOTAL PREVISTO DA CARTEIRA
  s.total_previsto_carteira,
  -- TOTAL A RECEBER = soma do saldo aberto de todas as parcelas válidas (INADIMPLÊNCIA + A RECEBER FUTURO)
  s.total_a_receber,
  -- INADIMPLÊNCIA
  s.inadimplencia AS overdue_receivable,
  -- A RECEBER FUTURO
  s.a_receber_futuro AS future_receivable,
  -- LUCRO REALIZADO = MAX(Total Recebido - Capital Investido, 0)
  GREATEST(m.total_recebido - (m.capital_inicial + m.total_aportes), 0) AS realized_profit,
  -- RESULTADO PROJETADO = Total Previsto da Carteira - Capital Investido
  (s.total_previsto_carteira - (m.capital_inicial + m.total_aportes)) AS projected_result,
  -- % CAPITAL RECUPERADO = IF Capital Investido > 0: MIN(Total Recebido / Capital Investido, 1)
  CASE 
    WHEN (m.capital_inicial + m.total_aportes) > 0 
    THEN LEAST(m.total_recebido / (m.capital_inicial + m.total_aportes), 1.0)
    ELSE 0 
  END AS recovery_percentage,
  m.total_operations,
  m.overdue_operations,
  m.review_operations,
  m.closed_operations,
  s.overdue_installments
FROM metrics m, sums s;

GRANT SELECT ON public.v_portfolio_summary TO authenticated;

-- 2. Garantir que o estorno de recebimento reverte as alocações corretamente
CREATE OR REPLACE FUNCTION public.cancel_receipt(p_receipt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  -- Marcar recebimento como cancelado
  UPDATE public.investment_receipts
  SET 
    cancelled_at = now(),
    notes = COALESCE(notes, '') || ' [ESTORNADO em ' || now()::text || ']'
  WHERE id = p_receipt_id;

  -- Marcar alocações como canceladas
  UPDATE public.investment_receipt_allocations
  SET cancelled_at = now()
  WHERE receipt_id = p_receipt_id;

  -- Registrar auditoria
  INSERT INTO public.investment_audit_log (operation_id, action, entity_type, entity_id, old_data)
  SELECT operation_id, 'CANCEL_RECEIPT', 'receipt', p_receipt_id, jsonb_build_object('receipt_id', p_receipt_id)
  FROM public.investment_receipts
  WHERE id = p_receipt_id;
END;
$$;

-- 3. Função para editar recebimento (conforme requisito 7)
CREATE OR REPLACE FUNCTION public.update_receipt(
  p_receipt_id uuid,
  p_receipt_date date,
  p_notes text,
  p_allocations jsonb -- Array de {installment_id, amount}
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_operation_id uuid;
  v_alloc record;
BEGIN
  SELECT operation_id INTO v_operation_id FROM public.investment_receipts WHERE id = p_receipt_id;
  
  -- 1. Reverter alocações antigas
  UPDATE public.investment_receipt_allocations
  SET cancelled_at = now()
  WHERE receipt_id = p_receipt_id AND cancelled_at IS NULL;

  -- 2. Atualizar cabeçalho do recebimento
  UPDATE public.investment_receipts
  SET 
    receipt_date = p_receipt_date,
    notes = p_notes,
    total_amount = (SELECT SUM((x->>'amount')::numeric) FROM jsonb_array_elements(p_allocations) x)
  WHERE id = p_receipt_id;

  -- 3. Inserir novas alocações
  FOR v_alloc IN SELECT * FROM jsonb_to_recordset(p_allocations) AS x(installment_id uuid, amount numeric)
  LOOP
    INSERT INTO public.investment_receipt_allocations (receipt_id, installment_id, amount)
    VALUES (p_receipt_id, v_alloc.installment_id, v_alloc.amount);
  END LOOP;

  -- 4. Auditoria
  INSERT INTO public.investment_audit_log (operation_id, action, entity_type, entity_id)
  VALUES (v_operation_id, 'UPDATE_RECEIPT', 'receipt', p_receipt_id);
END;
$$;
