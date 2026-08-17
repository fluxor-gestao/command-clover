-- 1. Restaurar memberships se necessário e atualizar RPCs
CREATE OR REPLACE FUNCTION public.get_portfolio_metrics(
    p_year integer DEFAULT NULL::integer,
    p_cutoff_competence date DEFAULT '2026-08-01'::date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    result json;
    v_cutoff date := COALESCE(p_cutoff_competence, '2026-08-01'::date);
BEGIN
    WITH membership_ops AS (
        SELECT operation_id 
        FROM public.portfolio_memberships 
        WHERE (p_year IS NULL OR portfolio_year = p_year)
          AND is_active = true
    ),
    op_stats AS (
        SELECT 
            o.id,
            o.initial_capital + COALESCE((SELECT SUM(amount) FROM public.investment_contributions WHERE operation_id = o.id AND cancelled_at IS NULL), 0) as invested_capital,
            COALESCE((SELECT SUM(total_amount) FROM public.investment_receipts WHERE operation_id = o.id AND cancelled_at IS NULL), 0) as total_received,
            COALESCE((
                SELECT SUM(expected_amount - received_amount) 
                FROM public.investment_installments 
                WHERE operation_id = o.id AND competence < v_cutoff AND expected_amount > received_amount
            ), 0) as overdue_amount,
            COALESCE((
                SELECT SUM(expected_amount - received_amount) 
                FROM public.investment_installments 
                WHERE operation_id = o.id AND competence >= v_cutoff AND expected_amount > received_amount
            ), 0) as future_amount,
            COALESCE((SELECT SUM(expected_amount) FROM public.investment_installments WHERE operation_id = o.id), 0) as total_previsto
        FROM public.investment_operations o
        WHERE o.id IN (SELECT operation_id FROM membership_ops)
    ),
    totals AS (
        SELECT
            p_year as scope_year,
            COALESCE(SUM(invested_capital), 0) as total_invested,
            COALESCE(SUM(total_received), 0) as total_received,
            COALESCE(SUM(invested_capital - total_received), 0) as capital_to_recover,
            COALESCE(SUM(total_previsto), 0) as total_previsto_carteira,
            COALESCE(SUM(overdue_amount + future_amount), 0) as total_a_receber,
            COALESCE(SUM(overdue_amount), 0) as overdue_receivable,
            COALESCE(SUM(future_amount), 0) as future_receivable,
            COALESCE(GREATEST(SUM(total_received) - SUM(invested_capital), 0), 0) as realized_profit,
            COALESCE(SUM(total_previsto) - SUM(invested_capital), 0) as projected_result,
            CASE WHEN COALESCE(SUM(invested_capital), 0) > 0 
                 THEN ROUND((COALESCE(SUM(total_received), 0) / SUM(invested_capital)) * 100, 1) 
                 ELSE 0 END as recovery_percentage,
            COUNT(*) as total_operations,
            (SELECT COUNT(*) FROM public.investment_installments i 
             WHERE i.operation_id IN (SELECT operation_id FROM membership_ops) 
               AND i.competence < v_cutoff AND i.expected_amount > i.received_amount) as overdue_installments,
            (SELECT COUNT(*) FROM public.investment_installments i 
             WHERE i.operation_id IN (SELECT operation_id FROM membership_ops)) as total_installments
        FROM op_stats
    )
    SELECT row_to_json(t) INTO result FROM totals t;
    
    RETURN result;
END;
$$ ;

CREATE OR REPLACE FUNCTION public.get_overdue_breakdown(
    p_year integer DEFAULT NULL::integer, 
    p_cutoff_competence date DEFAULT '2026-08-01'::date
)
RETURNS TABLE(reference text, competence date, amount numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    o.reference,
    i.competence,
    (i.expected_amount - i.received_amount) as amount
  FROM public.investment_installments i
  JOIN public.investment_operations o ON o.id = i.operation_id
  JOIN public.portfolio_memberships pm ON pm.operation_id = o.id
  WHERE (p_year IS NULL OR pm.portfolio_year = p_year)
    AND pm.is_active = true
    AND i.competence < COALESCE(p_cutoff_competence, '2026-08-01'::date)
    AND i.expected_amount > i.received_amount
  ORDER BY i.competence ASC, o.reference ASC;
$$ ;

GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(integer, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(integer, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_overdue_breakdown(integer, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_overdue_breakdown(integer, date) TO service_role;
