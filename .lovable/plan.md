---
name: Captura de Telas do Sistema
description: Gerar um arquivo consolidado com capturas de tela (prints) de todas as páginas do sistema para documentação.
type: feature
---

O usuário solicitou um arquivo contendo o print de cada tela do sistema. Vou criar um processo automatizado para capturar essas telas e gerar um documento consolidado.

## Etapas

1. **Preparação da Sessão**: Utilizar a sessão de usuário já autenticada para garantir acesso às rotas protegidas.
2. **Script de Captura**: Criar um script Playwright em Python para:
    - Autenticar no sistema injetando o token na LocalStorage.
    - Navegar por cada uma das rotas:
        - Login (`/auth`)
        - Dashboard (`/dashboard`)
        - Operações (`/operacoes`)
        - Detalhe de Operação (`/operacoes/[id]`)
        - Referências (`/referencias`)
        - Recebimentos (`/recebimentos`)
        - Aportes (`/aportes`)
        - Importação (`/importacao`)
        - Qualidade da Base (`/qualidade`)
        - Relatórios (`/relatorios`)
        - Parcelas (`/parcelas`)
    - Aguardar o carregamento dos dados em cada página.
    - Salvar os prints em `/mnt/documents/screenshots/`.
3. **Consolidação**: Criar um arquivo Markdown (`/mnt/documents/portfolio_sistema_nova_era.md`) que exibe todas as imagens capturadas com suas respectivas descrições.

## Detalhes Técnicos

- **Autenticação**: O script usará o arquivo de sessão `~/.cache/lovable-auth/session.json`.
- **Estabilidade**: O script incluirá esperas (`wait_for_selector` ou `wait_for_load_state`) para garantir que os gráficos e tabelas estejam renderizados antes do print.
- **Saída**: As imagens serão salvas em formato PNG e referenciadas no Markdown final.

## Verificação

- Confirmar que todas as páginas foram capturadas sem erros de "Não Autorizado".
- Validar se o arquivo Markdown final abre corretamente com os links das imagens.
