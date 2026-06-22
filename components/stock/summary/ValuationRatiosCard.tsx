'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MultEst {
  multiple:         string
  actualValue:      number
  sectorMedian:     number
  applicable:       boolean
  benchmarkSource:  string
  sectorPercentile?: number | null
}

interface RatioQuarter {
  date:                    string
  priceEarningsRatio:      number | null
  enterpriseValueMultiple: number | null
  evToSales:               number | null
  priceToBookRatio:        number | null
}

interface HistoricalMultiple {
  fiscalYear: string
  date?:      string
  pe:         number | null
  evEbitda:   number | null
  evRevenue:  number | null
  ps?:        number | null
}

interface Props {
  estimates?:           MultEst[]
  pegRatio?:            number | null
  peRatio?:             number | null
  sector?:              string | null
  isLoading?:           boolean
  ratiosQuarterly?:     RatioQuarter[]
  historicalMultiples?: HistoricalMultiple[]
  epsGrowthFwd?:        number | null
  analystForwardPE?:    number | null
}

interface SparkPoint { label: string; value: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number | null | undefined, lo: number, hi: number): number | null {
  if (v == null || !isFinite(v) || v <= 0) return null
  return v < lo || v > hi ? null : v
}

function fmtX(v: number): string {
  return v >= 100 ? `${Math.round(v)}×` : v >= 10 ? `${v.toFixed(1)}×` : `${v.toFixed(2)}×`
}

function quarterLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const m = d.getUTCMonth()
  const yr = String(d.getUTCFullYear()).slice(2)
  const q = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4'
  return `${q} '${yr}`
}

function getVariant(actual: number, median: number): 'below' | 'near' | 'above' {
  if (actual < median * 0.85) return 'below'
  if (actual > median * 1.15) return 'above'
  return 'near'
}

const VARIANT_STYLE = {
  below: { badge: 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]', label: 'Below median', arrow: '↓', color: '#11875D' },
  near:  { badge: 'bg-[#F0F1F6] text-[#566174] border-[#E0E2EB]', label: 'Near median',  arrow: '',  color: '#2563EB' },
  above: { badge: 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]', label: 'Above median', arrow: '↑', color: '#D83B3B' },
}

function pegColor(peg: number) {
  if (peg < 1.5) return { text: 'text-[#11875D]', bg: 'bg-[#E8F7EF]', border: 'border-[#A3D9BE]', color: '#11875D' }
  if (peg <= 2.5) return { text: 'text-[#B56A00]', bg: 'bg-[#FFF4DA]', border: 'border-[#F3D391]', color: '#B56A00' }
  return { text: 'text-[#D83B3B]', bg: 'bg-[#FCEAEA]', border: 'border-[#F0B8B8]', color: '#D83B3B' }
}

// Plain-English context for each ratio
const RATIO_CONTEXT: Record<string, string> = {
  'P/E':        'How much you pay per $1 of earnings.',
  'EV/EBITDA':  'Enterprise value relative to operating cash profit.',
  'P/Book':     'Price vs net assets on the balance sheet.',
  'EV/Revenue': 'Enterprise value relative to total revenue.',
  'P/Sales':    'Market cap relative to total revenue.',
  'P/FCF':      'Price relative to free cash flow generated.',
}

// ─── 5Y history range bar ─────────────────────────────────────────────────────
// Shows current value as a dot on the 5Y low-to-high range.

