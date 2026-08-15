
DROP FUNCTION IF EXISTS public.get_portfolio_metrics(integer);

CREATE OR REPLACE FUNCTION public.get_portfolio_metrics(p_year integer DEFAULT NULL)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today date := CURRENT_DATE;
BEGIN
    RETURN QUERY
    WITH targets AS (
        SELECT DISTINCT o.id, o.initial_capital
        FROM public.investment_operations o
        LEFT JOIN public.portfolio_memberships pm ON pm.operation_id = o.id
        WHERE (p_year IS NULL AND o.import_status = 'VALIDADO')
           OR (p_year IS NOT NULL AND pm.portfolio_year = p_year AND pm.is_active = true)
    ),
    receipt_sums AS (
        SELECT 
            r.operation_id,
            SUM(r.total_amount) as total_received
        FROM public.investment_receipts r
        WHERE r.operation_id IN (SELECT id FROM targets)
          AND r.cancelled_at IS NULL
        GROUP BY r.operation_id
    ),
    installment_metrics AS (
        SELECT
            i.operation_id,
            SUM(i.expected_amount) as total_expected,
            SUM(CASE WHEN i.due_date < v_today THEN (i.expected_amount - i.received_amount) ELSE 0 END) as overdue_amount,
            SUM(CASE WHEN i.due_date >= v_today THEN i.expected_amount ELSE 0 END) as future_amount,
            COUNT(*) as total_count,
            COUNT(CASE WHEN i.due_date < v_today AND i.expected_amount > i.received_amount THEN 1 END) as overdue_count
        FROM public.investment_installments i
        WHERE i.operation_id IN (SELECT id FROM targets)
        GROUP BY i.operation_id
    ),
    final_metrics AS (
        SELECT
            p_year as scope_year,
            COALESCE(SUM(t.initial_capital), 0) as total_invested,
            COALESCE(SUM(rs.total_received), 0) as total_received,
            COALESCE(SUM(GREATEST(t.initial_capital - COALESCE(rs.total_received, 0), 0)), 0) as capital_to_recover,
            COALESCE(SUM(im.total_expected), 0) as total_previsto_carteira,
            COALESCE(SUM(im.overdue_amount), 0) as overdue_receivable,
            COALESCE(SUM(im.future_amount), 0) as future_receivable,
            COALESCE(SUM(im.total_count), 0) as total_installments,
            COALESCE(SUM(im.overdue_count), 0) as overdue_installments,
            (SELECT COUNT(*) FROM targets) as total_operations
        FROM targets t
        LEFT JOIN receipt_sums rs ON rs.operation_id = t.id
        LEFT JOIN installment_metrics im ON im.operation_id = t.id
    )
    SELECT json_build_object(
        'scope_year', scope_year,
        'total_invested', total_invested,
        'total_received', total_received,
        'capital_to_recover', capital_to_recover,
        'total_previsto_carteira', total_previsto_carteira,
        'total_a_receber', total_previsto_carteira,
        'overdue_receivable', overdue_receivable,
        'future_receivable', future_receivable,
        'realized_profit', GREATEST(total_received - total_invested, 0),
        'projected_result', total_previsto_carteira - total_invested,
        'recovery_percentage', CASE WHEN total_invested > 0 THEN (total_received / total_invested) ELSE 0 END,
        'total_operations', total_operations,
        'overdue_installments', overdue_installments,
        'total_installments', total_installments
    )
    FROM final_metrics;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(integer) TO service_role;
