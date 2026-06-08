'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

type RawPoint = {
  score: number
  pe_ratio: number | null
  pb_ratio: number | null
  yield_val: number | null
  expense_ratio: number | null
  ts: string
}

type Range = '3M' | '6M' | '1Y' | 'All'

const RANGE_DAYS: Record<Range, number> = {
  '3M': 90,
  '6M': 180,
  '1Y': 365,
  'All': Infinity,
}

interface MetricConfig {
  key: keyof RawPoint
  label: string
  refLine: number
  refLabel: string
  formatter: (v: number) => string
  /** Zone direction: 'below' means below refLine is good (P/E, P/B), 'above' means above is good (Yield) */
  goodDirection: 'below' | 'above'
  gradientGood: string
  gradientBad: string
  lineColor: string
  isDashed?: boolean
}

const METRICS: MetricConfig[] = [
  {
    key: 'pe_ratio',
    label: 'P/E Ratio',
    refLine: 18,
    refLabel: '18× hist. avg',
    formatter: (v) => `${v.toFixed(1)}×`,
    goodDirection: 'below',
    gradientGood: '#11875D',
    gradientBad: '#D83B3B',
    lineColor: '#2563EB',
  },
  {
    key: 'pb_ratio',
    label: 'P/B Ratio',
    refLine: 2.5,
    refLabel: '2.5× hist. avg',
    formatter: (v) => `${v.toFixed(1)}×`,
    goodDirection: 'below',
    gradientGood: '#11875D',
    gradientBad: '#D83B3B',
    lineColor: '#2563EB',
  },
  {
    key: 'yield_val',
    label: 'Dividend Yield',
    refLine: 0.02,
    refLabel: '2% avg',
    formatter: (v) => `${(v * 100).toFixed(2)}%`,
    goodDirection: 'above',
    gradientGood: '#11875D',
    gradientBad: '#D83B3B',
    lineColor: '#11875D',
  },
  {
    key: 'score',
    label: 'Value Score',
    refLine: 50,
    refLabel: '50 (Fair)',
    formatter: (v) => String(Math.round(v)),
    goodDirection: 'above',
    gradientGood: '#11875D',
    gradientBad: '#D83B3B',
    lineColor: '#5F790B',
  },
]

const DynamicSmallChart = dynamic(
  () => import('recharts').then((m) => {
    const { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } = m

    return function SmallChart({
      data,
      config,
    }: {
      data: { date: string; value: number }[]
      config: MetricConfig
    }) {
      if (data.length < 2) {
        return (
          <div className="h-[120px] flex items-center justify-center rounded-lg bg-[#F5F5F5] border border-dashed border-[#E3E1DA]">
            <span className="text-[11px] text-[#8A95A6]">Not enough data</span>
          </div>
        )
      }

      const gradId = `grad-${config.key}`
      const isExpense = config.key === 'expense_ratio'
      const values = data.map((d) => d.value)
      const minV = Math.min(...values)
      const maxV = Math.max(...values)
      const pad = (maxV - minV) * 0.15 || 0.5
      const domain: [number, number] = [Math.max(0, minV - pad), maxV + pad]

      const tooltipStyle = {
        background: 'white',
        border: '1px solid #E3E1DA',
        borderRadius: '8px',
        fontSize: '11px',
        padding: '6px 10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        color: '#06101F',
      }

      if (isExpense) {
        return (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8A95A6' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={domain} tick={{ fontSize: 9, fill: '#8A95A6' }} axisLine={false} tickLine={false} width={28} tickFormatter={config.formatter} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [typeof v === 'number' ? config.formatter(v) : '—', '']} labelStyle={{ color: '#8A95A6', marginBottom: 2 }} />
              <ReferenceLine y={config.refLine} stroke="#E3E1DA" strokeDasharray="4 2" label={{ value: config.refLabel, position: 'insideTopRight', fontSize: 9, fill: '#8A95A6' }} />
              <Line type="stepAfter" dataKey="value" stroke={config.lineColor} strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        )
      }

      // Determine gradient orientation based on good direction
      const isGoodBelow = config.goodDirection === 'below'
      const refFraction = domain[1] > domain[0]
        ? 1 - (config.refLine - domain[0]) / (domain[1] - domain[0])
        : 0.5
      const clampedFraction = Math.max(0, Math.min(1, refFraction))

      return (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                {isGoodBelow ? (
                  <>
                    <stop offset="0%" stopColor={config.gradientBad} stopOpacity={0.12} />
                    <stop offset={`${clampedFraction * 100}%`} stopColor={config.gradientBad} stopOpacity={0.04} />
                    <stop offset={`${clampedFraction * 100}%`} stopColor={config.gradientGood} stopOpacity={0.08} />
                    <stop offset="100%" stopColor={config.gradientGood} stopOpacity={0} />
                  </>
                ) : (
                  <>
                    <stop offset="0%" stopColor={config.gradientGood} stopOpacity={0.12} />
                    <stop offset={`${clampedFraction * 100}%`} stopColor={config.gradientGood} stopOpacity={0.04} />
                    <stop offset={`${clampedFraction * 100}%`} stopColor={config.gradientBad} stopOpacity={0.08} />
                    <stop offset="100%" stopColor={config.gradientBad} stopOpacity={0} />
                  </>
                )}
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#F5F5F5" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8A95A6' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={domain} tick={{ fontSize: 9, fill: '#8A95A6' }} axisLine={false} tickLine={false} width={28} tickFormatter={config.formatter} />
            <ReferenceLine y={config.refLine} stroke="#C8C8C8" strokeDasharray="4 2" label={{ value: config.refLabel, position: 'insideTopRight', fontSize: 9, fill: '#8A95A6' }} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [typeof v === 'number' ? config.formatter(v) : '—', '']} labelStyle={{ color: '#8A95A6', marginBottom: 2 }} />
            <Area type="monotone" dataKey="value" stroke={config.lineColor} strokeWidth={2} fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      )
    }
  }),
  { ssr: false, loading: () => <div className="h-[120px] rounded-lg bg-[#F5F5F5] motion-safe:animate-pulse" /> },
)

