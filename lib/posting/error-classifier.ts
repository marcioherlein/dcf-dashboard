/**
 * Classifies Buffer API errors and posting failures into structured error codes.
 *
 * Error hierarchy (checked in order):
 *   1. CONFIG_MISSING      – missing env var (permanent)
 *   2. AUTH_FAILED         – 401 / 403 (permanent)
 *   3. DUPLICATE_POST      – "already got this one scheduled" (not retryable, treat as success)
 *   4. CHANNEL_INVALID     – channel ID wrong or disconnected (permanent)
 *   5. CONTENT_INVALID     – post too long, validation rejection (permanent)
 *   6. RATE_LIMITED        – 429 (retryable, 1 h fixed delay)
 *   7. PROVIDER_ERROR      – 5xx (retryable, exponential backoff)
 *   8. NETWORK_TIMEOUT     – fetch timeout / ECONNRESET / AbortError (retryable, 300 s)
 *   9. DATABASE_ERROR      – Supabase errors (retryable, 60 s)
 *  10. CONTENT_GENERATION_FAILED – mode returned no content (retryable, 900 s)
 *  11. UNKNOWN             – catch-all (retryable up to max_attempts, 300 s)
 */

export type ErrorCode =
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "NETWORK_TIMEOUT"
  | "DUPLICATE_POST"
  | "CONTENT_INVALID"
  | "CONFIG_MISSING"
  | "CHANNEL_INVALID"
  | "DATABASE_ERROR"
  | "CONTENT_GENERATION_FAILED"
  | "UNKNOWN";

export type ErrorClassification = {
  /** Structured error code */
  code: ErrorCode;
  /** Whether the operation can be retried */
  retryable: boolean;
  /** Seconds until the next retry attempt; 0 when not retryable */
  nextAttemptDelay: number;
  /** Human-readable description */
  message: string;
  /** true = dead-letter this item, no further retries */
  permanent: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the HTTP status code from a variety of error shapes that Buffer
 * client libraries or raw fetch calls may produce.
 */
function extractHttpStatus(err: unknown): number | undefined {
  if (err == null || typeof err !== "object") return undefined;
  const obj = err as Record<string, unknown>;

  // Most Buffer SDK errors expose `.status` or `.statusCode`
  if (typeof obj.status === "number") return obj.status;
  if (typeof obj.statusCode === "number") return obj.statusCode;

  // Some wrappers nest it under `.response`
  const resp = obj.response;
  if (resp != null && typeof resp === "object") {
    const r = resp as Record<string, unknown>;
    if (typeof r.status === "number") return r.status;
    if (typeof r.statusCode === "number") return r.statusCode;
  }

  return undefined;
}

/** Pull the message string out of any error-like value. */
function extractMessage(err: unknown): string {
  if (err == null) return "Unknown error (null/undefined thrown)";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    // Buffer API sometimes surfaces the error text in `.error` or `.body`
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.body === "string") return obj.body;
    // Nested Buffer response body
    const resp = obj.response;
    if (resp != null && typeof resp === "object") {
      const r = resp as Record<string, unknown>;
      if (typeof r.data === "string") return r.data;
    }
  }
  try {
    return String(err);
  } catch {
    return "Unknown error (unstringifiable value thrown)";
  }
}

/** Checks whether the error name or constructor name matches known timeout classes. */
function isTimeoutError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const obj = err as Record<string, unknown>;
  const name =
    typeof obj.name === "string" ? obj.name.toLowerCase() : "";
  const code =
    typeof obj.code === "string" ? obj.code.toUpperCase() : "";

  if (name === "aborterror" || name === "timeouterror") return true;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ECONNABORTED")
    return true;
  return false;
}

/** True when the error looks like it came from Supabase (postgrest / storage). */
function isSupabaseError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const obj = err as Record<string, unknown>;
  // Supabase PostgREST errors include a `hint` or `details` field,
  // or carry `code` as a Postgres error code string (e.g. "23505").
  if (typeof obj.hint === "string" || typeof obj.details === "string")
    return true;
  // @supabase/supabase-js errors have `.name === "PostgrestError"`
  if (typeof obj.name === "string" && obj.name.toLowerCase().includes("postgrest"))
    return true;
  return false;
}

