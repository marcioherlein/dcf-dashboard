'use client'

import { fmtPrice } from '@/lib/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  onViewValuation: () => void
  fairValue?: number | null
  upsidePct?: number | null
  currency?: string
  verdict?: 'Undervalued' | 'Fairly Valued' | 'Overvalued' | 'Insufficient Data' | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verdictChipClass(verdict: NonNullable<Props['verdict']>): string {
  switch (verdict) {
    case 'Undervalued':
      return 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]'
    case 'Fairly Valued':
      return 'bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391]'
    case 'Overvalued':
      return 'bg-[#FCEAEA] text-[#D83B3B] border border-[#F0B8B8]'
    default:
      return ''
  }
}

function upsideChipClass(pct: number): string {
  return pct >= 0
    ? 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]'
    : 'bg-[#FCEAEA] text-[#D83B3B] border border-[#F0B8B8]'
}

function formatUpside(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function verdictLabel(verdict: NonNullable<Props['verdict']>): string {
  switch (verdict) {
    case 'Undervalued':
      return '▲ Undervalued'
    case 'Fairly Valued':
      return '● Fairly Valued'
    case 'Overvalued':
      return '▼ Overvalued'
    default:
      return verdict
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SeeValuationCTA({
  onViewValuation,
  fairValue,
  upsidePct,
  currency = 'USD',
  verdict,
}: Props) {
  const hasFairValue = fairValue != null
  const hasUpside = upsidePct != null
  const showVerdict = verdict != null && verdict !== 'Insufficient Data'

  return (
    <div className="relative w-full bg-[#E8F7EF] border border-[#A3D9BE] rounded-xl transition-colors hover:bg-[#d4f0e3]">
      {/* Full-card interactive button — single focusable element for the whole card */}
      <button
        type="button"
        aria-label="View full valuation analysis"
        onClick={onViewValuation}
        className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-2 cursor-pointer"
      />

      {/* Card content (pointer-events-none so clicks fall through to the button above) */}
      <div className="relative pointer-events-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4">
        {/* Left: title + fair value info */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="font-bold text-[#111111] text-sm leading-snug">
            See full valuation analysis{' '}
            <span aria-hidden="true">→</span>
          </span>

          {(hasFairValue || showVerdict) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {hasFairValue && (
                <span className="text-xs text-[#6B6B6B]">
                  Fair value estimate:{' '}
                  <span className="font-semibold">
                    {fmtPrice(fairValue as number, currency)}
                  </span>
                </span>
              )}

              {hasUpside && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${upsideChipClass(upsidePct as number)}`}
                >
                  {formatUpside(upsidePct as number)}
                </span>
              )}

              {showVerdict && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${verdictChipClass(verdict as NonNullable<Props['verdict']>)}`}
                >
                  {verdictLabel(verdict as NonNullable<Props['verdict']>)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: visible button affordance (non-interactive — card button handles clicks) */}
        <span className="shrink-0 w-full sm:w-auto rounded-lg bg-[#5F790B] text-white text-sm font-semibold px-4 py-2 text-center">
          View Valuation
        </span>
      </div>
    </div>
  )
}
