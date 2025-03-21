/**
 * Context-related tool definitions
 *
 * This file defines tool definitions related to MCP context and configuration
 */
import {z} from 'zod'

import config from '../config/config.js'
import * as embeddingsController from '../controllers/embeddings.js'
import * as releasesController from '../controllers/releases.js'
import * as schemaController from '../controllers/schema.js'
import type {EmbeddingIndex, SchemaType} from '../types/index.js'
import type {SanityDocument} from '../types/sanity.js'
import type {
  ListEmbeddingsIndicesParams
} from '../types/sharedTypes.js'
import type {ToolProvider} from '../types/toolProvider.js'
import type {InitialContext, ToolDefinition} from '../types/tools.js'

/**
 * Context tools provider class
 */
export class ContextToolProvider implements ToolProvider {
  /**
   * Get all context-related tool definitions
   *
   * @returns Array of tool definition objects
   */
  // eslint-disable-next-line class-methods-use-this
  getToolDefinitions(): ToolDefinition[] {
    return ContextToolProvider.getToolDefinitionsStatic()
  }

  /**
   * Static method to get all context-related tool definitions
   * This allows the method to be called without an instance
   *
   * @returns Array of tool definition objects
   */
  static getToolDefinitionsStatic(): ToolDefinition[] {
    return [
      {
        name: 'getInitialContext',
        description:
          'IMPORTANT: Call this tool first to get initial context and usage instructions for this MCP server. ' +
          'This provides critical information about which projects and datasets you should use.',
        parameters: z.object({}),
        handler: async (): Promise<InitialContext> => {
          // Validate that we have project ID and dataset configured
          if (!config.projectId) {
            return {
              message: 'Welcome to the Sanity MCP Server!',
              warning: 'SANITY_PROJECT_ID is not configured. Please set it in your environment variables.',
              instructions: 'For this prototype, you need to set the following environment variables:',
              requiredVariables: ['SANITY_PROJECT_ID', 'SANITY_DATASET', 'SANITY_TOKEN'],
              note: 'Once these are set, the server will be ready to use.'
            }
          }

          try {
            // Get embeddings indices
            const embeddingsIndices = await embeddingsController.listEmbeddingsIndices({
              projectId: config.projectId,
              dataset: config.dataset || 'production'
            } as ListEmbeddingsIndicesParams)

            // Get schema types - only document types
            const documentTypes = await schemaController.listSchemaTypes(
              config.projectId,
              config.dataset || 'production',
              {allTypes: false}
            )

            // Get active releases
            const releasesResult = await releasesController.listReleases(
              config.projectId,
              config.dataset || 'production'
            )

            // Filter to only active releases
            const activeReleases = releasesResult.releases.filter(
              (release: SanityDocument) => !release.archivedAt && !release.discardedAt
            )

            return {
              message: 'Welcome to the Sanity MCP Server!',
              instructions:
                'You can use this server to interact with Sanity content. ' +
                'Start by exploring the schema to understand the content model.',
              projectId: config.projectId,
              dataset: config.dataset || 'production',
              embeddingsIndices: embeddingsIndices.map((index: EmbeddingIndex) => ({
                id: index.webhookId || index.indexName,
                name: index.indexName,
                status: index.status || 'available',
                documentCount: index.startDocumentCount - index.remainingDocumentCount
              })),
              documentTypes: documentTypes.map((type: SchemaType) => ({
                name: type.name,
                title: type.title,
                type: type.type
              })),
              activeReleases: activeReleases.map((release: SanityDocument) => ({
                id: release.id,
                title: release.title,
                status: release.status
              })),
              note:
                "The above information provides context about the Sanity project you're working with. " +
                'You can use the schema types to formulate GROQ queries.'
            }
          } catch (error) {
            return {
              message: 'Welcome to the Sanity MCP Server!',
              warning: 'Could not fetch complete initial context.',
              instructions: 'You can still use the server, but some information may be missing.',
              projectId: config.projectId,
              dataset: config.dataset || 'production',
              note: 'Make sure your SANITY_TOKEN has the necessary permissions.'
            }
          }
        }
      }
    ]
  }
}
