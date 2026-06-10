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
    // quota exceeded or SSR
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load the full watchlist.
 * Logged-in: Supabase only (cross-device consistent).
 * Anonymous: localStorage only.
 */
export async function loadWatchlist(userEmail?: string | null): Promise<WatchlistEntry[]> {
  const client = getClient()

  // Logged-in user — Supabase is the only source of truth
  if (client && userEmail) {
    try {
      const { data, error } = await client
        .from('simplifier_watchlist')
        .select('*')
        .eq('user_id', userEmail)
        .order('updated_at', { ascending: false })

      if (error) return readLocal() // fallback on error only
      return (data ?? []).map(rowToEntry)
    } catch {
      return readLocal()
    }
  }

  // Anonymous user — localStorage only
  return readLocal()
}

/**
 * Save or update a watchlist entry.
 * Logged-in: Supabase only.
 * Anonymous: localStorage only.
 */
export async function saveWatchlistEntry(
  entry: WatchlistEntry,
  userEmail?: string | null,
): Promise<void> {
  const client = getClient()

  if (client && userEmail) {
    // Logged-in: write only to Supabase
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
        list_tag: entry.listTag ?? null,
        group_name: entry.groupName ?? null,
      },
      { onConflict: 'user_id,ticker' },
    )
    return
  }

  // Anonymous: localStorage only
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
  const client = getClient()

  if (client && userEmail) {
    await client
      .from('simplifier_watchlist')
      .delete()
      .eq('user_id', userEmail)
      .eq('ticker', ticker)
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
  const client = getClient()

  if (client && userEmail) {
    await client
      .from('simplifier_watchlist')
      .update({ list_tag: listTag })
      .eq('user_id', userEmail)
      .eq('ticker', ticker)
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
  const client = getClient()

  if (client && userEmail) {
    await client
      .from('simplifier_watchlist')
      .update({ group_name: groupName })
      .eq('user_id', userEmail)
      .eq('ticker', ticker)
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
