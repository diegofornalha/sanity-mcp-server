# Guia de Sincronização com Repositório Original (Upstream)

## 🔄 Como Sincronizar com o Repositório Original

Este documento explica detalhadamente como trazer atualizações do repositório original (@sanity-io/sanity-mcp-server) para nosso fork que inclui funcionalidade SSE.

### 1. Configuração Inicial do Upstream

```bash
# Adicionar o repositório original como remote
git remote add upstream https://github.com/sanity-io/sanity-mcp-server.git

# Verificar se foi adicionado corretamente
git remote -v
# Saída esperada:
# origin    https://github.com/diegofornalha/sanity-mcp-server.git (fetch)
# origin    https://github.com/diegofornalha/sanity-mcp-server.git (push)
# upstream  https://github.com/sanity-io/sanity-mcp-server.git (fetch)
# upstream  https://github.com/sanity-io/sanity-mcp-server.git (push)
```

### 2. Buscar Atualizações do Upstream

```bash
# Buscar todas as branches e tags do upstream
git fetch upstream

# Comparar commits entre seu fork e upstream
git log --oneline upstream/main...main  # Commits que você tem mas upstream não tem
git log --oneline main...upstream/main  # Commits que upstream tem mas você não tem
```

### 3. Análise das Diferenças Encontradas

#### Versões
- **Nosso Fork**: v0.9.3
- **Upstream**: v0.10.1

#### Mudanças em Nosso Fork
1. **Implementação SSE** (commit aadfd0c):
   - `src/sse-server.ts` - Servidor Express com SSE
   - `README-SSE.md` - Documentação SSE
   - `test-sse.html` - Página de teste
   - Dependência `express` adicionada
   - Scripts de build modificados

2. **Documentação em Português** (commit 8b67bc1):
   - README.md traduzido
   - Arquivos GitHub removidos

#### Mudanças Significativas no Upstream (v0.10.0)
1. **Novas Dependências**:
   - `@modelcontextprotocol/sdk`: 1.7.0 → 1.12.0
   - `@sanity/client`: 7.1.0 → 7.4.0
   - `groq-js`: 1.16.1 → 1.17.0
   - Nova: `@sanity/types`: 3.89.0
   - Nova: `gpt-tokenizer`: 2.9.0

2. **Novos Recursos**:
   - Gerenciamento de limite de tokens (MAX_TOOL_TOKEN_OUTPUT)
   - Novas ferramentas de documento
   - Transformação de imagens com IA
   - Melhor tratamento de erros

3. **Breaking Changes**:
   - Nomes de ferramentas alterados
   - Funções removidas que o SSE usa
   - Nova lógica de limite de tokens

## 📋 Planejamento para Manter Funcionalidade SSE

### Fase 1: Preparação
1. **Criar Branch de Integração**
   ```bash
   git checkout -b feature/merge-upstream-v0.10.1
   ```

2. **Backup do Estado Atual**
   ```bash
   git tag backup-before-merge
   ```

### Fase 2: Merge Estratégico

#### Opção A: Merge Manual (Recomendado)
```bash
# Criar branch temporária do upstream
git checkout -b upstream-temp upstream/main

# Voltar para branch de integração
git checkout feature/merge-upstream-v0.10.1

# Cherry-pick commits específicos ou fazer merge manual
```

#### Opção B: Merge Direto com Resolução de Conflitos
```bash
git merge upstream/main
# Resolver conflitos manualmente
```

### Fase 3: Adaptações Necessárias

#### 1. Preservar Funcionalidade SSE
- **src/sse-server.ts**: Manter intacto
- **README-SSE.md**: Manter intacto
- **test-sse.html**: Manter intacto

#### 2. Atualizar Dependências
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@sanity/client": "^7.4.0",
    "@sanity/types": "^3.89.0",
    "dotenv": "^16.4.7",
    "express": "^4.18.2",  // Manter para SSE
    "gpt-tokenizer": "^2.9.0",
    "groq-js": "^1.17.0",
    "proper-fetch": "^1.0.1"
  }
}
```

#### 3. Adaptar SSE para Novos Limites de Token
```typescript
// Em src/sse-server.ts
import { MAX_TOOL_TOKEN_OUTPUT } from './config/env';

// Adicionar verificação de limite de tokens
function truncateResponse(response: any): any {
  const tokenCount = estimateTokens(JSON.stringify(response));
  if (tokenCount > MAX_TOOL_TOKEN_OUTPUT) {
    // Implementar truncamento
  }
  return response;
}
```

#### 4. Restaurar Funções Removidas
Se `utils/formatters.ts` foi removido mas é necessário para SSE:
```typescript
// Criar src/utils/sse-formatters.ts
export function formatToolResponse(data: any) {
  // Implementação específica para SSE
}
```

### Fase 4: Testes

1. **Testes Unitários**
   ```bash
   npm test
   ```

2. **Teste Manual SSE**
   - Abrir `test-sse.html`
   - Verificar todas as ferramentas
   - Confirmar streaming funciona

3. **Teste de Integração**
   - Testar com Claude/Cursor
   - Verificar limites de token

### Fase 5: Deploy na VPS

#### Preparação do Servidor
```bash
# Instalar Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2 para gerenciamento
sudo npm install -g pm2

# Clonar repositório
git clone https://github.com/diegofornalha/sanity-mcp-server.git
cd sanity-mcp-server
```

#### Configuração de Produção
```bash
# Criar arquivo .env
cat > .env << EOF
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
SANITY_API_TOKEN=your-token
MCP_USER_ROLE=developer
MAX_TOOL_TOKEN_OUTPUT=50000
PORT=3000
EOF

# Instalar dependências
npm install --production

# Build
npm run build
```

#### Deploy com PM2
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'sanity-mcp-sse',
    script: './build/sse-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

```bash
# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração
pm2 save
pm2 startup
```

#### Configurar Nginx (Opcional)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # SSE specific
        proxy_set_header Cache-Control 'no-cache';
        proxy_set_header X-Accel-Buffering 'no';
        proxy_read_timeout 86400;
    }
}
```

## 🔒 Segurança

1. **Variáveis de Ambiente**
   - Nunca commitar `.env`
   - Usar secrets do sistema

2. **Firewall**
   ```bash
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

3. **HTTPS com Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## 📊 Monitoramento

1. **Logs PM2**
   ```bash
   pm2 logs sanity-mcp-sse
   ```

2. **Monitoramento de Recursos**
   ```bash
   pm2 monit
   ```

3. **Status da Aplicação**
   ```bash
   pm2 status
   ```

## 🚀 Próximos Passos

1. Executar o merge seguindo este guia
2. Testar extensivamente a funcionalidade SSE
3. Documentar quaisquer mudanças na API
4. Considerar contribuir o recurso SSE de volta ao upstream
5. Configurar CI/CD para deploys automáticos