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
      return 'bg-[#ECFDF3] text-[#047857] border border-[#BBF7D0]'
    case 'Fairly Valued':
      return 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
    case 'Overvalued':
      return 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
    default:
      return ''
  }
}

function upsideChipClass(pct: number): string {
  return pct >= 0
    ? 'bg-[#ECFDF3] text-[#047857] border border-[#BBF7D0]'
    : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
}

function formatUpside(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
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
    <div
      role="button"
      tabIndex={0}
      onClick={onViewValuation}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onViewValuation()
      }}
      className="w-full flex items-center justify-between gap-4 bg-[#F6FAEA] border border-[#BFD2A1] rounded-xl p-4 cursor-pointer hover:bg-[#EEF4DD] transition-colors"
    >
      {/* Left: title + fair value info */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="font-bold text-[#2D3A1E] text-sm leading-snug">
          See full valuation analysis →
        </span>

        {(hasFairValue || showVerdict) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {hasFairValue && (
              <span className="text-xs text-[#4A5A2E]">
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
                {verdict}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onViewValuation()
        }}
        className="shrink-0 rounded-lg bg-[#5F790B] hover:bg-[#4E6509] active:bg-[#3D4F07] text-white text-sm font-semibold px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-2"
      >
        View Valuation
      </button>
    </div>
  )
}
