-- =====================================================================
-- Plataforma de refeições por assinatura — 01: papéis, configuração,
-- clientes, catálogo (ingredientes, fichas técnicas) e estoque por lote.
-- Não remove nenhuma tabela anterior do projeto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Papéis da plataforma
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.platform_role AS ENUM ('admin', 'operacao', 'cozinha', 'financeiro', 'nutricionista', 'cliente');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.platform_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);
ALTER TABLE public.platform_user_roles ENABLE ROW LEVEL SECURITY;

-- Admin da plataforma tem todos os papéis implicitamente.
CREATE OR REPLACE FUNCTION public.has_any_role(_roles public.platform_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_user_roles
    WHERE user_id = auth.uid() AND (role = ANY(_roles) OR role = 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(ARRAY['operacao','cozinha','financeiro','nutricionista']::public.platform_role[])
$$;

CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS SETOF public.platform_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.platform_user_roles WHERE user_id = auth.uid()
$$;

DROP POLICY IF EXISTS "roles_select" ON public.platform_user_roles;
CREATE POLICY "roles_select" ON public.platform_user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_any_role(ARRAY['admin']::public.platform_role[]));
DROP POLICY IF EXISTS "roles_admin" ON public.platform_user_roles;
CREATE POLICY "roles_admin" ON public.platform_user_roles FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['admin']::public.platform_role[]))
  WITH CHECK (public.has_any_role(ARRAY['admin']::public.platform_role[]));

-- Administradores já existentes no projeto viram administradores da plataforma.
DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    INSERT INTO public.platform_user_roles (user_id, role)
    SELECT user_id, 'admin'::public.platform_role FROM public.user_roles WHERE role::text = 'admin'
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Configuração operacional e financeira
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  business_name text NOT NULL DEFAULT 'Kit Fit',
  card_fee_pct numeric(7,5) NOT NULL DEFAULT 0.0399,
  pix_fee_pct numeric(7,5) NOT NULL DEFAULT 0.0099,
  tax_pct numeric(7,5) NOT NULL DEFAULT 0.06,
  delivery_cost_per_order numeric(12,2) NOT NULL DEFAULT 12,
  delivery_price numeric(12,2) NOT NULL DEFAULT 0,
  delivery_included_in_price boolean NOT NULL DEFAULT true,
  avg_portions_per_order numeric(8,2) NOT NULL DEFAULT 10,
  target_margin_pct numeric(7,5) NOT NULL DEFAULT 0.35,
  min_margin_pct numeric(7,5) NOT NULL DEFAULT 0.20,
  labor_cost_per_hour numeric(12,2) NOT NULL DEFAULT 25,
  expiry_alert_days int NOT NULL DEFAULT 3,
  payment_max_retries int NOT NULL DEFAULT 3,
  payment_retry_hours int NOT NULL DEFAULT 24,
  pix_expiration_minutes int NOT NULL DEFAULT 60,
  release_reservation_on_failure boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read" ON public.platform_settings;
CREATE POLICY "settings_read" ON public.platform_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "settings_admin" ON public.platform_settings;
CREATE POLICY "settings_admin" ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.has_any_role(ARRAY['admin','financeiro']::public.platform_role[]))
  WITH CHECK (public.has_any_role(ARRAY['admin','financeiro']::public.platform_role[]));

