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
  currentValue,
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
  const min = Math.min(...allValues) * 0.92
  const max = Math.max(...allValues) * 1.08

  return (
    <div className="h-[68px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" hide tick={false} axisLine={false} tickLine={false} />
          <YAxis domain={[min, max]} hide tick={false} axisLine={false} tickLine={false} />
          <ReferenceLine y={medianValue} stroke="#E5E5E5" strokeWidth={1} strokeDasharray="3 3" />
          <ReferenceLine y={currentValue} stroke={color} strokeWidth={1} strokeOpacity={0.25} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E5E5E5', strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: color, stroke: '#fff', strokeWidth: 1.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── PEG block ────────────────────────────────────────────────────────────────

function PEGBlock({ peg }: { peg: number | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-[600] text-[#6B6B6B]">PEG ratio</span>
      <span className={cn('text-[28px] font-[800] leading-none tabular-nums font-mono', peg != null ? pegColor(peg) : 'text-[#6B6B6B]')}>
        {peg != null ? peg.toFixed(2) : '—'}
      </span>
      <span className="text-[11px] text-[#6B6B6B] mt-0.5">
        {peg == null ? 'Not available'
          : peg < 1.0 ? 'Growth not fully priced in'
          : peg < 1.5 ? 'Reasonably priced for growth'
          : peg < 2.5 ? 'Growth priced at a premium'
          : 'High premium relative to growth'}
      </span>
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
    <div className={cn('py-3', !isLast && 'border-b border-[#E5E5E5]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-[600] text-[#111111] min-w-[64px] w-20 shrink-0 truncate" title={name}>
          {name}
        </span>
        <span className="text-[13px] font-[700] text-[#111111] tabular-nums font-mono flex-1 text-center">
          {fmtMultiple(actual)}
        </span>
        <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[11px] font-[600] shrink-0', badge.container)}>
          {badge.label}{badge.arrow ? ` ${badge.arrow}` : ''}
        </span>
      </div>
      <div className="mt-1 pl-20">
        <span className="text-[11px] text-[#6B6B6B]">
          Sector median: <span className="font-mono">{fmtMultiple(median)}</span>
        </span>
      </div>
      {hasChart && (
        <>
          <MultipleChart
            points={chartPoints}
            currentValue={actual}
            medianValue={median}
            color={chartColor}
          />
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px] text-[#9B9B9B]">{chartPoints[0]?.label}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[9px] text-[#9B9B9B]">
                <span className="inline-block w-3" style={{ borderTop: `1.5px solid ${chartColor}` }} />
                Actual
              </span>
              <span className="flex items-center gap-1 text-[9px] text-[#9B9B9B]">
                <span className="inline-block w-3" style={{ borderTop: '1px dashed #E5E5E5' }} />
                Sector median
              </span>
            </div>
            <span className="text-[9px] text-[#9B9B9B]">{chartPoints[chartPoints.length - 1]?.label}</span>
          </div>
        </>
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
  peRatio: _peRatio,
  sector,
  isLoading,
  ratiosQuarterly,
  historicalMultiples,
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
        <PEGBlock peg={pegRatio} />

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
          <div>
            {applicable.map((est, i) => (
              <RatioRow
                key={est.multiple}
                name={est.multiple}
                actual={est.actualValue}
                median={est.sectorMedian}
                isLast={i === applicable.length - 1}
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