/**
 * Exponential backoff for PROVIDER_ERROR.
 * delay = min(300 * 2^(attempt-1), 3600) seconds.
 */
function providerBackoff(attemptCount: number): number {
  // attemptCount is 1-based (i.e. 1 on the first failure)
  const attempt = Math.max(1, attemptCount);
  return Math.min(300 * Math.pow(2, attempt - 1), 3600);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify any thrown value into a structured {@link ErrorClassification}.
 *
 * This function must never throw — it always returns a valid classification.
 *
 * @param err          The caught value (any shape)
 * @param attemptCount 1-based attempt number (used for backoff calculations)
 */
export function classifyError(
  err: unknown,
  attemptCount: number
): ErrorClassification {
  try {
    return _classify(err, attemptCount);
  } catch {
    // Absolute last resort — should never happen, but guards against bugs in
    // the classifier itself.
    return {
      code: "UNKNOWN",
      retryable: true,
      nextAttemptDelay: 300,
      message: "Classification failed; treating as unknown retryable error.",
      permanent: false,
    };
  }
}

function _classify(err: unknown, attemptCount: number): ErrorClassification {
  const message = extractMessage(err);
  const lowerMsg = message.toLowerCase();
  const httpStatus = extractHttpStatus(err);

  // ── 1. CONFIG_MISSING ────────────────────────────────────────────────────
  if (
    lowerMsg.includes("env") ||
    lowerMsg.includes("environment variable") ||
    lowerMsg.includes("is not set") ||
    lowerMsg.includes("missing env") ||
    lowerMsg.includes("config_missing")
  ) {
    return {
      code: "CONFIG_MISSING",
      retryable: false,
      nextAttemptDelay: 0,
      message: `Configuration error (operator action required): ${message}`,
      permanent: true,
    };
  }

  // ── 2. AUTH_FAILED ───────────────────────────────────────────────────────
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    lowerMsg.includes("unauthorized") ||
    lowerMsg.includes("forbidden") ||
    lowerMsg.includes("invalid token") ||
    lowerMsg.includes("auth_failed")
  ) {
    return {
      code: "AUTH_FAILED",
      retryable: false,
      nextAttemptDelay: 0,
      message: `Authentication failed (HTTP ${httpStatus ?? "n/a"}): ${message}`,
      permanent: true,
    };
  }

  // ── 3. DUPLICATE_POST ───────────────────────────────────────────────────
  // Buffer returns this human-readable string when a duplicate is detected.
  if (
    lowerMsg.includes("already got this one scheduled") ||
    lowerMsg.includes("duplicate") ||
    lowerMsg.includes("already scheduled") ||
    lowerMsg.includes("duplicate_post")
  ) {
    return {
      code: "DUPLICATE_POST",
      retryable: false,
      nextAttemptDelay: 0,
      // Not an error in the business sense — caller should mark as success.
      message: `Duplicate post detected (treat as success): ${message}`,
      permanent: false,
    };
  }

  // ── 4. CHANNEL_INVALID ──────────────────────────────────────────────────
  if (
    lowerMsg.includes("channel") ||
    lowerMsg.includes("profile not found") ||
    lowerMsg.includes("profile_not_found") ||
    lowerMsg.includes("disconnected") ||
    lowerMsg.includes("channel_invalid") ||
    lowerMsg.includes("invalid profile") ||
    lowerMsg.includes("profile id")
  ) {
    return {
      code: "CHANNEL_INVALID",
      retryable: false,
      nextAttemptDelay: 0,
      message: `Buffer channel invalid or disconnected: ${message}`,
      permanent: true,
    };
  }

  // ── 5. CONTENT_INVALID ──────────────────────────────────────────────────
  if (
    lowerMsg.includes("too long") ||
    lowerMsg.includes("character limit") ||
    lowerMsg.includes("content_invalid") ||
    lowerMsg.includes("validation") ||
    lowerMsg.includes("invalid content") ||
    lowerMsg.includes("text is too long") ||
    (httpStatus === 422)
  ) {
    return {
      code: "CONTENT_INVALID",
      retryable: false,
      nextAttemptDelay: 0,
      message: `Post content invalid or rejected: ${message}`,
      permanent: true,
    };
  }

  // ── 6. RATE_LIMITED ─────────────────────────────────────────────────────
  if (
    httpStatus === 429 ||
    lowerMsg.includes("rate limit") ||
    lowerMsg.includes("rate_limit") ||
    lowerMsg.includes("too many requests")
  ) {
    return {
      code: "RATE_LIMITED",
      retryable: true,
      nextAttemptDelay: 3600,
      message: `Buffer rate limit hit; retry in 1 hour: ${message}`,
      permanent: false,
    };
  }

  // ── 7. PROVIDER_ERROR ───────────────────────────────────────────────────
  if (
    (httpStatus != null && httpStatus >= 500 && httpStatus <= 599) ||
    lowerMsg.includes("provider_error") ||
    lowerMsg.includes("server error") ||
    lowerMsg.includes("internal server error") ||
    lowerMsg.includes("bad gateway") ||
    lowerMsg.includes("service unavailable")
  ) {
    const delay = providerBackoff(attemptCount);
    return {
      code: "PROVIDER_ERROR",
      retryable: true,
      nextAttemptDelay: delay,
      message: `Buffer server error (HTTP ${httpStatus ?? "n/a"}); retry in ${delay}s: ${message}`,
      permanent: false,
    };
  }

  // ── 8. NETWORK_TIMEOUT ──────────────────────────────────────────────────
  if (
    isTimeoutError(err) ||
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("timed out") ||
    lowerMsg.includes("network_timeout") ||
    lowerMsg.includes("econnreset") ||
    lowerMsg.includes("fetch failed")
  ) {
    return {
      code: "NETWORK_TIMEOUT",
      retryable: true,
      nextAttemptDelay: 300,
      message: `Network timeout or connection error; retry in 5 min: ${message}`,
      permanent: false,
    };
  }

  // ── 9. DATABASE_ERROR ───────────────────────────────────────────────────
  if (
    isSupabaseError(err) ||
    lowerMsg.includes("supabase") ||
    lowerMsg.includes("database_error") ||
    lowerMsg.includes("mark_posted") ||
    lowerMsg.includes("mark_failed") ||
    lowerMsg.includes("postgrest") ||
    lowerMsg.includes("relation") ||
    lowerMsg.includes("violates")
  ) {
    return {
      code: "DATABASE_ERROR",
      retryable: true,
      nextAttemptDelay: 60,
      message: `Database error during state update; retry in 60s: ${message}`,
      permanent: false,
    };
  }

  // ── 10. CONTENT_GENERATION_FAILED ───────────────────────────────────────
  if (
    lowerMsg.includes("no content") ||
    lowerMsg.includes("content_generation_failed") ||
    lowerMsg.includes("generation failed") ||
    lowerMsg.includes("empty content") ||
    lowerMsg.includes("returned no content") ||
    lowerMsg.includes("mode returned")
  ) {
    return {
      code: "CONTENT_GENERATION_FAILED",
      retryable: true,
      nextAttemptDelay: 900,
      message: `Content generation produced no output; retry in 15 min: ${message}`,
      permanent: false,
    };
  }

  // ── 11. UNKNOWN (catch-all) ──────────────────────────────────────────────
  return {
    code: "UNKNOWN",
    retryable: true,
    nextAttemptDelay: 300,
    message: `Unclassified error; retry in 5 min: ${message}`,
    permanent: false,
  };
}

/**
 * Compute the absolute time for the next retry attempt.
 *
 * @returns `null` when the error is not retryable; otherwise `now + delay`.
 */
export function computeNextAttemptAt(
  classification: ErrorClassification
): Date | null {
  if (!classification.retryable || classification.nextAttemptDelay === 0) {
    return null;
  }
  return new Date(Date.now() + classification.nextAttemptDelay * 1_000);
}
