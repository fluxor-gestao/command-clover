-- 1. Tabela para registrar cada execução de sincronização/importação
CREATE TABLE IF NOT EXISTS public.sync_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    filename text NOT NULL,
    mode text NOT NULL, -- 'HISTORICAL_IMPORT', 'PORTFOLIO_SYNC'
    status text NOT NULL, -- 'EM_ANDAMENTO', 'CONCLUIDA', 'ERRO'
    total_processed integer DEFAULT 0,
    new_records integer DEFAULT 0,
    updated_records integer DEFAULT 0,
    ignored_records integer DEFAULT 0,
    conflicts integer DEFAULT 0,
    errors integer DEFAULT 0,
    summary jsonb,
    started_at timestamptz DEFAULT now(),
    finished_at timestamptz,
    created_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view sync runs') THEN
        CREATE POLICY "Users can view sync runs" ON public.sync_runs FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 2. Garantir colunas de hash e controle em entidades principais
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investment_operations' AND column_name = 'source_hash') THEN
        ALTER TABLE public.investment_operations ADD COLUMN source_hash text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investment_operations' AND column_name = 'last_synced_at') THEN
        ALTER TABLE public.investment_operations ADD COLUMN last_synced_at timestamptz;
    END IF;
END $$;

-- 3. Função para verificar se houve alteração desde a última sincronização
CREATE OR REPLACE FUNCTION public.check_sync_conflict(
    p_operation_id uuid,
    p_incoming_hash text
) RETURNS text AS $$
DECLARE
    v_current_hash text;
    v_updated_at timestamptz;
    v_last_synced timestamptz;
BEGIN
    SELECT source_hash, updated_at, last_synced_at 
    INTO v_current_hash, v_updated_at, v_last_synced
    FROM public.investment_operations
    WHERE id = p_operation_id;

    IF v_current_hash = p_incoming_hash THEN
        RETURN 'INALTERADO';
    END IF;

    IF v_last_synced IS NOT NULL AND v_updated_at > v_last_synced + interval '5 seconds' THEN
        RETURN 'CONFLITO';
    END IF;

    RETURN 'ALTERADO_NO_EXCEL';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
