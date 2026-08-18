# Correção: botão de recebimento invisível e Operações sem dados

## 1. Botão "Registrar Recebimento" em branco

Causa confirmada: a cor verde (`--success`) existe nas variáveis do tema, mas nunca foi registrada como cor do Tailwind. Assim, `bg-success` não gera nenhum fundo e o texto branco fica sobre fundo branco — o botão parece vazio. O mesmo afeta todos os outros elementos verdes do sistema (badges, valores de recebimento, faixas "Vencendo hoje").

Correção:
- Registrar `--color-success` e `--color-success-foreground` no bloco `@theme inline` de `src/styles.css` (e adicionar a variável de contraste `--success-foreground` no tema claro e escuro).
- Ajustar o botão em `src/routes/_authenticated/recebimentos.tsx` para usar `text-success-foreground` em vez de `text-white`, garantindo contraste nos dois temas.

Resultado: botão verde legível com o texto "Registrar Recebimento" e o restante dos indicadores verdes voltando a aparecer.

## 2. Aba Operações sem nenhum dado

Causa confirmada por consulta ao banco: existem 19 operações ativas (`investment_operations`), mas todas com `reference_id` nulo. A view que alimenta a tela (`v_operation_position`) usa `JOIN investment_references`, ou seja, um vínculo obrigatório com a tabela de referências — que foi zerada na limpeza global. Sem vínculo, a view retorna 0 linhas e a página fica vazia, embora o Dashboard funcione (ele lê a tabela direta).

Correção em duas frentes:

a) Tornar a leitura resiliente (migração):
- Recriar `v_operation_position` com `LEFT JOIN investment_references` e `COALESCE(r.name, o.reference)` como referência exibida, além de expor `installment_count` e `installment_value` para a tela.
- Assim, operações importadas aparecem mesmo sem cadastro de referência.

b) Reestabelecer as referências a partir da planilha (aba "Operações"):
- No motor de importação (`src/lib/import/import-workbook.ts`), ao processar cada linha da aba Operações, fazer upsert em `investment_references` pelo nome do imóvel/ativo e gravar o `reference_id` na operação.
- Backfill único dos 19 registros atuais: criar as referências faltantes a partir do texto de `investment_operations.reference` e preencher `reference_id`, sem alterar valores financeiros.

## Verificação
- Consultar `v_operation_position` e confirmar 19 linhas com referência, capital, nº de parcelas e valor da parcela.
- Abrir Operações e conferir a lista preenchida, com os filtros de situação/categoria funcionando.
- Abrir Recebimentos, alocar um valor e confirmar que o botão verde aparece com texto legível.
