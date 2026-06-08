import type { ETFEntry } from './etfTypes'

const LOCAL_KEY = 'etf_watchlist'

let _localCache: ETFEntry[] | null = null

function readLocal(): ETFEntry[] {
  if (typeof window === 'undefined') return []
  if (_localCache !== null) return _localCache
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const parsed = raw ? (JSON.parse(raw) as ETFEntry[]) : []
    _localCache = parsed.map((e) => ({
      ...e,
      price: e.price ?? null,
      priceChangePct: e.priceChangePct ?? null,
      metricsUpdatedAt: e.metricsUpdatedAt ?? null,
    }))
    return _localCache
  } catch {
    return []
  }
}

function writeLocal(entries: ETFEntry[]): void {
  if (typeof window === 'undefined') return
  _localCache = entries
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries))
  } catch { /* quota exceeded — silent */ }
}

export function readLocalWatchlist(): ETFEntry[] {
  return readLocal()
}

export async function loadETFWatchlist(userEmail?: string | null): Promise<ETFEntry[]> {
  const local = readLocal()
  if (!userEmail) return local

  try {
    const res = await fetch('/api/etf/watchlist')
    if (!res.ok) return local
    const rows: Array<Record<string, unknown>> = await res.json()
    if (!Array.isArray(rows)) return local

    const remoteMap = new Map<string, ETFEntry>()
    for (const row of rows) {
      remoteMap.set(row.ticker as string, rowToEntry(row))
    }
    // Merge: remote wins, local fills gaps for anything not yet synced
    for (const entry of local) {
      if (!remoteMap.has(entry.ticker)) remoteMap.set(entry.ticker, entry)
    }
    const merged = Array.from(remoteMap.values())
    writeLocal(merged)
    return merged
  } catch {
    return local
  }
}

export async function saveETFEntry(entry: ETFEntry, userEmail?: string | null): Promise<void> {
  // Always write locally first for instant feedback
  const local = readLocal()
  const idx = local.findIndex((e) => e.ticker === entry.ticker)
  if (idx >= 0) local[idx] = entry
  else local.unshift(entry)
  writeLocal(local)

  if (!userEmail) return

  try {
    await fetch('/api/etf/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: entry.ticker,
        name: entry.name ?? null,
        value_score: entry.valueScore ?? null,
        expense_ratio: entry.expenseRatio ?? null,
        yield: entry.yield ?? null,
        pe_ratio: entry.peRatio ?? null,
        pb_ratio: entry.pbRatio ?? null,
        total_assets: entry.totalAssets ?? null,
      }),
    })
  } catch { /* silent — data safe in localStorage */ }
}

export async function deleteETFEntry(ticker: string, userEmail?: string | null): Promise<void> {
  const local = readLocal().filter((e) => e.ticker !== ticker)
  writeLocal(local)

  if (!userEmail) return

  try {
    await fetch(`/api/etf/watchlist?ticker=${encodeURIComponent(ticker)}`, { method: 'DELETE' })
  } catch { /* silent */ }
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
    price: null,
    priceChangePct: null,
    metricsUpdatedAt: null,
  }
}
