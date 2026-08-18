# Alinhamento da Homologação de Leitura com o Excel oficial

Os quatro indicadores divergentes (Valor Previsto, Saldo Inadimplente, Total a Receber e Parcelas) têm causa identificada: o sistema e a planilha usam **definições diferentes** para os mesmos nomes, e o leitor cria parcelas que o contrato não prevê.

## Diagnóstico confirmado na planilha enviada

| Indicador | Excel (regra real) | Sistema hoje | Efeito |
| --- | --- | --- | --- |
| Valor Previsto | Soma do Valor Parcela dos contratos **ativos em cada mês** (1º Vencimento ≤ fim do mês e Data Final ≥ mês) = 1.071.851,18 | Cronograma por Nº de Parcelas (1.065.151,18) + 42 parcelas extras (81.740,02) | Divergente |
| Parcelas | 407 competências contratuais | 449 (as 42 extras) | Divergente |
| Saldo Inadimplente | Aba **Inadimplência** (lista manual, hoje vazia); o 15.068,54 do Painel vem de referências soltas para a Base2026 | Saldo aberto antes de ago/26 = 80.693,35; e o rótulo lido ("SALDO INADIMPLENTE") não existe no Painel ("INADIMPLÊNCIA") | Divergente |
| Total a Receber | "A Receber Futuro" da Projeção (≥ ago/26) = 755.480,53 | Saldo contratual aberto de todas as competências = 835.725,85 | Divergente |

As 42 parcelas extras nascem de recebimentos em competências fora do contrato — por exemplo BEACH VILLAGE 1507 (baixas jan–mai, 1º vencimento jun/26) e FAVORITO 406 (baixas jan–ago, 1º vencimento mar/27).

## O que será ajustado

### 1. Previsto pela regra do Excel
- O cronograma passa a ser gerado por **janela contratual**: uma competência para cada mês entre o 1º Vencimento e a Data Final, com o Valor Parcela do contrato (o Nº de Parcelas deixa de cortar o cronograma antes da Data Final).
- Competências anteriores a 2026-01 continuam fora, como já é a regra vigente.
- `Valor Previsto` e `Parcelas` da homologação passam a comparar exatamente a mesma base dos dois lados.

### 2. Recebimento fora do cronograma = baixa antecipada
- O recebimento continua sendo importado integralmente (nada de dinheiro perdido), mas **não cria mais parcela nova** e não infla Previsto nem contagem de parcelas.
- A baixa é alocada na primeira competência contratual em aberto da operação; se não houver, fica registrada como crédito antecipado da operação.
- Cada caso gera um apontamento informativo em Qualidade da base, com referência e competência, para conferência.

### 3. Inadimplência pela aba Inadimplência
- A aba **Inadimplência** passa a ser a fonte oficial: Referência, Competência, Valor, Data Vencimento, Observação.
- O sistema deixa de inferir inadimplência por saldo aberto antes de ago/26; passa a marcar como inadimplente apenas o que estiver listado nessa aba.
- Como a aba está vazia hoje, o indicador ficará **R$ 0,00 dos dois lados (OK)** até você preencher a lista — inclusive os 15.068,54, que hoje não existem como regra viva na planilha.
- Um aviso na tela de importação explica isso, para não parecer perda de dado.

### 4. Total a Receber comparável
- `Total a Receber` na homologação passa a significar **A Receber Futuro** (saldo aberto de competências ≥ 01/08/2026), igual à coluna F da Projeção.
- O lado Excel deixa de usar "Capital a Receber" do Painel; um indicador separado, **Capital a Recuperar** (Capital Investido − Total Recebido = 443.947,75), passa a mostrar esse conceito.
- A leitura do Painel passa a casar os rótulos reais da planilha ("INADIMPLÊNCIA", "CAPITAL A RECEBER", "VALOR TOTAL"), sem depender de nomes que não existem.

## Detalhes técnicos

- `src/lib/import/parse-workbook.ts`: `generateSchedule` passa a iterar por janela contratual; `parseReceiptsSheet` deixa de fazer `upsertInstallment` para competências fora do cronograma e passa a alocar/apontar; novo `parseDelinquencySheet` para a aba Inadimplência; `parsePanelBaseline` com rótulos corrigidos; `ParseBaseline` ganha `futureReceivableTotal` e `capitalToRecoverTotal`.
- `src/routes/_authenticated/importacao.tsx`: tabela de homologação com os indicadores pareados corretamente (inclui "Capital a Recuperar" e "A Receber Futuro") e nota sobre a aba Inadimplência.
- `src/lib/homolog/compare.ts` e `src/lib/import/import-workbook.ts`: mesma regra de inadimplência (lista) e de previsto contratual, para Dashboard e Homologação Financeira não se contradizerem.
- Sem mudança de schema.

## Verificação

1. Reprocessar o arquivo sem importar: Operações 19, Capital 756.800,00, Recebido 312.852,25, Previsto 1.071.851,18, A Receber Futuro 755.480,53, Inadimplência 0,00 — todos OK.
2. Parcelas iguais dos dois lados, sem as 42 extras, e as baixas antecipadas listadas em Qualidade da base.
3. Preencher duas linhas na aba Inadimplência e reprocessar: o indicador acompanha exatamente a soma informada.
4. Reimportar o mesmo arquivo: nenhuma duplicação.
