# Onda Visual Premium — Nova Era

Elevar a experiência visual para o nível de um SaaS financeiro premium, focando em clareza, hierarquia, sofisticação e microinterações.

## Identidade Visual
- **Paleta**: Navy muito escuro (BG/Sidebar), Off-white (Área de conteúdo), tons neutros, verde financeiro, vermelho alerta e âmbar atenção.
- **Estilo**: Sem excessos, gradientes chamativos ou neon. Sombras leves e foco em tipografia.

## Etapas de Implementação

### 1. Fundação & Layout (AppShell & Sidebar)
- **Sidebar**:
  - Implementar colapsibilidade (desktop).
  - Nova hierarquia: "NOVA ERA" (topo) e "Gestão de Investimentos" (logo abaixo).
  - Itens agrupados por categoria (Operacional vs. Gestão/Importação) com separador.
  - Hovers refinados, ícones minimalistas e tooltips para estado colapsado.
- **Header**:
  - Header discreto com Breadcrumb (esquerda).
  - Busca global ("Buscar operação ou referência...") e Avatar/Menu (direita).

### 2. Dashboard Executivo
- **Cards de KPI**:
  - Peso visual maior nos 4 principais (Investido, Recebido, A Recuperar, Total a Receber).
  - Ícones em pequenos containers, labels claras e microtexto informativo (ex: "% do capital").
  - Inadimplência com destaque vermelho suave (não fundo sólido).
- **Recuperação de Capital**:
  - Progress bar moderna e alta, com valores "X de Y recuperados" em destaque.
- **Gráficos (Recharts)**:
  - Refinar tooltips, legendas, grid e labels.
  - Segmented control para período no fluxo mensal (12m, 24m, 36m, 60m).
  - Drill-down simples ao clicar nas competências.

### 3. Carteira de Investimentos (Tabelas & Operações)
- **Tabelas**:
  - Whitespace generoso, cabeçalhos discretos, alinhamento monetário à direita.
  - Badges de status consistentes e coluna de ações (⋮).
- **Tela de Operações**:
  - Toolbar única para filtros com chips de busca ativa.
  - Primeira coluna sticky para facilitar visualização em scroll horizontal.

### 4. Experiência de Detalhe e Fluxos Operacionais
- **Detalhe da Operação**:
  - Header com status e ações rápidas.
  - Organização por Tabs (Visão Geral, Parcelas, Recebimentos, Aportes, Histórico).
  - Timeline contratual visual (Início -> 1º Vencimento -> Fim).
- **Recebimentos & Aportes**:
  - Layout focado em produtividade (Formulário lateral ou Drawer + Histórico em tabela).
  - Empty states premium informativos.
- **Importação & Qualidade**:
  - Área drag-and-drop para upload.
  - Substituição de termos técnicos por labels amigáveis com tooltips explicativos.

## Detalhes Técnicos
- Utilizar `SidebarProvider` e componentes `Sidebar` do Shadcn para colapsibilidade.
- Aplicar oklch para cores exatas do design system.
- Refinar `src/components/ui/table.tsx` e `src/components/ui/card.tsx` para o estilo premium.
