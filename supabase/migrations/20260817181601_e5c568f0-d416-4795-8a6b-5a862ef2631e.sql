CREATE OR REPLACE FUNCTION public.clear_portfolio_data(p_year int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_op_ids uuid[];
BEGIN
    -- 1. Identify all operations belonging to this portfolio year
    SELECT array_agg(operation_id) 
    INTO v_op_ids
    FROM public.portfolio_memberships
    WHERE portfolio_year = p_year;

    IF v_op_ids IS NOT NULL THEN
        -- 2. Delete receipts, installments, and contributions
        DELETE FROM public.investment_receipt_allocations WHERE id IS NOT NULL; 
        DELETE FROM public.investment_receipts WHERE operation_id = ANY(v_op_ids);
        DELETE FROM public.investment_installments WHERE operation_id = ANY(v_op_ids);
        DELETE FROM public.investment_contributions WHERE operation_id = ANY(v_op_ids);

        -- 3. Delete memberships
        DELETE FROM public.portfolio_memberships WHERE portfolio_year = p_year;
        
        -- 4. Delete orphan operations
        DELETE FROM public.investment_operations
        WHERE id = ANY(v_op_ids)
          AND NOT EXISTS (
              SELECT 1 FROM public.portfolio_memberships 
              WHERE operation_id = investment_operations.id 
                AND portfolio_year != p_year
          );
    END IF;

    -- 5. Clear Import History and Issues
    DELETE FROM public.investment_import_issues WHERE id IS NOT NULL;
    DELETE FROM public.investment_imports WHERE id IS NOT NULL;
    
    -- 6. Clear Sync Runs and Audit Logs
    DELETE FROM public.sync_runs WHERE id IS NOT NULL;
    DELETE FROM public.investment_audit_log WHERE id IS NOT NULL;

    -- 7. Clear Rentals
    DELETE FROM public.rental_receipts WHERE id IS NOT NULL;
    DELETE FROM public.rental_properties WHERE id IS NOT NULL;

    -- 8. Clear orphaned references
    DELETE FROM public.investment_references WHERE source = 'EXCEL' AND id IS NOT NULL;
END;
$$;