-- ---------------------------------------------------------------------
-- 2. Clientes: dados de contato (operação) x perfil alimentar (restrito)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_accounts (
  customer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  address text,
  delivery_notes text,
  anonymized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.allergens (
  code text PRIMARY KEY,
  name text NOT NULL
);
INSERT INTO public.allergens (code, name) VALUES
  ('gluten', 'Glúten (trigo, centeio, cevada, aveia)'),
  ('crustaceos', 'Crustáceos'),
  ('ovos', 'Ovos'),
  ('peixes', 'Peixes'),
  ('amendoim', 'Amendoim'),
  ('soja', 'Soja'),
  ('leite', 'Leite e derivados'),
  ('lactose', 'Lactose'),
  ('castanhas', 'Castanhas, nozes e amêndoas'),
  ('gergelim', 'Gergelim'),
  ('latex', 'Látex natural')
ON CONFLICT (code) DO NOTHING;
ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allergens_read" ON public.allergens;
CREATE POLICY "allergens_read" ON public.allergens FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "allergens_admin" ON public.allergens;
CREATE POLICY "allergens_admin" ON public.allergens FOR ALL TO authenticated
  USING (public.has_any_role(ARRAY['admin','nutricionista']::public.platform_role[]))
  WITH CHECK (public.has_any_role(ARRAY['admin','nutricionista']::public.platform_role[]));

CREATE TABLE IF NOT EXISTS public.customer_profiles (
  customer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric(5,1),
  height_cm numeric(5,1),
  age_range text,
  training_frequency int CHECK (training_frequency BETWEEN 0 AND 14),
  training_type text,
  activity_level text NOT NULL DEFAULT 'moderado' CHECK (activity_level IN ('baixo','moderado','alto')),
  goal text NOT NULL DEFAULT 'manutencao' CHECK (goal IN ('manutencao','hipertrofia','reducao_peso')),
  preferences text[] NOT NULL DEFAULT '{}',
  avoid_ingredient_ids uuid[] NOT NULL DEFAULT '{}',
  allergies text[] NOT NULL DEFAULT '{}',
  restrictions text[] NOT NULL DEFAULT '{}',
  meal_types text[] NOT NULL DEFAULT '{almoco}',
  delivery_weekdays int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  personalization_mode text NOT NULL DEFAULT 'sugestao' CHECK (personalization_mode IN ('sugestao','plano_individual')),
  consent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

-- Contato: o próprio cliente, operação e admin.
DROP POLICY IF EXISTS "accounts_owner" ON public.customer_accounts;
CREATE POLICY "accounts_owner" ON public.customer_accounts FOR ALL TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
DROP POLICY IF EXISTS "accounts_staff_read" ON public.customer_accounts;
CREATE POLICY "accounts_staff_read" ON public.customer_accounts FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['operacao','financeiro','nutricionista']::public.platform_role[]));

-- Perfil alimentar: só o cliente, o nutricionista e o admin.
DROP POLICY IF EXISTS "profiles_owner" ON public.customer_profiles;
CREATE POLICY "profiles_owner" ON public.customer_profiles FOR ALL TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
DROP POLICY IF EXISTS "profiles_nutri_read" ON public.customer_profiles;
CREATE POLICY "profiles_nutri_read" ON public.customer_profiles FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['nutricionista']::public.platform_role[]));

-- Novo usuário: papel cliente + registros vazios.
CREATE OR REPLACE FUNCTION public.handle_new_platform_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.platform_user_roles (user_id, role) VALUES (NEW.id, 'cliente') ON CONFLICT DO NOTHING;
  INSERT INTO public.customer_accounts (customer_id, full_name)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data->>'full_name', '')) ON CONFLICT DO NOTHING;
  INSERT INTO public.customer_profiles (customer_id, consent_at)
  VALUES (NEW.id, CASE WHEN NEW.raw_user_meta_data->>'lgpd_consent' = 'true' THEN now() END) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created_platform ON auth.users;
CREATE TRIGGER on_auth_user_created_platform AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_platform_user();

-- Garante registros para quem já tinha conta (chamado pelo app no login).
CREATE OR REPLACE FUNCTION public.ensure_my_customer_records()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.customer_accounts (customer_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO public.customer_profiles (customer_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.platform_user_roles WHERE user_id = auth.uid()) THEN
    INSERT INTO public.platform_user_roles (user_id, role) VALUES (auth.uid(), 'cliente');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Auditoria
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL,
  changed_by uuid DEFAULT auth.uid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  old_data jsonb,
  new_data jsonb
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_log;
CREATE POLICY "audit_admin_read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_any_role(ARRAY['admin']::public.platform_role[]));

CREATE OR REPLACE FUNCTION public.audit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END;
  v_new jsonb := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END;
  v_id text;
BEGIN
  IF TG_OP = 'UPDATE' AND v_old = v_new THEN RETURN NEW; END IF;
  v_id := COALESCE(v_new->>'id', v_old->>'id', v_new->>'customer_id', v_old->>'customer_id', v_new->>'user_id', v_old->>'user_id');
  INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data)
  VALUES (TG_TABLE_NAME, v_id, TG_OP, v_old, v_new);
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.touch_row_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

