
DROP FUNCTION IF EXISTS public.get_portfolio_metrics(integer);

CREATE OR REPLACE FUNCTION public.get_portfolio_metrics(p_year integer)
 RETURNS TABLE(
    year integer, 
    total_investido numeric, 
    total_recebido numeric, 
    capital_a_recuperar numeric, 
    total_previsto_carteira numeric, 
    total_a_receber numeric, 
    inadimplente numeric, 
    projetado_futuro numeric, 
    lucro_realizado numeric, 
    resultado_projetado numeric, 
    percentual_recuperado numeric, 
    operacoes_ativas integer, 
    parcelas_atrasadas integer, 
    total_parcelas integer
 )
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_reference_month date := CURRENT_DATE;
BEGIN
  RETURN QUERY
  WITH ops_scope AS (
    SELECT o.id, o.initial_capital, o.contracted_total
    FROM public.investment_operations o
    WHERE EXISTS (
         SELECT 1 FROM public.portfolio_memberships pm
         WHERE pm.operation_id = o.id AND pm.portfolio_year = p_year AND pm.is_active = true
    )
  ),
  contribs AS (
    SELECT c.operation_id, SUM(c.amount) as total
    FROM public.investment_contributions c
    WHERE c.cancelled_at IS NULL AND c.operation_id IN (SELECT id FROM ops_scope)
    GROUP BY c.operation_id
  ),
  invested_calc AS (
    SELECT 
      SUM(o.initial_capital + COALESCE(c.total, 0)) as total_investido
    FROM ops_scope o
    LEFT JOIN contribs c ON o.id = c.operation_id
  ),
  received_calc AS (
    SELECT SUM(r.total_amount) as total_recebido
    FROM public.investment_receipts r
    WHERE r.cancelled_at IS NULL AND r.operation_id IN (SELECT id FROM ops_scope)
  ),
  installments_calc AS (
    SELECT
      SUM(CASE WHEN i.due_date < v_reference_month THEN i.outstanding_amount ELSE 0 END) as overdue,
      SUM(CASE WHEN i.due_date >= v_reference_month THEN i.outstanding_amount ELSE 0 END) as future,
      SUM(i.outstanding_amount) as total_a_receber,
      SUM(i.expected_amount) as total_previsto,
      COUNT(*) FILTER (WHERE i.due_date < v_reference_month AND i.outstanding_amount > 0) as overdue_count,
      COUNT(*) as total_count
    FROM public.v_installments i
    WHERE i.operation_id IN (SELECT id FROM ops_scope)
  )
  SELECT
    p_year,
    COALESCE(inv.total_investido, 0),
    COALESCE(rec.total_recebido, 0),
    GREATEST(COALESCE(inv.total_investido, 0) - COALESCE(rec.total_recebido, 0), 0),
    COALESCE(ins.total_previsto, 0),
    COALESCE(ins.total_a_receber, 0),
    COALESCE(ins.overdue, 0),
    COALESCE(ins.future, 0),
    GREATEST(COALESCE(rec.total_recebido, 0) - COALESCE(inv.total_investido, 0), 0),
    COALESCE(ins.total_previsto, 0) - COALESCE(inv.total_investido, 0),
    CASE WHEN COALESCE(inv.total_investido, 0) > 0 THEN LEAST(COALESCE(rec.total_recebido, 0) / inv.total_investido, 1.0) ELSE 0 END,
    (SELECT COUNT(*)::integer FROM ops_scope),
    COALESCE(ins.overdue_count, 0)::integer,
    COALESCE(ins.total_count, 0)::integer
  FROM invested_calc inv, received_calc rec, installments_calc ins;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.check_sync_conflict(p_operation_id uuid, p_incoming_hash text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_current_hash text;
    v_updated_at timestamptz;
    v_last_synced timestamptz;
BEGIN
    SELECT source_hash, updated_at, last_synced_at 
    INTO v_current_hash, v_updated_at, v_last_synced
    FROM public.investment_operations
    WHERE id = p_operation_id;

    IF COALESCE(v_current_hash, '') = COALESCE(p_incoming_hash, '') THEN
        RETURN 'INALTERADO';
    END IF;

    IF v_last_synced IS NOT NULL AND v_updated_at > v_last_synced + interval '2 seconds' THEN
        RETURN 'CONFLITO';
    END IF;

    RETURN 'ALTERADO_NO_EXCEL';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_sync_conflict(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_sync_conflict(uuid, text) TO service_role;
