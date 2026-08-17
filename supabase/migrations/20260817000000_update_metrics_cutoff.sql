-- Atualiza a RPC de métricas para aceitar cutoff_competence
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
            o.invested_capital,
            COALESCE(SUM(r.amount), 0) as total_received,
            -- Inadimplência: competência < cutoff E não recebido
            COALESCE(SUM(CASE WHEN i.competence < v_cutoff THEN i.expected_amount - i.received_amount ELSE 0 END), 0) as overdue_amount,
            -- A receber futuro: competência >= cutoff E não recebido
            COALESCE(SUM(CASE WHEN i.competence >= v_cutoff THEN i.expected_amount - i.received_amount ELSE 0 END), 0) as future_amount
        FROM public.investment_operations o
        JOIN membership_ops mo ON mo.operation_id = o.id
        LEFT JOIN public.investment_installments i ON i.operation_id = o.id
        LEFT JOIN public.investment_receipts r ON r.installment_id = i.id
        GROUP BY o.id, o.invested_capital
    )
    SELECT json_build_object(
        'invested_capital', SUM(invested_capital),
        'total_received', SUM(total_received),
        'capital_to_recover', SUM(invested_capital) - SUM(total_received),
        'overdue_amount', SUM(overdue_amount),
        'future_amount', SUM(future_amount),
        'total_to_receive', SUM(overdue_amount) + SUM(future_amount),
        'active_operations', COUNT(*),
        'recovery_rate', CASE WHEN SUM(invested_capital) > 0 
            THEN (SUM(total_received) / SUM(invested_capital)) * 100 
            ELSE 0 END,
        'profit_amount', SUM(total_received) - SUM(invested_capital) -- Simplificado para homologação
    ) INTO result
    FROM op_stats;

    RETURN result;
END;
$$;

-- RPC para detalhamento da inadimplência
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
$$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(integer, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_overdue_breakdown(integer, date) TO authenticated;
