DROP VIEW IF EXISTS public.v_portfolio_summary CASCADE;
DROP VIEW IF EXISTS public.v_operation_position CASCADE;

CREATE VIEW public.v_operation_position
WITH (security_invoker = on) AS
SELECT o.id AS operation_id,
    r.name AS reference,
    c.name AS category,
    o.initial_capital,
    COALESCE((SELECT sum(ic.amount) FROM investment_contributions ic WHERE ic.operation_id = o.id AND ic.cancelled_at IS NULL), 0::numeric) AS total_contributions,
    (o.initial_capital + COALESCE((SELECT sum(ic.amount) FROM investment_contributions ic WHERE ic.operation_id = o.id AND ic.cancelled_at IS NULL), 0::numeric)) AS total_invested,
    COALESCE(sum(i.received_amount), 0::numeric) AS total_received,
    COALESCE(sum(i.outstanding_amount), 0::numeric) AS outstanding_amount,
    COALESCE(sum(CASE WHEN i.due_date < CURRENT_DATE THEN i.outstanding_amount ELSE 0::numeric END), 0::numeric) AS overdue_receivable,
    count(CASE WHEN i.due_date < CURRENT_DATE AND i.outstanding_amount > 0::numeric THEN 1 ELSE NULL::integer END) AS overdue_installments,
    COALESCE(sum(CASE WHEN i.due_date >= CURRENT_DATE THEN i.outstanding_amount ELSE 0::numeric END), 0::numeric) AS future_receivable,
    max(i.due_date) AS last_installment_due,
    GREATEST((o.initial_capital + COALESCE((SELECT sum(ic.amount) FROM investment_contributions ic WHERE ic.operation_id = o.id AND ic.cancelled_at IS NULL), 0::numeric)) - COALESCE(sum(i.received_amount), 0::numeric), 0::numeric) AS capital_to_recover,
    CASE WHEN (o.initial_capital + COALESCE((SELECT sum(ic.amount) FROM investment_contributions ic WHERE ic.operation_id = o.id AND ic.cancelled_at IS NULL), 0::numeric)) > 0::numeric
      THEN LEAST(COALESCE(sum(i.received_amount), 0::numeric) / (o.initial_capital + COALESCE((SELECT sum(ic.amount) FROM investment_contributions ic WHERE ic.operation_id = o.id AND ic.cancelled_at IS NULL), 0::numeric)), 1.0)
      ELSE 0::numeric END AS recovery_percentage,
    CASE WHEN COALESCE(sum(i.outstanding_amount), 0::numeric) <= 0::numeric THEN 'LIQUIDADA'::text
         WHEN COALESCE(sum(CASE WHEN i.due_date < CURRENT_DATE THEN i.outstanding_amount ELSE 0::numeric END), 0::numeric) > 0::numeric THEN 'INADIMPLENTE'::text
         ELSE 'EM_DIA'::text END AS financial_status
   FROM investment_operations o
     JOIN investment_references r ON o.reference_id = r.id
     LEFT JOIN investment_categories c ON r.category_id = c.id
     LEFT JOIN v_installments i ON o.id = i.operation_id
  WHERE o.cancelled_at IS NULL AND o.import_status <> 'DESCARTADO'::text
  GROUP BY o.id, r.name, c.name, o.initial_capital;

CREATE VIEW public.v_portfolio_summary
WITH (security_invoker = on) AS
WITH global_metrics AS (
  SELECT COALESCE(sum(initial_capital), 0::numeric) AS initial_capital_sum
    FROM investment_operations
   WHERE cancelled_at IS NULL AND import_status <> 'DESCARTADO'::text
), contributions_sum AS (
  SELECT COALESCE(sum(amount), 0::numeric) AS total_aportes
    FROM investment_contributions WHERE cancelled_at IS NULL
), receipts_sum AS (
  SELECT COALESCE(sum(ira.amount), 0::numeric) AS total_recebido
    FROM investment_receipt_allocations ira
    JOIN investment_receipts ir ON ira.receipt_id = ir.id
   WHERE ir.cancelled_at IS NULL
), installments_metrics AS (
  SELECT COALESCE(sum(expected_amount), 0::numeric) AS total_previsto_carteira,
         COALESCE(sum(outstanding_amount), 0::numeric) AS total_a_receber,
         COALESCE(sum(CASE WHEN due_date < CURRENT_DATE THEN outstanding_amount ELSE 0::numeric END), 0::numeric) AS inadimplencia,
         COALESCE(sum(CASE WHEN due_date >= CURRENT_DATE THEN outstanding_amount ELSE 0::numeric END), 0::numeric) AS a_receber_futuro,
         count(CASE WHEN due_date < CURRENT_DATE AND outstanding_amount > 0::numeric THEN 1 ELSE NULL::integer END) AS overdue_installments,
         count(*) AS total_installments
    FROM v_installments
), operation_counts AS (
  SELECT count(*) AS total_operations,
         count(CASE WHEN overdue_receivable > 0::numeric THEN 1 ELSE NULL::integer END) AS overdue_operations,
         count(CASE WHEN outstanding_amount > 0::numeric AND financial_status = 'EM_DIA'::text THEN 1 ELSE NULL::integer END) AS review_operations,
         count(CASE WHEN financial_status = 'LIQUIDADA'::text THEN 1 ELSE NULL::integer END) AS closed_operations
    FROM v_operation_position
)
SELECT (gm.initial_capital_sum + cs.total_aportes) AS total_invested,
   rs.total_recebido AS total_received,
   GREATEST((gm.initial_capital_sum + cs.total_aportes) - rs.total_recebido, 0::numeric) AS capital_to_recover,
   im.total_previsto_carteira,
   im.total_a_receber,
   im.inadimplencia AS overdue_receivable,
   im.a_receber_futuro AS future_receivable,
   GREATEST(rs.total_recebido - (gm.initial_capital_sum + cs.total_aportes), 0::numeric) AS realized_profit,
   (im.total_previsto_carteira - (gm.initial_capital_sum + cs.total_aportes)) AS projected_result,
   CASE WHEN (gm.initial_capital_sum + cs.total_aportes) > 0::numeric
     THEN LEAST(rs.total_recebido / (gm.initial_capital_sum + cs.total_aportes), 1.0)
     ELSE 0::numeric END AS recovery_percentage,
   oc.total_operations,
   oc.overdue_operations,
   oc.review_operations,
   oc.closed_operations,
   im.overdue_installments,
   im.total_installments
  FROM global_metrics gm, contributions_sum cs, receipts_sum rs, installments_metrics im, operation_counts oc;

GRANT SELECT ON public.v_operation_position TO authenticated;
GRANT SELECT ON public.v_portfolio_summary TO authenticated;