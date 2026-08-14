-- ============ CATEGORIAS ============
CREATE TABLE public.investment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_categories TO authenticated;
GRANT ALL ON public.investment_categories TO service_role;
ALTER TABLE public.investment_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_all_auth" ON public.investment_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.investment_categories (name) VALUES
  ('Sublocação'), ('Veículos'), ('Empréstimos'), ('Aluguéis'), ('Outros');

-- ============ OPERAÇÕES ============
CREATE TABLE public.investment_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  category_id uuid REFERENCES public.investment_categories(id) ON DELETE SET NULL,
  due_day integer,
  initial_capital numeric(14,2) NOT NULL DEFAULT 0,
  investment_date date,
  first_due_date date,
  installment_count integer,
  installment_value numeric(14,2),
  contracted_total numeric(14,2),
  last_due_date date,
  status text NOT NULL DEFAULT 'ATIVA',
  description text,
  notes text,
  source text NOT NULL DEFAULT 'SISTEMA',
  import_status text NOT NULL DEFAULT 'VALIDADO',
  source_key text UNIQUE,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX investment_operations_reference_key ON public.investment_operations (lower(reference));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_operations TO authenticated;
GRANT ALL ON public.investment_operations TO service_role;
ALTER TABLE public.investment_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_all_auth" ON public.investment_operations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PARCELAS ============
CREATE TABLE public.investment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.investment_operations(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  competence date NOT NULL,
  due_date date NOT NULL,
  expected_amount numeric(14,2) NOT NULL DEFAULT 0,
  received_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'A_RECEBER',
  source text NOT NULL DEFAULT 'SISTEMA',
  source_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT installment_unique UNIQUE (operation_id, installment_number),
  CONSTRAINT installment_expected_positive CHECK (expected_amount >= 0),
  CONSTRAINT installment_received_positive CHECK (received_amount >= 0)
);
CREATE INDEX idx_inst_operation ON public.investment_installments(operation_id);
CREATE INDEX idx_inst_competence ON public.investment_installments(competence);
CREATE INDEX idx_inst_due ON public.investment_installments(due_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_installments TO authenticated;
GRANT ALL ON public.investment_installments TO service_role;
ALTER TABLE public.investment_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inst_all_auth" ON public.investment_installments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ RECEBIMENTOS ============
CREATE TABLE public.investment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.investment_operations(id) ON DELETE CASCADE,
  receipt_date date NOT NULL,
  total_amount numeric(14,2) NOT NULL,
  notes text,
  source text NOT NULL DEFAULT 'SISTEMA',
  source_key text UNIQUE,
  created_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipt_amount_positive CHECK (total_amount > 0)
);
CREATE INDEX idx_receipt_operation ON public.investment_receipts(operation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_receipts TO authenticated;
GRANT ALL ON public.investment_receipts TO service_role;
ALTER TABLE public.investment_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec_all_auth" ON public.investment_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.investment_receipt_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.investment_receipts(id) ON DELETE CASCADE,
  installment_id uuid NOT NULL REFERENCES public.investment_installments(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT allocation_amount_positive CHECK (amount > 0)
);
CREATE INDEX idx_alloc_receipt ON public.investment_receipt_allocations(receipt_id);
CREATE INDEX idx_alloc_installment ON public.investment_receipt_allocations(installment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_receipt_allocations TO authenticated;
GRANT ALL ON public.investment_receipt_allocations TO service_role;
ALTER TABLE public.investment_receipt_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alloc_all_auth" ON public.investment_receipt_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ APORTES ============
CREATE TABLE public.investment_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.investment_operations(id) ON DELETE CASCADE,
  contribution_date date NOT NULL,
  type text NOT NULL DEFAULT 'APORTE_ADICIONAL',
  amount numeric(14,2) NOT NULL,
  notes text,
  source text NOT NULL DEFAULT 'SISTEMA',
  source_key text UNIQUE,
  created_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contribution_amount_positive CHECK (amount <> 0)
);
CREATE INDEX idx_contrib_operation ON public.investment_contributions(operation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_contributions TO authenticated;
GRANT ALL ON public.investment_contributions TO service_role;
ALTER TABLE public.investment_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contrib_all_auth" ON public.investment_contributions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ IMPORTAÇÕES ============
CREATE TABLE public.investment_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  fingerprint text,
  status text NOT NULL DEFAULT 'EM_ANDAMENTO',
  rows_processed integer NOT NULL DEFAULT 0,
  rows_imported integer NOT NULL DEFAULT 0,
  rows_existing integer NOT NULL DEFAULT 0,
  rows_pending integer NOT NULL DEFAULT 0,
  rows_error integer NOT NULL DEFAULT 0,
  summary jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_imports TO authenticated;
GRANT ALL ON public.investment_imports TO service_role;
ALTER TABLE public.investment_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imp_all_auth" ON public.investment_imports FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.investment_import_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.investment_imports(id) ON DELETE CASCADE,
  operation_id uuid REFERENCES public.investment_operations(id) ON DELETE SET NULL,
  source_sheet text,
  source_row text,
  reference text,
  issue_type text NOT NULL,
  description text NOT NULL,
  raw_data jsonb,
  status text NOT NULL DEFAULT 'PENDENTE',
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_issue_import ON public.investment_import_issues(import_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_import_issues TO authenticated;
GRANT ALL ON public.investment_import_issues TO service_role;
ALTER TABLE public.investment_import_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issue_all_auth" ON public.investment_import_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ AUDITORIA ============
CREATE TABLE public.investment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON public.investment_audit_log(entity_type, entity_id);
GRANT SELECT, INSERT ON public.investment_audit_log TO authenticated;
GRANT ALL ON public.investment_audit_log TO service_role;
ALTER TABLE public.investment_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read_auth" ON public.investment_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert_auth" ON public.investment_audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============ TRIGGERS BÁSICOS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_op_touch BEFORE UPDATE ON public.investment_operations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_inst_touch BEFORE UPDATE ON public.investment_installments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- status base da parcela (RECEBIDO / PARCIAL / A_RECEBER)
CREATE OR REPLACE FUNCTION public.set_installment_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.received_amount >= NEW.expected_amount AND NEW.expected_amount > 0 THEN
    NEW.status := 'RECEBIDO';
  ELSIF NEW.received_amount > 0 THEN
    NEW.status := 'PARCIAL';
  ELSE
    NEW.status := 'A_RECEBER';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_inst_status BEFORE INSERT OR UPDATE OF received_amount, expected_amount
ON public.investment_installments FOR EACH ROW EXECUTE FUNCTION public.set_installment_status();

-- ============ VIEWS DE CÁLCULO ============
CREATE VIEW public.v_installments AS
SELECT
  i.id, i.operation_id, o.reference, c.name AS category, i.installment_number,
  i.competence, i.due_date, i.expected_amount, i.received_amount,
  GREATEST(i.expected_amount - i.received_amount, 0) AS outstanding_amount,
  CASE
    WHEN i.received_amount >= i.expected_amount AND i.expected_amount > 0 THEN 'RECEBIDO'
    WHEN i.due_date < CURRENT_DATE THEN 'INADIMPLENTE'
    WHEN i.received_amount > 0 THEN 'PARCIAL'
    ELSE 'A_RECEBER'
  END AS financial_status,
  i.status AS payment_status,
  CASE WHEN i.due_date < CURRENT_DATE AND i.received_amount < i.expected_amount
       THEN (CURRENT_DATE - i.due_date) ELSE 0 END AS days_overdue,
  i.source, i.created_at, i.updated_at
FROM public.investment_installments i
JOIN public.investment_operations o ON o.id = i.operation_id
LEFT JOIN public.investment_categories c ON c.id = o.category_id;
GRANT SELECT ON public.v_installments TO authenticated;

CREATE VIEW public.v_operation_position AS
WITH inst AS (
  SELECT operation_id,
    SUM(expected_amount) AS contracted_expected,
    SUM(received_amount) AS received_in_installments,
    SUM(CASE WHEN due_date < CURRENT_DATE THEN GREATEST(expected_amount - received_amount,0) ELSE 0 END) AS overdue_receivable,
    SUM(CASE WHEN due_date >= CURRENT_DATE THEN GREATEST(expected_amount - received_amount,0) ELSE 0 END) AS future_receivable,
    COUNT(*) FILTER (WHERE received_amount < expected_amount) AS open_installments,
    COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND received_amount < expected_amount) AS overdue_installments,
    COUNT(*) AS total_installments,
    MIN(due_date) AS first_installment_due,
    MAX(due_date) AS last_installment_due
  FROM public.investment_installments GROUP BY operation_id
),
contrib AS (
  SELECT operation_id, SUM(amount) AS contributions
  FROM public.investment_contributions WHERE cancelled_at IS NULL GROUP BY operation_id
),
rec AS (
  SELECT operation_id, SUM(total_amount) AS receipts_total, COUNT(*) AS receipts_count
  FROM public.investment_receipts WHERE cancelled_at IS NULL GROUP BY operation_id
)
SELECT
  o.id AS operation_id, o.reference, o.category_id, c.name AS category,
  o.due_day, o.first_due_date, o.installment_count, o.installment_value,
  o.investment_date, o.source, o.import_status, o.notes, o.description,
  o.initial_capital,
  COALESCE(contrib.contributions,0) AS contributions,
  o.initial_capital + COALESCE(contrib.contributions,0) AS total_invested,
  COALESCE(inst.received_in_installments,0) AS total_received,
  GREATEST(o.initial_capital + COALESCE(contrib.contributions,0) - COALESCE(inst.received_in_installments,0),0) AS capital_to_recover,
  COALESCE(inst.future_receivable,0) AS future_receivable,
  COALESCE(inst.overdue_receivable,0) AS overdue_receivable,
  COALESCE(inst.future_receivable,0) + COALESCE(inst.overdue_receivable,0) AS total_receivable,
  CASE WHEN (o.initial_capital + COALESCE(contrib.contributions,0)) > 0
       THEN LEAST(COALESCE(inst.received_in_installments,0) / (o.initial_capital + COALESCE(contrib.contributions,0)), 1)
       ELSE 0 END AS recovery_percentage,
  GREATEST(COALESCE(inst.received_in_installments,0) - (o.initial_capital + COALESCE(contrib.contributions,0)),0) AS realized_profit,
  COALESCE(inst.contracted_expected,0) - (o.initial_capital + COALESCE(contrib.contributions,0)) AS projected_result,
  COALESCE(inst.contracted_expected,0) AS contracted_total_calc,
  COALESCE(inst.open_installments,0) AS open_installments,
  COALESCE(inst.overdue_installments,0) AS overdue_installments,
  COALESCE(inst.total_installments,0) AS total_installments,
  inst.first_installment_due, inst.last_installment_due,
  COALESCE(rec.receipts_count,0) AS receipts_count,
  CASE
    WHEN o.import_status IN ('PENDENTE_REVISAO','INCONSISTENTE') THEN 'EM_REVISAO'
    WHEN COALESCE(inst.overdue_installments,0) > 0 THEN 'INADIMPLENTE'
    WHEN COALESCE(inst.open_installments,0) > 0 THEN 'ATIVA'
    ELSE 'ENCERRADA'
  END AS computed_status
FROM public.investment_operations o
LEFT JOIN public.investment_categories c ON c.id = o.category_id
LEFT JOIN inst ON inst.operation_id = o.id
LEFT JOIN contrib ON contrib.operation_id = o.id
LEFT JOIN rec ON rec.operation_id = o.id
WHERE o.cancelled_at IS NULL;
GRANT SELECT ON public.v_operation_position TO authenticated;

CREATE VIEW public.v_monthly_flow AS
SELECT
  i.competence,
  SUM(i.expected_amount) AS expected,
  SUM(i.received_amount) AS received,
  SUM(CASE WHEN i.due_date < CURRENT_DATE THEN GREATEST(i.expected_amount - i.received_amount,0) ELSE 0 END) AS overdue,
  SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN GREATEST(i.expected_amount - i.received_amount,0) ELSE 0 END) AS future_receivable,
  SUM(i.received_amount) - SUM(i.expected_amount) AS difference,
  CASE WHEN SUM(i.expected_amount) > 0 THEN SUM(i.received_amount)/SUM(i.expected_amount) ELSE 0 END AS realization_percentage,
  COUNT(*) AS installments_count
FROM public.investment_installments i
JOIN public.investment_operations o ON o.id = i.operation_id AND o.cancelled_at IS NULL
GROUP BY i.competence;
GRANT SELECT ON public.v_monthly_flow TO authenticated;

CREATE VIEW public.v_portfolio_summary AS
SELECT
  SUM(total_invested) AS total_invested,
  SUM(total_received) AS total_received,
  GREATEST(SUM(total_invested) - SUM(total_received),0) AS capital_to_recover,
  SUM(total_receivable) AS total_receivable,
  SUM(overdue_receivable) AS overdue_receivable,
  SUM(future_receivable) AS future_receivable,
  CASE WHEN SUM(total_invested) > 0 THEN LEAST(SUM(total_received)/SUM(total_invested),1) ELSE 0 END AS recovery_percentage,
  GREATEST(SUM(total_received) - SUM(total_invested),0) AS realized_profit,
  SUM(contracted_total_calc) - SUM(total_invested) AS projected_result,
  COUNT(*) FILTER (WHERE computed_status IN ('ATIVA','INADIMPLENTE')) AS active_operations,
  COUNT(*) FILTER (WHERE computed_status = 'INADIMPLENTE') AS overdue_operations,
  COUNT(*) FILTER (WHERE computed_status = 'EM_REVISAO') AS review_operations,
  COUNT(*) FILTER (WHERE computed_status = 'ENCERRADA') AS closed_operations,
  SUM(overdue_installments) AS overdue_installments,
  COUNT(*) AS total_operations
FROM public.v_operation_position;
GRANT SELECT ON public.v_portfolio_summary TO authenticated;

-- ============ RPC: gerar cronograma ============
CREATE OR REPLACE FUNCTION public.generate_schedule(p_operation_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  op public.investment_operations;
  i integer;
  due date;
  created integer := 0;
BEGIN
  SELECT * INTO op FROM public.investment_operations WHERE id = p_operation_id;
  IF op.id IS NULL THEN RAISE EXCEPTION 'Operação não encontrada'; END IF;
  IF op.first_due_date IS NULL OR op.installment_count IS NULL OR op.installment_count < 1
     OR op.installment_value IS NULL OR op.installment_value <= 0 THEN
    RAISE EXCEPTION 'Contrato incompleto: informe primeiro vencimento, quantidade de parcelas e valor da parcela';
  END IF;
  FOR i IN 1..op.installment_count LOOP
    due := (op.first_due_date + ((i - 1) * INTERVAL '1 month'))::date;
    INSERT INTO public.investment_installments
      (operation_id, installment_number, competence, due_date, expected_amount, source)
    VALUES (op.id, i, date_trunc('month', due)::date, due, op.installment_value, op.source)
    ON CONFLICT (operation_id, installment_number) DO NOTHING;
    created := created + 1;
  END LOOP;
  UPDATE public.investment_operations
     SET contracted_total = op.installment_count * op.installment_value,
         last_due_date = (op.first_due_date + ((op.installment_count - 1) * INTERVAL '1 month'))::date
   WHERE id = op.id;
  INSERT INTO public.investment_audit_log (entity_type, entity_id, action, new_data, user_id)
  VALUES ('operation', op.id, 'CRONOGRAMA_GERADO', jsonb_build_object('parcelas', created), auth.uid());
  RETURN created;
END; $$;
GRANT EXECUTE ON FUNCTION public.generate_schedule(uuid) TO authenticated;

-- ============ RPC: registrar recebimento (lote) ============
CREATE OR REPLACE FUNCTION public.register_receipt(
  p_operation_id uuid,
  p_receipt_date date,
  p_allocations jsonb,
  p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  alloc jsonb;
  v_total numeric(14,2) := 0;
  v_receipt_id uuid;
  v_inst public.investment_installments;
  v_amount numeric(14,2);
BEGIN
  IF p_allocations IS NULL OR jsonb_array_length(p_allocations) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma parcela';
  END IF;
  FOR alloc IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
    v_amount := (alloc->>'amount')::numeric;
    IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Valor do recebimento deve ser maior que zero'; END IF;
    SELECT * INTO v_inst FROM public.investment_installments WHERE id = (alloc->>'installment_id')::uuid;
    IF v_inst.id IS NULL THEN RAISE EXCEPTION 'Parcela não encontrada'; END IF;
    IF v_inst.operation_id <> p_operation_id THEN RAISE EXCEPTION 'Parcela não pertence à operação'; END IF;
    v_total := v_total + v_amount;
  END LOOP;

  INSERT INTO public.investment_receipts (operation_id, receipt_date, total_amount, notes, created_by)
  VALUES (p_operation_id, COALESCE(p_receipt_date, CURRENT_DATE), v_total, p_notes, auth.uid())
  RETURNING id INTO v_receipt_id;

  FOR alloc IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
    v_amount := (alloc->>'amount')::numeric;
    INSERT INTO public.investment_receipt_allocations (receipt_id, installment_id, amount)
    VALUES (v_receipt_id, (alloc->>'installment_id')::uuid, v_amount);
    UPDATE public.investment_installments
       SET received_amount = received_amount + v_amount
     WHERE id = (alloc->>'installment_id')::uuid;
  END LOOP;

  INSERT INTO public.investment_audit_log (entity_type, entity_id, action, new_data, user_id)
  VALUES ('receipt', v_receipt_id, 'RECEBIMENTO_REGISTRADO',
          jsonb_build_object('total', v_total, 'alocacoes', p_allocations), auth.uid());
  RETURN v_receipt_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.register_receipt(uuid, date, jsonb, text) TO authenticated;

-- ============ RPC: cancelar recebimento ============
CREATE OR REPLACE FUNCTION public.cancel_receipt(p_receipt_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF (SELECT cancelled_at FROM public.investment_receipts WHERE id = p_receipt_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Recebimento já cancelado';
  END IF;
  FOR r IN SELECT installment_id, amount FROM public.investment_receipt_allocations WHERE receipt_id = p_receipt_id LOOP
    UPDATE public.investment_installments
       SET received_amount = GREATEST(received_amount - r.amount, 0)
     WHERE id = r.installment_id;
  END LOOP;
  UPDATE public.investment_receipts SET cancelled_at = now(), cancelled_by = auth.uid() WHERE id = p_receipt_id;
  INSERT INTO public.investment_audit_log (entity_type, entity_id, action, user_id)
  VALUES ('receipt', p_receipt_id, 'RECEBIMENTO_CANCELADO', auth.uid());
END; $$;
GRANT EXECUTE ON FUNCTION public.cancel_receipt(uuid) TO authenticated;