function HistoryRange({ points, actual, color }: { points: SparkPoint[]; actual: number; color: string }) {
  if (points.length < 2) return null
  const vals = points.map(p => p.value)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const range = hi - lo || 1
  const dotPct = Math.max(2, Math.min(98, ((actual - lo) / range) * 100))

  return (
    <div>
      <p className="text-[10px] text-[#9B9B9B] mb-1.5">5Y range</p>
      <div className="relative h-[4px] rounded-full bg-[#ECEEF3]">
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
          style={{ left: `${dotPct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-[#9B9B9B] tabular-nums">
        <span>{fmtX(lo)}</span>
        <span className="font-[600]" style={{ color }}>{fmtX(actual)}</span>
        <span>{fmtX(hi)}</span>
      </div>
    </div>
  )
}

// ─── Vs-sector bar ────────────────────────────────────────────────────────────
// Uses sectorPercentile from API when available (actual peer distribution).
// Falls back to a visual comparison showing current vs median on a simple bar.

function VsSectorBar({ actual, median, sectorPercentile, color }: {
  actual: number; median: number; sectorPercentile?: number | null; color: string
}) {
  // Use API-provided percentile when available — that's from actual peer data
  const pct = sectorPercentile != null
    ? Math.round(sectorPercentile)
    : null

  // Fallback: visual bar showing current vs median (not a percentile claim)
  const ratio = median > 0 ? actual / median : 1
  // Map: at 0.5× median = 20%, at median = 50%, at 2× median = 80%
  const visualPct = Math.max(3, Math.min(97, Math.round(50 + (ratio - 1) * 40)))

  if (pct != null) {
    // We have real peer percentile data
    return (
      <div>
        <p className="text-[10px] text-[#9B9B9B] mb-1.5">vs sector peers</p>
        <div className="relative h-[6px] rounded-full bg-[#ECEEF3]">
          <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: color, opacity: 0.25 }} />
          {/* Median marker at 50% */}
          <div className="absolute top-1/2 -translate-y-1/2 w-px h-3.5 bg-[#9B9B9B] opacity-60" style={{ left: '50%' }} />
          {/* Current value pill */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${Math.max(3, Math.min(97, pct))}%` }}
          >
            <div className="rounded-full px-1 py-0.5 text-[9px] font-[700] text-white whitespace-nowrap shadow-sm" style={{ background: color, fontSize: 9 }}>
              {pct}th
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-[#9B9B9B]">
          <span>Cheapest</span>
          <span>Median</span>
          <span>Most expensive</span>
        </div>
      </div>
    )
  }

  // No peer percentile — show current vs median bar without a percentile claim
  return (
    <div>
      <p className="text-[10px] text-[#9B9B9B] mb-1.5">vs sector median ({fmtX(median)})</p>
      <div className="relative h-[6px] rounded-full bg-[#ECEEF3]">
        <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${visualPct}%`, background: color, opacity: 0.25 }} />
        {/* Median marker at 50% */}
        <div className="absolute top-1/2 -translate-y-1/2 w-px h-3.5 bg-[#9B9B9B] opacity-60" style={{ left: '50%' }} />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm"
          style={{ left: `${visualPct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-[#9B9B9B]">
        <span>0.5× median</span>
        <span>Median</span>
        <span>2× median</span>
      </div>
    </div>
  )
}

// ─── Single ratio card ────────────────────────────────────────────────────────

function RatioCard({ name, actual, median, sectorPercentile, chartPoints }: {
  name: string
  actual: number
  median: number
  sectorPercentile?: number | null
  chartPoints: SparkPoint[]
}) {
  const variant = getVariant(actual, median)
  const style = VARIANT_STYLE[variant]
  const context = RATIO_CONTEXT[name] ?? ''

  return (
    <div
      className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex flex-col gap-3"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] font-[700] text-[#6B6B6B] uppercase tracking-wider">{name}</span>
          {context && <p className="text-[10px] text-[#9B9B9B] mt-0.5 leading-tight">{context}</p>}
        </div>
        <span className={cn('text-[9px] font-[700] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0', style.badge)}>
          {style.label}{style.arrow ? ` ${style.arrow}` : ''}
        </span>
      </div>

      {/* Current value + sector median */}
      <div>
        <span className="text-[30px] font-[800] tabular-nums leading-none tracking-tight" style={{ color: style.color }}>
          {fmtX(actual)}
        </span>
        <p className="text-[11px] text-[#9B9B9B] mt-1">
          Sector median <span className="font-[600] text-[#566174]">{fmtX(median)}</span>
        </p>
      </div>

      {/* Vs-sector bar */}
      <VsSectorBar
        actual={actual}
        median={median}
        sectorPercentile={sectorPercentile}
        color={style.color}
      />

      {/* 5Y range — only when we have history */}
      {chartPoints.length >= 2 && (
        <div className="pt-2.5 border-t border-[#F0F0F0]">
          <HistoryRange points={chartPoints} actual={actual} color={style.color} />
        </div>
      )}
    </div>
  )
}

// ─── PEG hero ─────────────────────────────────────────────────────────────────

function PEGHero({ peg, peRatioTTM, epsGrowthFwd, analystForwardPE }: {
  peg: number | null | undefined
  peRatioTTM: number | null | undefined
  epsGrowthFwd: number | null | undefined
  analystForwardPE: number | null | undefined
}) {
  const [open, setOpen] = useState(false)

  const peUsed = analystForwardPE ?? peRatioTTM ?? null
  const peLabel = analystForwardPE != null ? 'Fwd P/E' : 'P/E (TTM)'
  const growthPct = epsGrowthFwd != null ? epsGrowthFwd * 100 : null
  const derivedPeg = peUsed != null && growthPct != null && growthPct > 0 ? peUsed / growthPct : null
  const displayPeg = peg ?? derivedPeg

  if (displayPeg == null) return null

  const c = pegColor(displayPeg)

  const verdict =
    displayPeg < 1.0 ? { label: 'Undervalued vs growth', sub: 'Growth is not fully priced in at today\'s P/E.' }
    : displayPeg < 1.5 ? { label: 'Fairly valued', sub: 'Price is reasonable relative to expected earnings growth.' }
    : displayPeg < 2.5 ? { label: 'Growth premium', sub: 'You\'re paying a premium for expected growth.' }
    : { label: 'Expensive vs growth', sub: 'High valuation relative to the earnings growth rate.' }

  return (
    <div className={cn('rounded-xl border p-4 mb-4', c.bg, c.border)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-[700] uppercase tracking-wider text-[#6B6B6B] mb-1">PEG Ratio</p>
          <div className={cn('text-[42px] font-[800] tabular-nums leading-none tracking-tight', c.text)}>
            {displayPeg.toFixed(2)}
          </div>
          <p className="text-[12px] font-[500] mt-1.5 leading-snug" style={{ color: c.color }}>
            {verdict.label}
          </p>
          <p className="text-[11px] text-[#6B6B6B] mt-0.5 leading-snug">{verdict.sub}</p>
        </div>

        {/* Scale indicator */}
        <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
          {[
            { range: '< 1', label: 'Cheap', active: displayPeg < 1 },
            { range: '1–1.5', label: 'Fair', active: displayPeg >= 1 && displayPeg < 1.5 },
            { range: '1.5–2.5', label: 'Premium', active: displayPeg >= 1.5 && displayPeg < 2.5 },
            { range: '> 2.5', label: 'Expensive', active: displayPeg >= 2.5 },
          ].map(row => (
            <div key={row.range} className="flex items-center gap-2 w-[100px]">
              <div
                className={cn('w-2 h-2 rounded-full shrink-0', row.active ? '' : 'opacity-20')}
                style={{ background: row.active ? c.color : '#9B9B9B' }}
              />
              <span className={cn('text-[9px] tabular-nums', row.active ? 'font-[700]' : 'text-[#9B9B9B]')}
                style={{ color: row.active ? c.color : undefined }}>
                {row.range}
              </span>
              <span className={cn('text-[9px]', row.active ? 'font-[600]' : 'text-[#9B9B9B]')}
                style={{ color: row.active ? c.color : undefined }}>
                {row.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* How it's calculated — inline expandable */}
      {(peUsed != null || growthPct != null) && (
        <>
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1 text-[11px] font-[600] text-[#566174] hover:text-[#111111] mt-3 transition-colors"
          >
            <span className={cn('transition-transform text-[9px] inline-block', open && 'rotate-90')}>▶</span>
            How it&apos;s calculated
          </button>
          {open && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <div className="flex flex-col items-center rounded-lg bg-white/80 border border-white px-3 py-1.5 min-w-[52px]">
                <span className="text-[13px] font-[700] tabular-nums">{peUsed != null ? peUsed.toFixed(1) + '×' : '—'}</span>
                <span className="text-[9px] text-[#9B9B9B] mt-0.5">{peLabel}</span>
              </div>
              <span className="text-[14px] text-[#9B9B9B]">÷</span>
              <div className="flex flex-col items-center rounded-lg bg-white/80 border border-white px-3 py-1.5 min-w-[52px]">
                <span className="text-[13px] font-[700] tabular-nums">{growthPct != null ? growthPct.toFixed(1) + '%' : '—'}</span>
                <span className="text-[9px] text-[#9B9B9B] mt-0.5">EPS growth</span>
              </div>
              <span className="text-[14px] text-[#9B9B9B]">=</span>
              <div className={cn('flex flex-col items-center rounded-lg px-3 py-1.5 min-w-[52px] border', c.bg, c.border)}>
                <span className={cn('text-[13px] font-[700] tabular-nums', c.text)}>{displayPeg.toFixed(2)}</span>
                <span className="text-[9px] text-[#9B9B9B] mt-0.5">PEG</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationRatiosCard({
  estimates, pegRatio, peRatio, sector, isLoading,
  ratiosQuarterly, historicalMultiples, epsGrowthFwd, analystForwardPE,
}: Props) {
  const applicable = (estimates ?? []).filter((e) => e.applicable)
  const benchmarkSource = applicable.length > 0 ? applicable[0].benchmarkSource : null

  const chartSeries = useMemo(() => {
    const rq = (ratiosQuarterly ?? []).slice().reverse()
    const build = (getter: (r: RatioQuarter) => number | null | undefined, lo: number, hi: number): SparkPoint[] =>
      rq
        .map(r => ({ label: quarterLabel(r.date), v: clamp(getter(r), lo, hi) }))
        .filter((p): p is { label: string; v: number } => p.v != null)
        .slice(-12)
        .map(p => ({ label: p.label, value: p.v }))

    const peQ    = build(r => r.priceEarningsRatio,      1,  500)
    const evEbQ  = build(r => r.enterpriseValueMultiple, 1,  150)
    const pbQ    = build(r => r.priceToBookRatio,        0.1, 20)
    const evRevQ = build(r => r.evToSales,               0.1, 50)

    const hm = (historicalMultiples ?? []).sort((a, b) => String(a.fiscalYear).localeCompare(String(b.fiscalYear)))
    const annual = <K extends 'pe' | 'evEbitda' | 'evRevenue'>(key: K): SparkPoint[] =>
      hm.filter(h => h[key] != null).slice(-6).map(h => ({ label: String(h.fiscalYear), value: h[key]! as number }))

    return {
      'P/E':        peQ.length >= 2   ? peQ   : annual('pe'),
      'EV/EBITDA':  evEbQ.length >= 2 ? evEbQ : annual('evEbitda'),
      'P/Book':     pbQ.length >= 2   ? pbQ   : [],
      'EV/Revenue': evRevQ.length >= 2 ? evRevQ : annual('evRevenue'),
      'P/Sales':    evRevQ.length >= 2 ? evRevQ : annual('evRevenue'),
      'P/FCF':      [],
    }
  }, [ratiosQuarterly, historicalMultiples])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-4 motion-safe:animate-pulse">
        <div className="h-28 bg-[#F0F1F6] rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-44 bg-[#F0F1F6] rounded-xl" />)}
        </div>
      </div>
    )
  }

  const hasAnyData = applicable.length > 0 || pegRatio != null || peRatio != null
  if (!hasAnyData) {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
        <p className="text-[13px] font-[700] text-[#111111] mb-1">Valuation Ratios</p>
        <p className="text-[12px] text-[#9B9B9B]">Ratio data not available for this stock.</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border border-[#E5E5E5] bg-[#F9F9F7] overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-0">
        <p className="text-[13px] font-[700] text-[#111111] mb-3">Valuation Ratios</p>
        <PEGHero
          peg={pegRatio}
          peRatioTTM={peRatio}
          epsGrowthFwd={epsGrowthFwd}
          analystForwardPE={analystForwardPE}
        />
      </div>

      {/* Ratio cards */}
      {applicable.length > 0 ? (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {applicable.map((est) => (
            <RatioCard
              key={est.multiple}
              name={est.multiple}
              actual={est.actualValue}
              median={est.sectorMedian}
              sectorPercentile={est.sectorPercentile}
              chartPoints={chartSeries[est.multiple as keyof typeof chartSeries] ?? []}
            />
          ))}
        </div>
      ) : peRatio != null && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
            <p className="text-[11px] font-[700] uppercase tracking-wider text-[#6B6B6B] mb-1">P/E (TTM)</p>
            <p className="text-[28px] font-[800] tabular-nums leading-none text-[#111111]">{fmtX(peRatio)}</p>
            <p className="text-[11px] text-[#9B9B9B] mt-1">No sector comparison available</p>
          </div>
        </div>
      )}

      {/* Footer */}
      {(benchmarkSource || sector) && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-1">
          {benchmarkSource && <span className="text-[10px] text-[#9B9B9B]">({benchmarkSource})</span>}
          {sector && <span className="text-[10px] text-[#9B9B9B]">· {sector}</span>}
        </div>
      )}
    </div>
  )
}
