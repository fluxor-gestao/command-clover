-- =====================================================================
-- Plataforma de refeições — 04: políticas de acesso (RLS), permissões
-- de execução, funções de apoio ao app e carga de demonstração.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RLS
-- ---------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','ingredients','supplier_item_map','dishes','dish_items','purchase_orders','purchase_order_items',
    'nfe_imports','nfe_items','ingredient_lots','stock_movements','menu_cycles','menu_cycle_days','menu_items','dish_prices',
    'subscription_plans','subscriptions','orders','order_items','subscription_cycles','stock_reservations','notifications',
    'payments','payment_events','financial_entries','provider_payouts','production_batches','batch_ingredient_lots',
    'nutrition_parameters','nutrition_plans','privacy_requests'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Helper para recriar políticas de forma idempotente.
CREATE OR REPLACE FUNCTION pg_temp.pol(p_table text, p_name text, p_cmd text, p_using text, p_check text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name, p_table);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR %s TO authenticated %s %s', p_name, p_table, p_cmd,
                 CASE WHEN p_using IS NOT NULL THEN 'USING (' || p_using || ')' ELSE '' END,
                 CASE WHEN p_check IS NOT NULL THEN 'WITH CHECK (' || p_check || ')' ELSE '' END);
END $$;

-- Operação: leitura para a equipe, escrita para operação (admin incluso).
SELECT pg_temp.pol(t, t || '_staff_read', 'SELECT', 'public.is_staff()')
  FROM unnest(ARRAY['suppliers','ingredients','supplier_item_map','dish_items','purchase_orders','purchase_order_items',
                    'nfe_imports','nfe_items','ingredient_lots','stock_movements','stock_reservations','production_batches',
                    'batch_ingredient_lots','payment_events']) t;
SELECT pg_temp.pol(t, t || '_ops_write', 'ALL',
                   $p$public.has_any_role(ARRAY['operacao']::public.platform_role[])$p$,
                   $p$public.has_any_role(ARRAY['operacao']::public.platform_role[])$p$)
  FROM unnest(ARRAY['suppliers','supplier_item_map','purchase_orders','purchase_order_items','menu_cycles','menu_cycle_days','menu_items']) t;

-- Ingredientes e fichas: operação e nutricionista editam.
SELECT pg_temp.pol(t, t || '_tech_write', 'ALL',
                   $p$public.has_any_role(ARRAY['operacao','nutricionista']::public.platform_role[])$p$,
                   $p$public.has_any_role(ARRAY['operacao','nutricionista']::public.platform_role[])$p$)
  FROM unnest(ARRAY['ingredients','dishes','dish_items']) t;

-- Catálogo visível ao cliente.
SELECT pg_temp.pol('dishes', 'dishes_read', 'SELECT', $p$status = 'aprovado' OR public.is_staff()$p$);
SELECT pg_temp.pol('menu_cycles', 'menu_cycles_read', 'SELECT', $p$status <> 'rascunho' OR public.is_staff()$p$);
SELECT pg_temp.pol('menu_cycle_days', 'menu_cycle_days_read', 'SELECT', 'true');
SELECT pg_temp.pol('menu_items', 'menu_items_read', 'SELECT', 'true');
SELECT pg_temp.pol('dish_prices', 'dish_prices_read', 'SELECT', $p$status = 'aprovado' OR public.is_staff()$p$);
SELECT pg_temp.pol('subscription_plans', 'plans_read', 'SELECT', 'true');
SELECT pg_temp.pol('subscription_plans', 'plans_write', 'ALL',
                   $p$public.has_any_role(ARRAY['financeiro']::public.platform_role[])$p$,
                   $p$public.has_any_role(ARRAY['financeiro']::public.platform_role[])$p$);

-- Dados do cliente: o próprio titular + equipes que precisam deles.
SELECT pg_temp.pol('subscriptions', 'subscriptions_read', 'SELECT',
                   $p$customer_id = auth.uid() OR public.has_any_role(ARRAY['operacao','financeiro']::public.platform_role[])$p$);
SELECT pg_temp.pol('orders', 'orders_read', 'SELECT',
                   $p$customer_id = auth.uid() OR public.has_any_role(ARRAY['operacao','financeiro','cozinha']::public.platform_role[])$p$);
