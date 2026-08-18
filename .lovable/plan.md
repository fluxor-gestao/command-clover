# Plano de Correção: Visibilidade Pós-Importação e Sincronização Estrita

O usuário relata que, após subir o arquivo e receber a confirmação de importação bem-sucedida, o sistema continua sem exibir dados (Dashboard zerado e páginas vazias). As verificações via API confirmam que o banco de dados está atualmente com 0 registros, o que é esperado após o zeramento, mas a importação subsequente falhou em persistir os dados ou a UI não está invalidando os caches corretamente.

## Problemas Identificados
1. **Falha Silenciosa no Importador**: O processo de importação pode estar encontrando um erro atômico (ex: constraint de chave estrangeira ou permissão RLS) que aborta a transação sem retornar erro para a UI.
2. **Dependência de Vencimentos 2026**: A lógica de `portfolio_memberships` (necessária para o Dashboard Gerencial) pode estar filtrando operações que não atendem aos critérios de data de 2026.
3. **Cache de Consulta**: O TanStack Query pode estar mantendo estados vazios mesmo após a importação.

## Alterações Propostas

### 1. Refinamento do Motor de Importação (`src/lib/import/import-workbook.ts`)
- **Resiliência em Memberships**: Garantir que o vínculo com a carteira 2026 seja criado independentemente do status da operação (`NOVO` ou `INALTERADO`).
- **Logs de Depuração**: Adicionar logs detalhados no servidor (via `console.log` no `createServerFn` se aplicável, ou logs de resposta no cliente) para capturar o exato ponto de falha.
- **Transacionalidade**: Verificar se o `upsert` em massa está falhando devido a limites de tamanho de payload ou constraints.

### 2. Melhoria na UI de Importação (`src/routes/_authenticated/importacao.tsx`)
- **Invalidação Agressiva**: Reforçar o `invalidate()` do TanStack Query para garantir que todas as queries (metrics, operations, installments) sejam marcadas como stale imediatamente.
- **Feedback de Dados**: Exibir um resumo visual mais claro dos registros criados vs. ignorados após o sucesso.

### 3. Ajuste de Homologação (`src/lib/import/parse-workbook.ts`)
- **Alinhamento de Datas**: Garantir que operações com `first_due_date` ou `last_due_date` em 2026 sejam priorizadas para o vínculo gerencial.

## Detalhes Técnicos
- **Supabase RLS**: Revisar se a tabela `sync_runs` e `investment_import_issues` permitem inserção por usuários autenticados sem restrições que causem falhas silenciosas.
- **RPC Metrics**: Verificar se a RPC `get_portfolio_metrics` está ignorando registros por falta de `portfolio_year = 2026` ativo.

## Verificação
- Realizar uma importação de teste e verificar via API (`curl`) a contagem de registros em `investment_operations` e `portfolio_memberships`.
- Confirmar se o Dashboard exibe os valores esperados (ex: R$ 756.800,00 investidos e R$ 15.068,54 inadimplentes) imediatamente após a confirmação.
