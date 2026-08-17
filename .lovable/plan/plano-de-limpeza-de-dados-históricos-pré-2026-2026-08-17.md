# Plano de Limpeza de Dados Históricos (Pré-2026)

O usuário solicitou a remoção de todos os dados de parcelas com vencimento anterior a 2026 (2024, 2023, etc.), estabelecendo o ano de 2026 como o novo ponto de partida oficial do sistema.

## Ações Propostas

### 1. Limpeza do Banco de Dados
Executar uma migração SQL para remover fisicamente as parcelas e recebimentos legados que não fazem parte da nova estratégia "Base 2026".
- Deletar registros da tabela `public.investment_installments` onde `due_date < '2026-01-01'`.
- Como a tabela `investment_receipts` possui `ON DELETE CASCADE` para a FK de `installment_id` (verificado nas migrações anteriores), os recebimentos vinculados a essas parcelas também serão removidos automaticamente.

### 2. Atualização das Views de Métricas
Garantir que as views que calculam saldos e posições reflitam apenas a realidade a partir de 2026, evitando que resíduos de operações antigas (sem parcelas ativas) apareçam como "Inadimplentes" ou com "Capital a Recuperar" incorreto.
- Revisar a view `v_investment_references` e `v_portfolio_summary` para garantir que o cálculo de `total_invested` e `total_received` considere apenas o horizonte 2026+.

### 3. Ajuste no Parser de Importação
Reforçar a lógica no `src/lib/import/parse-workbook.ts` para que, em futuras importações de planilhas Excel, qualquer dado anterior a 2026 seja ignorado ou tratado apenas como histórico não-operacional, focando o processamento na aba "Base2026".

## Detalhes Técnicos

### SQL de Limpeza
```sql
-- Remover parcelas anteriores a 2026
DELETE FROM public.investment_installments 
WHERE due_date < '2026-01-01';

-- As tabelas dependentes (receipts, etc) devem limpar via CASCADE.
```

### Validação
- Verificar a página de "Parcelas" no sistema para confirmar que a lista começa em 2026.
- Conferir o Dashboard para garantir que os KPIs de "Inadimplência" e "Capital Recebido" estejam alinhados com o novo ponto de corte.
