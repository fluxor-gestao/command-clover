# Plano de Ajuste dos Cards do Simulador

O usuário relatou que os números nos cards do simulador estão "quebrando" (começam em cima e terminam embaixo) e solicitou um design mais minimalista e ajustado.

## Mudanças propostas

### Frontend

- **Ajuste do Componente KPI em `src/routes/_authenticated/simulador.tsx`**:
    - Alterar a estrutura de empilhamento vertical (`flex-col`) para permitir que o valor se ajuste melhor ao espaço disponível.
    - Reduzir o tamanho da fonte do valor (`text-lg`) para evitar quebras em telas pequenas.
    - Remover `break-words` que força a quebra do número no meio, usando `whitespace-nowrap` ou `shrink-0` para manter a integridade do valor monetário.
    - Ajustar o padding e a altura mínima para um visual mais "limpo" e minimalista.
    - Usar um layout que aproveite melhor a largura em dispositivos móveis.

## Detalhes técnicos

- **CSS/Tailwind**:
    - Substituir `break-words` por `truncate` ou garantir que o contêiner tenha `overflow-hidden`.
    - Ajustar os breakpoints de grid para evitar que os cards fiquem muito estreitos em resoluções intermediárias.
    - Aumentar levemente o contraste do label para melhorar a legibilidade em tamanhos reduzidos.

