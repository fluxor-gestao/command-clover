# Refinamento do Sistema de Gestão de Investimentos - Nova Era

Este plano detalha a "Onda Final de Refinamento", focando em estruturar referências, melhorar a interatividade e reduzir o esforço do usuário através de cadastros mestres e componentes de seleção inteligentes.

## 1. Estrutura de Referências (Database)

A ideia é separar a **Referência** (o ativo/imóvel/pessoa) da **Operação** (o contrato financeiro).

### Novas Tabelas e Alterações
- **Criar `investment_references`**: 
  - `id`, `name` (unique), `category_id`, `description`, `active` (default true), `created_at`, `updated_at`, `archived_at`.
- **Alterar `investment_operations`**:
  - Adicionar `reference_id` (FK para `investment_references`).
- **Migração**:
  - Script para extrair referências únicas de `investment_operations` atual e popular `investment_references`.
  - Atualizar `reference_id` em todas as operações existentes.
  - Manter o campo `reference` (text) em `investment_operations` por compatibilidade ou remover após garantir que as views usam o join. *Decisão: Manter temporariamente e atualizar views.*

## 2. Interface de Referências

- **Nova Tela**: `src/routes/_authenticated/referencias.tsx`.
  - Listagem com filtros de Categoria e Status.
  - Visualização resumida: Capital Total Investido e Recebido por referência (drill-down para operações).
- **Combobox Inteligente**:
  - Componente de seleção de referência com busca.
  - Botão "+ Cadastrar Nova Referência" integrado no dropdown.
  - Modal rápido de cadastro sem sair do fluxo de "Nova Operação".

## 3. Refinamento de Fluxos (UX)

### Nova Operação
- **Resumo Dinâmico**: Ao preencher valor da parcela e quantidade, mostrar imediatamente o ROI projetado e a data do último vencimento.
- **Autofill**: Ao selecionar uma Referência já cadastrada, preencher a Categoria automaticamente.

### Edição de Operações
- **Edição Segura**: Se o usuário tentar alterar valor/quantidade de parcelas em uma operação com recebimentos, exibir um aviso.
- **Histórico**: Registro automático no `investment_audit_log` para qualquer alteração contratual.

### Tabela de Operações
- Adição de menu de ações rápido (⋮).
- Referência clicável levando para o detalhe da operação.
- Melhoria na visualização de "Retorno" (exibindo lucro/prejuízo projetado).

## Detalhes Técnicos
- **RLS**: Garantir que a nova tabela `investment_references` tenha políticas de acesso corretas.
- **Views**: Atualizar `v_operation_position` e `v_monthly_flow` para usar `investment_references.name`.
- **Idempotência**: Manter a lógica de importação compatível com o novo ID de referência.

