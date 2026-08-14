# Refinamento do Sistema de Gestão de Investimentos - Nova Era

Este plano detalha a "Onda Final de Refinamento", focando em estruturar referências, melhorar a interatividade e reduzir o esforço do usuário através de cadastros mestres e componentes de seleção inteligentes.

## Alterações de Banco de Dados (Supabase)

1.  **Criar Tabela `investment_references`**:
    - Campos: `id`, `name`, `category_id` (FK), `description`, `active`, `source`, `created_at`, `updated_at`, `archived_at`.
    - Habilitar RLS e conceder permissões.
2.  **Modificar `investment_operations`**:
    - Adicionar `reference_id` (FK para `investment_references`).
3.  **Migração de Dados**:
    - Script para extrair referências únicas de `investment_operations` e popular `investment_references`.
    - Vincular `operation.reference_id` baseado no nome da referência.
4.  **Atualizar Views Financeiras**:
    - `v_operation_position`, `v_monthly_flow` e `v_portfolio_summary` devem agora considerar a nova estrutura de referências para nomes e agrupamentos.

## Componentes e Hooks

1.  **Combobox de Referência**:
    - Componente reutilizável com busca assíncrona.
    - Opção integrada para "+ Cadastrar Nova Referência" que abre um modal sem sair do fluxo.
2.  **Resumo Dinâmico da Operação**:
    - Bloco visual em tempo real no formulário de Nova Operação calculando Total Previsto, Datas Limites e Resultado Projetado conforme o usuário digita.
3.  **Lógica de Edição Segura**:
    - Mecanismo para detectar se uma alteração contratual afeta parcelas já recebidas.
    - Alerta e opção de aplicar apenas a parcelas futuras.

## Novas Telas e Ajustes de UI

1.  **Página de Referências**:
    - Lista mestre sob "Operações > Referências" ou menu lateral.
    - Gestão de status (Ativo/Inativo) e visualização de capital total por referência.
2.  **Tabela de Operações**:
    - Referências clicáveis para abrir detalhes.
    - Menu de ações (⋮) em cada linha para acesso rápido (Recebimento, Aporte, Edição).
3.  **Formulário de Operação**:
    - Substituir input de texto por Combobox.
    - Autofill da categoria baseado na referência selecionada.

## Rastreabilidade e Segurança

1.  **Audit Log**:
    - Garantir que edições em operações e referências sejam registradas com `old_data` e `new_data`.
2.  **Soft Delete**:
    - Implementar `archived_at` em referências e `cancelled_at` em operações com histórico financeiro.
