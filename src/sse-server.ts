#!/usr/bin/env node
import express from 'express'
import {SSEServerTransport} from '@modelcontextprotocol/sdk/server/sse.js'
import {registerAllPrompts} from './prompts/register.js'
import {registerAllResources} from './resources/register.js'
import {registerAllTools} from './tools/register.js'
import {env} from './config/env.js'
import {VERSION} from './config/version.js'
import type {IncomingMessage, ServerResponse} from 'node:http'

const MCP_SERVER_NAME = '@sanity/mcp'
const PORT = parseInt(process.env.PORT || '3000')

// Store active transports by session ID
const transports = new Map<string, SSEServerTransport>()

async function main() {
  try {
    const app = express()
    app.use(express.json())
    
    // SSE endpoint - establishes SSE connection
    app.get('/sse', async (req, res) => {
      try {
        // Create SSE transport
        const transport = new SSEServerTransport('/messages', res as ServerResponse)
        
        
        // Use McpServer from SDK
        const {McpServer} = await import('@modelcontextprotocol/sdk/server/mcp.js')
        const mcpServer = new McpServer({
          name: MCP_SERVER_NAME,
          version: VERSION,
        })
        
        registerAllTools(mcpServer, env.data?.MCP_USER_ROLE)
        registerAllPrompts(mcpServer)
        registerAllResources(mcpServer)
        
        // Connect the underlying server to transport
        await mcpServer.connect(transport)
        
        // Store transport by session ID
        transports.set(transport.sessionId, transport)
        
        // Start SSE stream
        await transport.start()
        
        // Clean up on close
        transport.onclose = () => {
          transports.delete(transport.sessionId)
        }
        
      } catch (error) {
        console.error('SSE connection error:', error)
        if (!res.headersSent) {
          res.status(500).send('Internal Server Error')
        }
      }
    })
    
    // Messages endpoint - handles POST messages
    app.post('/messages/:sessionId', async (req, res) => {
      try {
        const sessionId = req.params.sessionId
        const transport = transports.get(sessionId)
        
        if (!transport) {
          res.status(404).json({ error: 'Session not found' })
          return
        }
        
        // Handle the POST message
        await transport.handlePostMessage(
          req as IncomingMessage,
          res as ServerResponse,
          req.body
        )
      } catch (error) {
        console.error('Message handling error:', error)
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' })
        }
      }
    })
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        server: MCP_SERVER_NAME,
        version: VERSION,
        activeSessions: transports.size,
      })
    })
    
    // CORS headers for development
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      if (req.method === 'OPTIONS') {
        res.sendStatus(200)
      } else {
        next()
      }
    })
    
    app.listen(PORT, () => {
      console.log(`🚀 Sanity MCP SSE Server running on http://localhost:${PORT}`)
      console.log(`   SSE endpoint: GET http://localhost:${PORT}/sse`)
      console.log(`   Messages endpoint: POST http://localhost:${PORT}/messages/:sessionId`)
      console.log(`   Health check: GET http://localhost:${PORT}/health`)
      console.log('\nEnvironment:')
      if (env.data && 'SANITY_PROJECT_ID' in env.data) {
        console.log(`   Project: ${env.data.SANITY_PROJECT_ID}`)
        console.log(`   Dataset: ${env.data.SANITY_DATASET}`)
      }
      console.log(`   User Role: ${env.data?.MCP_USER_ROLE}`)
    })
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()