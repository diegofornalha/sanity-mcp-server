import type {
  ContentObject,
  ContentValue,
  PatchOperations,
  SanityActionResult,
  SanityClient,
  SanityDocument,
  SanityMutationResult
} from '../types/sanity.js'
import {
  applyPatchOperations,
  getDocumentContent,
  normalizeBaseDocId,
  normalizeDocumentIds,
  normalizeDraftId} from '../utils/documentHelpers.js'
import {createSanityClient, sanityApi} from '../utils/sanityClient.js'

// Define types for Sanity documents
interface SanityDocumentStub {
  _type: string;
  [key: string]: ContentValue;
}

interface IdentifiedSanityDocumentStub extends SanityDocumentStub {
  _id: string;
}

// Define a more specific type for the transaction object
interface TransactionLike {
  create: (doc: Record<string, unknown> & { _type: string }) => TransactionLike;
  createOrReplace: (doc: Record<string, unknown> & { _type: string; _id: string }) => TransactionLike;
  createIfNotExists: (doc: Record<string, unknown> & { _type: string; _id: string }) => TransactionLike;
  delete: (documentId: string) => TransactionLike;
  patch: (documentId: string, patchSpec: Record<string, unknown>) => TransactionLike;
  commit: (options?: { visibility?: 'sync' | 'async' }) => Promise<SanityMutationResult>;
}

/**
 * Publishes a document or multiple documents (makes draft the published version)
 *
 * @param projectId - Sanity project ID
 * @param dataset - Dataset name
 * @param documentId - The document ID or array of IDs to publish
 * @returns Result of the publish operation
 */
