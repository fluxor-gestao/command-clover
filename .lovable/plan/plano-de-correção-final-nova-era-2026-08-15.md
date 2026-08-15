# Plano de Correção Final — Nova Era

Este plano detalha a resolução das 3 pendências críticas para a entrega operacional do sistema Nova Era.

## 1. Conflito de Sincronização
Atualmente, o sistema realiza UPSERT mesmo em caso de CONFLITO no modo `CONTROLE_GERENCIAL`.
- **Alteração**: Modificar `import-workbook.ts` para que, se `syncStatus === 'CONFLITO'`, a operação seja ignorada no loop de gravação e adicionada a uma lista de pendências.
- **UI**: Em `importacao.tsx`, exibir um diálogo de resolução de conflitos comparando "Sistema" vs "Excel" para campos divergentes.
- **Ações**: Botões "Manter Sistema" (ignora Excel) e "Usar Excel" (força UPSERT).

## 2. Sincronização da Aba Aluguéis
Integração da aba "Alugueis" ao motor de sincronização.
- **Leitura**: Adicionar `parseRentalsSheet` em `parse-workbook.ts` para mapear colunas (Imóvel, Categoria, Vencimento, Aluguel, Datas, Fluxo Jan-Dez).
- **Destino**: Persistir em `rental_properties` e `rental_receipts`.
- **Regra**: Não criar `investment_operation` para imóveis da aba Aluguéis (patrimônio próprio).

## 3. Projeção da Carteira Gerencial
Ajuste da projeção para ser contínua e baseada estritamente na carteira selecionada.
- **Lógica**: Se o filtro global for "Carteira 2026", buscar operações via `portfolio_memberships`.
- **Projeção**: Percorrer do `first_due_date` até o `last_due_date` de cada operação, gerando competências mensais até o fim dos contratos (2027, 2028, etc.).
- **Unificação**: Centralizar essa lógica em um hook ou RPC para que Dashboard e Relatórios exibam os mesmos números.

## Validação Técnica
- **Conflito**: Simular alteração manual no banco e tentar reimportar Excel. O sistema deve travar e pedir resolução.
- **Aluguéis**: Validar carga total vs Excel.
- **Carteira 2026**: Confirmar contagem de 27 operações (backfill das 5 faltantes via SQL).
- **Projeção**: Verificar se os gráficos mostram anos além de 2026 se houver contratos longos.

## Detalhes Técnicos
- **RPC `check_sync_conflict`**: Já existe, será integrada à UI de decisão.
- **Entidades**: `rental_properties`, `rental_receipts`, `portfolio_memberships`.
- **Framework**: TanStack Start v1 / Supabase.
