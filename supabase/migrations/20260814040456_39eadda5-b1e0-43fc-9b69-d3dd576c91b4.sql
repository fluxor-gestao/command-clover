-- Ensure v_portfolio_summary has all necessary columns for the dashboard
DROP VIEW IF EXISTS public.v_portfolio_summary CASCADE;

CREATE OR REPLACE VIEW public.v_portfolio_summary AS
WITH stats AS (
    SELECT 
        COUNT(*) as total_operations,
        SUM(total_invested) as total_invested,
        SUM(total_received) as total_received,
        SUM(capital_to_recover) as capital_to_recover,
        SUM(overdue_receivable) as overdue_receivable,
        SUM(CASE WHEN computed_status = 'ATIVA' THEN 1 ELSE 0 END) as active_operations,
        SUM(CASE WHEN computed_status = 'INADIMPLENTE' THEN 1 ELSE 0 END) as overdue_operations,
        SUM(CASE WHEN computed_status = 'EM_REVISAO' THEN 1 ELSE 0 END) as review_operations,
        SUM(CASE WHEN computed_status = 'ENCERRADA' THEN 1 ELSE 0 END) as closed_operations,
        SUM(overdue_installments) as overdue_installments
    FROM public.v_operation_position
)
SELECT 
    s.*,
    COALESCE(s.total_received / NULLIF(s.total_invested, 0), 0) as recovery_percentage,
    (s.total_received - s.total_invested) as realized_profit,
    (SELECT SUM(outstanding_amount) FROM public.v_installments WHERE due_date > CURRENT_DATE) as future_receivable
FROM stats s;

GRANT SELECT ON public.v_portfolio_summary TO authenticated;
GRANT SELECT ON public.v_portfolio_summary TO anon;