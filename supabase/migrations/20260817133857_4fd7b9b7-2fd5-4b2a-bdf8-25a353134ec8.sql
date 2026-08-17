-- Resetando memberships de 2026 para sincronização estrita com a Base2026
UPDATE public.portfolio_memberships SET is_active = false WHERE portfolio_year = 2026;

-- Garantir acesso service_role para as novas RPCs
GRANT EXECUTE ON FUNCTION public.get_portfolio_metrics(integer, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_overdue_breakdown(integer, date) TO service_role;