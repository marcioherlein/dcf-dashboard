'use client'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MultEst {
  multiple: string
  actualValue: number
  sectorMedian: number
  applicable: boolean
  benchmarkSource: string
}

interface Props {
  estimates?: MultEst[]
  pegRatio?: number | null
  peRatio?: number | null
  sector?: string | null
  isLoading?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pegColor(peg: number): string {
  if (peg < 1.5) return 'text-[#11875D]'
  if (peg <= 2.5) return 'text-[#B56A00]'
  return 'text-[#D83B3B]'
}

type BadgeVariant = 'below' | 'above' | 'near'

function getVariant(actual: number, median: number): BadgeVariant {
  if (actual < median * 0.85) return 'below'
  if (actual > median * 1.15) return 'above'
  return 'near'
}

type BadgeLabel = { srOnly: string; visual: string; arrow: string }

const BADGE_STYLES: Record<BadgeVariant, { container: string; label: BadgeLabel }> = {
  below: {
    container: 'bg-[#E8F7EF] text-[#11875D]',
    label: { srOnly: 'Below sector median', visual: 'Below median', arrow: '↓' },
  },
  above: {
    container: 'bg-[#FCEAEA] text-[#D83B3B]',
    label: { srOnly: 'Above sector median', visual: 'Above median', arrow: '↑' },
  },
  near: {
    container: 'bg-[#E5E5E5] text-[#6B6B6B]',
    label: { srOnly: 'Near sector median', visual: 'Near median', arrow: '' },
  },
}

function fmtMultiple(v: number): string {
  return `${v.toFixed(2)}×`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PEGBlock({ peg }: { peg: number | null | undefined }) {
  return (
    <div
      className="flex flex-col gap-0.5"
      aria-label={peg != null ? `PEG Ratio: ${peg.toFixed(2)}` : 'PEG Ratio: Not available'}
    >
      <span className="text-[11px] font-semibold text-[#6B6B6B]">
        PEG ratio
      </span>
      <span
        className={cn(
          'text-[36px] font-[800] leading-none tabular-nums font-mono',
          peg != null ? pegColor(peg) : 'text-[#9B9B9B]',
        )}
        aria-label={peg != null ? `PEG Ratio: ${peg.toFixed(2)}` : 'PEG Ratio: Not available'}
      >
        {peg != null ? peg.toFixed(2) : '—'}
      </span>
      <span className="text-[11px] text-[#6B6B6B] mt-0.5">
        {peg == null
          ? 'Not available'
          : peg < 1.0
          ? 'Growth not fully priced in'
          : peg < 1.5
          ? 'Reasonably priced for growth'
          : peg < 2.5
          ? 'Growth priced at a premium'
          : 'High premium relative to growth'}
      </span>
      <span className="text-[11px] text-[#9B9B9B] mt-0.5">
        Industry median: 1.0 – 2.5 typical range
      </span>
    </div>
  )
}

interface RatioRowProps {
  name: string
  actual: number
  median: number
  isLast: boolean
}

function RatioRow({ name, actual, median, isLast }: RatioRowProps) {
  const variant = getVariant(actual, median)
  const badge = BADGE_STYLES[variant]

  return (
    <div className={cn('py-2.5', !isLast && 'border-b border-[#E5E5E5]')}>
      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        {/* Ratio name */}
        <span
          className="text-[12px] font-[600] text-[#111111] min-w-[64px] w-20 max-w-[80px] shrink-0 truncate"
          title={name}
        >
          {name}
        </span>

        {/* Actual value */}
        <span className="text-[13px] font-[700] text-[#111111] tabular-nums font-mono flex-1 text-center">
          {fmtMultiple(actual)}
        </span>

        {/* Badge */}
        <span
          className={cn(
            'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-[600] shrink-0',
            badge.container,
          )}
        >
          <span className="sr-only">{badge.label.srOnly}</span>
          <span aria-hidden="true">{badge.label.visual}{badge.label.arrow ? ` ${badge.label.arrow}` : ''}</span>
        </span>
      </div>

      {/* Median sub-line */}
      <div className="mt-1 pl-20">
        <span className="text-[11px] text-[#9B9B9B]">
          Sector median: <span className="font-mono">{fmtMultiple(median)}</span>
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationRatiosCard({ estimates, pegRatio, peRatio: _peRatio, sector, isLoading }: Props) {
  const applicable = (estimates ?? []).filter((e) => e.applicable)

  // Derive a display benchmark source from whichever estimate is available first
  const benchmarkSource =
    applicable.length > 0 ? applicable[0].benchmarkSource : null

  if (isLoading) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-col animate-pulse">
        <div className="h-4 w-32 bg-[#E5E5E5] rounded mb-3" />
        <div className="h-10 w-20 bg-[#E5E5E5] rounded mb-1" />
        <div className="h-3 w-40 bg-[#E5E5E5] rounded mb-1" />
        <div className="h-3 w-32 bg-[#E5E5E5] rounded" />
        <div className="my-3 border-t border-[#E5E5E5]" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="py-2.5 flex items-center justify-between gap-2 border-b border-[#E5E5E5] last:border-0">
            <div className="h-3 w-20 bg-[#E5E5E5] rounded" />
            <div className="h-3 w-12 bg-[#E5E5E5] rounded" />
            <div className="h-5 w-24 bg-[#E5E5E5] rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-col">
      {/* Header */}
      <p className="text-[13px] font-[700] text-[#111111] mb-3">
        Valuation Ratios
      </p>

      {/* PEG featured block */}
      <PEGBlock peg={pegRatio} />

      {/* Divider */}
      <div className="my-3 border-t border-[#E5E5E5]" />

      {/* Ratio rows */}
      {applicable.length === 0 ? (
        <div className="flex flex-col gap-2">
          {['P/E', 'EV/EBITDA', 'P/Book', 'P/Sales', 'EV/Revenue'].map((name, i, arr) => (
            <div
              key={name}
              className={cn(
                'py-2.5 flex items-center justify-between',
                i < arr.length - 1 && 'border-b border-[#E5E5E5]',
              )}
            >
              <span className="text-[12px] font-[600] text-[#111111] min-w-[64px] w-20 max-w-[80px] shrink-0 truncate" title={name}>{name}</span>
              <span className="text-[13px] font-[700] text-[#6B6B6B] tabular-nums font-mono flex-1 text-center">—</span>
              <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-[600] bg-[#E5E5E5] text-[#6B6B6B] shrink-0">
                No data
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div>
          {applicable.map((est, i) => (
            <RatioRow
              key={est.multiple}
              name={est.multiple}
              actual={est.actualValue}
              median={est.sectorMedian}
              isLast={i === applicable.length - 1}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      {(benchmarkSource || sector) && (
        <p className="mt-3 text-[11px] text-[#9B9B9B] leading-snug">
          {benchmarkSource ? `(${benchmarkSource})` : null}
          {benchmarkSource && sector ? ' · ' : null}
          {sector ? sector : null}
        </p>
      )}
    </div>
  )
}
