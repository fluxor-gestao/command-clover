# Plano de Homologação Final e Correção do Dashboard (Corte 2026)

Este plano visa corrigir a implementação do sistema para que os cálculos do Dashboard e da Homologação coincidam exatamente com os valores da planilha oficial "Base2026", respeitando o ponto de corte de Agosto/2026.

## 1. Correção e Proteção da Carteira Gerencial 2026

*   **Remover Migration Destrutiva**: Alterar a lógica que apaga os memberships de 2026 sem reconstruí-los.
*   **Sincronização Atômica**: Ajustar o importador (`import-workbook.ts`) para que a atualização da carteira seja segura. Em vez de um `DELETE` global, usaremos uma estratégia de "marcar como inativo" o que não estiver na planilha e "upsert" no que estiver.
*   **Identificação de memberships**: Garantir que `is_management` seja propagado corretamente do parser para o banco.

## 2. Refinamento da RPC de Métricas (`get_portfolio_metrics`)

*   **Ponto de Corte Estrito**: Ajustar a RPC para considerar `2026-08-01` como a linha divisória entre Inadimplência e Recebível Futuro.
*   **Cálculo de Capital**:
    *   **Capital Investido**: Soma de `initial_capital` + aportes das operações ativas na `portfolio_memberships` de 2026. (Meta: R$ 756.800,00).
    *   **Total Recebido**: Soma de `received_amount` de todas as parcelas dessas operações (independente do ano). (Meta: R$ 312.852,25).
    *   **Capital a Recuperar**: `Capital Investido - Total Recebido`. (Meta: R$ 443.947,75).
    *   **Saldo Inadimplente**: Soma de `(expected - received)` para parcelas com competência < `2026-08-01`. (Meta: R$ 15.068,54).
    *   **ROI Projetado**: Baseado no total contratado vs capital investido.

## 3. Ajustes no Parser e Importador

*   **Parse de Competências**: Garantir que todas as parcelas de todos os anos das operações listadas na Base2026 sejam importadas, permitindo a projeção até 2030+.
*   **Normalização de Referências**: Garantir que "APTO" e "APT" sejam tratados uniformemente para evitar duplicidade ou falha no vínculo com a `investment_references`.

## Detalhes Técnicos

*   **SQL**: Atualização das RPCs `get_portfolio_metrics` e `get_overdue_breakdown`.
*   **TypeScript**: Ajuste em `src/lib/import/import-workbook.ts` para lidar com a inativação seletiva de memberships.
*   **Dashboard**: Garantir que o seletor de ano (YearScopeSelect) dispare corretamente a RPC com o parâmetro `2026` e a data de corte.

## Verificação

1.  **Carga de Dados**: Re-importar a Base2026 oficial.
2.  **Dashboard**: Validar se o total investido chega a R$ 756.800,00 e inadimplência a R$ 15.068,54.
3.  **Homologação**: Verificar se o detalhamento de inadimplência mostra exatamente os registros esperados.
