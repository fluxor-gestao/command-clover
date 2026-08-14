CREATE TABLE IF NOT EXISTS public.portfolio_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id uuid NOT NULL REFERENCES public.investment_operations(id) ON DELETE CASCADE,
    portfolio_year integer NOT NULL,
    is_active boolean DEFAULT true,
    source text DEFAULT 'controle_gerencial',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(operation_id, portfolio_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_memberships TO authenticated;
GRANT ALL ON public.portfolio_memberships TO service_role;

ALTER TABLE public.portfolio_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their portfolio memberships"
ON public.portfolio_memberships FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage portfolio memberships"
ON public.portfolio_memberships FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Criar VIEW para facilitar acesso à carteira
CREATE OR REPLACE VIEW public.v_portfolio_memberships AS
SELECT 
    pm.*,
    o.reference,
    o.initial_capital,
    o.investment_date,
    o.status as operation_status,
    r.name as reference_name,
    c.name as category_name
FROM public.portfolio_memberships pm
JOIN public.investment_operations o ON pm.operation_id = o.id
JOIN public.investment_references r ON o.reference_id = r.id
LEFT JOIN public.investment_categories c ON r.category_id = c.id;

GRANT SELECT ON public.v_portfolio_memberships TO authenticated;
