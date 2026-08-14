CREATE OR REPLACE FUNCTION public.get_portfolio_metrics(p_year integer DEFAULT NULL)
RETURNS TABLE (
  scope_year integer,
  total_invested numeric,
  total_received numeric,
  capital_to_recover numeric,
  total_previsto_carteira numeric,
  total_a_receber numeric,
  overdue_receivable numeric,
  future_receivable numeric,
  realized_profit numeric,
  projected_result numeric,
  recovery_percentage numeric,
  total_operations bigint,
  overdue_installments bigint,
  total_installments bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ops_scope AS (
    SELECT o.id, o.initial_capital
    FROM public.investment_operations o
    WHERE 
      (p_year IS NULL AND o.import_status <> 'DESCARTADO')
      OR
      (p_year IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.portfolio_memberships pm 
         WHERE pm.operation_id = o.id AND pm.portfolio_year = p_year AND pm.is_active = true
      ))
  ),
  contribs AS (
    SELECT c.operation_id, SUM(c.amount) as total
    FROM public.investment_contributions c
    WHERE c.cancelled_at IS NULL AND c.operation_id IN (SELECT id FROM ops_scope)
    GROUP BY c.operation_id
  ),
  base_invested AS (
    SELECT 
      SUM(o.initial_capital + COALESCE(c.total, 0)) as total
    FROM ops_scope o
    LEFT JOIN contribs c ON o.id = c.operation_id
  ),
  base_received AS (
    SELECT SUM(r.total_amount) as total
    FROM public.investment_receipts r
    WHERE r.cancelled_at IS NULL AND r.operation_id IN (SELECT id FROM ops_scope)
  ),
  installs AS (
    SELECT 
      SUM(i.outstanding_amount) as a_receber,
      SUM(CASE WHEN i.due_date < CURRENT_DATE THEN i.outstanding_amount ELSE 0 END) as overdue,
      SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END) as future,
      COUNT(*) FILTER (WHERE i.due_date < CURRENT_DATE AND i.outstanding_amount > 0) as overdue_count,
      COUNT(*) as total_count
    FROM public.v_installments i
    WHERE 
      i.operation_id IN (SELECT id FROM ops_scope)
      AND
      (p_year IS NULL OR EXTRACT(YEAR FROM i.due_date) = p_year)
  )
  SELECT
    p_year,
    COALESCE(inv.total, 0),
    COALESCE(rec.total, 0),
    GREATEST(COALESCE(inv.total, 0) - COALESCE(rec.total, 0), 0),
    0.0, -- total_previsto_carteira
    COALESCE(ins.a_receber, 0),
    COALESCE(ins.overdue, 0),
    COALESCE(ins.future, 0),
    GREATEST(COALESCE(rec.total, 0) - COALESCE(inv.total, 0), 0),
    COALESCE(rec.total, 0) - COALESCE(inv.total, 0), -- projected_result
    CASE WHEN COALESCE(inv.total, 0) > 0 THEN LEAST(COALESCE(rec.total, 0) / inv.total, 1.0) ELSE 0 END,
    (SELECT COUNT(*) FROM ops_scope),
    COALESCE(ins.overdue_count, 0),
    COALESCE(ins.total_count, 0)
  FROM base_invested inv, base_received rec, installs ins;
END;
$$;