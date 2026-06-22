'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MultEst {
  multiple:        string
  actualValue:     number
  sectorMedian:    number
  applicable:      boolean
  benchmarkSource: string
  sectorPercentile?: number | null // 0-100 where the stock sits vs peers
}

interface RatioQuarter {
  date:                   string
  priceEarningsRatio:     number | null
  enterpriseValueMultiple:number | null
  evToSales:              number | null
  priceToBookRatio:       number | null
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
  estimates?:          MultEst[]
  pegRatio?:           number | null
  peRatio?:            number | null
  sector?:             string | null
  isLoading?:          boolean
  ratiosQuarterly?:    RatioQuarter[]
  historicalMultiples?:HistoricalMultiple[]
  epsGrowthFwd?:       number | null
  analystForwardPE?:   number | null
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

type Variant = 'below' | 'near' | 'above'

function getVariant(actual: number, median: number): Variant {
  if (actual < median * 0.85) return 'below'
  if (actual > median * 1.15) return 'above'
  return 'near'
}

function pegColor(peg: number) {
  if (peg < 1.5) return { text: 'text-[#11875D]', bg: 'bg-[#E8F7EF]', border: 'border-[#A3D9BE]' }
  if (peg <= 2.5) return { text: 'text-[#B56A00]', bg: 'bg-[#FFF4DA]', border: 'border-[#F3D391]' }
  return { text: 'text-[#D83B3B]', bg: 'bg-[#FCEAEA]', border: 'border-[#F0B8B8]' }
}

function variantStyle(v: Variant): { badge: string; label: string; arrow: string; lineColor: string } {
  if (v === 'below') return { badge: 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]', label: 'Below median', arrow: '↓', lineColor: '#11875D' }
  if (v === 'above') return { badge: 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]', label: 'Above median', arrow: '↑', lineColor: '#D83B3B' }
  return { badge: 'bg-[#F0F1F6] text-[#566174] border-[#E0E2EB]', label: 'Near median', arrow: '', lineColor: '#2563EB' }
}

// ─── SVG Sparkline (lightweight, no recharts) ─────────────────────────────────

function TinySparkline({ points, color, median }: { points: SparkPoint[]; color: string; median: number }) {
  if (points.length < 2) return null
  const vals = points.map(p => p.value)
  const allVals = [...vals, median]
  const minV = Math.min(...allVals) * 0.92
  const maxV = Math.max(...allVals) * 1.08
  const range = maxV - minV || 1
  const W = 100, H = 36
  const toY = (v: number) => H - ((v - minV) / range) * H

  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${toY(v)}`).join(' ')
  const medY = toY(median)
  const last = vals[vals.length - 1]
  const lastX = W, lastY = toY(last)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 36 }} aria-hidden="true">
      {/* Median dashed line */}
      <line x1="0" y1={medY} x2={W} y2={medY} stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
      {/* Line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Terminal dot */}
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  )
}

// ─── Percentile track slider ──────────────────────────────────────────────────

function PercentileTrack({ actual, median, allValues }: { actual: number; median: number; allValues: number[] }) {
  // Compute approximate percentile from historical distribution
  const sorted = [...allValues].sort((a, b) => a - b)
  const rank = sorted.filter(v => v <= actual).length
  const pct = sorted.length > 1 ? Math.round((rank / sorted.length) * 100) : 50

  // Median position
  const medRank = sorted.filter(v => v <= median).length
  const medPct = sorted.length > 1 ? Math.round((medRank / sorted.length) * 100) : 50

  const variant = getVariant(actual, median)
  const { lineColor } = variantStyle(variant)

  return (
    <div className="mt-2">
      <p className="text-[10px] text-[#9B9B9B] mb-1.5">vs sector</p>
      <div className="relative h-[6px] rounded-full bg-[#ECEEF3]">
        {/* Color fill from 0 to current */}
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, Math.min(98, pct))}%`, background: lineColor, opacity: 0.35 }}
        />
        {/* Median tick */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-px h-3.5 bg-[#9B9B9B] opacity-60"
          style={{ left: `${medPct}%` }}
        />
        {/* Current marker pill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center"
          style={{ left: `${Math.max(2, Math.min(98, pct))}%` }}
        >
          <div
            className="rounded-full px-1.5 py-0.5 text-[9px] font-[700] text-white whitespace-nowrap shadow-sm"
            style={{ background: lineColor, fontSize: 9 }}
          >
            {pct}th
          </div>
        </div>
      </div>
      <div className="flex justify-between mt-1.5 text-[9px] text-[#9B9B9B]">
        <span>10th</span>
        <span>25th</span>
        <span>50th</span>
        <span>75th</span>
        <span>90th</span>
      </div>
    </div>
  )
}

// ─── 5Y range bar ─────────────────────────────────────────────────────────────

function HistoryRange({ points, actual, color }: { points: SparkPoint[]; actual: number; color: string }) {
  if (points.length < 2) return null
  const vals = points.map(p => p.value)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const range = hi - lo || 1
  const dotPct = Math.max(0, Math.min(100, ((actual - lo) / range) * 100))

  return (
    <div className="mt-2.5">
      <p className="text-[10px] text-[#9B9B9B] mb-1.5">vs 5Y history</p>
      <div className="relative h-[4px] rounded-full bg-[#ECEEF3]">
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm"
          style={{ left: `${dotPct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-[#9B9B9B] tabular-nums">
        <span>{fmtX(lo)}</span>
        <span>{fmtX(hi)}</span>
      </div>
    </div>
  )
}

// ─── Single ratio card ────────────────────────────────────────────────────────

function RatioCard({
  name, actual, median, chartPoints, showHistory,
}: {
  name: string
  actual: number
  median: number
  chartPoints: SparkPoint[]
  showHistory: boolean
}) {
  const variant = getVariant(actual, median)
  const style = variantStyle(variant)
  const allVals = chartPoints.map(p => p.value)

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-3.5 flex flex-col"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* Header row: name + badge */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[11px] font-[700] text-[#6B6B6B] uppercase tracking-wider">{name}</span>
        <span className={cn('text-[9px] font-[700] px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0', style.badge)}>
          {style.label}{style.arrow ? ` ${style.arrow}` : ''}
        </span>
      </div>

      {/* Big value */}
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="text-[28px] font-[800] tabular-nums leading-none tracking-tight" style={{ color: style.lineColor }}>
          {fmtX(actual)}
        </span>
      </div>
      <p className="text-[10px] text-[#9B9B9B] mt-0.5">
        Sector median <span className="font-[600] text-[#566174]">{fmtX(median)}</span>
      </p>

      {/* Percentile track */}
      {allVals.length > 0 && (
        <PercentileTrack actual={actual} median={median} allValues={allVals} />
      )}

      {/* 5Y sparkline + range */}
      {showHistory && chartPoints.length >= 2 && (
        <div className="mt-2.5 pt-2.5 border-t border-[#F0F0F0]">
          <TinySparkline points={chartPoints} color={style.lineColor} median={median} />
          <HistoryRange points={chartPoints} actual={actual} color={style.lineColor} />
        </div>
      )}
    </div>
  )
}

// ─── PEG hero ────────────────────────────────────────────────────────────────

function PEGHero({
  peg, peRatioTTM, epsGrowthFwd, analystForwardPE,
}: {
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
  const interpretation =
    displayPeg < 1.0 ? 'Growth not fully priced in'
    : displayPeg < 1.5 ? 'Reasonably priced for growth'
    : displayPeg < 2.5 ? 'Growth priced at a premium'
    : 'High premium relative to growth'

  const pegLabel =
    displayPeg < 1.0 ? 'Undervalued vs growth'
    : displayPeg < 1.5 ? 'Fairly valued'
    : displayPeg < 2.5 ? 'Growth premium'
    : 'Expensive vs growth'

  return (
    <div className={cn('rounded-xl border p-4 mb-4', c.bg, c.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-[700] uppercase tracking-wider text-[#6B6B6B] mb-1">PEG Ratio</p>
          <div className={cn('text-[40px] font-[800] tabular-nums leading-none tracking-tight', c.text)}>
            {displayPeg.toFixed(2)}
          </div>
          <p className="text-[12px] text-[#566174] mt-1.5">{interpretation}</p>
        </div>
        {/* Verdict chip */}
        <div className={cn('rounded-xl border px-3 py-2 text-center shrink-0', c.bg, c.border)}>
          <div className="text-2xl mb-0.5">⚖️</div>
          <p className={cn('text-[11px] font-[700]', c.text)}>{pegLabel}</p>
          <p className="text-[9px] text-[#9B9B9B] mt-0.5">Growth priced at {displayPeg < 1.5 ? 'fair' : 'premium'}</p>
        </div>
      </div>

      {/* How it's calculated */}
      {(peUsed != null || growthPct != null) && (
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 text-[11px] font-[600] text-[#566174] hover:text-[#111111] mt-3 transition-colors"
        >
          <span className={cn('transition-transform text-[9px]', open && 'rotate-90')}>▶</span>
          How it&apos;s calculated
        </button>
      )}
      {open && (peUsed != null || growthPct != null) && (
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
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationRatiosCard({
  estimates,
  pegRatio,
  peRatio,
  sector,
  isLoading,
  ratiosQuarterly,
  historicalMultiples,
  epsGrowthFwd,
  analystForwardPE,
}: Props) {
  const applicable = (estimates ?? []).filter((e) => e.applicable)
  const benchmarkSource = applicable.length > 0 ? applicable[0].benchmarkSource : null

  // Build chart series — quarterly preferred, fall back to annual
  const chartSeries = useMemo(() => {
    const rq = (ratiosQuarterly ?? []).slice().reverse()

    const build = (
      getter: (r: RatioQuarter) => number | null | undefined,
      lo: number, hi: number,
    ): SparkPoint[] =>
      rq
        .map(r => ({ label: quarterLabel(r.date), v: clamp(getter(r), lo, hi) }))
        .filter((p): p is { label: string; v: number } => p.v != null)
        .slice(-12)
        .map(p => ({ label: p.label, value: p.v }))

    const peQ    = build(r => r.priceEarningsRatio,      1,   500)
    const evEbQ  = build(r => r.enterpriseValueMultiple, 1,   150)
    const pbQ    = build(r => r.priceToBookRatio,        0.1,  20)
    const evRevQ = build(r => r.evToSales,               0.1,  50)

    const hm = (historicalMultiples ?? []).sort((a, b) => String(a.fiscalYear).localeCompare(String(b.fiscalYear)))
    const annual = <K extends 'pe' | 'evEbitda' | 'evRevenue'>(key: K): SparkPoint[] =>
      hm.filter(h => h[key] != null).slice(-6).map(h => ({ label: String(h.fiscalYear), value: h[key]! as number }))

    return {
      'P/E':        peQ.length >= 2    ? peQ    : annual('pe'),
      'EV/EBITDA':  evEbQ.length >= 2  ? evEbQ  : annual('evEbitda'),
      'P/Book':     pbQ.length >= 2    ? pbQ    : [],
      'EV/Revenue': evRevQ.length >= 2 ? evRevQ : annual('evRevenue'),
      'P/Sales':    evRevQ.length >= 2 ? evRevQ : annual('evRevenue'),
      'P/FCF':      [],
    }
  }, [ratiosQuarterly, historicalMultiples])

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 space-y-4 motion-safe:animate-pulse">
        <div className="h-28 bg-[#F0F1F6] rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-40 bg-[#F0F1F6] rounded-xl" />)}
        </div>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  const hasAnyData = applicable.length > 0 || pegRatio != null || peRatio != null

  if (!hasAnyData) {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-5">
        <p className="text-[13px] font-[700] text-[#111111] mb-1">Valuation Ratios</p>
        <p className="text-[12px] text-[#9B9B9B]">Ratio data not available for this stock.</p>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-[#F9F9F7] overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-0">
        <p className="text-[13px] font-[700] text-[#111111] mb-3">Valuation Ratios</p>

        {/* PEG Hero */}
        <PEGHero
          peg={pegRatio}
          peRatioTTM={peRatio}
          epsGrowthFwd={epsGrowthFwd}
          analystForwardPE={analystForwardPE}
        />
      </div>

      {/* Ratio cards grid */}
      {applicable.length > 0 ? (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {applicable.map((est) => (
            <RatioCard
              key={est.multiple}
              name={est.multiple}
              actual={est.actualValue}
              median={est.sectorMedian}
              chartPoints={chartSeries[est.multiple as keyof typeof chartSeries] ?? []}
              showHistory
            />
          ))}
        </div>
      ) : (
        /* Fallback: at least show P/E from props when no estimates */
        peRatio != null && (
          <div className="px-4 pb-4">
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-3.5">
              <p className="text-[11px] font-[700] uppercase tracking-wider text-[#6B6B6B] mb-1">P/E (TTM)</p>
              <p className="text-[28px] font-[800] tabular-nums leading-none text-[#111111]">{fmtX(peRatio)}</p>
              <p className="text-[11px] text-[#9B9B9B] mt-1">No sector comparison available</p>
            </div>
          </div>
        )
      )}

      {/* Footer */}
      {(benchmarkSource || sector) && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
          {[
            benchmarkSource && `(${benchmarkSource})`,
            sector,
          ].filter(Boolean).map((s, i) => (
            <span key={i} className="text-[10px] text-[#9B9B9B]">{i > 0 ? '· ' : ''}{s}</span>
          ))}
        </div>
      )}
    </div>
  )
}
