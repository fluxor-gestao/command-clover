# Plano de Correção Definitiva — Carteira Gerencial 2026

Implementação da infraestrutura de banco de dados necessária para a Carteira Gerencial 2026, garantindo que as 27 operações oficiais sejam a única fonte de dados para o período de 2026, sem fallbacks incorretos.

## Etapas de Implementação

### 1. Infraestrutura de Segurança (Roles)
Como a migration existente falhou por falta da função `has_role`, primeiro estabeleceremos o sistema de permissões exigido:
- Criar o tipo enum `app_role` ('admin', 'moderator', 'user').
- Criar a tabela `public.user_roles` para mapear usuários a papéis.
- Criar a função `public.has_role` com `SECURITY DEFINER` para validar permissões em RLS.
- Garantir permissões de acesso (GRANT) e habilitar RLS.

### 2. Infraestrutura da Carteira Gerencial
Aplicar a lógica da migration `20260814_portfolio_memberships.sql` (corrigida):
- Criar tabela `public.portfolio_memberships` com restrição única `(operation_id, portfolio_year)`.
- Criar view `public.v_portfolio_memberships` para auditoria facilitada.
- Aplicar políticas de RLS vinculadas ao sistema de `has_role`.
- Inserir exatamente as 27 operações oficiais para o ano de 2026 (idempotente).

### 3. Refinamento da Lógica Financeira (RPC)
Atualizar a função `public.get_portfolio_metrics(p_year)`:
- **Escopo Estrito:** Quando um ano é fornecido, a query deve buscar operações EXCLUSIVAMENTE em `portfolio_memberships`.
- **Remoção de Fallback:** Se não houver configuração para o ano, a função deve retornar zero/vazio em vez de incluir todas as operações com parcelas no ano.
- **Isolamento Histórico:** Garantir que a "Carteira Completa" (p_year IS NULL) continue refletindo os 88 registros homologados.

### 4. Auditoria e Validação
- Executar queries SQL para provar a existência da tabela e a contagem de 27 registros.
- Comparar os indicadores gerados pelo sistema com o Controle Oficial (Meta: Diferença < R$ 0,01).
- Validar a composição do Capital Investido (R$ 840.500,00) e Recebido (R$ 441.872,41).

## Detalhes Técnicos
- Utilização de `supabase--migration` para aplicação atômica.
- Manutenção da idempotência via `IF NOT EXISTS` e `ON CONFLICT DO NOTHING`.
- O Dashboard passará a exibir o indicador "27 operações na carteira" quando o filtro 2026 estiver ativo.
