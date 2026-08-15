# Plano de Consolidação: Onda de Convergência e Carteira Gerencial

Este plano consolida a infraestrutura de sincronização entre as planilhas Excel e o sistema, garantindo a integridade da carga histórica homologada e a precisão da Carteira Gerencial 2026.

## Auditoria e Infraestrutura
- [x] Criada tabela `sync_runs` para rastreamento de operações.
- [x] Criada função `check_sync_conflict` para detecção de divergências entre Excel e Sistema.
- [x] Verificada integridade de `portfolio_memberships` e `investment_operations`.

## Fase 2: Modos de Importação Reais
- **HISTORICAL_IMPORT**: Focado em carga de dados (2023-2030), preservando a idempotência via `source_key`.
- **PORTFOLIO_SYNC**: Modo de sincronização inteligente que utiliza o motor de diff para atualizar registros existentes sem destruir alterações manuais.

## Fase 3: Motor de Diff e UX de Sincronização
- Implementar interface visual na tela de Importação que classifica registros em: **Novo**, **Alterado**, **Inalterado** e **Conflito**.
- Adicionar indicadores no topo com contadores de cada categoria.
- **Resolução de Conflitos**: Exibir comparação campo a campo quando houver divergência entre alteração no Excel e alteração manual no Sistema.

## Fase 4: Sincronização de Referências e Aluguéis
- Estender a lógica de `source_hash` para as tabelas `investment_references` e `rental_properties`.
- Garantir que a sincronização não remova registros ausentes no Excel, apenas os sinalize.

## Fase 5: Dashboard e Relatórios
- Refinar `YearScopeSelect` para alternar entre "Management Mode" (Carteira Gerencial) e "Audit Mode" (Base Completa).
- Validar que os KPIs de 2026 batem 100% com o Controle Gerencial (27 operações).

## Detalhes Técnicos
- Utilização de `source_hash` gerado via `crypto` no parser para identificar mudanças reais.
- Proteção de dados: O sistema nunca deleta dados automaticamente se não encontrados no Excel.
- RPC `check_sync_conflict` será usada no preview de importação para enriquecer a visualização.
