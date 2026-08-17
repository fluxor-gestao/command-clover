# Plan: Forced Total Reset of Operations and Schedule

The user reported that even after clearing the portfolio, operations, installments, and receipts still persist. Investigation shows that 88 operations and hundreds of installments remain in the database because they aren't linked to a membership row for the year 2026, or the previous cleanup logic for orphan operations failed due to lack of source_hash or explicit filtering.

## Proposed Changes

### Database (Supabase)

- Modify `clear_portfolio_data(p_year int)` to perform a **unconditional global reset** of core investment tables.
- Since the user's intent is to "zero everything" before a new V3 import, we will remove the restriction that only deletes operations tied to a specific year.
- Explicitly target all operations, installments, receipts, and allocations.

### SQL Migration

```sql
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
```

## Verification Plan

### Database Check
- Execute `SELECT clear_portfolio_data(2026);`
- Verify that `investment_operations`, `investment_installments`, and `investment_receipts` counts are all **0**.

### UI Check
- Verify that the "Operações" and "Parcelas" views in the system are empty.
