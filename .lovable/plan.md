# ONDA FINAL DE UX E OPERAÇÃO - NOVA ERA

Este plano detalha a revisão final e evolução funcional de todas as telas do sistema para torná-lo 100% operacional e com experiência premium.

## 1. Dashboard
- **Cards Clicáveis**: Implementar navegação com filtros automáticos ao clicar nos KPIs (ex: clicar em "Capital Investido" leva para Operações, "Inadimplência" leva para Parcelas filtradas).
- **Drill-down em Gráficos**: Adicionar interatividade nos gráficos de Recharts para filtrar tabelas ou navegar para detalhes.
- **Top Inadimplências**: Tornar as linhas da tabela clicáveis para abrir o detalhe da operação.

## 2. Operações
- **Toolbar Completa**: Adicionar botões de Exportar (CSV/Excel) e paginação seletiva.
- **Persistência de Estado**: Usar `search params` ou `sessionStorage` para manter filtros ativos ao navegar e voltar.
- **Menu de Ações (⋮)**: Refinar o DropdownMenu com todas as ações solicitadas (Ver, Editar, Receber, Aportar, Parcelas, Cancelar).

## 3. Referências (Cadastro Mestre)
- **Normalização de Dados**: Implementar lógica de `trim`, `case-insensitive` e remoção de acentos para evitar duplicatas durante a criação.
- **Métricas de Vínculo**: Adicionar coluna de "Qtd. Operações" na listagem.
- **Gestão de Ciclo de Vida**: Habilitar botões de Editar, Desativar e Excluir (com validação de dependência).

## 4. Parcelas & Vencimentos
- **KPIs de Topo**: Adicionar cards resumindo Abertas, A Vencer, Vencidas e Recebidas.
- **Filtros Temporais Rápidos**: Adicionar tabs ou botões para "Hoje", "Este Mês", "Próximos 30 dias".
- **Ações Contextuais**: Menu de ações por linha (Receber, Editar, Ver Operação, Histórico).

## 5. Recebimentos
- **Fluxo de Seleção Inteligente**: Implementar agrupamento visual por Atrasadas, Atuais e Futuras.
- **Pagamento Múltiplo e Parcial**: Melhorar a UI de distribuição de valores.
- **Revisão Pré-Confirmar**: Mostrar o "Antes vs Depois" dos saldos das parcelas antes de salvar.

## 6. Aportes
- **Resumo Financeiro**: Adicionar KPIs no topo sobre total aportado no ano.
- **Simulador de Aporte**: Mostrar o impacto no capital da operação (Antes, Aporte, Depois) no formulário.

## 7. Importação
- **Histórico Detalhado**: Criar uma tabela de logs de importações passadas com link para ver o relatório detalhado de cada carga.
- **Exportação de Log**: Gerar arquivo de texto ou CSV com os erros/alertas de cada importação.

## 8. Qualidade da Base
- **Filtros de Gravidade**: Refinar a toolbar de filtros (Todos, Crítico, Atenção, Informativo, Resolvido).
- **Busca Global**: Facilitar localização de problemas por referência ou aba do Excel.

## 9. Relatórios
- **Arquitetura de Tabs**: Separar Fluxo Mensal, Carteira, Inadimplência, Recebimentos e Aportes.
- **Filtros Globais**: Datas e Categorias que afetam todas as abas.

## 10. Login
- **Refinamento Visual**: Ajustar card central, tipografia premium (tracking expandido nos labels) e garantir o monograma/logo Nova Era.

---

### Detalhes Técnicos
- **Estado Global**: Utilizar `TanStack Router Search Params` para persistência de filtros em URLs (favoritando links, etc).
- **Backend**: Atualizar RLS se necessário para novas ações de edição/exclusão.
- **UI**: Manter consistência com a paleta `oklch` (Deep Navy / Off-white).