SELECT pg_temp.pol('order_items', 'order_items_read', 'SELECT',
                   $p$EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
                      OR public.has_any_role(ARRAY['operacao','financeiro','cozinha']::public.platform_role[])$p$);
SELECT pg_temp.pol('subscription_cycles', 'subscription_cycles_read', 'SELECT',
                   $p$EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.customer_id = auth.uid())
                      OR public.has_any_role(ARRAY['operacao','financeiro']::public.platform_role[])$p$);
SELECT pg_temp.pol('payments', 'payments_read', 'SELECT',
                   $p$customer_id = auth.uid() OR public.has_any_role(ARRAY['operacao','financeiro']::public.platform_role[])$p$);
SELECT pg_temp.pol('notifications', 'notifications_read', 'SELECT', 'customer_id = auth.uid()');
SELECT pg_temp.pol('notifications', 'notifications_update', 'UPDATE', 'customer_id = auth.uid()', 'customer_id = auth.uid()');

-- Financeiro.
SELECT pg_temp.pol(t, t || '_fin_read', 'SELECT', $p$public.has_any_role(ARRAY['financeiro']::public.platform_role[])$p$)
  FROM unnest(ARRAY['financial_entries','provider_payouts']) t;
SELECT pg_temp.pol('financial_entries', 'financial_entries_fin_write', 'ALL',
                   $p$public.has_any_role(ARRAY['financeiro']::public.platform_role[])$p$,
                   $p$public.has_any_role(ARRAY['financeiro']::public.platform_role[]) AND kind IN ('despesa','compra_insumo')$p$);

-- Nutrição: o cliente só vê planos publicados.
SELECT pg_temp.pol('nutrition_parameters', 'nutrition_parameters_read', 'SELECT', $p$public.has_any_role(ARRAY['nutricionista']::public.platform_role[])$p$);
SELECT pg_temp.pol('nutrition_parameters', 'nutrition_parameters_write', 'ALL',
                   $p$public.has_any_role(ARRAY['nutricionista']::public.platform_role[])$p$,
                   $p$public.has_any_role(ARRAY['nutricionista']::public.platform_role[])$p$);
SELECT pg_temp.pol('nutrition_plans', 'nutrition_plans_read', 'SELECT',
                   $p$(customer_id = auth.uid() AND status IN ('publicado','substituido'))
                      OR public.has_any_role(ARRAY['nutricionista']::public.platform_role[])$p$);

-- LGPD.
SELECT pg_temp.pol('privacy_requests', 'privacy_requests_owner_read', 'SELECT',
                   $p$customer_id = auth.uid() OR public.has_any_role(ARRAY['admin']::public.platform_role[])$p$);
SELECT pg_temp.pol('privacy_requests', 'privacy_requests_owner_insert', 'INSERT', NULL, 'customer_id = auth.uid()');
SELECT pg_temp.pol('privacy_requests', 'privacy_requests_admin_update', 'UPDATE',
                   $p$public.has_any_role(ARRAY['admin']::public.platform_role[])$p$,
                   $p$public.has_any_role(ARRAY['admin']::public.platform_role[])$p$);

-- ---------------------------------------------------------------------
-- 2. Funções de apoio ao app
-- ---------------------------------------------------------------------
-- Detalhe do prato para o cliente: ingredientes, porção e nutrição (sem custos).
CREATE OR REPLACE FUNCTION public.dish_public_details(p_dish_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'dish_id', d.id, 'name', d.name, 'description', d.description, 'meal_type', d.meal_type, 'tags', d.tags,
    'portion_weight_g', f.portion_weight_g, 'kcal', f.kcal, 'protein_g', f.protein_g, 'carbs_g', f.carbs_g,
    'fat_g', f.fat_g, 'fiber_g', f.fiber_g, 'sodium_mg', f.sodium_mg,
    'allergens', f.allergens, 'may_contain', f.may_contain, 'allergen_info_incomplete', f.allergen_info_incomplete,
    'storage_instructions', d.storage_instructions, 'shelf_life_days', d.shelf_life_days,
    'ingredients', (SELECT COALESCE(jsonb_agg(i.name ORDER BY di.quantity DESC), '[]') FROM public.dish_items di
                      JOIN public.ingredients i ON i.id = di.ingredient_id WHERE di.dish_id = d.id))
    FROM public.dishes d JOIN public.v_dish_facts f ON f.dish_id = d.id
   WHERE d.id = p_dish_id AND (d.status = 'aprovado' OR public.is_staff())
