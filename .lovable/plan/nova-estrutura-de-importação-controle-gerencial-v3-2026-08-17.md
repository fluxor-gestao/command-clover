# Nova estrutura de importação — Controle Gerencial v3

## O que o arquivo novo traz (análise aba a aba)

| Aba | Conteúdo | Destino no sistema |
| --- | --- | --- |
| Orientações / Calculadora / Painel / Fluxo / Projeção / Aux | Instruções e resultados calculados pelo próprio Excel | Não importar. Só usar Painel/Fluxo/Projeção como **conferência** (homologação Excel × Sistema) |
| **Operações** | Uma linha por operação: Referência, Categoria, Dia Venc., Capital Inicial, 1º Vencimento, Nº Parcelas, Valor Parcela, Aportes Adicionais, Data Final, Situação, Observações | `investment_operations` + `portfolio_memberships` (carteira 2026) — **fonte oficial do contrato** |
| **Recebimentos** | Uma linha por baixa: Referência, Competência, Valor Recebido, Data Recebimento, Observação | `investment_receipts` + alocação na parcela da competência |
| **Aportes** | Referência, Data, Tipo, Valor, Observação (hoje vazia) | `investment_contributions` |
| **Base2026** | Grade mensal Jan–Dez por referência (valores já recebidos/lançados) | Apenas **conferência** e complemento de recebimentos que não estejam na aba Recebimentos |
| **Alugueis** | Imóveis próprios com grade mensal e Ano referência | `rental_properties` + `rental_receipts` (fora da carteira de investimentos) |

Dois pontos importantes que a estrutura atual não atende:
- O leitor atual espera a referência na **coluna B** e detecta parcelas por **célula vermelha** na grade mensal. No arquivo novo a Base2026 tem a referência na **coluna A** e não há mais dependência de cor: as abas Operações/Recebimentos já separam contrato e baixa.
- Hoje as parcelas são criadas a partir das células mensais. No arquivo novo elas devem **nascer do contrato** (1º Vencimento + Nº Parcelas + Valor Parcela, limitado pela Data Final).

## Como as parcelas passam a ser geradas (o ponto que você levantou)

Para cada linha de Operações:

```text
1º Vencimento = 2026-02-25 | Nº Parcelas = 13 | Valor Parcela = 2.515,25 | Data Final = 2027-02-28

parcela 1  -> venc. 2026-02-25  previsto 2.515,25
parcela 2  -> venc. 2026-03-25  previsto 2.515,25
...
parcela 13 -> venc. 2027-02-25  previsto 2.515,25
```

- Cronograma completo, inclusive futuro (projeção do que poderá ser dado baixa).
- Dia do vencimento vem de "Dia Venc." (com ajuste para meses curtos); nunca ultrapassa a Data Final.
- Status de cada parcela é derivado, não importado:
  - recebido total/parcial = soma das baixas da aba Recebimentos naquela competência;
  - **A_RECEBER** se o vencimento é futuro;
  - **INADIMPLENTE** se venceu (competência anterior ao corte de agosto/2026) e não tem baixa suficiente.
- Parcelas anteriores a 2026-01 continuam descartadas, conforme regra já vigente.

## Reimportação sem duplicar (mesmo arquivo com dados a mais)

Cada registro ganha uma chave estável e um hash de conteúdo:

| Entidade | Chave estável (`source_key`) |
| --- | --- |
| Operação | `op:<referência normalizada>` |
| Parcela | `inst:<referência>:<AAAA-MM>` |
| Recebimento | `rec:<referência>:<AAAA-MM>:<seq>` |
| Aporte | `ap:<referência>:<data>:<seq>` |
| Imóvel | `rental:<referência>` |
| Aluguel recebido | `rentrec:<referência>:<AAAA-MM>` |

Regras de sincronização:
- Linha inédita -> insere.
- Linha igual (hash idêntico) -> ignora, sem escrita.
- Linha alterada no Excel -> atualiza.
- Linha alterada manualmente no sistema após o último sync -> marca **CONFLITO** e só grava com sua confirmação explícita na tela de Importação (comportamento já existente).
- Parcelas: recalculadas a partir do contrato; as que deixam de existir (contrato encurtado) são removidas apenas se **não** tiverem baixa vinculada.
- Baixas manuais feitas dentro do sistema nunca são apagadas pela reimportação.

## Tela de Importação

- Detecção automática do layout v3 (presença das abas Operações/Recebimentos/Aportes) com fallback para o layout antigo.
- Prévia por aba: quantas linhas novas, alteradas, inalteradas e em conflito antes de confirmar.
- Homologação comparando os totais lidos com o Painel do Excel (Capital Investido 756.800, Total Recebido 312.852,25, Saldo Inadimplente 15.068,54, 19 operações ativas).

## Detalhes técnicos

- `src/lib/import/parse-workbook.ts`: novos leitores `parseOperationsSheet`, `parseReceiptsSheet`, `parseContributionsSheet`, `parseBase2026Sheet` (conferência) e reescrita de `parseRentalsSheet` para o layout largo com colunas mensais; cabeçalhos localizados por nome, não por índice fixo.
- Geração do cronograma reutiliza `src/lib/finance/contract.ts` (`addMonthsClamped`).
- `src/lib/import/import-workbook.ts`: gravação por entidade com `upsert` em `source_key`, hash por linha, e a proteção atômica de `portfolio_memberships` já implementada.
- Sem mudança de schema: as tabelas atuais (`investment_operations`, `investment_installments`, `investment_receipts`, `investment_receipt_allocations`, `investment_contributions`, `rental_properties`, `rental_receipts`, `portfolio_memberships`) cobrem todo o arquivo.

## Verificação

1. Importar o arquivo: conferir 19 operações ativas e os totais do Painel na tela de homologação.
2. Abrir Parcelas & Vencimentos: cronograma completo por operação, incluindo meses futuros, e inadimplência de 15.068,54.
3. Importar o mesmo arquivo novamente: nenhuma duplicação, tudo "inalterado".
4. Adicionar uma linha nova em Recebimentos e reimportar: apenas essa baixa entra.
