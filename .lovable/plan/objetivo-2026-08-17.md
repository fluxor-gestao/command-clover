---
title: Zeramento Total da Carteira Gerencial 2026
description: Implementação de funcionalidade para remover todos os dados (operações, parcelas, recebimentos e aluguéis) associados à Carteira 2026, permitindo uma nova importação limpa.
---

## Objetivo
Atender à solicitação do usuário de "zerar tudo" (Operações, Parcelas, Vencimentos, Recebimentos e Aluguéis) atrelados à Carteira 2026, garantindo que o sistema reflita valores zerados antes de uma nova importação.

## Alterações

### Banco de Dados (Supabase)
1. **Atualizar RPC `clear_portfolio_data`**:
    - Ajustar a lógica para remover também os dados de aluguéis (`rental_receipts` e opcionalmente `rental_properties` se forem exclusivos da carga). 
    - *Nota*: Como `rental_properties` não possuem um `portfolio_year` direto no esquema atual, adicionaremos uma lógica para limpar a tabela de recebimentos de aluguéis e, se solicitado implicitamente pelo "zerar tudo", os imóveis.
    - Garantir que a remoção de `investment_operations` limpe em cascata (ou manualmente) as referências se elas ficarem órfãs e forem marcadas como originadas de importação.

### Frontend
1. **Componente de Importação (`src/routes/_authenticated/importacao.tsx`)**:
    - Manter o botão "Limpar Carteira 2026".
    - Adicionar um segundo nível de confirmação ou um checkbox "Incluir Aluguéis e Imóveis Próprios" para garantir que o usuário entenda a extensão do zeramento.
    - Invalidação global de cache após a execução para atualizar Dashboard e telas de listagem.

## Detalhes Técnicos
- A migração SQL usará `TRUNCATE` ou `DELETE` dependendo da volumetria, mas manterá a segurança via RLS.
- O botão de limpeza será movido para uma área de "Configurações de Base" ou mantido em Destaque na Importação conforme preferência visual do usuário por "fácil acesso".

## Verificação
1. Executar a limpeza e verificar se o Dashboard exibe R$ 0,00 em todas as métricas de 2026.
2. Verificar se a tela de Operações e Aluguéis está vazia.
3. Validar se uma nova importação da Base2026 reconstrói os dados corretamente.
