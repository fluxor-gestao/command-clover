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
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
WITH scoped_ops AS (
  SELECT o.id, o.initial_capital
    FROM investment_operations o
   WHERE o.cancelled_at IS NULL
     AND o.import_status <> 'DESCARTADO'
     AND (
       p_year IS NULL
       OR EXISTS (
         SELECT 1 FROM investment_installments i
          WHERE i.operation_id = o.id
            AND EXTRACT(YEAR FROM i.competence) = p_year
       )
     )
), scoped_inst AS (
  SELECT i.*
    FROM v_installments i
    JOIN scoped_ops s ON s.id = i.operation_id
   WHERE p_year IS NULL OR EXTRACT(YEAR FROM i.competence) = p_year
), capital AS (
  SELECT COALESCE((SELECT sum(initial_capital) FROM scoped_ops), 0)
       + COALESCE((SELECT sum(c.amount) FROM investment_contributions c
                    JOIN scoped_ops s ON s.id = c.operation_id
                   WHERE c.cancelled_at IS NULL
                     AND (p_year IS NULL OR EXTRACT(YEAR FROM c.contribution_date) = p_year)), 0) AS invested
), agg AS (
  SELECT COALESCE(sum(expected_amount), 0) AS previsto,
         COALESCE(sum(received_amount), 0) AS recebido,
         COALESCE(sum(outstanding_amount), 0) AS a_receber,
         COALESCE(sum(CASE WHEN due_date < CURRENT_DATE THEN outstanding_amount ELSE 0 END), 0) AS inadimplencia,
         COALESCE(sum(CASE WHEN due_date >= CURRENT_DATE THEN outstanding_amount ELSE 0 END), 0) AS futuro,
         count(CASE WHEN due_date < CURRENT_DATE AND outstanding_amount > 0 THEN 1 END) AS overdue_inst,
         count(*) AS inst_count
    FROM scoped_inst
)
SELECT p_year,
       c.invested,
       a.recebido,
       GREATEST(c.invested - a.recebido, 0),
       a.previsto,
       a.a_receber,
       a.inadimplencia,
       a.futuro,
       GREATEST(a.recebido - c.invested, 0),
       a.previsto - c.invested,
       CASE WHEN c.invested > 0 THEN LEAST(a.recebido / c.invested, 1.0) ELSE 0 END,
       (SELECT count(*) FROM scoped_ops),
       a.overdue_inst,
       a.inst_count
  FROM capital c, agg a;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_portfolio_years()
RETURNS TABLE (year integer)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT DISTINCT EXTRACT(YEAR FROM competence)::integer AS year
    FROM investment_installments
   ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_years() TO authenticated;