import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import type {RequestHandlerExtra} from '@modelcontextprotocol/sdk/shared/protocol.js'
import type {ServerRequest, ServerNotification} from '@modelcontextprotocol/sdk/types.js'
import {enforceInitialContextMiddleware} from './context/middleware.js'
import {registerContextTools} from './context/register.js'
import {registerDatasetsTools} from './datasets/register.js'
import {registerDocumentsTools} from './documents/register.js'
import {registerEmbeddingsTools} from './embeddings/register.js'
import {registerGroqTools} from './groq/register.js'
import {registerProjectsTools} from './projects/register.js'
import {registerReleasesTools} from './releases/register.js'
import {registerSchemaTools} from './schema/register.js'
import type {McpRole} from '../types/mcp.js'
import type {THIS_IS_FINE} from '../types/any.js'

function createContextCheckingServer(server: McpServer): McpServer {
  const originalTool = server.tool.bind(server)
  return new Proxy(server, {
    get(target, prop) {
      if (prop === 'tool') {
        return function (this: THIS_IS_FINE, ...args: THIS_IS_FINE[]) {
          // Handle different overloads
          if (args.length >= 2) {
            const lastArg = args[args.length - 1]
            if (typeof lastArg === 'function') {
              const handler = lastArg
              const wrappedHandler = async (params: THIS_IS_FINE, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
                enforceInitialContextMiddleware(args[0] as string)
                return handler(params, extra)
              }
              args[args.length - 1] = wrappedHandler
            }
          }
          
          return (originalTool as THIS_IS_FINE).apply(server, args)
        }
      }
      return (target as THIS_IS_FINE)[prop]
    },
  })
}

/**
 * Register all tools with for the MCP server
 */
function developerTools(server: McpServer) {
  const wrappedServer = createContextCheckingServer(server)

  registerContextTools(wrappedServer)
  registerGroqTools(wrappedServer)
  registerDocumentsTools(wrappedServer)
  registerProjectsTools(wrappedServer)
  registerSchemaTools(wrappedServer)
  registerDatasetsTools(wrappedServer)
  registerReleasesTools(wrappedServer)
  registerEmbeddingsTools(wrappedServer)
}

function editorTools(server: McpServer) {
  const wrappedServer = createContextCheckingServer(server)

  registerContextTools(wrappedServer)
  registerGroqTools(wrappedServer)
  registerDocumentsTools(wrappedServer)
  registerSchemaTools(wrappedServer)
  registerReleasesTools(wrappedServer)
  registerEmbeddingsTools(wrappedServer)
}

function agentTools(server: McpServer) {
  registerGroqTools(server)
  registerDocumentsTools(server)
  registerSchemaTools(server)
  registerReleasesTools(server)
  registerEmbeddingsTools(server)
  registerProjectsTools(server)
}

export function registerAllTools(server: McpServer, userRole: McpRole = 'developer') {
  const toolMap: Record<McpRole, (server: McpServer) => void> = {
    developer: developerTools,
    editor: editorTools,
    internal_agent_role: agentTools,
  }
  const registerTools = toolMap[userRole]

  registerTools(server)
}
