# Plano de Ajuste dos Cards do Simulador

O usuário relatou que os cards do simulador estão desalinhados e com números "vazando" ou fora do lugar. Analisando o código em `src/routes/_authenticated/simulador.tsx`, identificamos que os cards de KPI utilizam um grid fixo que pode causar sobreposição ou corte de texto em telas menores ou com valores monetários longos.

## Alterações propostas

### Frontend

- **Ajuste de Layout dos KPIs**:
  - Modificar o componente `Kpi` em `src/routes/_authenticated/simulador.tsx` para garantir que o conteúdo não vaze.
  - Aumentar o espaçamento interno (padding) se necessário.
  - Ajustar o tamanho da fonte do valor (de `text-xl` para `text-lg` ou similar se necessário, ou usar `break-words`).
  - Melhorar a responsividade do grid de KPIs para evitar que os cards fiquem muito estreitos.

- **Ajuste de Alinhamento**:
  - Garantir que os rótulos e valores dentro dos cards de KPI estejam bem centralizados ou alinhados consistentemente.
  - Verificar o alinhamento da tabela de cronograma em relação aos cards superiores.

## Detalhes técnicos

- Arquivo afetado: `src/routes/_authenticated/simulador.tsx`.
- Utilizar classes utilitárias do Tailwind CSS para controle de overflow e responsividade (`min-w-0`, `truncate`, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
- Adicionar `p-4` ou `p-5` explícito no `CardContent` dos KPIs para prevenir que o texto encoste nas bordas.
