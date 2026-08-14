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

-- Seed da Carteira 2026 (baseado no Controle Gerencial)
INSERT INTO public.portfolio_memberships (operation_id, portfolio_year, is_active, source) VALUES
('14ed08e3-99cf-43a7-a0cd-374cf42b8ce7', 2026, true, 'controle_gerencial'),
('e34a4650-1bcd-49a1-8ca5-35e7c8fa4e7c', 2026, true, 'controle_gerencial'),
('e8a781f5-8040-4d5f-8be9-e05c577e00c7', 2026, true, 'controle_gerencial'),
('c00b43c9-813e-4b9c-9448-513527a87326', 2026, true, 'controle_gerencial'),
('7f59b375-ab62-4fb9-be70-7b0d11a698b6', 2026, true, 'controle_gerencial'),
('a255eab9-bd12-4bc1-b11c-79a4195a39dc', 2026, true, 'controle_gerencial'),
('c221e215-11ca-4967-97a0-818232cc95cb', 2026, true, 'controle_gerencial'),
('3afd72e1-9c79-4a7f-b93c-4dd8165054d8', 2026, true, 'controle_gerencial'),
('95d27e88-4999-465b-99b1-4109908a4d91', 2026, true, 'controle_gerencial'),
('64ce3e31-028d-43e9-92b1-8faf9a6fb04f', 2026, true, 'controle_gerencial'),
('e1d3d48f-d0a0-4bb4-86bf-4ed70d4fed9f', 2026, true, 'controle_gerencial'),
('92945757-8eb3-4518-9894-fdac0057f40f', 2026, true, 'controle_gerencial'),
('ffa750d9-d865-4ad6-b899-0fe6079f2a93', 2026, true, 'controle_gerencial'),
('1eac9f65-a4fb-42d7-86d8-c2e0a2684f6d', 2026, true, 'controle_gerencial'),
('faf1c74d-f28e-49c5-b45d-7905199d8b20', 2026, true, 'controle_gerencial'),
('214a4010-22db-49fe-9aca-fc3c3d14a863', 2026, true, 'controle_gerencial'),
('0e836c9d-3387-4852-84b3-64a9e23fe16a', 2026, true, 'controle_gerencial'),
('c452693c-8c9f-4c48-a06a-549b48882143', 2026, true, 'controle_gerencial'),
('f9e21a72-2ca5-4c61-bddd-5dbb31d7a955', 2026, true, 'controle_gerencial'),
('dde2a210-bf39-432c-b632-0d469aacdba0', 2026, true, 'controle_gerencial'),
('d6e77064-0c1b-4b21-b2d6-470f293fd9b5', 2026, true, 'controle_gerencial'),
('848bd5a4-fb2b-4659-a761-b07f14c3df91', 2026, true, 'controle_gerencial'),
('0e37003e-33b8-4c36-baab-afb9708f1b1b', 2026, true, 'controle_gerencial'),
('35f985df-49dc-4c5c-9a46-267f270ad191', 2026, true, 'controle_gerencial'),
('37def0f3-ed01-4c5c-b196-57a874f16db8', 2026, true, 'controle_gerencial'),
('11d767d3-65fa-4ab1-9b4f-6343f0967a6c', 2026, true, 'controle_gerencial'),
('1abab968-e2df-4ac1-ad14-8db38ff44945', 2026, true, 'controle_gerencial')
ON CONFLICT (operation_id, portfolio_year) DO NOTHING;

-- Atualizar RPC de métricas para considerar a carteira se o ano for fornecido
CREATE OR REPLACE FUNCTION public.get_portfolio_metrics(p_year integer DEFAULT NULL)
RETURNS TABLE (
  scope_year integer,
  total_invested numeric,
  total_received numeric,
  capital_to_recover numeric,
  total_previsto_carteira numeric,
  total_a_receber numeric,
  overdue_receivable numeric,
  future_receivable numeric,
  realized_profit numeric,
  projected_result numeric,
  recovery_percentage numeric,
  total_operations bigint,
  overdue_installments bigint,
  total_installments bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH ops_scope AS (
    -- Se p_year for NULL, pega toda a base histórica
    -- Se p_year for informado, pega apenas as operações que pertencem à carteira daquele ano
    SELECT o.id, o.initial_capital
    FROM public.investment_operations o
    WHERE 
      (p_year IS NULL AND o.import_status <> 'DESCARTADO')
      OR
      (p_year IS NOT NULL AND o.id IN (
         SELECT pm.operation_id 
         FROM public.portfolio_memberships pm 
         WHERE pm.portfolio_year = p_year AND pm.is_active = true
      ))
  ),
  contribs AS (
    SELECT c.operation_id, SUM(c.amount) as total
    FROM public.investment_contributions c
    WHERE c.cancelled_at IS NULL AND c.operation_id IN (SELECT id FROM ops_scope)
    GROUP BY c.operation_id
  ),
  base_invested AS (
    SELECT 
      SUM(o.initial_capital + COALESCE(c.total, 0)) as total
    FROM ops_scope o
    LEFT JOIN contribs c ON o.id = c.operation_id
  ),
  base_received AS (
    SELECT SUM(r.amount) as total
    FROM public.investment_receipts r
    JOIN public.investment_operations o ON r.operation_id = o.id
    WHERE r.cancelled_at IS NULL AND o.id IN (SELECT id FROM ops_scope)
  ),
  installs AS (
    -- Aqui filtramos parcelas: 
    -- Se p_year for NULL: todas as parcelas das operações do escopo
    -- Se p_year for NOT NULL: apenas parcelas das operações do escopo COM competência no ano
    -- Nota: O usuário quer que o fechamento financeiro do painel 2026 reflita o ano.
    -- Para o Dashboard 2026, 'Total a Receber' deve ser o que falta receber DAS parcelas de 2026.
    SELECT 
      SUM(i.outstanding_amount) as a_receber,
      SUM(CASE WHEN i.due_date < CURRENT_DATE THEN i.outstanding_amount ELSE 0 END) as overdue,
      SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END) as future,
      COUNT(*) FILTER (WHERE i.due_date < CURRENT_DATE AND i.outstanding_amount > 0) as overdue_count,
      COUNT(*) as total_count
    FROM public.investment_installments i
    JOIN public.investment_operations o ON i.operation_id = o.id
    WHERE 
      o.id IN (SELECT id FROM ops_scope)
      AND
      (p_year IS NULL OR EXTRACT(YEAR FROM i.due_date) = p_year)
  )
  SELECT
    p_year,
    COALESCE(inv.total, 0),
    COALESCE(rec.total, 0),
    GREATEST(COALESCE(inv.total, 0) - COALESCE(rec.total, 0), 0),
    0.0, -- total_previsto_carteira (placeholder)
    COALESCE(ins.a_receber, 0),
    COALESCE(ins.overdue, 0),
    COALESCE(ins.future, 0),
    GREATEST(COALESCE(rec.total, 0) - COALESCE(inv.total, 0), 0),
    COALESCE(rec.total, 0) - COALESCE(inv.total, 0), -- projected_result (simplified)
    CASE WHEN COALESCE(inv.total, 0) > 0 THEN LEAST(COALESCE(rec.total, 0) / inv.total, 1.0) ELSE 0 END,
    (SELECT COUNT(*) FROM ops_scope),
    COALESCE(ins.overdue_count, 0),
    COALESCE(ins.total_count, 0)
  FROM base_invested inv, base_received rec, installs ins;
END;
$$;
