-- 1. Sync control columns (incremental)
ALTER TABLE public.investment_operations
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_own_property boolean NOT NULL DEFAULT false;

ALTER TABLE public.investment_receipts
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE public.investment_contributions
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE public.investment_imports
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'CARGA_HISTORICA';

CREATE UNIQUE INDEX IF NOT EXISTS investment_operations_source_key_uidx
  ON public.investment_operations (source_key) WHERE source_key IS NOT NULL;

-- 2. Rental properties (imóveis próprios)
CREATE TABLE IF NOT EXISTS public.rental_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid REFERENCES public.investment_references(id),
  name text NOT NULL,
  tenant_name text,
  due_day integer,
  current_rent numeric(14,2) NOT NULL DEFAULT 0,
  contract_start date,
  contract_end date,
  next_adjustment_date date,
  status text NOT NULL DEFAULT 'ATIVO',
  notes text,
  source text NOT NULL DEFAULT 'SISTEMA',
  source_key text UNIQUE,
  source_hash text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_properties TO authenticated;
GRANT ALL ON public.rental_properties TO service_role;
ALTER TABLE public.rental_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rental_props_all_auth ON public.rental_properties;
CREATE POLICY rental_props_all_auth ON public.rental_properties
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_rental_props_touch ON public.rental_properties;
CREATE TRIGGER trg_rental_props_touch BEFORE UPDATE ON public.rental_properties
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Rental receipts (nunca misturados com investment_receipts)
CREATE TABLE IF NOT EXISTS public.rental_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  competence date NOT NULL,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL,
  notes text,
  source text NOT NULL DEFAULT 'SISTEMA',
  source_key text UNIQUE,
  cancelled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rental_receipts TO authenticated;
GRANT ALL ON public.rental_receipts TO service_role;
ALTER TABLE public.rental_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rental_receipts_all_auth ON public.rental_receipts;
CREATE POLICY rental_receipts_all_auth ON public.rental_receipts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_rental_receipts_touch ON public.rental_receipts;
CREATE TRIGGER trg_rental_receipts_touch BEFORE UPDATE ON public.rental_receipts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Sync runs + conflict decisions
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  source_fingerprint text,
  mode text NOT NULL DEFAULT 'CONTROLE_GERENCIAL',
  status text NOT NULL DEFAULT 'PREVIEW',
  summary jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sync_runs_all_auth ON public.sync_runs;
CREATE POLICY sync_runs_all_auth ON public.sync_runs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Seed dos imóveis próprios, sem apagar histórico
INSERT INTO public.rental_properties (name, reference_id, status, source, source_key)
SELECT t.nome,
       (SELECT r.id FROM public.investment_references r
         WHERE upper(r.name) LIKE '%' || t.match || '%' LIMIT 1),
       'ATIVO', 'CONTROLE_GERENCIAL', 'cg-rental:' || t.match
FROM (VALUES
  ('TERRAÇOS DO ATLÂNTICO', 'TERRA'),
  ('CASA CIDADE 2000 - AL. HORTÊNCIAS', 'HORT'),
  ('CASA EUSÉBIO - JOÃO MOZART', 'MOZART'),
  ('LIVING - APT.1101 - MYKONOS', 'MYKONOS'),
  ('DENVER PLACE - APTO 202', 'DENVER')
) AS t(nome, match)
WHERE NOT EXISTS (
  SELECT 1 FROM public.rental_properties p WHERE p.source_key = 'cg-rental:' || t.match
);

UPDATE public.investment_operations o
   SET is_own_property = true
 WHERE upper(o.reference) LIKE ANY (ARRAY['%TERRA%','%HORT%','%MOZART%','%MYKONOS%','%DENVER%']);

UPDATE public.portfolio_memberships pm
   SET is_active = false, updated_at = now()
 WHERE pm.is_active = true
   AND EXISTS (
     SELECT 1 FROM public.investment_operations o
      WHERE o.id = pm.operation_id AND o.is_own_property = true
   );