function ChartPanel({
  config,
  data,
  range,
}: {
  config: MetricConfig
  data: { date: string; value: number }[]
  range: Range
}) {
  const filtered = range === 'All'
    ? data
    : data.filter((d) => {
        const ms = new Date(d.date).getTime()
        return ms >= Date.now() - RANGE_DAYS[range] * 86400000
      })

  const latest = filtered.length > 0 ? filtered[filtered.length - 1].value : null
  const first = filtered.length > 0 ? filtered[0].value : null
  const delta = latest != null && first != null ? latest - first : null
  const deltaUp = delta != null && (config.goodDirection === 'above' ? delta > 0 : delta < 0)
  const deltaStr = delta != null ? `${delta > 0 ? '+' : ''}${config.formatter(delta).replace('×', '').replace('%', '')}${config.key === 'yield_val' ? '%' : config.key === 'score' ? '' : '×'}` : null

  return (
    <div className="bg-white rounded-xl border border-[#E3E1DA] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-[0.06em]">{config.label}</span>
          {latest != null && (
            <span className="text-[12px] font-mono font-semibold text-[#06101F]">{config.formatter(latest)}</span>
          )}
        </div>
        {deltaStr && delta !== 0 && (
          <span className={cn('text-[10px] font-semibold tabular-nums', deltaUp ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
            {deltaUp ? '▲' : '▼'} {deltaStr.replace(/^[+-]/, '')}
          </span>
        )}
      </div>
      <DynamicSmallChart data={filtered} config={config} />
    </div>
  )
}

interface Props {
  ticker: string
}

export function ETFMetricHistory({ ticker }: Props) {
  const [raw, setRaw] = useState<RawPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('1Y')

  useEffect(() => {
    if (!ticker) return
    fetch(`/api/etf/score-history?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d: RawPoint[]) => { setRaw(d); setLoading(false) })
      .catch(() => { setRaw([]); setLoading(false) })
  }, [ticker])

  if (loading) {
    return (
      <div className="glass-card-light rounded-xl p-4">
        <div className="h-6 w-40 bg-[#E3E1DA] rounded mb-4 motion-safe:animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[160px] bg-[#F5F5F5] rounded-xl motion-safe:animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const hasSomeData = raw.length >= 3

  // Build per-metric series, deduping to one point per date
  function buildSeries(key: keyof RawPoint): { date: string; value: number }[] {
    const seen = new Map<string, number>()
    for (const pt of raw) {
      const date = pt.ts.slice(0, 10)
      const v = pt[key]
      if (typeof v === 'number' && isFinite(v) && v > 0) {
        seen.set(date, v)
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value }))
  }

  const series = METRICS.map((m) => ({ config: m, data: buildSeries(m.key) }))

  const RANGES: Range[] = ['3M', '6M', '1Y', 'All']

  return (
    <div className="glass-card-light rounded-xl p-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <p className="text-sm font-semibold text-[#06101F]">Metric History</p>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors border',
                range === r
                  ? 'bg-olive-50 text-olive-700 border-[#BFD2A1]'
                  : 'bg-white text-[#6B6B6B] border-transparent hover:bg-[#F5F5F5]',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {!hasSomeData ? (
        <div className="h-[140px] flex flex-col items-center justify-center gap-2 rounded-lg bg-[#F5F5F5] border border-dashed border-[#E3E1DA]">
          <p className="text-sm text-[#6B6B6B] font-semibold">Building history…</p>
          <p className="text-xs text-[#8A95A6] text-center max-w-xs">
            More data points appear each day this ETF is tracked.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {series.map(({ config, data }) => (
            <ChartPanel key={config.key} config={config} data={data} range={range} />
          ))}
        </div>
      )}
    </div>
  )
}
