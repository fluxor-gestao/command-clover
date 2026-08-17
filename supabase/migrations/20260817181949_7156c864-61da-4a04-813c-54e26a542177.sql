CREATE OR REPLACE FUNCTION public.clear_portfolio_data(p_year int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Clear All Investment Data (Unconditional for total reset)
    -- The user wants a clean slate for the new V3 import.
    DELETE FROM public.investment_receipt_allocations WHERE id IS NOT NULL;
    DELETE FROM public.investment_receipts WHERE id IS NOT NULL;
    DELETE FROM public.investment_installments WHERE id IS NOT NULL;
    DELETE FROM public.investment_contributions WHERE id IS NOT NULL;
    DELETE FROM public.portfolio_memberships WHERE id IS NOT NULL;
    DELETE FROM public.investment_operations WHERE id IS NOT NULL;

    -- 2. Clear Import History and Issues
    DELETE FROM public.investment_import_issues WHERE id IS NOT NULL;
    DELETE FROM public.investment_imports WHERE id IS NOT NULL;
    
    -- 3. Clear Sync Runs and Audit Logs
    DELETE FROM public.sync_runs WHERE id IS NOT NULL;
    DELETE FROM public.investment_audit_log WHERE id IS NOT NULL;

    -- 4. Clear Rentals
    DELETE FROM public.rental_receipts WHERE id IS NOT NULL;
    DELETE FROM public.rental_properties WHERE id IS NOT NULL;

    -- 5. Clear References
    DELETE FROM public.investment_references WHERE id IS NOT NULL;
END;
$$;