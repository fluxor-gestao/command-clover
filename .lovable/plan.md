# Plano de Implementação - Cálculo de Valor Líquido no Simulador

Ajustar a lógica do Simulador Gerencial para que o valor da parcela informado pelo usuário seja convertido em um "Valor Líquido" (90% do valor bruto), sendo este o valor utilizado para todos os cálculos financeiros da página (Lucro, ROI, Payback e Cronograma).

## Alterações Propostas

### 1. Frontend: Ajuste na Interface do Simulador
- **Arquivo**: `src/routes/_authenticated/simulador.tsx`
- **Ação**: 
    - Exibir o campo "Valor Líquido" logo abaixo ou ao lado do "Valor da Parcela" para que o usuário veja o valor real que está sendo considerado para os cálculos.
    - O Valor Líquido será calculado como `0.9 * installmentValue`.
    - Garantir que o componente `Kpi` e a tabela de `Cronograma` reflitam os valores baseados no líquido.

### 2. Lógica de Simulação: Atualização do Motor de Cálculo
- **Arquivo**: `src/lib/finance/contract.ts`
- **Ação**:
    - Alterar a função `simulateContract` para aceitar ou calcular internamente o valor líquido. 
    - Recomenda-se passar o valor líquido derivado da UI para manter a transparência, ou ajustar o motor para aplicar a taxa de 10% se for uma regra fixa de "Taxa de Administração/Operação".

## Detalhes Técnicos

1. No arquivo `src/routes/_authenticated/simulador.tsx`:
    - Adicionar um `const netInstallmentValue = Number(installmentValue) * 0.9;`.
    - Passar `netInstallmentValue` para a função `simulateContract`.
    - Adicionar um indicador visual (ex: texto pequeno ou um novo campo de input desabilitado) mostrando "Valor Líquido: R$ XXX,XX".

2. No arquivo `src/lib/finance/contract.ts`:
    - Validar se a função `simulateContract` deve receber o valor bruto e aplicar o desconto ou se deve receber o valor já líquido. Para evitar confusão no motor de cálculo que pode ser usado em outros lugares, prefiro injetar o valor líquido diretamente da UI.

## Verificação
- Inserir R$ 1.000,00 como valor de parcela.
- O sistema deve calcular automaticamente R$ 900,00 como valor líquido.
- O "Total Contratado", "Lucro Projetado" e as linhas da tabela de parcelas devem utilizar R$ 900,00 como base.
