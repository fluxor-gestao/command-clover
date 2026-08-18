
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_import_issues TO authenticated;
GRANT ALL ON public.investment_import_issues TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_runs' AND policyname = 'Users can manage their own sync runs') THEN
        CREATE POLICY "Users can manage their own sync runs" ON public.sync_runs
            FOR ALL TO authenticated USING (auth.uid() = created_by);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'investment_import_issues' AND policyname = 'Users can manage issues of their imports') THEN
        CREATE POLICY "Users can manage issues of their imports" ON public.investment_import_issues
            FOR ALL TO authenticated USING (
                EXISTS (SELECT 1 FROM public.sync_runs WHERE id = import_id AND created_by = auth.uid())
            );
    END IF;
END $$;
