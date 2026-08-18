# Alinhar os cards do Dashboard com o Painel da planilha

Verifiquei na base: somando, por operação, `nº parcelas × valor da parcela − capital inicial` das 19 operações da Carteira 2026, o resultado é exatamente **R$ 599.808,56** — o mesmo "Lucro Real Projetado / Lucro Estimado" da planilha. Hoje o card usa a soma das parcelas geradas, por isso dá número negativo.

## Cards finais (linha 1 e linha 2)

| Card | Fórmula | Valor esperado hoje |
|---|---|---|
| Capital Investido | como está | 756.800,00 |
| Capital Recebido | como está | 312.852,25 |
| Capital a Recuperar | como está | 443.947,75 |
| Lucro Real Projetado | Σ (nº parcelas × valor parcela − capital inicial) | 599.808,56 |
| Resultado Projetado | Capital Investido + Lucro Real Projetado | 1.356.608,56 |
| Inadimplência | como está | 13.043,54 |
| Valor Total | Capital Investido + Lucro Real Projetado + Inadimplência | 1.369.652,10 |

O card **Lucro Realizado** é removido, ficando 4 cards na primeira linha e 3 na segunda.

Todos respeitam o filtro de ano/escopo já existente no topo.

## Detalhes técnicos

- Novo hook em `src/lib/data/hooks.ts` (`useContractTotals(scope)`): consulta `investment_operations` (`id, initial_capital, installment_count, installment_value`) com join em `portfolio_memberships` (`is_active = true`, `portfolio_year = ano` quando houver escopo anual) e retorna `contractedTotal`, `investedCapital` e `projectedProfit = Σ(count×value − capital)`, ignorando operações sem `installment_count`/`installment_value`.
- Em `src/routes/_authenticated/dashboard.tsx`: substituir `contractedTotal` derivado de `scopedInstallments` pelos valores do novo hook; `resultadoProjetado = invested + projectedProfit`; `valorTotal = invested + projectedProfit + overdue_amount`; remover o `Kpi` "Lucro realizado" e ajustar os hints para descrever as novas fórmulas.
- Sem mudanças de schema nem de dados; a inadimplência continua vindo de `get_portfolio_metrics`.