-- ---------------------------------------------------------------------
-- 4. Fornecedores e ingredientes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text UNIQUE,
  contact text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purchase_unit text NOT NULL DEFAULT 'kg',
  usage_unit text NOT NULL DEFAULT 'g',
  conversion_factor numeric(14,4) NOT NULL DEFAULT 1000 CHECK (conversion_factor > 0),
  usage_unit_grams numeric(10,3) NOT NULL DEFAULT 1 CHECK (usage_unit_grams > 0),
  default_supplier_id uuid REFERENCES public.suppliers(id),
  unit_cost numeric(16,6) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  yield_pct numeric(6,4) NOT NULL DEFAULT 1 CHECK (yield_pct > 0 AND yield_pct <= 1),
  kcal_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  protein_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  carbs_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  fat_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  fiber_per_100g numeric(8,2) NOT NULL DEFAULT 0,
  sodium_mg_per_100g numeric(10,2) NOT NULL DEFAULT 0,
  allergens text[] NOT NULL DEFAULT '{}',
  may_contain text[] NOT NULL DEFAULT '{}',
  allergen_info_complete boolean NOT NULL DEFAULT false,
  storage text NOT NULL DEFAULT 'refrigerado' CHECK (storage IN ('ambiente','refrigerado','congelado')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ingredients_name_idx ON public.ingredients (lower(name));

CREATE TABLE IF NOT EXISTS public.supplier_item_map (
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  supplier_code text NOT NULL,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  conversion_factor numeric(14,4) NOT NULL CHECK (conversion_factor > 0),
  PRIMARY KEY (supplier_id, supplier_code)
);

-- ---------------------------------------------------------------------
-- 5. Fichas técnicas (pratos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  description text,
  meal_type text NOT NULL CHECK (meal_type IN ('almoco','jantar','lanche')),
  product_line text NOT NULL DEFAULT 'fitness_adulto',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','em_aprovacao','aprovado','inativo')),
  version int NOT NULL DEFAULT 1,
  final_yield_g numeric(12,2) NOT NULL DEFAULT 0 CHECK (final_yield_g >= 0),
  portions int NOT NULL DEFAULT 1 CHECK (portions > 0),
  packaging_desc text,
  packaging_cost numeric(12,4) NOT NULL DEFAULT 0 CHECK (packaging_cost >= 0),
  labor_minutes numeric(10,2) NOT NULL DEFAULT 0 CHECK (labor_minutes >= 0),
  shelf_life_days int NOT NULL DEFAULT 5 CHECK (shelf_life_days > 0),
  storage_instructions text NOT NULL DEFAULT 'Manter refrigerado entre 0 °C e 5 °C. Aquecer antes de consumir.',
  cross_contact_risk text[] NOT NULL DEFAULT '{}',
  change_note text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dish_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  quantity numeric(14,4) NOT NULL CHECK (quantity > 0), -- peso bruto na unidade de uso, receita inteira
  prep_loss_pct numeric(6,4) CHECK (prep_loss_pct >= 0 AND prep_loss_pct < 1),
  UNIQUE (dish_id, ingredient_id)
);

-- Ficha aprovada que muda volta para aprovação (não fica disponível ao cliente até reaprovar).
CREATE OR REPLACE FUNCTION public.dish_requires_reapproval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dish uuid := COALESCE(NEW.dish_id, OLD.dish_id);
BEGIN
  UPDATE public.dishes
     SET status = 'em_aprovacao', version = version + 1, approved_at = NULL, approved_by = NULL,
         change_note = COALESCE(change_note, 'Ingredientes alterados')
   WHERE id = v_dish AND status = 'aprovado';
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS dish_items_reapproval ON public.dish_items;
CREATE TRIGGER dish_items_reapproval AFTER INSERT OR UPDATE OR DELETE ON public.dish_items
  FOR EACH ROW EXECUTE FUNCTION public.dish_requires_reapproval();

CREATE OR REPLACE FUNCTION public.dish_fields_reapproval()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'aprovado' AND NEW.status = 'aprovado' AND (
       NEW.final_yield_g IS DISTINCT FROM OLD.final_yield_g OR NEW.portions IS DISTINCT FROM OLD.portions
    OR NEW.cross_contact_risk IS DISTINCT FROM OLD.cross_contact_risk OR NEW.shelf_life_days IS DISTINCT FROM OLD.shelf_life_days
    OR NEW.packaging_cost IS DISTINCT FROM OLD.packaging_cost OR NEW.labor_minutes IS DISTINCT FROM OLD.labor_minutes) THEN
    NEW.status := 'em_aprovacao';
    NEW.version := OLD.version + 1;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS dishes_reapproval ON public.dishes;
CREATE TRIGGER dishes_reapproval BEFORE UPDATE ON public.dishes
  FOR EACH ROW EXECUTE FUNCTION public.dish_fields_reapproval();

CREATE OR REPLACE FUNCTION public.approve_dish(p_dish_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(ARRAY['nutricionista','operacao']::public.platform_role[]) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar fichas técnicas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.dish_items WHERE dish_id = p_dish_id) THEN
    RAISE EXCEPTION 'A ficha técnica não tem ingredientes';
  END IF;
  UPDATE public.dishes SET status = 'aprovado', approved_by = auth.uid(), approved_at = now(), change_note = NULL
   WHERE id = p_dish_id;
END $$;

-- Custo e nutrição calculados a partir da ficha técnica.
CREATE OR REPLACE VIEW public.v_dish_facts WITH (security_invoker = on) AS
WITH items AS (
  SELECT di.dish_id,
         di.quantity * i.unit_cost AS cost,
         di.quantity * (1 - COALESCE(di.prep_loss_pct, 1 - i.yield_pct)) * i.usage_unit_grams AS net_g,
         i.kcal_per_100g, i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g, i.fiber_per_100g, i.sodium_mg_per_100g,
         i.allergens, i.may_contain, i.allergen_info_complete
    FROM public.dish_items di JOIN public.ingredients i ON i.id = di.ingredient_id
)
SELECT d.id AS dish_id, d.code, d.name, d.meal_type, d.status, d.version, d.portions, d.final_yield_g,
       CASE WHEN d.portions > 0 THEN round(d.final_yield_g / d.portions, 1) END AS portion_weight_g,
       round(COALESCE(sum(it.cost), 0) / d.portions, 4) AS ingredient_cost_per_portion,
       d.packaging_cost AS packaging_cost_per_portion,
       round((d.labor_minutes / 60.0 * s.labor_cost_per_hour) / d.portions, 4) AS labor_cost_per_portion,
       round(COALESCE(sum(it.cost), 0) / d.portions + d.packaging_cost + (d.labor_minutes / 60.0 * s.labor_cost_per_hour) / d.portions, 4) AS cost_per_portion,
       round(COALESCE(sum(it.net_g * it.kcal_per_100g / 100), 0) / d.portions, 1) AS kcal,
       round(COALESCE(sum(it.net_g * it.protein_per_100g / 100), 0) / d.portions, 1) AS protein_g,
       round(COALESCE(sum(it.net_g * it.carbs_per_100g / 100), 0) / d.portions, 1) AS carbs_g,
       round(COALESCE(sum(it.net_g * it.fat_per_100g / 100), 0) / d.portions, 1) AS fat_g,
       round(COALESCE(sum(it.net_g * it.fiber_per_100g / 100), 0) / d.portions, 1) AS fiber_g,
       round(COALESCE(sum(it.net_g * it.sodium_mg_per_100g / 100), 0) / d.portions, 0) AS sodium_mg,
       COALESCE((SELECT array_agg(DISTINCT a) FROM items x, unnest(x.allergens) a WHERE x.dish_id = d.id), '{}') AS allergens,
       COALESCE((SELECT array_agg(DISTINCT a) FROM (
          SELECT unnest(x.may_contain) a FROM items x WHERE x.dish_id = d.id
          UNION SELECT unnest(d.cross_contact_risk)) z), '{}') AS may_contain,
       (count(it.dish_id) = 0 OR bool_or(NOT it.allergen_info_complete)) AS allergen_info_incomplete
  FROM public.dishes d
  CROSS JOIN public.platform_settings s
  LEFT JOIN items it ON it.dish_id = d.id
 GROUP BY d.id, s.labor_cost_per_hour;

-- Compatibilidade de um prato com o perfil de um cliente (alergia = bloqueio).
CREATE OR REPLACE FUNCTION public.dish_compatibility(p_dish_id uuid, p_customer_id uuid)
RETURNS TABLE (compatible boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  p public.customer_profiles%ROWTYPE;
  f record;
  v_hit text[];
  v_tags text[];
BEGIN
  SELECT * INTO p FROM public.customer_profiles WHERE customer_id = p_customer_id;
  SELECT * INTO f FROM public.v_dish_facts WHERE dish_id = p_dish_id;
  IF f.dish_id IS NULL THEN RETURN QUERY SELECT false, 'Prato não encontrado'; RETURN; END IF;

  IF p.customer_id IS NOT NULL AND cardinality(p.allergies) > 0 THEN
    IF f.allergen_info_incomplete THEN
      RETURN QUERY SELECT false, 'Informação de alergênicos incompleta em algum ingrediente'; RETURN;
    END IF;
    SELECT array_agg(a) INTO v_hit FROM unnest(f.allergens) a WHERE a = ANY(p.allergies);
    IF v_hit IS NOT NULL THEN
      RETURN QUERY SELECT false, 'Contém alergênico: ' || array_to_string(v_hit, ', '); RETURN;
    END IF;
    SELECT array_agg(a) INTO v_hit FROM unnest(f.may_contain) a WHERE a = ANY(p.allergies);
    IF v_hit IS NOT NULL THEN
      RETURN QUERY SELECT false, 'Risco de contato cruzado: ' || array_to_string(v_hit, ', '); RETURN;
    END IF;
  END IF;

  IF p.customer_id IS NOT NULL AND cardinality(p.restrictions) > 0 THEN
    SELECT tags INTO v_tags FROM public.dishes WHERE id = p_dish_id;
    IF NOT (v_tags @> p.restrictions) THEN
      RETURN QUERY SELECT false, 'Não atende à restrição: ' || array_to_string(ARRAY(SELECT unnest(p.restrictions) EXCEPT SELECT unnest(v_tags)), ', ');
      RETURN;
    END IF;
  END IF;

  IF p.customer_id IS NOT NULL AND cardinality(p.avoid_ingredient_ids) > 0 AND EXISTS (
     SELECT 1 FROM public.dish_items WHERE dish_id = p_dish_id AND ingredient_id = ANY(p.avoid_ingredient_ids)) THEN
    RETURN QUERY SELECT false, 'Contém ingrediente que você pediu para evitar'; RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END $$;

-- ---------------------------------------------------------------------
-- 6. Estoque por lote
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id),
  expected_date date NOT NULL,
  status text NOT NULL DEFAULT 'prevista' CHECK (status IN ('prevista','recebida_parcial','recebida','cancelada')),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  quantity numeric(14,4) NOT NULL CHECK (quantity > 0), -- unidade de uso
  quantity_received numeric(14,4) NOT NULL DEFAULT 0,
  unit_cost numeric(16,6) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.nfe_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_key text UNIQUE,
  number text,
  series text,
  issued_at timestamptz,
  supplier_id uuid REFERENCES public.suppliers(id),
  supplier_cnpj text,
  supplier_name text,
  total_amount numeric(14,2),
  due_date date,
  status text NOT NULL DEFAULT 'em_conferencia' CHECK (status IN ('em_conferencia','conferida','cancelada')),
  raw_xml text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid,
  checked_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.nfe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.nfe_imports(id) ON DELETE CASCADE,
  item_number int NOT NULL,
  supplier_code text,
  description text NOT NULL,
  ncm text,
  unit text,
  quantity numeric(14,4) NOT NULL,
  unit_price numeric(16,6) NOT NULL,
  total numeric(14,2) NOT NULL,
  ingredient_id uuid REFERENCES public.ingredients(id),
  conversion_factor numeric(14,4),
  lots jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','conferido','divergente','ignorado')),
  divergence_note text,
  UNIQUE (import_id, item_number)
);

CREATE TABLE IF NOT EXISTS public.ingredient_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  lot_code text NOT NULL,
  quantity_received numeric(14,4) NOT NULL CHECK (quantity_received >= 0),
  quantity_on_hand numeric(14,4) NOT NULL CHECK (quantity_on_hand >= 0),
  unit_cost numeric(16,6) NOT NULL DEFAULT 0,
  received_at date NOT NULL DEFAULT current_date,
  manufactured_at date,
  expires_at date,
  storage text,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','bloqueado','esgotado')),
  nfe_item_id uuid REFERENCES public.nfe_items(id),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ingredient_lots_fefo_idx ON public.ingredient_lots (ingredient_id, expires_at);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id bigserial PRIMARY KEY,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id),
  lot_id uuid REFERENCES public.ingredient_lots(id),
  kind text NOT NULL CHECK (kind IN ('entrada','consumo','perda','devolucao','baixa','ajuste')),
  quantity numeric(14,4) NOT NULL, -- positivo entra, negativo sai
  unit_cost numeric(16,6),
  reason text,
  reference text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
