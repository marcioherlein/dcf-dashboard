'use client'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  historicalCagr3y?: number | null   // decimal e.g. 0.062
  analystEstimate1y?: number | null  // decimal
  epsGrowthFwd?: number | null       // decimal, from analystForwardEstimates['+1y'].eps.growth
  drivers?: string[]
}

type Rating = 'A+' | 'A' | 'B+' | 'B' | 'C'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeRating(rev: number | null, eps: number | null): Rating {
  if (rev == null && eps == null) return 'C'
  const valid = [rev, eps].filter((v): v is number => v != null)
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  const bothAbove = (threshold: number) =>
    rev != null && eps != null && rev > threshold && eps > threshold
  if (bothAbove(0.15)) return 'A+'
  if (bothAbove(0.10)) return 'A'
  if (avg > 0.08) return 'B+'
  if (avg > 0.05) return 'B'
  return 'C'
}

function ratingBadgeClass(rating: Rating): string {
  if (rating === 'A+' || rating === 'A') {
    return 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]'
  }
  if (rating === 'B+' || rating === 'B') {
    return 'bg-[#EEF2FA] text-[#5F790B] border border-[#C9DC8E]'
  }
  // C — amber
  return 'bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391]'
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

/** Bar width as a percentage: clamped 0–100, scaled so 33% growth = full bar. */
function barWidth(v: number | null | undefined): number {
  if (v == null || v <= 0) return 0
  return Math.min(100, v * 300)
}

function computeVerdict(
  rev: number | null,
  eps: number | null,
  drivers?: string[],
): string {
  if (drivers && drivers.length > 0 && typeof drivers[0] === 'string' && drivers[0].trim()) {
    const first = drivers[0].trim()
    return first.endsWith('.') ? first : first + '.'
  }
  if (rev == null && eps == null) return 'Growth expectations are moderate.'
  const valid = [rev, eps].filter((v): v is number => v != null)
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length
  const both = rev != null && eps != null
  if (both && rev! > 0.10 && eps! > 0.10) {
    return 'Strong growth outlook with double-digit expansion.'
  }
  if (avg > 0.05) return 'Solid growth outlook.'
  return 'Growth expectations are moderate.'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MetricRowProps {
  label: string
  value: number | null | undefined
}

function MetricRow({ label, value }: MetricRowProps) {
  const width = barWidth(value)
  const hasValue = value != null && value > 0

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-[#566174] leading-snug">{label}</span>
        <span
          className={cn(
            'text-[13px] font-[700] tabular-nums shrink-0',
            hasValue ? 'text-[#111111]' : 'text-[#9B9B9B]',
          )}
        >
          {fmtPct(value)}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-[6px] bg-[#E5E5E5] rounded-full overflow-hidden"
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(width)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            hasValue ? 'bg-[#5F790B]' : 'bg-transparent',
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GrowthOutlookCard({
  historicalCagr3y,
  analystEstimate1y,
  epsGrowthFwd,
  drivers,
}: Props) {
  // Resolve the two display values
  const revGrowth = historicalCagr3y ?? null
  const epsGrowth = epsGrowthFwd ?? analystEstimate1y ?? null

  const rating = computeRating(revGrowth, epsGrowth)
  const verdict = computeVerdict(revGrowth, epsGrowth, drivers)

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 flex flex-col gap-3 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-[700] text-[#111111] leading-tight">
          Growth Outlook
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[11px] font-[600] border leading-none',
            ratingBadgeClass(rating),
          )}
        >
          {rating}
        </span>
      </div>

      {/* Metric rows */}
      <div className="flex flex-col gap-3">
        <MetricRow
          label="Revenue CAGR (3Y Historical)"
          value={revGrowth}
        />
        <MetricRow
          label="EPS Growth (Next 3Y CAGR)"
          value={epsGrowth}
        />
      </div>

      {/* Footer / Verdict */}
      <div className="pt-1 border-t border-[#E3E1DA] flex flex-col gap-1">
        <p className="text-[12px] text-[#566174] leading-snug">{verdict}</p>
      </div>
    </div>
  )
}
