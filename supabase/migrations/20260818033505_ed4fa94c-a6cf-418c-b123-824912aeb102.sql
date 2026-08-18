
-- 1. Garantir que as tabelas existem e têm permissões básicas
GRANT ALL ON TABLE public.investment_operations TO authenticated, service_role;
GRANT ALL ON TABLE public.investment_installments TO authenticated, service_role;
GRANT ALL ON TABLE public.investment_receipts TO authenticated, service_role;
GRANT ALL ON TABLE public.investment_receipt_allocations TO authenticated, service_role;
GRANT ALL ON TABLE public.investment_contributions TO authenticated, service_role;
GRANT ALL ON TABLE public.portfolio_memberships TO authenticated, service_role;
GRANT ALL ON TABLE public.sync_runs TO authenticated, service_role;
GRANT ALL ON TABLE public.investment_import_issues TO authenticated, service_role;
GRANT ALL ON TABLE public.rental_properties TO authenticated, service_role;
GRANT ALL ON TABLE public.rental_receipts TO authenticated, service_role;

-- 2. Reforçar políticas de RLS para permitir UPSERT/INSERT
DO $$ 
BEGIN
    -- Sync Runs
    DROP POLICY IF EXISTS "Users can manage their own sync runs" ON public.sync_runs;
    CREATE POLICY "Users can manage their own sync runs" ON public.sync_runs
        FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Import Issues
    DROP POLICY IF EXISTS "Users can manage issues of their imports" ON public.investment_import_issues;
    CREATE POLICY "Users can manage issues of their imports" ON public.investment_import_issues
        FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Operações
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.investment_operations;
    CREATE POLICY "Allow all for authenticated users" ON public.investment_operations
        FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Parcelas
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.investment_installments;
    CREATE POLICY "Allow all for authenticated users" ON public.investment_installments
        FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Recebimentos
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.investment_receipts;
    CREATE POLICY "Allow all for authenticated users" ON public.investment_receipts
        FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Alocações
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.investment_receipt_allocations;
    CREATE POLICY "Allow all for authenticated users" ON public.investment_receipt_allocations
        FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Membros da Carteira
    DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.portfolio_memberships;
    CREATE POLICY "Allow all for authenticated users" ON public.portfolio_memberships
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;
