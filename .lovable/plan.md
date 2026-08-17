# Homologação Final — Ponto de Corte Oficial Agosto/2026

Objetivo: tornar a guia "À receber 2026" (Base2026) a única fonte da Carteira Gerencial 2026, aplicar o corte oficial de inadimplência em agosto/2026 e homologar com números reais. Sem mudar arquitetura, layout, nomenclaturas ou o Audit Mode.

## Diagnóstico já verificado nesta análise

- A Base2026 tem 5 parcelas em vermelho (fonte vermelha) com competência anterior a agosto/2026, somando exatamente R$ 15.068,54: ALTO DO PARQUE 1105 (abr, 9.000,00), BEACH VILLAGE 1303 (jun, 2.153,54), BEACH VILLAGE 804 (jul, 1.890,00), CASA CIDADE 2000 (fev, 1.012,50 e mai, 1.012,50).
- As parcelas já gravadas no sistema para essas referências reproduzem exatamente esses saldos abertos (conferido linha a linha no banco). O motor de parcelas está correto.
- O problema está no **membership**: a carteira 2026 tem 27 vínculos, porém parte deles aponta para operações históricas duplicadas (ex.: "Alto do Parque apto 1105" e "Beach Village apto 1303 Norte", com parcelas de 2025) em vez das operações da Base2026. Por isso o saldo inadimplente da carteira sai com competências 2025-11, 2025-12 e valores de 1.300,00 que não existem na Base2026.
- Logo: não é preciso "reprocessar" a base histórica; é preciso reconstruir o membership 2026 a partir da Base2026 e aplicar o cutoff nas métricas.

## O que será feito

### 1. Resolução de referências da Base2026 (sem número fixo)
- No parser (`parse-workbook.ts`), passar a emitir a lista completa de linhas da Base2026 (referência, venc., valor emprestado, fluxo mensal, células vermelhas) como snapshot oficial da carteira, ignorando as seções que não são investimento (Aluguéis de Imóveis Próprios, Carros à Receber vão para seus destinos atuais, sem virar membership de investimento).
- Resolver cada referência contra `investment_operations` na ordem: `source_key` → referência normalizada (acentos, espaços, pontuação, abreviações APT/APTO) → aliases já existentes.
- Quando houver mais de uma operação candidata (duplicatas históricas), escolher a que possui parcelas de 2026 com `source` de importação da guia 2026; as demais permanecem intactas no histórico.
- Nenhuma contagem esperada é fixada em código: a carteira é o conjunto resolvido.

### 2. Sincronização de `portfolio_memberships` 2026
- Migração para limpar/inativar vínculos 2026 que não correspondam à Base2026 e ativar os corretos, gravando o `source_key` de origem.
- Nunca excluir operação histórica: referência removida da Base2026 apenas inativa o membership (com confirmação na tela de importação).
- Relatório retornado na importação e na homologação: Referência Excel | Operação Sistema | source_key | Status do vínculo (VINCULADO / ATUALIZADO / NÃO RESOLVIDO / INATIVADO).

### 3. Cutoff oficial de inadimplência
- Introduzir o conceito explícito `cutoff_competence = 2026-08`, parametrizável nas RPCs `get_portfolio_metrics` e `get_portfolio_projection` (default = primeiro dia do mês corrente, valor oficial deste fechamento = 2026-08-01), substituindo `CURRENT_DATE` no cálculo de inadimplência da Carteira Gerencial.
- INADIMPLÊNCIA = saldo aberto com competência < cutoff. A RECEBER FUTURO = saldo aberto com competência >= cutoff. TOTAL A RECEBER = soma das duas (validado matematicamente).
- Nova RPC `get_overdue_breakdown(p_year, p_cutoff)` devolvendo as parcelas que compõem a inadimplência (referência, competência, saldo) para o teste de composição.

### 4. Dashboard e Projeção
- Dashboard em Management Mode passa a consumir exclusivamente a carteira Base2026 (via membership sincronizado) e o cutoff, sem alterar layout dos cards.
- Projeção continua partindo das operações do membership e vai até o último vencimento de cada contrato (2027, 2028, 2029, 2030 inclusive), sem corte anual.

### 5. Importação (Portfolio Sync)
- Base2026 tratada como snapshot oficial: NOVO → inserir/vincular, ALTERADO → atualizar, INALTERADO → nada, CONFLITO → decisão manual (fluxo atual "USAR EXCEL" / "MANTER SISTEMA"), REMOVIDO → apenas inativar membership após confirmação.

### 6. Homologação real (relatório entregue no chat)
- Bloco 1: registros da Base2026, resolvidos, memberships ativos, referências não resolvidas.
- Bloco 2: tabela INDICADOR | EXCEL | SISTEMA | DIFERENÇA | STATUS para Capital Investido, Total Recebido, Capital a Recuperar, Total a Receber, % Recuperado, Operações, Inadimplência, Projeção futura.
- Bloco 3: composição da inadimplência (as 5 parcelas). Qualquer parcela de agosto/2026 na lista reprova.
- Veredictos finais: Carteira Gerencial, Inadimplência, Total a Receber, Projeção, Sincronização, Entrega Final. Diferenças serão mostradas e explicadas, sem ajuste artificial de dados.

## Detalhes técnicos

- Migrações: `get_portfolio_metrics(p_year, p_cutoff_competence)`, `get_portfolio_projection(p_year, p_cutoff_competence)`, nova `get_overdue_breakdown`, e sincronização de `portfolio_memberships` 2026.
- Código: `src/lib/import/parse-workbook.ts` (snapshot Base2026 + resolução de referências), `src/lib/import/import-workbook.ts` (sync de membership + estados NOVO/ALTERADO/INALTERADO/CONFLITO/REMOVIDO), `src/lib/data/hooks.ts` (cutoff + breakdown), `dashboard.tsx` e `relatorios.tsx` (consumo dos novos campos, sem mudança de layout), `HomologacaoFinanceira.tsx` (blocos de auditoria e composição).
- Audit Mode e todas as tabelas históricas permanecem intocados.
