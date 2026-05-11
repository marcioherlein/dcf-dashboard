import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Legacy formatter re-exports (still used by older components) ─────────────
// New code should import directly from lib/formatters.ts

/** Basic number formatter: rounds to `decimals` places */
export function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null || !isFinite(v)) return '—'
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export { fmtPct, fmtLarge } from './formatters'
