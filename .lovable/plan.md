# Plano de Correção: Dashboard e Importação V3

O usuário reportou que, após a importação confirmada, o Dashboard e as outras telas continuam zerados. A investigação revelou que as tabelas principais (`investment_operations`, `investment_installments`, etc.) e a tabela de logs de importação (`sync_runs`) estão fisicamente vazias no banco de dados, indicando que a transação de importação pode estar falhando silenciosamente ou não está sendo disparada corretamente devido a um erro de permissão ou lógica no fluxo de gravação.

## Diagnóstico
- As tabelas de produção estão vazias (`count = 0`).
- A RPC `get_portfolio_metrics` retorna zeros para a carteira 2026.
- A função `importParseResult` em `src/lib/import/import-workbook.ts` tenta realizar o insert em `sync_runs` e depois nas operações. Se o insert inicial em `sync_runs` falhar (mesmo com a correção de RLS anterior), o processo para.
- Suspeita-se que a limpeza global executada anteriormente tenha removido permissões ou que o `syncStatus` esteja bloqueando o UPSERT indevidamente no modo `CONTROLE_GERENCIAL`.

## Ações Propostas

### 1. Reforço de Permissões e RLS
Garantir que todas as tabelas envolvidas na importação tenham as permissões corretas para o papel `authenticated` e que as políticas de RLS permitam a inserção.

### 2. Correção da Lógica de Sincronização
Ajustar `importParseResult` para garantir que a transação não seja interrompida e que o `importId` seja tratado de forma robusta. Remover travas que possam estar impedindo o UPSERT quando a base está zerada.

### 3. Ajuste do Dashboard
Garantir que o Dashboard não dependa de caches antigos e que a filtragem por `portfolio_memberships` funcione corretamente assim que os dados forem inseridos.

## Detalhes Técnicos
- Executar migração SQL para resetar GRANTs em `investment_operations`, `investment_installments`, `investment_receipts`, `portfolio_memberships`, `sync_runs` e `investment_import_issues`.
- Modificar `import-workbook.ts` para garantir que `operationId` seja sempre recuperado/gerado corretamente.
- Adicionar logs detalhados no cliente para identificar falhas durante o `runImport` no frontend.

---
Por favor, autorize a execução deste plano para restaurar a visibilidade dos dados no Dashboard.
