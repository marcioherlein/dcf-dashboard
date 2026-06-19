'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, Tooltip, ReferenceLine,
  XAxis, YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MultEst {
  multiple: string
  actualValue: number
  sectorMedian: number
  applicable: boolean
  benchmarkSource: string
}

interface RatioQuarter {
  date: string
  priceEarningsRatio: number | null
  enterpriseValueMultiple: number | null
  evToSales: number | null
  priceToBookRatio: number | null
}

interface HistoricalMultiple {
  fiscalYear: string
  date?: string
  pe: number | null
  evEbitda: number | null
  evRevenue: number | null
  ps?: number | null
}

interface Props {
  estimates?: MultEst[]
  pegRatio?: number | null
  peRatio?: number | null
  sector?: string | null
  isLoading?: boolean
  ratiosQuarterly?: RatioQuarter[]
  historicalMultiples?: HistoricalMultiple[]
  // PEG breakdown inputs
  epsGrowthFwd?: number | null    // forward EPS growth rate (fraction, e.g. 0.14 = 14%)
  analystForwardPE?: number | null // analyst-implied forward P/E
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number | null | undefined, lo: number, hi: number): number | null {
  if (v == null || !isFinite(v) || v <= 0) return null
  return v < lo || v > hi ? null : v
}

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

const BADGE_STYLES: Record<BadgeVariant, { container: string; label: string; arrow: string }> = {
  below: { container: 'bg-[#E8F7EF] text-[#11875D]', label: 'Below median', arrow: '↓' },
  above: { container: 'bg-[#FCEAEA] text-[#D83B3B]', label: 'Above median', arrow: '↑' },
  near:  { container: 'bg-[#E5E5E5] text-[#6B6B6B]',  label: 'Near median',  arrow: '' },
}

function fmtMultiple(v: number): string {
  return `${v.toFixed(2)}×`
}

function quarterLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const m = d.getUTCMonth()
  const yr = String(d.getUTCFullYear()).slice(2)
  const q = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4'
  return `${q} '${yr}`
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg px-2.5 py-1.5 shadow-sm">
      <p className="text-[10px] text-[#9B9B9B] mb-0.5">{label}</p>
      <p className="text-[12px] font-[700] text-[#111111] tabular-nums font-mono">
        {fmtMultiple(payload[0].value)}
      </p>
    </div>
  )
}

// ─── Sparkline chart ──────────────────────────────────────────────────────────

interface SparkPoint { label: string; value: number }

