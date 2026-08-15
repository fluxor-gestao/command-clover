---
title: Correção Final de Bloqueadores - Fase 3
description: Resolução de conflitos de sincronização, importação de aluguéis e projeção contínua da carteira.
---

# Plano de Correção Final

## 1. Conflito de Sincronização
- **UI de Resolução**: Em `src/routes/_authenticated/importacao.tsx`, implementar um diálogo ou expansão no diff para quando `syncStatus === 'CONFLITO'`.
- **Ações**: Adicionar botões "MANTER SISTEMA" (ignora o item da planilha) e "USAR EXCEL" (força o UPSERT sobrescrevendo as alterações manuais).
- **Lógica**: O botão "USAR EXCEL" disparará o UPSERT via `import-workbook.ts` passando um flag `forceUpdate`.

## 2. Aba Aluguéis
- **Parser**: Ativar o uso de `parseRentalsSheet` no fluxo de importação.
- **Diferenciação**: Garantir que imóveis próprios da aba "Alugueis" sejam mapeados para `rental_properties` e `rental_receipts`, e **não** criem registros em `investment_operations`.
- **KPIs**: Validar que esses valores não se misturam aos investimentos no dashboard.

## 3. Projeção Contínua
- **RPC `get_portfolio_metrics`**: A RPC já foi ajustada para remover o filtro de ano, mas os hooks do frontend (`usePortfolioMetrics`) precisam garantir que a projeção ignore limites de dezembro.
- **Cálculo**: A projeção deve percorrer até o `last_due_date` de cada contrato ativo na carteira selecionada.

## 4. Carteira 2026
- **Vinculação**: Executar script para garantir as 27 operações (vinculando Helton, Moto Ivano, etc).

## Detalhes Técnicos
- Modificação em `src/lib/import/import-workbook.ts` para aceitar `forceUpdate`.
- Ajuste em `src/routes/_authenticated/importacao.tsx` para exibir a interface de conflito.
- Refinamento da lógica de baseline em `src/lib/import/parse-workbook.ts` para aluguéis.