-- 6. Métricas: excluir imóveis próprios da carteira de investimento
CREATE OR REPLACE FUNCTION public.get_portfolio_metrics(p_year integer DEFAULT NULL::integer)
 RETURNS TABLE(scope_year integer, total_invested numeric, total_received numeric, capital_to_recover numeric, total_previsto_carteira numeric, total_a_receber numeric, overdue_receivable numeric, future_receivable numeric, realized_profit numeric, projected_result numeric, recovery_percentage numeric, total_operations bigint, overdue_installments bigint, total_installments bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH ops_scope AS (
    SELECT o.id, o.initial_capital
    FROM public.investment_operations o
    WHERE o.is_own_property = false AND (
      (p_year IS NULL AND o.import_status <> 'DESCARTADO')
      OR
      (p_year IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.portfolio_memberships pm
         WHERE pm.operation_id = o.id AND pm.portfolio_year = p_year AND pm.is_active = true
      ))
    )
  ),
  contribs AS (
    SELECT c.operation_id, SUM(c.amount) as total
    FROM public.investment_contributions c
    WHERE c.cancelled_at IS NULL AND c.operation_id IN (SELECT id FROM ops_scope)
    GROUP BY c.operation_id
  ),
  base_invested AS (
    SELECT SUM(o.initial_capital + COALESCE(c.total, 0)) as total
    FROM ops_scope o
    LEFT JOIN contribs c ON o.id = c.operation_id
  ),
  base_received AS (
    SELECT SUM(r.total_amount) as total
    FROM public.investment_receipts r
    WHERE r.cancelled_at IS NULL AND r.operation_id IN (SELECT id FROM ops_scope)
  ),
  installs AS (
    SELECT
      SUM(i.outstanding_amount) as a_receber,
      SUM(CASE WHEN i.due_date < CURRENT_DATE THEN i.outstanding_amount ELSE 0 END) as overdue,
      SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN i.outstanding_amount ELSE 0 END) as future,
      COUNT(*) FILTER (WHERE i.due_date < CURRENT_DATE AND i.outstanding_amount > 0) as overdue_count,
      COUNT(*) as total_count
    FROM public.v_installments i
    WHERE i.operation_id IN (SELECT id FROM ops_scope)
      AND (p_year IS NULL OR EXTRACT(YEAR FROM i.due_date) = p_year)
  )
  SELECT
    p_year,
    COALESCE(inv.total, 0),
    COALESCE(rec.total, 0),
    GREATEST(COALESCE(inv.total, 0) - COALESCE(rec.total, 0), 0),
    0.0,
    COALESCE(ins.a_receber, 0),
    COALESCE(ins.overdue, 0),
    COALESCE(ins.future, 0),
    GREATEST(COALESCE(rec.total, 0) - COALESCE(inv.total, 0), 0),
    COALESCE(rec.total, 0) - COALESCE(inv.total, 0),
    CASE WHEN COALESCE(inv.total, 0) > 0 THEN LEAST(COALESCE(rec.total, 0) / inv.total, 1.0) ELSE 0 END,
    (SELECT COUNT(*) FROM ops_scope),
    COALESCE(ins.overdue_count, 0),
    COALESCE(ins.total_count, 0)
  FROM base_invested inv, base_received rec, installs ins;
END;
$function$;

-- 7. Resumo de aluguéis
CREATE OR REPLACE VIEW public.v_rental_position AS
SELECT p.*,
       COALESCE(y.received_year, 0) AS received_year,
       CASE WHEN p.status = 'ENCERRADO' THEN 0
            ELSE GREATEST((12 - COALESCE(y.months_received, 0)) * p.current_rent, 0) END AS receivable_year
FROM public.rental_properties p
LEFT JOIN (
  SELECT property_id,
         SUM(amount) AS received_year,
         COUNT(DISTINCT competence) AS months_received
    FROM public.rental_receipts
   WHERE cancelled_at IS NULL
     AND EXTRACT(YEAR FROM competence) = EXTRACT(YEAR FROM CURRENT_DATE)
   GROUP BY property_id
) y ON y.property_id = p.id;

GRANT SELECT ON public.v_rental_position TO authenticated;
GRANT ALL ON public.v_rental_position TO service_role;