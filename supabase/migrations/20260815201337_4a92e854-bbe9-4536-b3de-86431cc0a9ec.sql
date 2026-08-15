
-- Revogar acesso público padrão (anon) das funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.register_receipt(uuid, date, jsonb, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.cancel_receipt(uuid) FROM public;

-- Garantir acesso para usuários autenticados e service_role
GRANT EXECUTE ON FUNCTION public.register_receipt(uuid, date, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_receipt(uuid, date, jsonb, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.cancel_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_receipt(uuid) TO service_role;

-- A função get_portfolio_metrics já possui os GRANTs corretos na migração anterior
