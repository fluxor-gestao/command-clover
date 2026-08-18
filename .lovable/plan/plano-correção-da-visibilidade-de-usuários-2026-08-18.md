# Plano: Correção da Visibilidade de Usuários

O usuário `adm@novaeraimoveis.com.br` foi criado com sucesso no banco de dados e possui o papel de `admin`, mas não está aparecendo na lista de usuários da interface. Isso provavelmente ocorre devido ao cache do TanStack Query ou a uma falha na atualização automática da lista após a criação.

## Problema Identificado
1. O usuário existe no banco (`auth.users` e `public.user_roles`).
2. A tentativa de recriar falha (corretamente) pois o e-mail já está em uso.
3. A lista na interface pode estar exibindo dados desatualizados ou "cacheados".

## Solução Proposta
Vou forçar a invalidação completa do cache de usuários e adicionar um tratamento mais robusto na página de usuários para garantir que a lista seja recarregada corretamente.

## Detalhes Técnicos
- **Invalidação de Cache**: Garantir que o `queryClient.invalidateQueries` seja chamado corretamente após a criação bem-sucedida.
- **RPC Update**: Verificarei se a RPC `list_users_with_roles` está retornando todos os registros sem filtros indevidos.
- **Interface**: Adicionar um log temporário ou verificar a lógica de renderização em `src/routes/_authenticated/usuarios.tsx`.

## Passos de Execução
1. Modificar `src/routes/_authenticated/usuarios.tsx` para garantir que o `refetch` seja agressivo após a criação.
2. Limpar qualquer estado de cache residual que possa estar impedindo a visualização do novo registro.
3. Validar se a RPC `list_users_with_roles` no banco de dados (PostgreSQL) está funcionando como esperado para o usuário autenticado.
