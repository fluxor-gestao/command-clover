-- Remover RPC antiga se existir para evitar conflito de parâmetros
DROP FUNCTION IF EXISTS public.get_portfolio_metrics(INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION public.get_portfolio_metrics(
  p_year INTEGER DEFAULT NULL,
  p_management_mode BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_today DATE := CURRENT_DATE;
BEGIN
  WITH filtered_ops AS (
    -- Se p_year for fornecido, filtrar por membership daquele ano
    SELECT io.* 
    FROM investment_operations io
    INNER JOIN portfolio_memberships pm ON pm.operation_id = io.id
    WHERE (p_year IS NULL OR pm.portfolio_year = p_year)
      AND pm.is_active = true
  ),
  installments_metrics AS (
    -- Métricas baseadas em parcelas reais/projetadas
    SELECT 
      SUM(expected_amount) as total_previsto,
      SUM(received_amount) as total_recebido,
      -- TOTAL A RECEBER: saldo ainda aberto (previsto - recebido)
      SUM(GREATEST(expected_amount - received_amount, 0)) as total_a_receber,
      -- INADIMPLÊNCIA: saldo aberto com data vencida
      SUM(CASE WHEN due_date < v_today THEN GREATEST(expected_amount - received_amount, 0) ELSE 0 END) as inadimplencia,
      -- A RECEBER FUTURO: saldo aberto com data futura ou hoje
      SUM(CASE WHEN due_date >= v_today THEN GREATEST(expected_amount - received_amount, 0) ELSE 0 END) as a_receber_futuro
    FROM investment_installments
    WHERE operation_id IN (SELECT id FROM filtered_ops)
  ),
  capital_metrics AS (
    SELECT 
      SUM(initial_capital) as capital_investido
    FROM filtered_ops
  )
  SELECT json_build_object(
    'capital_investido', COALESCE(cm.capital_investido, 0),
    'total_recebido', COALESCE(im.total_recebido, 0),
    'capital_a_recuperar', GREATEST(COALESCE(cm.capital_investido, 0) - COALESCE(im.total_recebido, 0), 0),
    'total_previsto', COALESCE(im.total_previsto, 0),
    'total_a_receber', COALESCE(im.total_a_receber, 0),
    'inadimplencia', COALESCE(im.inadimplencia, 0),
    'a_receber_futuro', COALESCE(im.a_receber_futuro, 0),
    'lucro_realizado', GREATEST(COALESCE(im.total_recebido, 0) - COALESCE(cm.capital_investido, 0), 0),
    'resultado_projetado', COALESCE(im.total_previsto, 0) - COALESCE(cm.capital_investido, 0),
    'percentual_recuperado', CASE WHEN COALESCE(cm.capital_investido, 0) > 0 
      THEN (COALESCE(im.total_recebido, 0) / cm.capital_investido) * 100 
      ELSE 0 END
  ) INTO v_result
  FROM installments_metrics im, capital_metrics cm;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(INTEGER, BOOLEAN) TO service_role;

-- Criar RPC de Projeção Contínua
CREATE OR REPLACE FUNCTION public.get_portfolio_projection(
  p_year INTEGER DEFAULT NULL
)
RETURNS TABLE (
  competence TEXT,
  expected NUMERIC,
  received NUMERIC,
  overdue NUMERIC,
  future_receivable NUMERIC,
  installments_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered_ops AS (
    SELECT operation_id 
    FROM portfolio_memberships 
    WHERE (p_year IS NULL OR portfolio_year = p_year)
      AND is_active = true
  )
  SELECT 
    TO_CHAR(due_date, 'YYYY-MM') as competence,
    SUM(expected_amount) as expected,
    SUM(received_amount) as received,
    SUM(CASE WHEN due_date < CURRENT_DATE THEN GREATEST(expected_amount - received_amount, 0) ELSE 0 END) as overdue,
    SUM(CASE WHEN due_date >= CURRENT_DATE THEN GREATEST(expected_amount - received_amount, 0) ELSE 0 END) as future_receivable,
    COUNT(*) as installments_count
  FROM investment_installments
  WHERE operation_id IN (SELECT operation_id FROM filtered_ops)
  GROUP BY TO_CHAR(due_date, 'YYYY-MM')
  ORDER BY competence ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_projection(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_projection(INTEGER) TO service_role;
