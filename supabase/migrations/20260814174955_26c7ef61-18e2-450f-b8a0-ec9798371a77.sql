-- Infraestrutura de Segurança (Roles)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Carteira Gerencial
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

-- Políticas de RLS com cast explícito
DROP POLICY IF EXISTS "Users can view their portfolio memberships" ON public.portfolio_memberships;
CREATE POLICY "Users can view their portfolio memberships"
ON public.portfolio_memberships FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage portfolio memberships" ON public.portfolio_memberships;
CREATE POLICY "Admins can manage portfolio memberships"
ON public.portfolio_memberships FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

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

-- Seed da Carteira 2026 (IDs Auditados)
INSERT INTO public.portfolio_memberships (operation_id, portfolio_year, is_active, source) VALUES
('14ed08e3-99cf-43a7-a0cd-374cf42b8ce7', 2026, true, 'controle_gerencial_2026'),
('e34a4650-1bcd-49a1-8ca5-35e7c8fa4e7c', 2026, true, 'controle_gerencial_2026'),
('e8a781f5-8040-4d5f-8be9-e05c577e00c7', 2026, true, 'controle_gerencial_2026'),
('c00b43c9-813e-4b9c-9448-513527a87326', 2026, true, 'controle_gerencial_2026'),
('7f59b375-ab62-4fb9-be70-7b0d11a698b6', 2026, true, 'controle_gerencial_2026'),
('a255eab9-bd12-4bc1-b11c-79a4195a39dc', 2026, true, 'controle_gerencial_2026'),
('c221e215-11ca-4967-97a0-818232cc95cb', 2026, true, 'controle_gerencial_2026'),
('3afd72e1-9c79-4a7f-b93c-4dd8165054d8', 2026, true, 'controle_gerencial_2026'),
('95d27e88-4999-465b-99b1-4109908a4d91', 2026, true, 'controle_gerencial_2026'),
('64ce3e31-028d-43e9-92b1-8faf9a6fb04f', 2026, true, 'controle_gerencial_2026'),
('e1d3d48f-d0a0-4bb4-86bf-4ed70d4fed9f', 2026, true, 'controle_gerencial_2026'),
('92945757-8eb3-4518-9894-fdac0057f40f', 2026, true, 'controle_gerencial_2026'),
('ffa750d9-d865-4ad6-b899-0fe6079f2a93', 2026, true, 'controle_gerencial_2026'),
('1eac9f65-a4fb-42d7-86d8-c2e0a2684f6d', 2026, true, 'controle_gerencial_2026'),
('faf1c74d-f28e-49c5-b45d-7905199d8b20', 2026, true, 'controle_gerencial_2026'),
('214a4010-22db-49fe-9aca-fc3c3d14a863', 2026, true, 'controle_gerencial_2026'),
('0e836c9d-3387-4852-84b3-64a9e23fe16a', 2026, true, 'controle_gerencial_2026'),
('c452693c-8c9f-4c48-a06a-549b48882143', 2026, true, 'controle_gerencial_2026'),
('f9e21a72-2ca5-4c61-bddd-5dbb31d7a955', 2026, true, 'controle_gerencial_2026'),
('dde2a210-bf39-432c-b632-0d469aacdba0', 2026, true, 'controle_gerencial_2026'),
('d6e77064-0c1b-4b21-b2d6-470f293fd9b5', 2026, true, 'controle_gerencial_2026'),
('848bd5a4-fb2b-4659-a761-b07f14c3df91', 2026, true, 'controle_gerencial_2026'),
('0e37003e-33b8-4c36-baab-afb9708f1b1b', 2026, true, 'controle_gerencial_2026'),
('35f985df-49dc-4c5c-9a46-267f270ad191', 2026, true, 'controle_gerencial_2026'),
('37def0f3-ed01-4c5c-b196-57a874f16db8', 2026, true, 'controle_gerencial_2026'),
('11d767d3-65fa-4ab1-9b4f-6343f0967a6c', 2026, true, 'controle_gerencial_2026'),
('1abab968-e2df-4ac1-ad14-8db38ff44945', 2026, true, 'controle_gerencial_2026')
ON CONFLICT (operation_id, portfolio_year) DO NOTHING;

-- Atualizar RPC de métricas com Escopo Estrito (Sem Fallback)
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
    -- Escopo Estrito: 
    -- Se p_year for NULL, pega toda a base histórica (88 registros)
    -- Se p_year for informado, pega EXCLUSIVAMENTE da portfolio_memberships
    SELECT o.id, o.initial_capital
    FROM public.investment_operations o
    WHERE 
      (p_year IS NULL AND o.import_status <> 'DESCARTADO')
      OR
      (p_year IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.portfolio_memberships pm 
         WHERE pm.operation_id = o.id AND pm.portfolio_year = p_year AND pm.is_active = true
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
    WHERE r.cancelled_at IS NULL AND r.operation_id IN (SELECT id FROM ops_scope)
  ),
  installs AS (
    -- Filtro Temporal: Se p_year for informado, filtramos parcelas do ano.
    -- Se p_year for NULL, todas as parcelas das operações do escopo.
    SELECT 
      SUM(i.outstanding_amount) as a_receber,
      SUM(CASE WHEN i.due_date < CURRENT_DATE THEN i.outstanding_amount ELSE 0 END) as overdue,
      SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END) as future,
      COUNT(*) FILTER (WHERE i.due_date < CURRENT_DATE AND i.outstanding_amount > 0) as overdue_count,
      COUNT(*) as total_count
    FROM public.v_installments i
    WHERE 
      i.operation_id IN (SELECT id FROM ops_scope)
      AND
      (p_year IS NULL OR EXTRACT(YEAR FROM i.due_date) = p_year)
  )
  SELECT
    p_year,
    COALESCE(inv.total, 0),
    COALESCE(rec.total, 0),
    GREATEST(COALESCE(inv.total, 0) - COALESCE(rec.total, 0), 0),
    0.0, -- total_previsto_carteira
    COALESCE(ins.a_receber, 0),
    COALESCE(ins.overdue, 0),
    COALESCE(ins.future, 0),
    GREATEST(COALESCE(rec.total, 0) - COALESCE(inv.total, 0), 0),
    COALESCE(rec.total, 0) - COALESCE(inv.total, 0), -- projected_result
    CASE WHEN COALESCE(inv.total, 0) > 0 THEN LEAST(COALESCE(rec.total, 0) / inv.total, 1.0) ELSE 0 END,
    (SELECT COUNT(*) FROM ops_scope),
    COALESCE(ins.overdue_count, 0),
    COALESCE(ins.total_count, 0)
  FROM base_invested inv, base_received rec, installs ins;
END;
$$;