/**
 * Display formatting utilities for the modelling workspace.
 * Null is shown as "—", never as "0" or "$0".
 */

/** Formats a number in millions (e.g. 1200 → "$1.2B", 500 → "$500M") */
export function fmtM(value: number | null, prefix = '$'): string {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '(' : ''
  const end = value < 0 ? ')' : ''
  if (abs >= 1000) {
    return `${sign}${prefix}${(abs / 1000).toFixed(1)}B${end}`
  }
  return `${sign}${prefix}${abs.toFixed(0)}M${end}`
}

/** Formats a dollar value per share */
export function fmtPrice(value: number | null, prefix = '$'): string {
  if (value == null) return '—'
  return `${prefix}${value.toFixed(2)}`
}

/** Formats a percentage (0.15 → "+15.0%") */
export function fmtPct(value: number | null, showSign = false): string {
  if (value == null) return '—'
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(1)}%`
}

/** Formats a multiplier (15 → "15.0x") */
export function fmtMultiple(value: number | null): string {
  if (value == null) return '—'
  if (value < 0) return 'N/M'
  return `${value.toFixed(1)}x`
}

/** Formats a YoY growth label above a bar or cell */
export function fmtGrowth(current: number | null, prior: number | null): string {
  if (current == null || prior == null || prior === 0) return '—'
  const g = (current - prior) / Math.abs(prior)
  const sign = g >= 0 ? '+' : ''
  return `${sign}${(g * 100).toFixed(1)}%`
}

/** Returns "—" for null, otherwise calls formatter. Useful for table cells. */
export function fmtOrDash<T>(value: T | null, format: (v: T) => string): string {
  if (value == null) return '—'
  return format(value)
}
