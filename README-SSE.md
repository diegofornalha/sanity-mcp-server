# Sanity MCP SSE Server

Esta é uma versão SSE (Server-Sent Events) do Sanity MCP Server, projetada para ser deployada em servidores web como VPS.

## Como funciona

Ao invés de usar stdio (entrada/saída padrão) como o servidor original, esta versão usa HTTP com SSE para comunicação:

1. **GET /sse** - Estabelece uma conexão SSE para enviar mensagens do servidor para o cliente
2. **POST /messages/:sessionId** - Recebe mensagens do cliente
3. **GET /health** - Endpoint de health check

## Instalação e Execução

### Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Compilar o servidor SSE
npm run build:sse

# Executar em modo desenvolvimento
npm run dev:sse

# Ou executar diretamente
PORT=3000 npm start:sse
```

### Variáveis de Ambiente

As mesmas variáveis do servidor original:

```bash
SANITY_API_TOKEN=seu-token
SANITY_PROJECT_ID=seu-projeto
SANITY_DATASET=production
MCP_USER_ROLE=developer
PORT=3000  # Porta do servidor (opcional, padrão: 3000)
```

### Deploy em VPS

1. **Clone o repositório na VPS:**
```bash
git clone <seu-repo>
cd sanity-mcp-server
npm install
npm run build
```

2. **Configure as variáveis de ambiente:**
```bash
# Crie um arquivo .env
cat > .env << EOF
SANITY_API_TOKEN=seu-token
SANITY_PROJECT_ID=seu-projeto
SANITY_DATASET=production
MCP_USER_ROLE=developer
PORT=3000
EOF
```

3. **Execute com PM2 (recomendado):**
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar o servidor
pm2 start build/sse-server.js --name sanity-mcp-sse

# Salvar configuração do PM2
pm2 save
pm2 startup
```

4. **Configure um proxy reverso (Nginx):**
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # SSE specific
        proxy_set_header X-Accel-Buffering no;
        proxy_read_timeout 86400;
    }
}
```

## Testando o Servidor

Use o arquivo `test-sse.html` incluído para testar o servidor:

1. Abra o arquivo no navegador
2. Clique em "Connect SSE"
3. Teste as ferramentas disponíveis

## Configuração em Clientes MCP

Para usar este servidor SSE em clientes MCP compatíveis:

```json
{
  "mcpServers": {
    "sanity-sse": {
      "url": "https://seu-dominio.com/sse",
      "transport": "sse"
    }
  }
}
```

## Segurança

- Configure HTTPS com Let's Encrypt
- Considere adicionar autenticação básica no Nginx
- Use firewall para restringir acesso
- Monitore logs com PM2: `pm2 logs sanity-mcp-sse`

## Diferenças do Servidor Original

1. Usa HTTP/SSE ao invés de stdio
2. Pode ser acessado remotamente
3. Suporta múltiplas sessões simultâneas
4. Requer configuração de servidor web

## Troubleshooting

- Verifique os logs: `pm2 logs sanity-mcp-sse`
- Teste o health check: `curl http://localhost:3000/health`
- Verifique as variáveis de ambiente: `pm2 env sanity-mcp-sse`
- Reinicie o servidor: `pm2 restart sanity-mcp-sse`