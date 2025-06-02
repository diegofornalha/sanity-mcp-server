# Sanity MCP Server <!-- omit in toc -->

> Transforme suas operações de conteúdo com ferramentas alimentadas por IA para o Sanity. Crie, gerencie e explore seu conteúdo através de conversas em linguagem natural no seu editor habilitado para IA favorito.

O Sanity MCP Server implementa o [Model Context Protocol](https://modelcontextprotocol.ai) para conectar seus projetos Sanity com ferramentas de IA como Claude, Cursor e VS Code. Ele permite que modelos de IA entendam a estrutura do seu conteúdo e realizem operações através de instruções em linguagem natural.

## ✨ Principais Recursos <!-- omit in toc -->

- 🤖 **Inteligência de Conteúdo**: Deixe a IA explorar e entender sua biblioteca de conteúdo
- 🔄 **Operações de Conteúdo**: Automatize tarefas através de instruções em linguagem natural
- 📊 **Consciente do Schema**: A IA respeita a estrutura do seu conteúdo e as regras de validação
- 🚀 **Gerenciamento de Releases**: Planeje e organize releases de conteúdo sem esforço
- 🔍 **Busca Semântica**: Encontre conteúdo com base no significado, não apenas em palavras-chave

## Sumário <!-- omit in toc -->

- [🔌 Guia Rápido](#-guia-rápido)
  - [Pré-requisitos](#pré-requisitos)
  - [Adicionar configuração para o servidor Sanity MCP](#adicionar-configuração-para-o-servidor-sanity-mcp)
- [🛠️ Ferramentas Disponíveis](#️-ferramentas-disponíveis)
- [⚙️ Configuração](#️-configuração)
  - [🔑 Tokens de API e Permissões](#-tokens-de-api-e-permissões)
  - [👥 Papéis de Usuário](#-papéis-de-usuário)
- [📦 Configuração do Ambiente Node.js](#-configuração-do-ambiente-nodejs)
  - [🛠 Configuração Rápida para Usuários do Node Version Manager](#-configuração-rápida-para-usuários-do-node-version-manager)
  - [🤔 Por Que Isso é Necessário?](#-por-que-isso-é-necessário)
  - [🔍 Solução de Problemas](#-solução-de-problemas)
- [💻 Desenvolvimento](#-desenvolvimento)
  - [Depuração](#depuração)

## 🔌 Guia Rápido

### Pré-requisitos

Antes de poder usar o servidor MCP, você precisa:

1. **Implantar seu Sanity Studio com o manifesto do schema**

   O servidor MCP precisa de acesso à estrutura do seu conteúdo para funcionar efetivamente. Implante o manifesto do seu schema usando uma destas abordagens:

   ```bash
   # Opção A: Se você tem o CLI instalado globalmente
   npm install -g sanity
   cd /path/to/studio
   sanity schema deploy

   # Opção B: Atualize seu Studio
   cd /path/to/studio
   npm update sanity
   npx sanity schema deploy
   ```

   Ao executar em ambientes de CI sem login do Sanity, você precisará fornecer um token de autenticação:

   ```bash
   SANITY_AUTH_TOKEN=<token> sanity schema deploy
   ```

   > [!NOTE]
   > A implantação do schema requer a versão 3.88.1 ou mais recente do Sanity CLI.

2. **Obter suas credenciais de API**
   - ID do Projeto
   - Nome do Dataset
   - Token de API com permissões apropriadas

Este servidor MCP pode ser usado com qualquer aplicação que suporte o Model Context Protocol. Aqui estão alguns exemplos populares:

- [Claude Desktop](https://modelcontextprotocol.io/quickstart/user)
- [Cursor IDE](https://docs.cursor.com/context/model-context-protocol)
- [Visual Studio Code](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
- Aplicações personalizadas compatíveis com MCP

### Adicionar configuração para o servidor Sanity MCP

Para usar o servidor Sanity MCP, adicione a seguinte configuração às configurações MCP da sua aplicação:

```json
{
  "mcpServers": {
    "sanity": {
      "command": "npx",
      "args": ["-y", "@sanity/mcp-server@latest"],
      "env": {
        "SANITY_PROJECT_ID": "your-project-id",
        "SANITY_DATASET": "production",
        "SANITY_API_TOKEN": "your-sanity-api-token",
        "MCP_USER_ROLE": "developer"
      }
    }
  }
}
```

Para uma lista completa de todas as variáveis de ambiente obrigatórias e opcionais, consulte a [seção Configuração](#️-configuração).

A localização exata desta configuração dependerá da sua aplicação:

| Aplicação    | Localização da Configuração                       |
| -------------- | ------------------------------------------------- |
| Claude Desktop | Arquivo de configuração do Claude Desktop         |
| Cursor         | Configurações do Workspace ou globais             |
| VS Code        | Configurações do Workspace ou do usuário (depende da extensão) |
| Apps Personalizadas | Consulte a documentação de integração MCP do seu app |

Não conseguiu fazer funcionar? Consulte a seção sobre [configuração do Node.js](#-configuração-do-ambiente-nodejs).

## 🛠️ Ferramentas Disponíveis

### Contexto e Configuração <!-- omit in toc -->

- **get_initial_context** – IMPORTANTE: Deve ser chamado antes de usar quaisquer outras ferramentas para inicializar o contexto e obter instruções de uso.
- **get_sanity_config** – Recupera a configuração atual do Sanity (projectId, dataset, apiVersion, etc.)

### Operações de Documento <!-- omit in toc -->

- **create_document** – Criar um novo documento com conteúdo gerado por IA com base em instruções
- **update_document** – Atualizar um documento existente com conteúdo gerado por IA com base em instruções
- **patch_document** - Aplicar operações de patch diretas para modificar partes específicas de um documento sem usar geração de IA
- **transform_document** – Transformar o conteúdo do documento preservando a formatação e a estrutura, ideal para substituições de texto e correções de estilo
- **translate_document** – Traduzir o conteúdo do documento para outro idioma preservando a formatação e a estrutura
- **query_documents** – Executar consultas GROQ para pesquisar e recuperar conteúdo
- **document_action** – Realizar ações em documentos como publicar, despublicar ou excluir documentos

### Gerenciamento de Releases <!-- omit in toc -->

- **list_releases** – Listar releases de conteúdo, opcionalmente filtradas por estado
- **create_release** – Criar uma nova release de conteúdo
- **edit_release** – Atualizar metadados de uma release existente
- **schedule_release** – Agendar uma release para ser publicada em um horário específico
- **release_action** – Realizar ações em releases (publicar, arquivar, desarquivar, desagendar, excluir)

### Gerenciamento de Versões <!-- omit in toc -->

- **create_version** – Criar uma versão de um documento para uma release específica
- **discard_version** – Excluir um documento de versão específico de uma release
- **mark_for_unpublish** – Marcar um documento para ser despublicado quando uma release específica for publicada

### Gerenciamento de Datasets <!-- omit in toc -->

- **get_datasets** – Listar todos os datasets no projeto
- **create_dataset** – Criar um novo dataset
- **update_dataset** – Modificar configurações do dataset

### Informações do Schema <!-- omit in toc -->

- **get_schema** – Obter detalhes do schema, seja o schema completo ou para um tipo específico
- **list_workspace_schemas** – Obter uma lista de todos os nomes de schemas de workspace disponíveis

### Suporte GROQ <!-- omit in toc -->

- **get_groq_specification** – Obter o resumo da especificação da linguagem GROQ

### Embeddings e Busca Semântica <!-- omit in toc -->

- **list_embeddings_indices** – Listar todos os índices de embeddings disponíveis
- **semantic_search** – Realizar busca semântica em um índice de embeddings

### Informações do Projeto <!-- omit in toc -->

- **list_projects** – Listar todos os projetos Sanity associados à sua conta
- **get_project_studios** – Obter aplicações de studio vinculadas a um projeto específico

## ⚙️ Configuração

O servidor utiliza as seguintes variáveis de ambiente:

| Variável            | Descrição                                                    | Obrigatório |
| ------------------- | ------------------------------------------------------------ | -------- |
| `SANITY_API_TOKEN`  | Seu token de API do Sanity                                   | ✅       |
| `SANITY_PROJECT_ID` | O ID do seu projeto Sanity                                   | ✅       |
| `SANITY_DATASET`    | O dataset a ser usado                                        | ✅       |
| `MCP_USER_ROLE`     | Determina o nível de acesso às ferramentas (developer ou editor) | ✅       |
| `SANITY_API_HOST`   | Host da API (padrão: https://api.sanity.io)                  | ❌       |

> [!WARNING] > **Usando IA com Datasets de Produção**
> Ao configurar o servidor MCP com um token que tem acesso de escrita a um dataset de produção, esteja ciente de que a IA pode realizar ações destrutivas como criar, atualizar ou excluir conteúdo. Isso não é uma preocupação se você estiver usando um token somente leitura. Embora estejamos desenvolvendo ativamente mecanismos de proteção, você deve ter cautela e considerar o uso de um dataset de desenvolvimento/homologação para testar operações de IA que exigem acesso de escrita.

### 🔑 Tokens de API e Permissões

O servidor MCP requer tokens de API e permissões apropriadas para funcionar corretamente. Eis o que você precisa saber:

1. **Gerar um Token de Robô**:

   - Vá para o console de gerenciamento do seu projeto: Configurações > API > Tokens
   - Clique em "Adicionar novo token"
   - Crie um token dedicado para o uso do seu servidor MCP
   - Armazene o token com segurança - ele só é mostrado uma vez!

2. **Permissões Necessárias**:

   - O token precisa de permissões apropriadas com base no seu uso
   - Para operações básicas de leitura: o papel `viewer` é suficiente
   - Para gerenciamento de conteúdo: papel `editor` ou `developer` recomendado
   - Para operações avançadas (como gerenciar datasets): o papel `administrator` pode ser necessário

3. **Acesso ao Dataset**:

   - Datasets públicos: O conteúdo é legível por usuários não autenticados
   - Datasets privados: Requerem autenticação de token adequada
   - Conteúdo de rascunho e versionado: Acessível apenas a usuários autenticados com as permissões apropriadas

4. **Melhores Práticas de Segurança**:
   - Use tokens separados para ambientes diferentes (desenvolvimento, homologação, produção)
   - Nunca comite tokens para o controle de versão
   - Considere usar variáveis de ambiente para gerenciamento de tokens
   - Rotacione tokens regularmente por segurança

### 👥 Papéis de Usuário

O servidor suporta dois papéis de usuário:

- **developer**: Acesso a todas as ferramentas
- **editor**: Ferramentas focadas em conteúdo sem administração de projeto

## 📦 Configuração do Ambiente Node.js

> **Importante para Usuários do Node Version Manager**: Se você usa `nvm`, `mise`, `fnm`, `nvm-windows` ou ferramentas similares, você precisará seguir os passos de configuração abaixo para garantir que os servidores MCP possam acessar o Node.js. Esta é uma configuração única que economizará seu tempo de solução de problemas mais tarde. Este é [um problema contínuo](https://github.com/modelcontextprotocol/servers/issues/64) com servidores MCP.

### 🛠 Configuração Rápida para Usuários do Node Version Manager

1. Primeiro, ative sua versão preferida do Node.js:

   ```bash
   # Usando nvm
   nvm use 20   # ou sua versão preferida

   # Usando mise
   mise use node@20

   # Usando fnm
   fnm use 20
   ```

2. Em seguida, crie os links simbólicos necessários (escolha seu SO):

   **Em macOS/Linux:**

   ```bash
   sudo ln -sf "$(which node)" /usr/local/bin/node && sudo ln -sf "$(which npx)" /usr/local/bin/npx
   ```

   > [!NOTE]
   > Embora o uso de `sudo` geralmente exija cautela, é seguro neste contexto porque:
   >
   > - Estamos apenas criando links simbólicos para seus binários Node.js existentes
   > - O diretório de destino (`/usr/local/bin`) é um local padrão do sistema para programas instalados pelo usuário
   > - Os links simbólicos apontam apenas para binários que você já instalou e confia
   > - Você pode remover facilmente esses links simbólicos mais tarde com `sudo rm`

   **No Windows (PowerShell como Administrador):**

   ```powershell
   New-Item -ItemType SymbolicLink -Path "C:\Program Files\nodejs\node.exe" -Target (Get-Command node).Source -Force
   New-Item -ItemType SymbolicLink -Path "C:\Program Files\nodejs\npx.cmd" -Target (Get-Command npx).Source -Force
   ```

3. Verifique a configuração:
   ```bash
   # Deve mostrar a versão escolhida do Node
   /usr/local/bin/node --version  # macOS/Linux
   "C:\Program Files\nodejs\node.exe" --version  # Windows
   ```

### 🤔 Por Que Isso é Necessário?

Os servidores MCP são iniciados chamando diretamente os binários `node` e `npx`. Ao usar gerenciadores de versão do Node, esses binários são gerenciados em ambientes isolados que não são automaticamente acessíveis às aplicações do sistema. Os links simbólicos acima criam uma ponte entre seu gerenciador de versão e os caminhos do sistema que os servidores MCP usam.

### 🔍 Solução de Problemas

Se você alterna frequentemente as versões do Node:

- Lembre-se de atualizar seus links simbólicos ao mudar as versões do Node
- Você pode criar um alias de shell ou script para automatizar isso:
  ```bash
  # Exemplo de alias para seu .bashrc ou .zshrc
  alias update-node-symlinks='sudo ln -sf "$(which node)" /usr/local/bin/node && sudo ln -sf "$(which npx)" /usr/local/bin/npx'
  ```

Para remover os links simbólicos mais tarde:

```bash
# macOS/Linux
sudo rm /usr/local/bin/node /usr/local/bin/npx

# Windows (PowerShell como Admin)
Remove-Item "C:\Program Files\nodejs\node.exe", "C:\Program Files\nodejs\npx.cmd"
```

## 💻 Desenvolvimento

Instale as dependências:

```bash
pnpm install
```

Compile e execute em modo de desenvolvimento:

```bash
pnpm run dev
```

Compile o servidor:

```bash
pnpm run build
```

Execute o servidor compilado:

```bash
pnpm start
```

### Depuração

Para depuração, você pode usar o inspetor MCP:

```bash
npx @modelcontextprotocol/inspector -e SANITY_API_TOKEN=<token> -e SANITY_PROJECT_ID=<project_id> -e SANITY_DATASET=<ds> -e MCP_USER_ROLE=developer node path/to/build/index.js
```

Isso fornecerá uma interface web para inspecionar e testar as ferramentas disponíveis. 