function MultipleChart({
  points,
  currentValue: _currentValue,
  medianValue,
  color,
}: {
  points: SparkPoint[]
  currentValue: number
  medianValue: number
  color: string
}) {
  if (points.length < 2) return null

  const allValues = points.map(p => p.value)
  const min = Math.min(...allValues) * 0.88
  const max = Math.max(...allValues) * 1.10

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SimpleDot = (props: any) => {
    const { cx, cy, index } = props
    // Only show dot on last point (current value)
    if (index !== points.length - 1) return null
    return <circle key={`dot-${index}`} cx={cx} cy={cy} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />
  }

  return (
    <div className="h-[72px] w-full mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" hide tick={false} axisLine={false} tickLine={false} />
          <YAxis domain={[min, max]} hide tick={false} axisLine={false} tickLine={false} />
          <ReferenceLine y={medianValue} stroke="#CBD5E1" strokeWidth={1} strokeDasharray="3 3" />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E5E5E5', strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={SimpleDot}
            activeDot={{ r: 3.5, fill: color, stroke: '#fff', strokeWidth: 1.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── PEG block — Moby-style formula breakdown ────────────────────────────────

interface PEGBlockProps {
  peg: number | null | undefined
  peRatioTTM: number | null | undefined
  epsGrowthFwd: number | null | undefined  // fraction e.g. 0.14
  analystForwardPE: number | null | undefined
}

function PEGBlock({ peg, peRatioTTM, epsGrowthFwd, analystForwardPE }: PEGBlockProps) {
  // Decide which P/E to show in the formula: prefer forward P/E when available
  const peUsed = analystForwardPE ?? peRatioTTM ?? null
  const peLabel = analystForwardPE != null ? 'Fwd P/E' : 'P/E (TTM)'
  const growthPct = epsGrowthFwd != null ? epsGrowthFwd * 100 : null

  // Derived PEG from our inputs (may differ slightly from Yahoo's pegRatio)
  const derivedPeg = peUsed != null && growthPct != null && growthPct > 0
    ? peUsed / growthPct
    : null

  const displayPeg = peg ?? derivedPeg

  const interpretation =
    displayPeg == null ? null
    : displayPeg < 1.0 ? 'Growth not fully priced in'
    : displayPeg < 1.5 ? 'Reasonably priced for growth'
    : displayPeg < 2.5 ? 'Growth priced at a premium'
    : 'High premium relative to growth'

  return (
    <div className="flex flex-col gap-3">

      {/* ── Header row: label + big number ── */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="text-[11px] font-[600] text-[#6B6B6B] uppercase tracking-wide">PEG ratio</span>
          <div className={cn('text-[32px] font-[800] leading-none tabular-nums font-mono mt-0.5',
            displayPeg != null ? pegColor(displayPeg) : 'text-[#6B6B6B]')}>
            {displayPeg != null ? displayPeg.toFixed(2) : '—'}
          </div>
          {interpretation && (
            <p className="text-[11px] text-[#6B6B6B] mt-1">{interpretation}</p>
          )}
        </div>
        {/* PEG gauge bar */}
        {displayPeg != null && (
          <div className="flex flex-col items-end gap-1 pb-0.5">
            <div className="relative w-28 h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
              {/* gradient track: green → amber → red */}
              <div className="absolute inset-0 rounded-full"
                style={{ background: 'linear-gradient(to right, #11875D 0%, #11875D 33%, #B56A00 50%, #D83B3B 100%)' }} />
              {/* needle */}
              <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full border border-[#6B6B6B] shadow"
                style={{ left: `calc(${Math.min(Math.log(1 + Math.max(displayPeg, 0)) / Math.log(5), 1) * 100}% - 3px)` }} />
            </div>
            <div className="flex items-center justify-between w-28">
              <span className="text-[9px] text-[#9B9B9B]">0</span>
              <span className="text-[9px] text-[#9B9B9B]">1</span>
              <span className="text-[9px] text-[#9B9B9B]">2</span>
              <span className="text-[9px] text-[#9B9B9B]">4+</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Formula breakdown ── */}
      {(peUsed != null || growthPct != null) && (
        <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2.5">
          <p className="text-[10px] font-[600] text-[#9B9B9B] uppercase tracking-wide mb-2">How it&apos;s calculated</p>
          <div className="flex items-center gap-1.5 flex-wrap">

            {/* P/E box */}
            <div className="flex flex-col items-center rounded-lg bg-white border border-[#E5E5E5] px-2.5 py-1.5 min-w-[52px]">
              <span className="text-[11px] font-[700] text-[#111111] tabular-nums font-mono leading-none">
                {peUsed != null ? peUsed.toFixed(1) + '×' : '—'}
              </span>
              <span className="text-[9px] text-[#9B9B9B] mt-0.5 whitespace-nowrap">{peLabel}</span>
            </div>

            <span className="text-[14px] font-[600] text-[#9B9B9B]">÷</span>

            {/* Growth box */}
            <div className="flex flex-col items-center rounded-lg bg-white border border-[#E5E5E5] px-2.5 py-1.5 min-w-[52px]">
              <span className="text-[11px] font-[700] text-[#111111] tabular-nums font-mono leading-none">
                {growthPct != null ? growthPct.toFixed(1) + '%' : '—'}
              </span>
              <span className="text-[9px] text-[#9B9B9B] mt-0.5 whitespace-nowrap">EPS growth</span>
            </div>

            <span className="text-[14px] font-[600] text-[#9B9B9B]">=</span>

            {/* Result box */}
            <div className={cn(
              'flex flex-col items-center rounded-lg border px-2.5 py-1.5 min-w-[52px]',
              displayPeg == null ? 'bg-white border-[#E5E5E5]' :
              displayPeg < 1.5 ? 'bg-[#E8F7EF] border-[#A3D9BE]' :
              displayPeg < 2.5 ? 'bg-[#FFF4DA] border-[#F3D391]' :
              'bg-[#FCEAEA] border-[#F0B8B8]'
            )}>
              <span className={cn('text-[11px] font-[700] tabular-nums font-mono leading-none',
                displayPeg == null ? 'text-[#6B6B6B]' : pegColor(displayPeg))}>
                {displayPeg != null ? displayPeg.toFixed(2) : '—'}
              </span>
              <span className="text-[9px] text-[#9B9B9B] mt-0.5">PEG</span>
            </div>
          </div>

          {/* Source note */}
          <p className="text-[9.5px] text-[#9B9B9B] mt-2 leading-snug">
            {analystForwardPE != null
              ? 'Forward P/E = price ÷ next-year consensus EPS estimate'
              : 'Trailing P/E from most recent 12 months'}
            {growthPct != null ? ' · EPS growth from analyst estimates (+1Y)' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Ratio row with sparkline ─────────────────────────────────────────────────

interface RatioRowProps {
  name: string
  actual: number
  median: number
  isLast: boolean
  chartPoints: SparkPoint[]
  chartColor: string
}

function RatioRow({ name, actual, median, isLast, chartPoints, chartColor }: RatioRowProps) {
  const variant = getVariant(actual, median)
  const badge = BADGE_STYLES[variant]
  const hasChart = chartPoints.length >= 2

  return (
    <div className={cn('py-2.5', !isLast && 'border-b border-[#E5E5E5]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-[600] text-[#111111] shrink-0">
          {name}
        </span>
        <span className="text-[13px] font-[700] text-[#111111] tabular-nums font-mono">
          {fmtMultiple(actual)}
        </span>
        <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-[600] shrink-0', badge.container)}>
          {badge.label}{badge.arrow ? ` ${badge.arrow}` : ''}
        </span>
      </div>
      <div className="mt-0.5">
        <span className="text-[10px] text-[#9B9B9B]">
          Sector median: <span className="font-mono">{fmtMultiple(median)}</span>
        </span>
      </div>
      {hasChart && (
        <MultipleChart
          points={chartPoints}
          currentValue={actual}
          medianValue={median}
          color={chartColor}
        />
      )}
    </div>
  )
}

function rowChartColor(actual: number, median: number): string {
  const v = getVariant(actual, median)
  if (v === 'below') return '#11875D'
  if (v === 'above') return '#D83B3B'
  return '#2563EB'
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

  // Build quarterly chart series — prefer quarterly (FMP), fall back to annual
  const chartSeries = useMemo(() => {
    const rq = (ratiosQuarterly ?? []).slice().reverse() // oldest→newest

    const build = (
      getter: (r: RatioQuarter) => number | null | undefined,
      lo: number,
      hi: number,
    ): SparkPoint[] =>
      rq
        .map(r => ({ label: quarterLabel(r.date), v: clamp(getter(r), lo, hi) }))
        .filter((p): p is { label: string; v: number } => p.v != null)
        .slice(-12)
        .map(p => ({ label: p.label, value: p.v }))

    const peQ    = build(r => r.priceEarningsRatio, 1, 500)
    const evEbQ  = build(r => r.enterpriseValueMultiple, 1, 150)
    const pbQ    = build(r => r.priceToBookRatio, 0.1, 20)
    const evRevQ = build(r => r.evToSales, 0.1, 50)

    // Annual fallbacks
    const hm = (historicalMultiples ?? []).sort((a, b) => String(a.fiscalYear).localeCompare(String(b.fiscalYear)))
    const annual = <K extends 'pe' | 'evEbitda' | 'evRevenue'>(key: K): SparkPoint[] =>
      hm.filter(h => h[key] != null).slice(-6).map(h => ({ label: String(h.fiscalYear), value: h[key]! as number }))

    return {
      'P/E':        peQ.length >= 2    ? peQ    : annual('pe'),
      'EV/EBITDA':  evEbQ.length >= 2  ? evEbQ  : annual('evEbitda'),
      'P/Book':     pbQ,
      'EV/Revenue': evRevQ.length >= 2 ? evRevQ : annual('evRevenue'),
      'P/Sales':    evRevQ.length >= 2 ? evRevQ : annual('evRevenue'),
    }
  }, [ratiosQuarterly, historicalMultiples])

  if (isLoading) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 flex flex-col motion-safe:animate-pulse">
        <div className="h-4 w-32 bg-[#E5E5E5] rounded mb-3" />
        <div className="h-10 w-20 bg-[#E5E5E5] rounded mb-1" />
        <div className="h-3 w-40 bg-[#E5E5E5] rounded mb-1" />
        <div className="h-3 w-32 bg-[#E5E5E5] rounded" />
        <div className="my-3 border-t border-[#E5E5E5]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="py-3 border-b border-[#E5E5E5] last:border-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="h-3 w-16 bg-[#E5E5E5] rounded" />
              <div className="h-3 w-12 bg-[#E5E5E5] rounded" />
              <div className="h-5 w-24 bg-[#E5E5E5] rounded-full" />
            </div>
            <div className="h-[68px] bg-[#F5F5F5] rounded mt-2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col h-full">
      
      <div
        className="px-4 py-3 shrink-0"
        
      >
        <p className="text-[13px] font-[700] text-[#111111]">Valuation Ratios</p>
      </div>

      <div className="bg-white flex-1 p-4 sm:p-5 flex flex-col">
        <PEGBlock
          peg={pegRatio}
          peRatioTTM={peRatio}
          epsGrowthFwd={epsGrowthFwd}
          analystForwardPE={analystForwardPE}
        />

        <div className="my-3 border-t border-[#E5E5E5]" />

        {applicable.length === 0 ? (
          <div>
            {['P/E', 'EV/EBITDA', 'P/Book', 'P/Sales', 'EV/Revenue'].map((name, i, arr) => (
              <div key={name} className={cn('py-3 flex items-center justify-between', i < arr.length - 1 && 'border-b border-[#E5E5E5]')}>
                <span className="text-[12px] font-[600] text-[#111111] min-w-[64px] w-20 shrink-0">{name}</span>
                <span className="text-[13px] font-[700] text-[#6B6B6B] tabular-nums font-mono flex-1 text-center">—</span>
                <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-[600] bg-[#F5F5F5] text-[#6B6B6B] shrink-0">No data</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {applicable.map((est, i) => (
              <RatioRow
                key={est.multiple}
                name={est.multiple}
                actual={est.actualValue}
                median={est.sectorMedian}
                isLast={i >= applicable.length - (applicable.length % 2 === 0 ? 2 : 1)}
                chartPoints={chartSeries[est.multiple as keyof typeof chartSeries] ?? []}
                chartColor={rowChartColor(est.actualValue, est.sectorMedian)}
              />
            ))}
          </div>
        )}

        {(benchmarkSource || sector) && (
          <p className="mt-3 text-[11px] text-[#6B6B6B] leading-snug">
            {benchmarkSource ? `(${benchmarkSource})` : null}
            {benchmarkSource && sector ? ' · ' : null}
            {sector ?? null}
          </p>
        )}
      </div>{/* /bg-white flex flex-col */}
    </div>
  )
}
