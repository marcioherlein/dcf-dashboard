import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { WatchlistEntry } from './types'

const LOCAL_KEY = 'simplifier_watchlist'

// ── Supabase client (anon key, isomorphic) ────────────────────────────────────

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url === '' || key === '') return null
  if (!_client) _client = createClient(url, key)
  return _client
}

// ── localStorage helpers ──────────────────────────────────────────────────────

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
    // localStorage quota exceeded or SSR — silent fail
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load the full watchlist.
 * Tries Supabase first; merges with any localStorage entries not yet synced.
 */
export async function loadWatchlist(userEmail?: string | null): Promise<WatchlistEntry[]> {
  const local = readLocal()
  const client = getClient()

  if (!client || !userEmail) return local

  try {
    const { data, error } = await client
      .from('simplifier_watchlist')
      .select('*')
      .eq('user_id', userEmail)
      .order('updated_at', { ascending: false })

    if (error) return local

    // Merge: remote wins; any local ticker not yet on remote stays
    const remoteMap = new Map<string, WatchlistEntry>()
    for (const row of data ?? []) {
      remoteMap.set(row.ticker, rowToEntry(row))
    }
    for (const entry of local) {
      if (!remoteMap.has(entry.ticker)) remoteMap.set(entry.ticker, entry)
    }

    return Array.from(remoteMap.values())
  } catch {
    return local
  }
}

/**
 * Save or update a watchlist entry.
 * Always writes localStorage; also syncs to Supabase if available.
 */
export async function saveWatchlistEntry(
  entry: WatchlistEntry,
  userEmail?: string | null,
): Promise<void> {
  // Always persist locally first
  const local = readLocal()
  const idx = local.findIndex((e) => e.ticker === entry.ticker)
  if (idx >= 0) local[idx] = entry
  else local.unshift(entry)
  writeLocal(local)

  const client = getClient()
  if (!client || !userEmail) return

  try {
    await client.from('simplifier_watchlist').upsert(
      {
        user_id: userEmail,
        ticker: entry.ticker,
        company_name: entry.companyName,
        updated_at: entry.updatedAt,
        current_phase: entry.currentPhase,
        answers: entry.answers,
        notes: entry.notes,
        phase_scores: entry.phaseScores,
        overall_score: entry.overallScore,
        financial_snapshot: entry.snapshot,
      },
      { onConflict: 'user_id,ticker' },
    )
  } catch {
    // Silent — data is safe in localStorage
  }
}

/**
 * Delete a watchlist entry by ticker.
 */
export async function deleteWatchlistEntry(
  ticker: string,
  userEmail?: string | null,
): Promise<void> {
  const local = readLocal().filter((e) => e.ticker !== ticker)
  writeLocal(local)

  const client = getClient()
  if (!client || !userEmail) return

  try {
    await client
      .from('simplifier_watchlist')
      .delete()
      .eq('user_id', userEmail)
      .eq('ticker', ticker)
  } catch {
    // Silent
  }
}

/**
 * Get a single entry from localStorage.
 */
export function getWatchlistEntry(ticker: string): WatchlistEntry | null {
  const entries = readLocal()
  return entries.find((e) => e.ticker === ticker) ?? null
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
    snapshot:     (row.financial_snapshot as WatchlistEntry['snapshot']) ?? {
      grossMargin: null, fcfMargin: null, moatScore: null, roic: null,
      cagr3y: null, insiderPct: null, beta: null, upsidePct: null,
      price: null, marketCap: null,
    },
  }
}
