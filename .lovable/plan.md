# Ajuste de inadimplência, edição de status e novos cards do Dashboard

## 1. Inadimplência oficial: somente 3 parcelas (R$ 13.043,54)

Fonte oficial da imagem/aba "Controle Inadimplência":

| Referência / Operação | Competência | Valor | Vencimento |
|---|---|---|---|
| ALTO DO PARQUE - APT. 1105 | abr/26 | 9.000,00 | 25/04/2026 |
| BEACH VILLAGE - APT.1303 - NORTE | jun/26 | 2.153,54 | 25/06/2026 |
| BEACH VILLAGE - APT. 804 - NORTE | jul/26 | 1.890,00 | 15/07/2026 |

Regra a aplicar na base atual:
- Toda parcela com vencimento anterior a 01/08/2026 que **não** estiver nessa lista passa a ser considerada **recebida/paga** (valor recebido igual ao previsto).
- As 3 parcelas da lista ficam em aberto (recebido = 0), resultando em inadimplência total de R$ 13.043,54.
- Parcelas com vencimento a partir de 01/08/2026 não são tocadas (seguem como futuras).

Isso é feito por atualização de dados (não altera regra de cálculo do sistema, que já deriva o status a partir de previsto x recebido).

## 2. Página Parcelas: editar status de cada parcela

Na coluna "Ações" de cada linha, um menu com:
- **Marcar como Paga** — recebido = previsto.
- **Marcar como Em aberto** — recebido = 0 (vira Inadimplente se vencida, A vencer se futura).
- **Marcar como Parcial** — abre um campo para informar o valor recebido.

Após salvar, a tabela, os totais do topo e o Dashboard são atualizados automaticamente. Confirmação por toast, com erro exibido caso a gravação falhe.

## 3. Dashboard: substituir dois cards

Remover **Total a Receber** e **A Receber Futuro**. No lugar:

- **Lucro Real Projetado** = soma de todas as parcelas contratadas (nº de parcelas × valor da parcela de cada operação) − capital investido. Card mostra o total geral da carteira.
- **Valor Total** = Capital Investido + Lucro Real Projetado (ou seja, o total contratado a ser recebido).

Ambos respeitam o filtro de ano/escopo já existente no topo do Dashboard.

## Detalhes técnicos

- Reconciliação da inadimplência: migração de dados via ferramenta de insert/update em `investment_installments`, casando `reference` + `competence` + `expected_amount` para preservar as 3 parcelas e fechar as demais com `due_date < 2026-08-01`. O trigger `set_installment_status` recalcula `status`.
- Edição de status: mutação em `src/routes/_authenticated/parcelas.tsx` usando `supabase.from("investment_installments").update({ received_amount })` + `invalidateQueries(["installments"])` e das chaves de métricas. `financial_status` continua derivado em `v_installments`.
- Cards: em `src/routes/_authenticated/dashboard.tsx`, `lucroProjetado = soma(expected_amount das parcelas no escopo) − invested_capital` e `valorTotal = invested_capital + lucroProjetado`, usando `scopedInstallments` e `metrics.data.invested_capital` já disponíveis.