$$;

-- Lista de ingredientes (somente nome) para o cliente indicar o que deseja evitar.
CREATE OR REPLACE FUNCTION public.ingredient_names()
RETURNS TABLE (id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name FROM public.ingredients WHERE active ORDER BY name
$$;

CREATE OR REPLACE FUNCTION public.list_platform_users()
RETURNS TABLE (user_id uuid, email text, full_name text, roles public.platform_role[], created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_any_role(ARRAY['admin']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, a.full_name,
         COALESCE(array_agg(r.role ORDER BY r.role) FILTER (WHERE r.role IS NOT NULL), '{}'), u.created_at, u.last_sign_in_at
    FROM auth.users u
    LEFT JOIN public.platform_user_roles r ON r.user_id = u.id
    LEFT JOIN public.customer_accounts a ON a.customer_id = u.id
   GROUP BY u.id, a.full_name
   ORDER BY u.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.set_user_roles(p_user_id uuid, p_roles public.platform_role[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_any_role(ARRAY['admin']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_user_id = auth.uid() AND NOT ('admin' = ANY(p_roles)) THEN RAISE EXCEPTION 'Você não pode remover o seu próprio acesso de administrador'; END IF;
  DELETE FROM public.platform_user_roles WHERE user_id = p_user_id AND NOT (role = ANY(p_roles));
  INSERT INTO public.platform_user_roles (user_id, role) SELECT p_user_id, unnest(p_roles) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.nutrition_review_queue()
RETURNS TABLE (plan_id uuid, customer_id uuid, customer_name text, version int, status text, origin text, created_at timestamptz,
               targets jsonb, published_version int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_any_role(ARRAY['nutricionista']::public.platform_role[]) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  SELECT n.id, n.customer_id, COALESCE(a.full_name, 'Cliente sem nome'), n.version, n.status, n.origin, n.created_at, n.targets,
         (SELECT max(x.version) FROM public.nutrition_plans x WHERE x.customer_id = n.customer_id AND x.status = 'publicado')
    FROM public.nutrition_plans n LEFT JOIN public.customer_accounts a ON a.customer_id = n.customer_id
   WHERE n.status IN ('proposta','em_revisao')
   ORDER BY n.created_at;
END $$;

-- Situação do plano para o próprio cliente (sem revelar rascunhos).
CREATE OR REPLACE FUNCTION public.my_plan_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pending_review', EXISTS (SELECT 1 FROM public.nutrition_plans WHERE customer_id = auth.uid() AND status IN ('proposta','em_revisao')),
    'published_version', (SELECT max(version) FROM public.nutrition_plans WHERE customer_id = auth.uid() AND status = 'publicado'))
$$;

CREATE OR REPLACE FUNCTION public.dashboard_metrics()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN jsonb_build_object(
    'active_subscriptions', (SELECT count(*) FROM public.subscriptions WHERE status = 'ativa'),
    'paused_subscriptions', (SELECT count(*) FROM public.subscriptions WHERE status = 'pausada'),
    'delinquent_subscriptions', (SELECT count(*) FROM public.subscriptions WHERE status = 'inadimplente'),
    'cancelled_30d', (SELECT count(*) FROM public.subscriptions WHERE status = 'cancelada' AND cancelled_at > now() - interval '30 days'),
    'orders_open', (SELECT count(*) FROM public.orders WHERE status IN ('aguardando_pagamento','confirmado','em_producao','pronto','separado','em_rota')),
    'orders_attention', (SELECT count(*) FROM public.orders WHERE needs_attention IS NOT NULL AND status NOT IN ('entregue')),
    'revenue_month', (SELECT COALESCE(sum(amount), 0) FROM public.financial_entries WHERE kind = 'receita_venda' AND competence_date >= date_trunc('month', current_date)),
    'mrr_estimate', (SELECT COALESCE(sum(o.total), 0) * 52 / 12 FROM public.orders o WHERE o.subscription_id IS NOT NULL
                       AND o.status NOT IN ('cancelado','expirado') AND o.created_at > now() - interval '7 days'),
    'lots_expired', (SELECT count(*) FROM public.v_stock_lots WHERE is_expired AND quantity_on_hand > 0),
    'lots_expiring', (SELECT count(*) FROM public.v_stock_lots WHERE expiring_soon AND quantity_on_hand > 0),
    'plans_to_review', (SELECT count(*) FROM public.nutrition_plans WHERE status IN ('proposta','em_revisao')),
    'prices_to_approve', (SELECT count(*) FROM public.dish_prices WHERE status = 'proposto'),
    'dishes_to_approve', (SELECT count(*) FROM public.dishes WHERE status = 'em_aprovacao')
  );
END $$;

-- ---------------------------------------------------------------------
-- 3. Carga de demonstração (somente admin; não roda sozinha)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_demo_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sup uuid; v_sup2 uuid; v_cycle uuid; v_monday date; d date; i int;
  ing jsonb; v_ing uuid; v_dish uuid; dish jsonb; it jsonb; v_po uuid;
BEGIN
  IF NOT public.has_any_role(ARRAY['admin']::public.platform_role[]) THEN RAISE EXCEPTION 'Somente o administrador'; END IF;
  IF EXISTS (SELECT 1 FROM public.dishes WHERE code LIKE 'DEMO%') THEN RETURN jsonb_build_object('result', 'ja_carregado'); END IF;

  INSERT INTO public.suppliers (name, cnpj) VALUES ('Hortifruti Demo LTDA', '11222333000181') ON CONFLICT (cnpj) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_sup;
  INSERT INTO public.suppliers (name, cnpj) VALUES ('Frigorífico Demo SA', '44555666000199') ON CONFLICT (cnpj) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_sup2;

  FOR ing IN SELECT * FROM jsonb_array_elements('[
    {"n":"Peito de frango","pu":"kg","uu":"g","cf":1000,"c":0.022,"y":0.92,"k":159,"p":32,"cb":0,"f":2.5,"al":[],"mc":[],"ok":true,"s":"refrigerado"},
    {"n":"Patinho moído","pu":"kg","uu":"g","cf":1000,"c":0.042,"y":0.95,"k":219,"p":35.9,"cb":0,"f":7.3,"al":[],"mc":[],"ok":true,"s":"refrigerado"},
    {"n":"Filé de tilápia","pu":"kg","uu":"g","cf":1000,"c":0.048,"y":0.95,"k":96,"p":20,"cb":0,"f":1.7,"al":["peixes"],"mc":[],"ok":true,"s":"congelado"},
    {"n":"Arroz integral","pu":"kg","uu":"g","cf":1000,"c":0.009,"y":1,"k":360,"p":7.3,"cb":77,"f":1.9,"al":[],"mc":[],"ok":true,"s":"ambiente"},
    {"n":"Batata-doce","pu":"kg","uu":"g","cf":1000,"c":0.006,"y":0.85,"k":86,"p":1.6,"cb":20,"f":0.1,"al":[],"mc":[],"ok":true,"s":"ambiente"},
    {"n":"Brócolis","pu":"kg","uu":"g","cf":1000,"c":0.014,"y":0.7,"k":34,"p":2.8,"cb":6.6,"f":0.4,"al":[],"mc":[],"ok":true,"s":"refrigerado"},
    {"n":"Feijão carioca","pu":"kg","uu":"g","cf":1000,"c":0.008,"y":1,"k":329,"p":20,"cb":61,"f":1.3,"al":[],"mc":[],"ok":true,"s":"ambiente"},
    {"n":"Queijo minas frescal","pu":"kg","uu":"g","cf":1000,"c":0.045,"y":1,"k":264,"p":17,"cb":3,"f":20,"al":["leite","lactose"],"mc":[],"ok":true,"s":"refrigerado"},
    {"n":"Ovo","pu":"dz","uu":"un","cf":12,"c":0.75,"y":0.88,"k":143,"p":13,"cb":0.7,"f":9.5,"al":["ovos"],"mc":[],"ok":true,"s":"refrigerado","g":50},
    {"n":"Aveia em flocos","pu":"kg","uu":"g","cf":1000,"c":0.016,"y":1,"k":389,"p":17,"cb":66,"f":7,"al":["gluten"],"mc":[],"ok":true,"s":"ambiente"},
    {"n":"Banana","pu":"kg","uu":"g","cf":1000,"c":0.007,"y":0.65,"k":89,"p":1.1,"cb":23,"f":0.3,"al":[],"mc":[],"ok":true,"s":"ambiente"},
    {"n":"Pasta de amendoim","pu":"kg","uu":"g","cf":1000,"c":0.04,"y":1,"k":588,"p":25,"cb":20,"f":50,"al":["amendoim"],"mc":["castanhas"],"ok":true,"s":"ambiente"},
    {"n":"Molho de tomate artesanal","pu":"kg","uu":"g","cf":1000,"c":0.012,"y":1,"k":45,"p":1.5,"cb":8,"f":1,"al":[],"mc":[],"ok":false,"s":"refrigerado"},
    {"n":"Azeite de oliva","pu":"L","uu":"ml","cf":1000,"c":0.05,"y":1,"k":884,"p":0,"cb":0,"f":100,"al":[],"mc":[],"ok":true,"s":"ambiente","g":0.92}
  ]'::jsonb) LOOP
    INSERT INTO public.ingredients (name, purchase_unit, usage_unit, conversion_factor, usage_unit_grams, default_supplier_id, unit_cost, yield_pct,
                                    kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, allergens, may_contain, allergen_info_complete, storage)
    VALUES (ing->>'n', ing->>'pu', ing->>'uu', (ing->>'cf')::numeric, COALESCE((ing->>'g')::numeric, 1),
            CASE WHEN ing->>'n' IN ('Peito de frango','Patinho moído','Filé de tilápia') THEN v_sup2 ELSE v_sup END,
            (ing->>'c')::numeric, (ing->>'y')::numeric, (ing->>'k')::numeric, (ing->>'p')::numeric, (ing->>'cb')::numeric, (ing->>'f')::numeric,
            ARRAY(SELECT jsonb_array_elements_text(ing->'al')), ARRAY(SELECT jsonb_array_elements_text(ing->'mc')), (ing->>'ok')::boolean, ing->>'s')
    RETURNING id INTO v_ing;
  END LOOP;

  FOR dish IN SELECT * FROM jsonb_array_elements('[
    {"c":"DEMO1","n":"Frango grelhado, arroz integral e brócolis","m":"almoco","t":["sem_lactose","sem_gluten"],"y":3000,"p":10,"pk":1.2,"l":90,
     "i":[["Peito de frango",1600],["Arroz integral",700],["Brócolis",900],["Azeite de oliva",60]]},
    {"c":"DEMO2","n":"Patinho com batata-doce e feijão","m":"almoco","t":["sem_lactose","sem_gluten"],"y":3200,"p":10,"pk":1.2,"l":100,
     "i":[["Patinho moído",1500],["Batata-doce",1600],["Feijão carioca",400],["Azeite de oliva",50]]},
    {"c":"DEMO3","n":"Tilápia com purê de batata-doce","m":"jantar","t":["sem_lactose","sem_gluten"],"y":2800,"p":10,"pk":1.2,"l":80,
     "i":[["Filé de tilápia",1600],["Batata-doce",1500],["Azeite de oliva",40]]},
    {"c":"DEMO4","n":"Escondidinho de frango com queijo","m":"jantar","t":["sem_gluten"],"y":3000,"p":10,"pk":1.2,"l":110,
     "i":[["Peito de frango",1400],["Batata-doce",1500],["Queijo minas frescal",400]]},
    {"c":"DEMO5","n":"Frango ao molho de tomate artesanal","m":"jantar","t":["sem_lactose","sem_gluten"],"y":2900,"p":10,"pk":1.2,"l":90,
     "i":[["Peito de frango",1600],["Molho de tomate artesanal",800],["Arroz integral",600]]},
    {"c":"DEMO6","n":"Overnight de aveia, banana e amendoim","m":"lanche","t":["vegetariano"],"y":2000,"p":10,"pk":0.9,"l":40,
     "i":[["Aveia em flocos",500],["Banana",900],["Pasta de amendoim",200]]},
    {"c":"DEMO7","n":"Omelete de forno com brócolis","m":"lanche","t":["vegetariano","sem_gluten","sem_lactose"],"y":1600,"p":10,"pk":0.9,"l":50,
     "i":[["Ovo",20],["Brócolis",600],["Azeite de oliva",20]]}
  ]'::jsonb) LOOP
    INSERT INTO public.dishes (code, name, meal_type, tags, final_yield_g, portions, packaging_desc, packaging_cost, labor_minutes)
    VALUES (dish->>'c', dish->>'n', dish->>'m', ARRAY(SELECT jsonb_array_elements_text(dish->'t')), (dish->>'y')::numeric,
            (dish->>'p')::int, 'Pote PP 500 ml com tampa', (dish->>'pk')::numeric, (dish->>'l')::numeric)
    RETURNING id INTO v_dish;
    FOR it IN SELECT * FROM jsonb_array_elements(dish->'i') LOOP
      INSERT INTO public.dish_items (dish_id, ingredient_id, quantity)
      SELECT v_dish, id, (it->>1)::numeric FROM public.ingredients WHERE name = it->>0 ORDER BY created_at DESC LIMIT 1;
    END LOOP;
    UPDATE public.dishes SET status = 'aprovado', approved_by = auth.uid(), approved_at = now() WHERE id = v_dish;
    INSERT INTO public.dish_prices (dish_id, price, suggested_price, status, approved_by, approved_at, cost_snapshot)
    SELECT v_dish, (public.price_breakdown(v_dish)->>'suggested_price')::numeric, (public.price_breakdown(v_dish)->>'suggested_price')::numeric,
           'aprovado', auth.uid(), now(), public.price_breakdown(v_dish);
  END LOOP;

  -- Estoque inicial por lote (um lote vencido e um perto do vencimento para demonstrar os alertas).
  INSERT INTO public.ingredient_lots (ingredient_id, supplier_id, lot_code, quantity_received, quantity_on_hand, unit_cost, expires_at, storage)
  SELECT i.id, i.default_supplier_id, 'DEMO-' || upper(left(regexp_replace(i.name, '[^A-Za-z]', '', 'g'), 4)) || '-01',
         CASE WHEN i.usage_unit = 'un' THEN 240 ELSE 40000 END, CASE WHEN i.usage_unit = 'un' THEN 240 ELSE 40000 END,
         i.unit_cost, current_date + CASE WHEN i.storage = 'ambiente' THEN 120 WHEN i.storage = 'congelado' THEN 90 ELSE 20 END, i.storage
    FROM public.ingredients i WHERE i.name <> 'Brócolis' AND i.created_at > now() - interval '1 minute';
  INSERT INTO public.ingredient_lots (ingredient_id, supplier_id, lot_code, quantity_received, quantity_on_hand, unit_cost, expires_at, storage)
  SELECT id, default_supplier_id, 'DEMO-BROC-VENC', 3000, 3000, unit_cost, current_date - 1, storage FROM public.ingredients WHERE name = 'Brócolis' ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.ingredient_lots (ingredient_id, supplier_id, lot_code, quantity_received, quantity_on_hand, unit_cost, expires_at, storage)
  SELECT id, default_supplier_id, 'DEMO-BROC-02', 8000, 8000, unit_cost, current_date + 2, storage FROM public.ingredients WHERE name = 'Brócolis' ORDER BY created_at DESC LIMIT 1;
  INSERT INTO public.stock_movements (ingredient_id, lot_id, kind, quantity, unit_cost, reason, reference)
  SELECT ingredient_id, id, 'entrada', quantity_received, unit_cost, 'Carga de demonstração', 'DEMO' FROM public.ingredient_lots WHERE lot_code LIKE 'DEMO-%';

  -- Compra prevista de brócolis (aparece como pendência até a conferência).
  INSERT INTO public.purchase_orders (supplier_id, expected_date, notes) VALUES (v_sup, current_date + 3, 'Compra prevista (demonstração)') RETURNING id INTO v_po;
  INSERT INTO public.purchase_order_items (purchase_order_id, ingredient_id, quantity, unit_cost)
  SELECT v_po, id, 20000, unit_cost FROM public.ingredients WHERE name = 'Brócolis' ORDER BY created_at DESC LIMIT 1;

  -- Ciclo da próxima semana, aberto para vendas até domingo anterior.
  v_monday := current_date + ((8 - extract(isodow FROM current_date)::int) % 7) + CASE WHEN extract(isodow FROM current_date) = 1 THEN 7 ELSE 0 END;
  INSERT INTO public.menu_cycles (name, sales_start, cutoff_at, status)
  VALUES ('Semana ' || to_char(v_monday, 'DD/MM'), now() - interval '1 hour', (v_monday - 1)::timestamp + time '12:00', 'aberto')
  RETURNING id INTO v_cycle;
  FOR i IN 0..4 LOOP
    d := v_monday + i;
    INSERT INTO public.menu_cycle_days (cycle_id, production_date, delivery_date, capacity_portions) VALUES (v_cycle, d - 1, d, 300);
  END LOOP;
  INSERT INTO public.menu_items (cycle_id, dish_id, max_portions)
  SELECT v_cycle, id, 400 FROM public.dishes WHERE code LIKE 'DEMO%';

  RETURN jsonb_build_object('result', 'carregado', 'cycle_id', v_cycle);
END $$;

-- ---------------------------------------------------------------------
-- 4. Permissões de execução
-- ---------------------------------------------------------------------
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace
              AND p.proname IN ('has_any_role','is_staff','my_roles','ensure_my_customer_records','audit_row','touch_row_updated_at',
                  'dish_requires_reapproval','dish_fields_reapproval','approve_dish','dish_compatibility','current_dish_price','price_breakdown',
                  'propose_dish_price','approve_dish_price','_reserve_ingredient','_release_order_reservations','dish_stock_ok','eligible_dishes_for',
                  'eligible_dishes','suggest_kit_for','suggest_kit','_create_order','place_order','cancel_order','subscribe','set_subscription_status',
                  'skip_subscription_cycle','generate_subscription_orders','process_payment_event','expire_overdue_payments',
                  '_reallocate_pending_reservations','_receive_lot','receive_manual_lot','import_nfe','confirm_nfe_item','ignore_nfe_item',
                  'register_stock_movement','set_lot_blocked','_finish_nfe_if_done','close_cycle','start_production','complete_batch','set_order_status',
                  'kitchen_restrictions','register_payout','_generate_plan_proposal','request_nutrition_plan','review_nutrition_plan',
                  'revise_nutrition_plan','profile_change_requires_plan_review','export_my_data','anonymize_customer','dish_public_details',
                  'ingredient_names','list_platform_users','set_user_roles','nutrition_review_queue','my_plan_status','dashboard_metrics',
                  'seed_demo_data','handle_new_platform_user') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f.sig);
    BEGIN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f.sig); EXCEPTION WHEN undefined_object THEN NULL; END;
    BEGIN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); EXCEPTION WHEN undefined_object THEN NULL; END;
    -- Funções internas (prefixo _), suggest_kit_for/eligible_dishes_for e triggers não ficam expostas ao app.
    IF f.proname NOT LIKE '\_%' AND f.proname NOT IN ('suggest_kit_for','eligible_dishes_for','audit_row','touch_row_updated_at',
         'dish_requires_reapproval','dish_fields_reapproval','profile_change_requires_plan_review','handle_new_platform_user') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
  END LOOP;
END $$;

-- Views: leitura para usuários autenticados (as tabelas de base aplicam o RLS).
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['v_dish_facts','v_upcoming_price_changes','v_stock_lots','v_stock_ingredients','v_cycle_capacity',
    'v_production_plan','v_production_ingredients','v_shopping_list','v_batch_labels','v_trace','v_finance_payments',
    'v_payout_reconciliation','v_dish_margin','v_batch_cost'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', v);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v);
  END LOOP;
END $$;
