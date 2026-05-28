import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { ETFEntry } from './etfTypes'

const LOCAL_KEY = 'etf_watchlist'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url === '' || key === '') return null
  if (!_client) _client = createClient(url, key)
  return _client
}

function readLocal(): ETFEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as ETFEntry[]) : []
  } catch {
    return []
  }
}

function writeLocal(entries: ETFEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries))
  } catch {
    // quota exceeded or SSR — silent fail
  }
}

export async function loadETFWatchlist(userEmail?: string | null): Promise<ETFEntry[]> {
  const local = readLocal()
  const client = getClient()

  if (!client || !userEmail) return local

  try {
    const { data, error } = await client
      .from('etf_watchlist')
      .select('*')
      .eq('user_id', userEmail)
      .order('added_at', { ascending: false })

    if (error) return local

    const remoteMap = new Map<string, ETFEntry>()
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

export async function saveETFEntry(entry: ETFEntry, userEmail?: string | null): Promise<void> {
  const local = readLocal()
  const idx = local.findIndex((e) => e.ticker === entry.ticker)
  if (idx >= 0) local[idx] = entry
  else local.unshift(entry)
  writeLocal(local)

  const client = getClient()
  if (!client || !userEmail) return

  try {
    await client.from('etf_watchlist').upsert(
      {
        user_id: userEmail,
        ticker: entry.ticker,
        name: entry.name ?? null,
        value_score: entry.valueScore ?? null,
        expense_ratio: entry.expenseRatio ?? null,
        yield: entry.yield ?? null,
        pe_ratio: entry.peRatio ?? null,
        pb_ratio: entry.pbRatio ?? null,
        total_assets: entry.totalAssets ?? null,
      },
      { onConflict: 'user_id,ticker' },
    )
  } catch {
    // silent — data is safe in localStorage
  }
}

export async function deleteETFEntry(ticker: string, userEmail?: string | null): Promise<void> {
  const local = readLocal().filter((e) => e.ticker !== ticker)
  writeLocal(local)

  const client = getClient()
  if (!client || !userEmail) return

  try {
    await client
      .from('etf_watchlist')
      .delete()
      .eq('user_id', userEmail)
      .eq('ticker', ticker)
  } catch {
    // silent
  }
}

export function getETFEntry(ticker: string): ETFEntry | null {
  return readLocal().find((e) => e.ticker === ticker) ?? null
}

function rowToEntry(row: Record<string, unknown>): ETFEntry {
  return {
    ticker: row.ticker as string,
    name: (row.name as string | null) ?? null,
    valueScore: (row.value_score as number | null) ?? null,
    expenseRatio: (row.expense_ratio as number | null) ?? null,
    yield: (row.yield as number | null) ?? null,
    peRatio: (row.pe_ratio as number | null) ?? null,
    pbRatio: (row.pb_ratio as number | null) ?? null,
    totalAssets: (row.total_assets as number | null) ?? null,
    addedAt: (row.added_at as string) ?? new Date().toISOString(),
  }
}