export async function publishDocument(
  projectId: string,
  dataset: string,
  documentId: string | string[]
): Promise<{
  success: boolean;
  message: string;
  documentId?: string;
  documentIds?: string[];
  result: SanityActionResult;
}> {
  try {
    // Handle array of document IDs
    if (Array.isArray(documentId)) {
      const actions = documentId.map((id) => {
        // Ensure document ID doesn't already have 'drafts.' prefix
        const baseDocId = id.replace(/^drafts\./, '')
        const draftId = `drafts.${baseDocId}`

        return {
          actionType: 'sanity.action.document.publish',
          draftId,
          publishedId: baseDocId
        }
      })

      // Call the Actions API with all actions at once
      const result = await sanityApi.performActions(projectId, dataset, actions)

      return {
        success: true,
        message: `Published ${documentId.length} documents successfully`,
        documentIds: documentId.map((id) => id.replace(/^drafts\./, '')),
        result
      }
    }

    // Handle single document ID
    // Ensure document ID doesn't already have 'drafts.' prefix
    const baseDocId = documentId.replace(/^drafts\./, '')
    const draftId = `drafts.${baseDocId}`

    // Create the publish action
    const action = {
      actionType: 'sanity.action.document.publish',
      draftId,
      publishedId: baseDocId
    }

    // Call the Actions API
    const result = await sanityApi.performActions(projectId, dataset, [action])

    return {
      success: true,
      message: `Document ${baseDocId} published successfully`,
      documentId: baseDocId,
      result
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error publishing document:', error)
    throw new Error(`Failed to publish document: ${errorMessage}`)
  }
}

/**
 * Unpublishes a document or multiple documents (keeps it as draft only)
 *
 * @param projectId - Sanity project ID
 * @param dataset - Dataset name
 * @param documentId - The document ID or array of IDs to unpublish
 * @returns Result of the unpublish operation
 */
export async function unpublishDocument(
  projectId: string,
  dataset: string,
  documentId: string | string[]
): Promise<{
  success: boolean;
  message: string;
  draftId?: string;
  draftIds?: string[];
  result: SanityActionResult;
}> {
  try {
    // Handle array of document IDs
    if (Array.isArray(documentId)) {
      const actions = documentId.map((id) => {
        // Ensure document ID doesn't already have 'drafts.' prefix
        const baseDocId = id.replace(/^drafts\./, '')

        return {
          actionType: 'sanity.action.document.unpublish',
          documentId: baseDocId
        }
      })

      // Call the Actions API with all actions at once
      const result = await sanityApi.performActions(projectId, dataset, actions)

      return {
        success: true,
        message: `Unpublished ${documentId.length} documents successfully`,
        draftIds: documentId.map((id) => `drafts.${id.replace(/^drafts\./, '')}`),
        result
      }
    }

    // Handle single document ID
    // Ensure document ID doesn't already have 'drafts.' prefix
    const baseDocId = documentId.replace(/^drafts\./, '')

    // Create the unpublish action
    const action = {
      actionType: 'sanity.action.document.unpublish',
      documentId: baseDocId
    }

    // Call the Actions API
    const result = await sanityApi.performActions(projectId, dataset, [action])

    return {
      success: true,
      message: `Document ${baseDocId} unpublished successfully`,
      draftId: `drafts.${baseDocId}`,
      result
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error unpublishing document:', error)
    throw new Error(`Failed to unpublish document: ${errorMessage}`)
  }
}

/**
 * Prepares a single document for creation, ensuring proper formatting and validation
 */
function prepareDocumentForCreation(document: ContentObject): ContentObject {
  // Ensure document has _type
  if (!document._type) {
    throw new Error('Document must have a _type field')
  }

  // If document has _id, make sure it's properly formatted
  if (document._id && typeof document._id === 'string' && !document._id.startsWith('drafts.')) {
    return {...document, _id: `drafts.${document._id}`}
  }

  return document
}

/**
 * Creates multiple documents in a single transaction
 */
async function createMultipleDocuments(
  client: SanityClient,
  documents: ContentObject[],
  options?: { ifExists?: 'fail' | 'ignore' }
): Promise<{ result: SanityMutationResult, count: number, ids: string[] }> {
  // Validate and prepare each documen
  const preparedDocs = documents.map(prepareDocumentForCreation)

  // Create documents based on options
  const transaction = client.transaction()

  for (const doc of preparedDocs) {
    if (options?.ifExists === 'ignore' && doc._id) {
      transaction.createIfNotExists(doc as IdentifiedSanityDocumentStub)
    } else {
      transaction.create(doc as SanityDocumentStub)
    }
  }

  // Commit all document creations at once
  const results = await transaction.commit()

  return {
    result: results,
    count: preparedDocs.length,
    ids: results.results.map((res: { id: string }) => res.id)
  }
}

/**
 * Creates a single documen
 */
async function createSingleDocument(
  client: SanityClient,
  document: ContentObject,
  options?: { ifExists?: 'fail' | 'ignore' }
): Promise<{ result: SanityMutationResult, id: string }> {
  const preparedDoc = prepareDocumentForCreation(document)

  // Handle ifExists option
  let result
  if (options?.ifExists === 'ignore' && preparedDoc._id) {
    // Use createIfNotExists if we want to ignore existing docs
    result = await client.createIfNotExists(preparedDoc as IdentifiedSanityDocumentStub)
  } else {
    // Default behavior - just create
    result = await client.create(preparedDoc as SanityDocumentStub)
  }

  // Transform result to match expected interface
  return {
    result: {documentId: result._id},
    id: result._id
  }
}

/**
 * Creates one or more new documents in Sanity
 *
 * @param projectId - Sanity project ID
 * @param dataset - Dataset name
 * @param documents - The document or array of documents to create
 * @param options - Additional options
 * @returns Result of the create operation
 */
export async function createDocument(
  projectId: string,
  dataset: string,
  documents: ContentObject | ContentObject[],
  options?: {
    ifExists?: 'fail' | 'ignore'
  }
): Promise<{
  success: boolean;
  message: string;
  documentId?: string;
  documentIds?: string[];
  result: SanityMutationResult;
}> {
  try {
    const client = createSanityClient(projectId, dataset)

    // Handle array of documents
    if (Array.isArray(documents)) {
      if (documents.length === 0) {
        throw new Error('Empty array of documents provided')
      }

      const result = await createMultipleDocuments(client, documents, options)

      return {
        success: true,
        message: `${result.count} documents created successfully`,
        documentIds: result.ids,
        result: result.result
      }
    }

    // Handle single documen
    const result = await createSingleDocument(client, documents, options)

    return {
      success: true,
      message: `Document created successfully with ID: ${result.id}`,
      documentId: result.id,
      result: result.result
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error creating document:', error)
    throw new Error(`Failed to create document: ${errorMessage}`)
  }
}

/**
 * Edits one or more existing documents with patches
 *
 * @param projectId - Sanity project ID
 * @param dataset - Dataset name
 * @param documentId - The document ID or array of IDs to edi
 * @param patch - The patch operations to apply to each documen
 * @returns Result of the edit operation
 */
export async function editDocument(
  projectId: string,
  dataset: string = 'production',
  documentId: string | string[],
  patch: PatchOperations
): Promise<{
  success: boolean;
  message: string;
  documentId?: string;
  documentIds?: string[];
  result: SanityMutationResult;
}> {
  try {
    const client = createSanityClient(projectId, dataset)

    // Process document IDs
    const documentIds = processDocumentIds(documentId)

    let result
    let processedIds: string[]

    if (documentIds.length === 1) {
      const response = await editSingleDocument(client, documentIds[0], patch)
      result = response.result
      processedIds = response.processedIds
    } else {
      const response = await editMultipleDocuments(client, documentIds, patch)
      result = response.result
      processedIds = response.processedIds
    }

    return {
      success: true,
      message: `Successfully edited ${processedIds.length} document(s)`,
      documentIds: processedIds,
      result
    }
  } catch (err) {
    // Convert Error to expected return type
    const error = err as Error
    return {
      success: false,
      message: error.message || 'Error editing document',
      result: {documentId: ''} as SanityMutationResult
    }
  }
}

/**
 * Deletes one or more documents and optionally their drafts
 *
 * @param projectId - Sanity project ID
 * @param dataset - Dataset name
 * @param documentId - The document ID or array of IDs to delete
 * @param options - Additional options
 * @returns Result of the delete operation
 */
export async function deleteDocument(
  projectId: string,
  dataset: string,
  documentId: string | string[],
  options?: {
    includeDrafts?: string[];
    purge?: boolean;
  }
): Promise<{
  success: boolean;
  message: string;
  documentId?: string;
  documentIds?: string[];
  result: SanityMutationResult;
}> {
  try {
    const client = createSanityClient(projectId, dataset)

    // Handle array of document IDs
    if (Array.isArray(documentId)) {
      if (documentId.length === 0) {
        throw new Error('Empty array of document IDs provided')
      }

      const {result, processedIds} = await deleteMultipleDocuments(client, documentId, options)

      return {
        success: true,
        message: `${processedIds.length} documents deleted successfully`,
        documentIds: processedIds,
        result
      }
    }

    // Handle single document ID
    const {baseDocId, draftId} = prepareDocumentIdForDeletion(documentId)

    // Start a transaction
    const transaction = client.transaction()

    // Delete the published documen
    transaction.delete(baseDocId)

    // Delete the draft documen
    transaction.delete(draftId)

    // Delete any additional draft IDs specified
    if (options?.includeDrafts && options.includeDrafts.length > 0) {
      options.includeDrafts.forEach((id) => {
        transaction.delete(id)
      })
    }

    // Commit the transaction
    const result = await transaction.commit({
      // If purge is true, completely remove from history
      visibility: options?.purge ? 'async' : 'sync'
    })

    return {
      success: true,
      message: `Document ${baseDocId} deleted successfully`,
      documentId: baseDocId,
      result
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error deleting document:', error)
    throw new Error(`Failed to delete document: ${errorMessage}`)
  }
}

/**
 * Prepares document IDs for deletion by normalizing them and creating base and draft IDs
 */
function prepareDocumentIdForDeletion(id: string): { baseDocId: string, draftId: string } {
  // Ensure document ID doesn't already have 'drafts.' prefix
  const baseDocId = id.replace(/^drafts\./, '')
  const draftId = `drafts.${baseDocId}`

  return {baseDocId, draftId}
}

/**
 * Sets up a transaction for deleting multiple documents
 */
function setupDeleteTransaction(
  transaction: TransactionLike,
  documentIds: string[],
  additionalDrafts?: string[]
): { transaction: TransactionLike, processedIds: string[] } {
  const processedIds: string[] = []

  // Process each document ID
  for (const id of documentIds) {
    const {baseDocId, draftId} = prepareDocumentIdForDeletion(id)

    // Delete the published documen
    transaction.delete(baseDocId)

    // Delete the draft documen
    transaction.delete(draftId)

    processedIds.push(baseDocId)
  }

  // Delete any additional draft IDs specified
  if (additionalDrafts && additionalDrafts.length > 0) {
    additionalDrafts.forEach((id) => {
      transaction.delete(id)
    })
  }

  return {transaction, processedIds}
}

/**
 * Deletes multiple documents in a transaction
 */
async function deleteMultipleDocuments(
  client: SanityClient,
  documentIds: string[],
  options?: {
    includeDrafts?: string[];
    purge?: boolean;
  }
): Promise<{ result: SanityMutationResult, processedIds: string[] }> {
  // Process each document ID
  const transaction = client.transaction()

  const {transaction: preparedTransaction, processedIds} = setupDeleteTransaction(
    transaction,
    documentIds,
    options?.includeDrafts
  )

  // Commit the transaction
  const result = await preparedTransaction.commit()

  return {
    result,
    processedIds
  }
}

/**
 * Validates and prepares a document for replacement
 */
function prepareDocumentForReplacement(doc: ContentObject): ContentObject {
  // Ensure document has _type and _id
  if (!doc._type) {
    throw new Error('Document must have a _type field')
  }

  if (!doc._id) {
    throw new Error('Document must have an _id field to replace')
  }

  // Ensure document ID is a draft
  if (typeof doc._id === 'string' && !doc._id.startsWith('drafts.')) {
    return {...doc, _id: `drafts.${doc._id}`}
  }

  return doc
}

/**
 * Replaces one or more existing draft documents
 *
 * @param projectId - Sanity project ID
 * @param dataset - Dataset name
 * @param documents - The replacement document or array of documents
 * @returns Result of the replace operation
 */
export async function replaceDraftDocument(
  projectId: string,
  dataset: string,
  documents: ContentObject | ContentObject[]
): Promise<{
  success: boolean;
  message: string;
  documentId?: string;
  documentIds?: string[];
  result: SanityMutationResult;
}> {
  try {
    const client = createSanityClient(projectId, dataset)

    // Handle array of documents
    if (Array.isArray(documents)) {
      if (documents.length === 0) {
        throw new Error('Empty array of documents provided')
      }

      // Validate and prepare each document
      const preparedDocs = documents.map(prepareDocumentForReplacement)

      // Replace documents in a single transaction
      const transaction = client.transaction()

      for (const doc of preparedDocs) {
        transaction.createOrReplace(doc as IdentifiedSanityDocumentStub)
      }

      const results = await transaction.commit()

      return {
        success: true,
        message: `${preparedDocs.length} draft documents replaced successfully`,
        documentIds: preparedDocs.map((doc) => doc._id as string),
        result: results
      }
    }

    // Handle single document
    const document = prepareDocumentForReplacement(documents)

    // Replace the document
    const result = await client.createOrReplace(document as IdentifiedSanityDocumentStub)

    return {
      success: true,
      message: `Draft document ${document._id} replaced successfully`,
      documentId: document._id as string,
      result
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error replacing draft document:', error)
    throw new Error(`Failed to replace draft document: ${errorMessage}`)
  }
}

/**
 * Edits a single document with the given patch
 *
 * @param client - Sanity clien
 * @param documentId - The document ID to edi
 * @param patch - The patch operations to apply
 * @returns Result of the edit operation
 */
async function editSingleDocument(
  client: SanityClient,
  documentId: string,
  patch: PatchOperations
): Promise<{ result: SanityMutationResult, processedIds: string[] }> {
  const draftId = normalizeDraftId(documentId)
  const transaction = client.transaction()

  // Create the patch operation on the draft documen
  const patchObj = client.patch(draftId)
  // @ts-expect-error - Type compatibility issues with the Sanity client
  applyPatchOperations(patch, patchObj)

  // Convert the patch to a plain object for use with transaction
  // @ts-expect-error - Type compatibility issues with the Sanity client
  const patchSpec = patchObjToSpec(patchObj)

  // Add the patch to the transaction
  transaction.patch(draftId, patchSpec)

  // Commit the transaction
  const result = await transaction.commit()

  return {
    result: {
      documentId: draftId,
      transactionId: result.transactionId,
      results: result.results
    },
    processedIds: [draftId]
  }
}

/**
 * Edits multiple documents with the given patch
 *
 * @param client - Sanity clien
 * @param documentIds - Array of document IDs to edi
 * @param patch - The patch operations to apply to each documen
 * @returns Result of the edit operation
 */
async function editMultipleDocuments(
  client: SanityClient,
  documentIds: string[],
  patch: PatchOperations
): Promise<{ result: SanityMutationResult, processedIds: string[] }> {
  // Normalize all document IDs to draft IDs
  const draftIds = documentIds.map((id) => normalizeDraftId(id))

  // Create a transaction for batch operations
  const transaction = client.transaction()

  // Apply the patch to each documen
  draftIds.forEach((id) => {
    const patchObj = client.patch(id)
    // @ts-expect-error - Type compatibility issues with the Sanity client
    applyPatchOperations(patch, patchObj)

    // Convert the patch to a plain object for use with transaction
    // @ts-expect-error - Type compatibility issues with the Sanity client
    const patchSpec = patchObjToSpec(patchObj)

    transaction.patch(id, patchSpec)
  })

  // Commit the transaction
  const result = await transaction.commit()

  return {
    result: {
      documentId: draftIds[0], // Return the first ID for backward compatibility
      transactionId: result.transactionId,
      results: result.results
    },
    processedIds: draftIds
  }
}

/**
 * Converts a patch object to a plain spec object for use with transaction
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity
function patchObjToSpec(patchObj: Record<string, unknown>): Record<string, unknown> {
  // Extract the internal spec from the patch objec
  // This is a workaround since we can't directly access the internal spec
  const patchSpec: Record<string, unknown> = {}

  // Check if patch has these properties and add them to the spec
  if ('_set' in patchObj && patchObj._set) {
    patchSpec.set = patchObj._set
  }
  if ('_setIfMissing' in patchObj && patchObj._setIfMissing) {
    patchSpec.setIfMissing = patchObj._setIfMissing
  }
  if ('_unset' in patchObj && patchObj._unset) {
    patchSpec.unset = patchObj._unset
  }
  if ('_inc' in patchObj && patchObj._inc) {
    patchSpec.inc = patchObj._inc
  }
  if ('_dec' in patchObj && patchObj._dec) {
    patchSpec.dec = patchObj._dec
  }
  if ('_insert' in patchObj && patchObj._insert) {
    patchSpec.insert = patchObj._insert
  }
  if ('_diffMatchPatch' in patchObj && patchObj._diffMatchPatch) {
    patchSpec.diffMatchPatch = patchObj._diffMatchPatch
  }
  if ('_ifRevisionId' in patchObj && patchObj._ifRevisionId) {
    patchSpec.ifRevisionId = patchObj._ifRevisionId
  }

  return patchSpec
}

/**
 * Creates a version document for a single documen
 *
 * @param client - Sanity clien
 * @param releaseId - ID of the release
 * @param documentId - ID of the documen
 * @param content - Optional content to use instead of the document's conten
 * @returns The created version documen
 */
async function createSingleDocumentVersion(
  client: SanityClient,
  releaseId: string,
  documentId: string,
  content?: ContentObject
): Promise<SanityDocument> {
  const baseDocId = normalizeBaseDocId(documentId)

  // Get document conten
  // @ts-expect-error - Type compatibility issues between ContentObject and SanityDocument
  const documentContent = await getDocumentContent(client, documentId, content)

  // Create version documen
  const versionDoc = {
    _type: 'release.version',
    _id: `release.version.${releaseId}.${baseDocId}`,
    releaseId,
    documentId: baseDocId,
    content: content || documentContent
  }

  // Create the version
  return await client.create(versionDoc)
}

/**
 * Creates document versions in a specific release
 *
 * @param projectId - Sanity project ID
 * @param dataset - Dataset name
 * @param releaseId - ID of the release to add the document version to
 * @param documentId - ID or array of IDs of the document(s) to create a version of
 * @param content - Optional content to use for the version
 * @returns Result of the create version operation
 */
export async function createDocumentVersion(
  projectId: string,
  dataset: string,
  releaseId: string,
  documentId: string | string[],
  content?: ContentObject
): Promise<{
  success: boolean;
  message: string;
  versionId?: string;
  versionIds?: string[];
  result: SanityMutationResult;
}> {
  try {
    const client = createSanityClient(projectId, dataset)

    // Handle array of document IDs
    if (Array.isArray(documentId)) {
      if (documentId.length === 0) {
        throw new Error('Empty array of document IDs provided')
      }

      const versionIds: string[] = []
      const results: SanityDocument[] = []

      // Process each document ID
      for (const id of documentId) {
        const result = await createSingleDocumentVersion(client, releaseId, id, content)
        versionIds.push(result._id)
        results.push(result)
      }

      return {
        success: true,
        message: `Created ${versionIds.length} document versions for release ${releaseId}`,
        versionIds,
        result: results
      }
    }

    // Handle single document ID
    const result = await createSingleDocumentVersion(client, releaseId, documentId, content)

    return {
      success: true,
      message: `Document version created for ${normalizeBaseDocId(documentId)} in release ${releaseId}`,
      versionId: result._id,
      result
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error creating document version:', error)
    throw new Error(`Failed to create document version: ${errorMessage}`)
  }
}

/**
 * Sets up a transaction for discarding multiple document versions
 */
function setupDiscardVersionsTransaction(
  client: SanityClient,
  versionIds: string[],
  options?: { purge?: boolean }
): { transaction: TransactionLike, visibility: 'sync' | 'async' } {
  const transaction = client.transaction()

  // Add delete operations for each version ID
  for (const id of versionIds) {
    transaction.delete(id)
  }

  // Determine visibility based on purge option
  const visibility = options?.purge ? 'async' : 'sync'

  return {transaction, visibility}
}

/**
 * Discards one or more specific versions of documents
 *
 * @param projectId - Sanity project ID
 * @param dataset - Dataset name
 * @param versionId - ID or array of IDs of the version(s) to discard
 * @param options - Additional options
 * @returns Result of the discard operation
 */
export async function discardDocumentVersion(
  projectId: string,
  dataset: string,
  versionId: string | string[],
  options?: {
    purge?: boolean;
  }
): Promise<{
  success: boolean;
  message: string;
  versionId?: string;
  versionIds?: string[];
  result: SanityMutationResult;
}> {
  try {
    const client = createSanityClient(projectId, dataset)

    // Handle array of version IDs
    if (Array.isArray(versionId)) {
      if (versionId.length === 0) {
        throw new Error('Empty array of version IDs provided')
      }

      // Set up transaction for batch deletion
      const {transaction, visibility} = setupDiscardVersionsTransaction(client, versionId, options)

      // Commit the transaction
      const result = await transaction.commit({visibility})

      return {
        success: true,
        message: `Discarded ${versionId.length} document versions`,
        versionIds: versionId,
        result
      }
    }

    // Handle single version ID
    const result = await client.delete(versionId, {
      // If purge is true, completely remove from history
      visibility: options?.purge ? 'async' : 'sync'
    })

    return {
      success: true,
      message: `Document version ${versionId} discarded successfully`,
      versionId,
      result
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error discarding document version:', error)
    throw new Error(`Failed to discard document version: ${errorMessage}`)
  }
}

/**
 * Marks one or more documents for unpublishing when a release is published
 *
 * @param projectId - Sanity project ID
 * @param dataset - Dataset name
 * @param releaseId - ID of the release
 * @param documentId - ID or array of IDs of the document(s) to unpublish
 * @returns Result of the unpublish with release operation
 */
export async function unpublishDocumentWithRelease(
  projectId: string,
  dataset: string,
  releaseId: string,
  documentId: string | string[]
): Promise<{
  success: boolean;
  message: string;
  documentId?: string;
  documentIds?: string[];
  result: SanityMutationResult;
}> {
  try {
    const client = createSanityClient(projectId, dataset)

    // Handle array of document IDs
    if (Array.isArray(documentId)) {
      if (documentId.length === 0) {
        throw new Error('Empty array of document IDs provided')
      }

      const unpublishDocs: string[] = []
      const results: SanityDocument[] = []

      // Process each document ID
      for (const id of documentId) {
        // Ensure document ID doesn't already have 'drafts.' prefix
        const baseDocId = id.replace(/^drafts\./, '')

        // Create unpublish documen
        const unpublishDoc = {
          _type: 'release.unpublish',
          _id: `release.unpublish.${releaseId}.${baseDocId}`,
          releaseId,
          documentId: baseDocId
        }

        // Create the unpublish record
        const result = await client.create(unpublishDoc)
        unpublishDocs.push(baseDocId)
        results.push(result)
      }

      return {
        success: true,
        message: `Marked ${unpublishDocs.length} documents for unpublishing with release ${releaseId}`,
        documentIds: unpublishDocs,
        result: results
      }
    }

    // Handle single document ID
    // Ensure document ID doesn't already have 'drafts.' prefix
    const baseDocId = documentId.replace(/^drafts\./, '')

    // Create unpublish documen
    const unpublishDoc = {
      _type: 'release.unpublish',
      _id: `release.unpublish.${releaseId}.${baseDocId}`,
      releaseId,
      documentId: baseDocId
    }

    // Create the unpublish record
    const result = await client.create(unpublishDoc)

    return {
      success: true,
      message: `Document ${baseDocId} marked for unpublishing with release ${releaseId}`,
      documentId: baseDocId,
      result
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error marking document for unpublishing:', error)
    throw new Error(`Failed to mark document for unpublishing: ${errorMessage}`)
  }
}

/**
 * Process document IDs
 */
export function processDocumentIds(documentId: string | string[]): string[] {
  const documentIds = normalizeDocumentIds(documentId)

  if (documentIds.length === 0) {
    throw new Error('No valid document IDs provided')
  }

  return documentIds
}
