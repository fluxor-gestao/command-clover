-- 1. Create investment_references table
CREATE TABLE IF NOT EXISTS public.investment_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category_id UUID REFERENCES public.investment_categories(id),
    description TEXT,
    active BOOLEAN DEFAULT true,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- 2. Add reference_id to investment_operations
ALTER TABLE public.investment_operations ADD COLUMN IF NOT EXISTS reference_id UUID REFERENCES public.investment_references(id);

-- 3. Migration: Extract existing references and link them
DO $$
DECLARE
    rec RECORD;
    ref_id UUID;
BEGIN
    FOR rec IN SELECT DISTINCT reference, category_id, source FROM public.investment_operations LOOP
        INSERT INTO public.investment_references (name, category_id, source)
        VALUES (rec.reference, rec.category_id, rec.source)
        ON CONFLICT (name) DO UPDATE SET category_id = EXCLUDED.category_id
        RETURNING id INTO ref_id;

        UPDATE public.investment_operations
        SET reference_id = ref_id
        WHERE reference = rec.reference;
    END LOOP;
END $$;

-- 4. Enable RLS
ALTER TABLE public.investment_references ENABLE ROW LEVEL SECURITY;

-- 5. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_references TO authenticated;
GRANT ALL ON public.investment_references TO service_role;

-- 6. Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'investment_references' 
        AND policyname = 'Enable all for authenticated users'
    ) THEN
        CREATE POLICY "Enable all for authenticated users" ON public.investment_references
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 7. Drop views to avoid dependency issues when changing join logic
DROP VIEW IF EXISTS public.v_portfolio_summary CASCADE;
DROP VIEW IF EXISTS public.v_operation_position CASCADE;

-- 8. Re-create v_operation_position with reference join
CREATE OR REPLACE VIEW public.v_operation_position AS
WITH operation_metrics AS (
    SELECT 
        o.id as operation_id,
        COALESCE(r.name, o.reference) as reference,
        COALESCE(r.category_id, o.category_id) as category_id,
        c.name as category,
        o.initial_capital,
        o.contracted_total,
        o.status,
        o.import_status,
        o.source,
        o.investment_date,
        o.first_due_date,
        o.due_day,
        o.installment_count,
        o.installment_value,
        o.notes,
        o.description,
        o.cancelled_at,
        (SELECT MIN(due_date) FROM investment_installments WHERE operation_id = o.id) as first_installment_due,
        (SELECT MAX(due_date) FROM investment_installments WHERE operation_id = o.id) as last_installment_due,
        (SELECT COUNT(*) FROM investment_installments WHERE operation_id = o.id) as total_installments,
        (SELECT COALESCE(SUM(amount), 0) FROM investment_contributions WHERE operation_id = o.id AND cancelled_at IS NULL) as total_invested_contributions,
        (SELECT COALESCE(SUM(total_amount), 0) FROM investment_receipts WHERE operation_id = o.id AND cancelled_at IS NULL) as total_received,
        (SELECT COUNT(*) FROM investment_receipts WHERE operation_id = o.id AND cancelled_at IS NULL) as receipts_count
    FROM investment_operations o
    LEFT JOIN investment_references r ON o.reference_id = r.id
    LEFT JOIN investment_categories c ON COALESCE(r.category_id, o.category_id) = c.id
),
installment_stats AS (
    SELECT 
        operation_id,
        COUNT(*) FILTER (WHERE payment_status != 'PAID') as open_installments,
        COUNT(*) FILTER (WHERE payment_status != 'PAID' AND due_date < CURRENT_DATE) as overdue_installments,
        SUM(expected_amount) as contracted_total_calc,
        SUM(expected_amount) FILTER (WHERE payment_status != 'PAID') as future_receivable,
        SUM(expected_amount) FILTER (WHERE payment_status != 'PAID' AND due_date < CURRENT_DATE) as overdue_receivable
    FROM v_installments
    GROUP BY operation_id
)
SELECT 
    m.*,
    s.open_installments,
    s.overdue_installments,
    s.contracted_total_calc,
    s.future_receivable,
    s.overdue_receivable,
    (m.initial_capital + m.total_invested_contributions) as total_invested,
    (s.contracted_total_calc - m.total_received) as capital_to_recover,
    (s.contracted_total_calc - (m.initial_capital + m.total_invested_contributions)) as projected_result,
    CASE 
        WHEN (m.initial_capital + m.total_invested_contributions) > 0 
        THEN (m.total_received / (m.initial_capital + m.total_invested_contributions)) * 100 
        ELSE 0 
    END as recovery_percentage,
    CASE
        WHEN m.cancelled_at IS NOT NULL THEN 'CANCELADA'
        WHEN s.overdue_installments > 0 THEN 'INADIMPLENTE'
        WHEN s.open_installments = 0 AND m.total_received >= s.contracted_total_calc THEN 'QUITADA'
        ELSE 'ATIVA'
    END as computed_status
FROM operation_metrics m
LEFT JOIN installment_stats s ON m.operation_id = s.operation_id;

ALTER VIEW public.v_operation_position SET (security_invoker = on);

-- 9. Re-create v_portfolio_summary
CREATE OR REPLACE VIEW public.v_portfolio_summary AS
SELECT 
    COUNT(*) as total_operations,
    SUM(total_invested) as total_invested,
    SUM(total_received) as total_received,
    SUM(overdue_receivable) as total_overdue,
    SUM(future_receivable) as total_future,
    SUM(projected_result) as total_projected_result,
    COUNT(*) FILTER (WHERE computed_status = 'INADIMPLENTE') as delinquent_operations
FROM v_operation_position
WHERE computed_status != 'CANCELADA';

ALTER VIEW public.v_portfolio_summary SET (security_invoker = on);
