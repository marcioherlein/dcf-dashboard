/**
 * Buffer API adapter for publishing posts via GraphQL.
 * Uses native fetch — no external dependencies.
 */

export type BufferPostResult = {
  success: boolean
  postId?: string
  status?: string
  error?: string
  isDuplicate?: boolean // true when Buffer rejected as duplicate (treat as success)
}

export type BufferConfig = {
  apiKey: string
  channelId: string
}

// ─── GraphQL documents ────────────────────────────────────────────────────────

const CREATE_POST_MUTATION = /* GraphQL */ `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      post {
        id
        status
      }
    }
  }
`

const CHANNEL_QUERY = /* GraphQL */ `
  query GetChannel($id: String!) {
    channel(id: $id) {
      id
      name
      service
    }
  }
`

const BUFFER_API_URL = 'https://api.buffer.com/graphql'

// ─── Error classification ─────────────────────────────────────────────────────

/** Phrases Buffer returns when a post is a duplicate of an already-scheduled one. */
const DUPLICATE_PHRASES = [
  'already got this one scheduled',
  'duplicate post',
  'this post has already been',
]

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class BufferAdapter {
  constructor(private readonly config: BufferConfig) {}

  /**
   * Makes a lightweight call to Buffer to confirm the API key and channel ID
   * are valid and the connection is reachable.
   */
  async validateConnection(): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await this._graphql(CHANNEL_QUERY, {
        id: this.config.channelId,
      })

      if (response.errors?.length) {
        const msg = BufferAdapter.parseError(response)
        return { valid: false, error: msg }
      }

      if (!response.data?.channel) {
        return {
          valid: false,
          error: `Channel ${this.config.channelId} not found`,
        }
      }

      return { valid: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { valid: false, error: message }
    }
  }

  /**
   * Publishes a text post to the configured Buffer channel.
   *
   * - Returns isDuplicate=true when Buffer rejects the post as already scheduled.
   * - Throws a structured Error (with a classifiable message) on auth / rate /
   *   server failures so the caller can decide how to handle them.
   */
  async publishPost(text: string): Promise<BufferPostResult> {
    let response: BufferGraphQLResponse

    try {
      response = await this._graphql(CREATE_POST_MUTATION, {
        input: {
          channelId: this.config.channelId,
          text,
        },
      })
    } catch (err: unknown) {
      // Network-level or HTTP-level failure — re-throw so caller can classify.
      throw err
    }

    // GraphQL-level errors (field errors, validation errors, auth errors, …)
    if (response.errors?.length) {
      const errorMessage = BufferAdapter.parseError(response)

      if (BufferAdapter.isDuplicateError(errorMessage)) {
        return { success: true, isDuplicate: true }
      }

      // Auth / rate-limit / server errors: throw so the caller can classify.
      throw new BufferApiError(errorMessage, response.errors)
    }

    const post = response.data?.createPost?.post
    if (!post) {
      throw new BufferApiError(
        'createPost mutation returned no post object',
        response.errors ?? []
      )
    }

    return {
      success: true,
      postId: post.id,
      status: post.status,
    }
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  private async _graphql(
    query: string,
    variables: Record<string, unknown>
  ): Promise<BufferGraphQLResponse> {
    const res = await fetch(BUFFER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (res.status === 401) {
      throw new BufferApiError('Buffer API key is invalid or expired', [])
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After')
      const suffix = retryAfter ? ` (retry after ${retryAfter}s)` : ''
      throw new BufferApiError(`Buffer rate limit exceeded${suffix}`, [])
    }

    if (res.status >= 500) {
      throw new BufferApiError(
        `Buffer server error: HTTP ${res.status}`,
        []
      )
    }

    if (!res.ok) {
      throw new BufferApiError(
        `Unexpected Buffer HTTP response: ${res.status}`,
        []
      )
    }

    let body: unknown
    try {
      body = await res.json()
    } catch {
      throw new BufferApiError(
        'Buffer returned a non-JSON response body',
        []
      )
    }

    return body as BufferGraphQLResponse
  }

  // ─── Static helpers ─────────────────────────────────────────────────────────

  /**
   * Extracts a human-readable error message from a Buffer GraphQL response.
   * Safe to call on any unknown response shape.
   */
  static parseError(response: unknown): string {
    if (!response || typeof response !== 'object') {
      return 'Unknown Buffer error'
    }

    const r = response as Record<string, unknown>
    const errors = r['errors']

    if (!Array.isArray(errors) || errors.length === 0) {
      return 'Unknown Buffer error'
    }

    const messages = errors
      .map((e: unknown) => {
        if (e && typeof e === 'object') {
          const err = e as Record<string, unknown>
          return typeof err['message'] === 'string' ? err['message'] : null
        }
        return null
      })
      .filter(Boolean)

    return messages.length > 0
      ? messages.join('; ')
      : 'Unknown Buffer error'
  }

  /**
   * Returns true when an error message indicates Buffer has already scheduled
   * this content — callers should treat this as a non-fatal success.
   */
  static isDuplicateError(message: string): boolean {
    const lower = message.toLowerCase()
    return DUPLICATE_PHRASES.some((phrase) => lower.includes(phrase))
  }
}

// ─── Config factory ───────────────────────────────────────────────────────────

/**
 * Reads Buffer credentials for the given platform from environment variables.
 * Returns null if any required variable is missing so callers can skip posting
 * gracefully rather than throwing at construction time.
 *
 * Expected env vars:
 *   BUFFER_API_KEY               — shared across platforms
 *   BUFFER_CHANNEL_ID_X          — Buffer channel ID for X / Twitter
 *   BUFFER_CHANNEL_ID_LINKEDIN   — Buffer channel ID for LinkedIn
 */
export function getBufferConfig(platform: 'x' | 'linkedin'): BufferConfig | null {
  const apiKey = process.env.BUFFER_API_KEY
  if (!apiKey) return null

  const channelEnvKey =
    platform === 'x' ? 'BUFFER_CHANNEL_ID_X' : 'BUFFER_CHANNEL_ID_LINKEDIN'

  const channelId = process.env[channelEnvKey]
  if (!channelId) return null

  return { apiKey, channelId }
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface BufferGraphQLError {
  message: string
  locations?: Array<{ line: number; column: number }>
  path?: string[]
  extensions?: Record<string, unknown>
}

interface BufferGraphQLResponse {
  data?: {
    createPost?: {
      post?: {
        id: string
        status: string
      }
    }
    channel?: {
      id: string
      name: string
      service: string
    }
  }
  errors?: BufferGraphQLError[]
}

/** Structured error that carries the raw GraphQL error array for caller inspection. */
export class BufferApiError extends Error {
  readonly graphqlErrors: BufferGraphQLError[]

  constructor(message: string, graphqlErrors: BufferGraphQLError[]) {
    super(message)
    this.name = 'BufferApiError'
    this.graphqlErrors = graphqlErrors
  }
}
