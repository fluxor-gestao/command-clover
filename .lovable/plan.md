# Alerta de Viabilidade no Simulador Gerencial

Adição de um indicador visual de viabilidade no Simulador Gerencial com base no ROI médio mensal, utilizando um design moderno e minimalista alinhado à identidade visual do projeto.

## Mudanças

### Frontend

- **src/routes/_authenticated/simulador.tsx**:
    - Adição de um componente de alerta de viabilidade posicionado estrategicamente (abaixo dos KPIs ou dentro do card de Parâmetros).
    - Lógica de exibição:
        - ROI Médio Mensal >= 3,5%: "Negócio favorável!" (Indicador Verde/Sucesso).
        - ROI Médio Mensal < 3,5%: "Analisar viabilidade!" (Indicador Vermelho/Aviso).
    - Design: Utilizar variantes de `Alert` do Shadcn ou um container personalizado com animação suave e ícones (CheckCircle para sucesso, AlertCircle para aviso).

## Detalhes Técnicos

- A verificação será feita em tempo real utilizando o valor `result.roiMonthlyAverage` já calculado no `useMemo`.
- As cores utilizarão os tokens semânticos `--success` e `--destructive` registrados no tema.
- Layout responsivo garantindo leitura clara em dispositivos móveis.
