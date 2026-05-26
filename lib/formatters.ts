/**
 * Canonical financial formatters — single source of truth.
 * Import from here everywhere. Do not create local copies.
 */

/** $1,234.56 or BRL 234.56 — respects currency prefix */
export function fmtPrice(v: number | null | undefined, currency = 'USD'): string {
  if (v == null || !isFinite(v)) return '—'
  const prefix = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  if (Math.abs(v) >= 1_000) return prefix + v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return prefix + v.toFixed(2)
}

/** +12.3% / -4.5% */
export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || !isFinite(v)) return '—'
  const sign = v >= 0 ? '+' : ''
  return sign + (v * 100).toFixed(decimals) + '%'
}

/** Unsigned percentage: 12.3% */
export function fmtPctAbs(v: number | null | undefined, decimals = 1): string {
  if (v == null || !isFinite(v)) return '—'
  return (Math.abs(v) * 100).toFixed(decimals) + '%'
}

/** 1.2B / 456M / 12.3K — no currency prefix */
export function fmtLarge(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + (abs / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9)  return sign + (abs / 1e9).toFixed(1)  + 'B'
  if (abs >= 1e6)  return sign + (abs / 1e6).toFixed(0)  + 'M'
  if (abs >= 1e3)  return sign + (abs / 1e3).toFixed(1)  + 'K'
  return sign + abs.toFixed(0)
}

/** $1.2B / $456M — currency + large suffix */
export function fmtLargeCurrency(v: number | null | undefined, currency = 'USD'): string {
  if (v == null || !isFinite(v)) return '—'
  const prefix = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + prefix + (abs / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9)  return sign + prefix + (abs / 1e9).toFixed(1)  + 'B'
  if (abs >= 1e6)  return sign + prefix + (abs / 1e6).toFixed(0)  + 'M'
  if (abs >= 1e3)  return sign + prefix + (abs / 1e3).toFixed(1)  + 'K'
  return sign + prefix + abs.toFixed(0)
}

/** 18.4× — multiple with × suffix, or — */
export function fmtMultiple(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v) || v <= 0 || v > 9999) return '—'
  return v.toFixed(digits) + '×'
}

/** Apr 2024 */
export function fmtMonthYear(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/** Compact number for axis ticks: $12K / $1.2M / $1.2B */
export function fmtAxisTick(v: number, currency = 'USD'): string {
  const prefix = currency === 'USD' ? '$' : ''
  const abs = Math.abs(v)
  if (abs >= 1e9) return prefix + (v / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6) return prefix + (v / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return prefix + (v / 1e3).toFixed(0) + 'K'
  return prefix + v.toFixed(0)
}

/** Upside zone label */
export function upsideZone(pct: number | null): 'Undervalued' | 'Fairly Valued' | 'Overvalued' | null {
  if (pct == null) return null
  if (pct >= 0.20) return 'Undervalued'
  if (pct >= 0.00) return 'Fairly Valued'
  return 'Overvalued'
}

/** Color classes for upside pct */
export function upsideColor(pct: number | null): string {
  if (pct == null) return 'text-slate-400'
  if (pct >= 0.10) return 'text-emerald-600'
  if (pct >= 0)    return 'text-blue-600'
  return 'text-red-600'
}

/** Color classes for zone badge */
export function zoneBadgeClass(zone: 'Undervalued' | 'Fairly Valued' | 'Overvalued' | null): string {
  if (zone === 'Undervalued')   return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (zone === 'Fairly Valued') return 'bg-blue-100 text-blue-700 border-blue-200'
  if (zone === 'Overvalued')    return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-slate-100 text-slate-500 border-slate-200'
}
