# Plano de Homologação Final — Ponto de Corte Agosto/2026

Este plano consolida o sistema Nova Era utilizando a guia "À receber 2026" (Base2026) como fonte única da Carteira Gerencial 2026, aplicando o ponto de corte oficial de inadimplência em Agosto/2026.

## 1. Fonte Oficial e Membership
- **Sincronização Estrita**: O Management Mode 2026 passará a refletir exclusivamente as operações listadas na guia "À receber 2026".
- **Resolução de Referências**: O motor de importação resolverá cada linha da planilha contra o sistema usando:
  1. `source_key` (chave de importação anterior).
  2. Referência normalizada (removendo acentos, pontuação e normalizando abreviações como APT/APTO).
  3. Aliases existentes.
- **Vínculo de Carteira**: Operações identificadas na Base2026 serão marcadas em `portfolio_memberships` para o ano 2026. Operações que saíram da planilha serão inativadas no membership 2026 (mas preservadas no histórico do Audit Mode).

## 2. Regra de Inadimplência (Cutoff Agosto/2026)
- **Novo Parâmetro de Cutoff**: Implementar `p_cutoff_competence` nas RPCs de métricas (padrão: 2026-08-01 para este fechamento).
- **Cálculo de Inadimplência**: 
  - `INADIMPLÊNCIA` = Saldo aberto com competência < Agosto/2026.
  - `A RECEBER FUTURO` = Saldo aberto com competência >= Agosto/2026.
- **Validação**: O total inadimplente deve bater exatamente R$ 15.068,54, composto pelas parcelas de:
  - Alto do Parque 1105 (Abril)
  - Beach Village 1303 (Junho)
  - Beach Village 804 (Julho)
  - Casa Cidade 2000 (Fevereiro e Maio)

## 3. Dashboard e Projeção
- **Cards de KPI**: Consumirão as métricas filtradas pelo membership Base2026 e pela nova regra de cutoff.
- **Projeção Contínua**: A projeção partirá das operações do membership 2026 e percorrerá até o `last_due_date` de cada contrato (mesmo que em 2027, 2028+).

## 4. Homologação e Relatórios
- **Interface de Homologação**: Atualizar `HomologacaoFinanceira.tsx` para exibir:
  - Auditoria de vínculos (Excel vs Sistema).
  - Tabela comparativa de indicadores (Capital, Recebido, Inadimplência, etc).
  - Breakdown detalhado das parcelas inadimplentes.
- **Veredicto Final**: Relatório automatizado no chat confirmando se os números batem 100% com o Excel oficial.

## Detalhes Técnicos
- **SQL**: Atualização da RPC `get_portfolio_metrics` e criação de `get_overdue_breakdown` para suportar o cutoff parametrizado.
- **Parser**: Refinamento em `parse-workbook.ts` para identificar explicitamente a guia Base2026 e capturar as marcações de inadimplência originais (células vermelhas) apenas para fins de auditoria, mantendo o cálculo de saldo real no sistema.
- **Frontend**: Ajuste nos hooks em `hooks.ts` e nos componentes de Dashboard/Relatórios para passar o cutoff de Agosto/2026 quando em modo gerencial.
