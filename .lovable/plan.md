# Plano de Limpeza Definitiva da Base

Identifiquei que, apesar da função de limpeza global ter sido executada, 19 operações e 449 parcelas ainda persistem no banco de dados. Isso indica que as transações de `DELETE` na RPC `clear_portfolio_data` podem ter falhado silenciosamente ou sido bloqueadas por algum erro de restrição de integridade não reportado.

Vou forçar um zeramento absoluto via migração SQL direta, garantindo que a base fique 100% limpa antes de qualquer nova importação.

## Alterações

### Banco de Dados (Supabase)
- Executar um script de limpeza incondicional em todas as tabelas de investimento, desta vez usando `TRUNCATE CASCADE` ou `DELETE` explícito em ordem inversa de dependência.
- As tabelas afetadas serão:
    1. `investment_receipt_allocations`
    2. `investment_receipts`
    3. `investment_installments`
    4. `investment_contributions`
    5. `portfolio_memberships`
    6. `investment_operations`
    7. `investment_references`
    8. `investment_imports` e logs relacionados.

## Validação
- Após a execução, farei uma contagem direta em `investment_installments` e `investment_operations`.
- O objetivo é que ambas retornem exatamente **0**.
