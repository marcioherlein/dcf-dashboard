import type { WatchlistEntry } from './types'

const LOCAL_KEY = 'simplifier_watchlist'

// ── localStorage helpers (anonymous users only) ───────────────────────────────

function readLocal(): WatchlistEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as WatchlistEntry[]) : []
  } catch {
    return []
  }
}

function writeLocal(entries: WatchlistEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries))
  } catch {
    // quota exceeded
  }
}

export function clearLocalWatchlist(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(LOCAL_KEY) } catch {}
}

// ── API helpers (authenticated users — always server-side DB) ─────────────────

async function apiFetch(method: string, body?: unknown, params?: Record<string, string>): Promise<Response> {
  const url = new URL('/api/simplifier/watchlist', window.location.origin)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load the full watchlist.
 * Logged-in: server API → Supabase (cross-device consistent, service-role key).
 * Anonymous: localStorage only.
 */
export async function loadWatchlist(userEmail?: string | null): Promise<WatchlistEntry[]> {
  if (userEmail) {
    try {
      const res = await apiFetch('GET')
      if (!res.ok) return readLocal()
      const data = await res.json() as Record<string, unknown>[]
      return data.map(rowToEntry)
    } catch {
      return readLocal()
    }
  }
  return readLocal()
}

/**
 * Save or update a watchlist entry.
 * Logged-in: server API → Supabase.
 * Anonymous: localStorage only.
 */
export async function saveWatchlistEntry(
  entry: WatchlistEntry,
  userEmail?: string | null,
): Promise<void> {
  if (userEmail) {
    await apiFetch('POST', { entry: {
      ticker:       entry.ticker,
      companyName:  entry.companyName,
      updatedAt:    entry.updatedAt,
      currentPhase: entry.currentPhase,
      answers:      entry.answers,
      notes:        entry.notes,
      phaseScores:  entry.phaseScores,
      overallScore: entry.overallScore,
      snapshot:     entry.snapshot,
      listTag:      entry.listTag ?? null,
      groupName:    entry.groupName ?? null,
    } })
    return
  }
  const local = readLocal()
  const idx = local.findIndex((e) => e.ticker === entry.ticker)
  if (idx >= 0) local[idx] = entry
  else local.unshift(entry)
  writeLocal(local)
}

/**
 * Delete a watchlist entry by ticker.
 */
export async function deleteWatchlistEntry(
  ticker: string,
  userEmail?: string | null,
): Promise<void> {
  if (userEmail) {
    await apiFetch('DELETE', undefined, { ticker })
    return
  }
  writeLocal(readLocal().filter((e) => e.ticker !== ticker))
}

/**
 * Get a single entry from localStorage (used for anonymous pre-fill only).
 */
export function getWatchlistEntry(ticker: string): WatchlistEntry | null {
  return readLocal().find((e) => e.ticker === ticker) ?? null
}

/**
 * Update only the listTag for an entry.
 */
export async function updateListTag(
  ticker: string,
  listTag: WatchlistEntry['listTag'],
  userEmail?: string | null,
): Promise<void> {
  if (userEmail) {
    await apiFetch('PATCH', { ticker, listTag })
    return
  }
  const local = readLocal()
  const idx = local.findIndex((e) => e.ticker === ticker)
  if (idx >= 0) { local[idx] = { ...local[idx], listTag }; writeLocal(local) }
}

/**
 * Update only the groupName for an entry.
 */
export async function updateGroupName(
  ticker: string,
  groupName: string | null,
  userEmail?: string | null,
): Promise<void> {
  if (userEmail) {
    await apiFetch('PATCH', { ticker, groupName: groupName ?? null })
    return
  }
  const local = readLocal()
  const idx = local.findIndex((e) => e.ticker === ticker)
  if (idx >= 0) { local[idx] = { ...local[idx], groupName: groupName ?? undefined }; writeLocal(local) }
}

// ── Shape conversion ──────────────────────────────────────────────────────────

function rowToEntry(row: Record<string, unknown>): WatchlistEntry {
  return {
    ticker:       row.ticker as string,
    companyName:  (row.company_name as string) ?? '',
    updatedAt:    (row.updated_at as string) ?? new Date().toISOString(),
    currentPhase: (row.current_phase as number) ?? 1,
    answers:      (row.answers as WatchlistEntry['answers']) ?? {},
    notes:        (row.notes as WatchlistEntry['notes']) ?? {},
    phaseScores:  (row.phase_scores as WatchlistEntry['phaseScores']) ?? {},
    overallScore: (row.overall_score as number | null) ?? null,
    listTag:      (row.list_tag as WatchlistEntry['listTag']) ?? null,
    groupName:    (row.group_name as string | null) ?? null,
    snapshot:     (row.financial_snapshot as WatchlistEntry['snapshot']) ?? {
      grossMargin: null, fcfMargin: null, moatScore: null, roic: null,
      cagr3y: null, insiderPct: null, beta: null, upsidePct: null,
      price: null, marketCap: null, fairValue: null,
    },
  }
}
