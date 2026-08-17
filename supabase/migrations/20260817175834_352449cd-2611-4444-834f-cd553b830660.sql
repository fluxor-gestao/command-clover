CREATE OR REPLACE FUNCTION public.clear_portfolio_data(
    p_year integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_op_ids uuid[];
BEGIN
    -- 1. Identificar todas as operações que fazem parte dessa carteira
    SELECT array_agg(operation_id) 
    INTO v_op_ids
    FROM public.portfolio_memberships
    WHERE portfolio_year = p_year;

    IF v_op_ids IS NOT NULL THEN
        -- 2. Remover recebimentos atrelados a essas operações
        DELETE FROM public.investment_receipts 
        WHERE operation_id = ANY(v_op_ids);

        -- 3. Remover parcelas atreladas a essas operações
        DELETE FROM public.investment_installments 
        WHERE operation_id = ANY(v_op_ids);

        -- 4. Remover aportes atrelados a essas operações
        DELETE FROM public.investment_contributions 
        WHERE operation_id = ANY(v_op_ids);

        -- 5. Remover memberships
        DELETE FROM public.portfolio_memberships
        WHERE portfolio_year = p_year;
        
        -- 6. Deletar operações que ficaram órfãs (não pertencem a outros anos)
        DELETE FROM public.investment_operations
        WHERE id = ANY(v_op_ids)
          AND NOT EXISTS (
              SELECT 1 FROM public.portfolio_memberships 
              WHERE operation_id = investment_operations.id 
                AND portfolio_year != p_year
          );
    END IF;

    -- 7. Zerar Aluguéis (Como não há portfolio_year em rental_properties, limpamos todos os dados vinculados a aluguéis)
    -- O usuário pediu para zerar "Alugueis" e o sistema é focado na Base 2026.
    DELETE FROM public.rental_receipts;
    DELETE FROM public.rental_properties;

    -- 8. Limpar referências órfãs que vieram de importação (opcional, mas recomendado para limpeza total)
    DELETE FROM public.investment_references
    WHERE source = 'EXCEL'
      AND NOT EXISTS (SELECT 1 FROM public.investment_operations WHERE reference_id = investment_references.id);
END;
$$;