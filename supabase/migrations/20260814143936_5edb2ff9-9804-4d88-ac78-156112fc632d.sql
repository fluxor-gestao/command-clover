
DROP VIEW IF EXISTS public.v_portfolio_summary CASCADE;
DROP VIEW IF EXISTS public.v_operation_position CASCADE;

CREATE VIEW public.v_operation_position AS
SELECT 
    o.id AS operation_id,
    r.name AS reference,
    c.name AS category,
    o.initial_capital,
    COALESCE((SELECT SUM(amount) FROM investment_contributions WHERE operation_id = o.id AND cancelled_at IS NULL), 0) AS total_contributions,
    (o.initial_capital + COALESCE((SELECT SUM(amount) FROM investment_contributions WHERE operation_id = o.id AND cancelled_at IS NULL), 0)) AS total_invested,
    COALESCE(SUM(i.received_amount), 0) AS total_received,
    COALESCE(SUM(i.outstanding_amount), 0) AS outstanding_amount,
    COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE THEN i.outstanding_amount ELSE 0 END), 0) AS overdue_receivable,
    COUNT(CASE WHEN i.due_date < CURRENT_DATE AND i.outstanding_amount > 0 THEN 1 END) AS overdue_installments,
    CASE 
        WHEN COALESCE(SUM(i.outstanding_amount), 0) <= 0 THEN 'LIQUIDADA'
        WHEN COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE THEN i.outstanding_amount ELSE 0 END), 0) > 0 THEN 'INADIMPLENTE'
        ELSE 'EM_DIA'
    END AS financial_status
FROM investment_operations o
JOIN investment_references r ON o.reference_id = r.id
LEFT JOIN investment_categories c ON r.category_id = c.id
LEFT JOIN v_installments i ON o.id = i.operation_id
WHERE o.import_status = 'VALIDADO'
GROUP BY o.id, r.name, c.name, o.initial_capital;

GRANT SELECT ON public.v_operation_position TO authenticated;

CREATE VIEW public.v_portfolio_summary AS
WITH global_metrics AS (
  SELECT
    COALESCE(SUM(initial_capital), 0) AS initial_capital_sum
  FROM investment_operations
  WHERE import_status = 'VALIDADO'
),
contributions_sum AS (
  SELECT COALESCE(SUM(amount), 0) AS total_aportes
  FROM investment_contributions
  WHERE cancelled_at IS NULL
),
receipts_sum AS (
  SELECT COALESCE(SUM(ira.amount), 0) AS total_recebido
  FROM investment_receipt_allocations ira
  JOIN investment_receipts ir ON ira.receipt_id = ir.id
  WHERE ir.cancelled_at IS NULL
),
installments_metrics AS (
  SELECT
    COALESCE(SUM(expected_amount), 0) AS total_previsto_carteira,
    COALESCE(SUM(outstanding_amount), 0) AS total_a_receber,
    COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE THEN outstanding_amount ELSE 0 END), 0) AS inadimplencia,
    COALESCE(SUM(CASE WHEN due_date >= CURRENT_DATE THEN outstanding_amount ELSE 0 END), 0) AS a_receber_futuro,
    COUNT(CASE WHEN due_date < CURRENT_DATE AND outstanding_amount > 0 THEN 1 END) AS overdue_installments
  FROM v_installments
),
operation_counts AS (
  SELECT
    COUNT(*) AS total_operations,
    COUNT(CASE WHEN overdue_receivable > 0 THEN 1 END) AS overdue_operations,
    COUNT(CASE WHEN outstanding_amount > 0 AND financial_status = 'EM_DIA' THEN 1 END) AS review_operations,
    COUNT(CASE WHEN financial_status = 'LIQUIDADA' THEN 1 END) AS closed_operations
  FROM v_operation_position
)
SELECT
  (gm.initial_capital_sum + cs.total_aportes) AS total_invested,
  rs.total_recebido AS total_received,
  GREATEST((gm.initial_capital_sum + cs.total_aportes) - rs.total_recebido, 0) AS capital_to_recover,
  im.total_previsto_carteira,
  im.total_a_receber,
  im.inadimplencia AS overdue_receivable,
  im.a_receber_futuro AS future_receivable,
  GREATEST(rs.total_recebido - (gm.initial_capital_sum + cs.total_aportes), 0) AS realized_profit,
  (im.total_previsto_carteira - (gm.initial_capital_sum + cs.total_aportes)) AS projected_result,
  CASE 
    WHEN (gm.initial_capital_sum + cs.total_aportes) > 0 
    THEN LEAST(rs.total_recebido / (gm.initial_capital_sum + cs.total_aportes), 1.0)
    ELSE 0 
  END AS recovery_percentage,
  oc.total_operations,
  oc.overdue_operations,
  oc.review_operations,
  oc.closed_operations,
  im.overdue_installments
FROM global_metrics gm, contributions_sum cs, receipts_sum rs, installments_metrics im, operation_counts oc;

GRANT SELECT ON public.v_portfolio_summary TO authenticated;
