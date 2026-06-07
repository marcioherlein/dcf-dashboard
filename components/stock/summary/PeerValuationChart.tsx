'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Label,
} from 'recharts'
import { Info, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import InfoTooltip from '@/components/ui/InfoTooltip'
import type { PeersResponse } from '@/app/api/peers/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlotPoint {
  x: number             // forwardPE
  y: number             // epsGrowth as %
  ticker: string
  name: string
  marketCap: number | null
  analystCount: number | null
  isAnchor: boolean
}

// ─── Custom bubble: ticker label + analyst count ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BubbleDot(props: any) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null

  const { isAnchor, ticker, analystCount } = payload as PlotPoint
  const r = isAnchor ? 22 : 18
  const fill = isAnchor ? '#2563EB' : '#566174'
  const tickerSize = (ticker?.length ?? 0) > 3 ? 7.5 : 8.5

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} opacity={isAnchor ? 1 : 0.72} />
      <text
        x={cx} y={analystCount != null ? cy - 1.5 : cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={tickerSize} fontWeight="700" fill="white"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {ticker}
      </text>
      {/* Analyst count badge below ticker */}
      {analystCount != null && (
        <text
          x={cx} y={cy + 7}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={6.5} fill="rgba(255,255,255,0.75)"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {analystCount}
        </text>
      )}
    </g>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PeerTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p: PlotPoint = payload[0]?.payload
  if (!p) return null

  // PEG = PE / EPS_growth_percent — standard formula (p.y is already in %)
  const peg = p.x > 0 && p.y > 0 ? p.x / p.y : null
  const pegStr = peg?.toFixed(2) ?? null

  const mcap = p.marketCap != null
    ? p.marketCap >= 1e12 ? `$${(p.marketCap / 1e12).toFixed(1)}T`
    : p.marketCap >= 1e9  ? `$${(p.marketCap / 1e9).toFixed(1)}B`
    : `$${(p.marketCap / 1e6).toFixed(0)}M`
    : null

  // Consistent thresholds with the rest of the app (OverviewMetricGrid: ≤1 good, ≤2 neutral, >2 expensive)
  const pegCls = peg == null ? ''
    : peg <= 1   ? 'text-[#11875D]'
    : peg <= 2   ? 'text-[#B56A00]'
    : 'text-[#D83B3B]'

  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl shadow-lg px-3 py-2.5 min-w-[160px]">
      <p className="text-[12px] font-bold text-[#06101F] mb-0.5">{p.ticker}</p>
      <p className="text-[11px] text-[#566174] mb-2 truncate max-w-[180px]">{p.name}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-[11px] text-[#566174]">Forward P/E</span>
          <span className="text-[11px] font-semibold text-[#06101F]">{p.x != null ? `${p.x.toFixed(1)}x` : '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[11px] text-[#566174]">NTM EPS growth</span>
          <span className="text-[11px] font-semibold text-[#06101F]">
            {p.y != null ? `${p.y >= 0 ? '+' : ''}${p.y.toFixed(1)}%` : '—'}
          </span>
        </div>
        {pegStr && (
          <div className="flex justify-between gap-4 pt-1 border-t border-[#E3E1DA] mt-1">
            <span className="text-[11px] text-[#566174]">PEG ratio</span>
            <span className={cn('text-[11px] font-bold', pegCls)}>{pegStr}</span>
          </div>
        )}
        {mcap && (
          <div className="flex justify-between gap-4">
            <span className="text-[11px] text-[#566174]">Market cap</span>
            <span className="text-[11px] font-semibold text-[#06101F]">{mcap}</span>
          </div>
        )}
        {p.analystCount != null && (
          <div className="flex justify-between gap-4">
            <span className="text-[11px] text-[#566174]">Analysts</span>
            <span className="text-[11px] font-semibold text-[#06101F]">{p.analystCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PeerValuationChartProps {
  ticker: string
  isFinancialSector?: boolean
}

const PEER_TOOLTIP_TEXT =
  "Peers are sourced from Yahoo Finance's 'People also watch' list — stocks frequently viewed together with this one. These are behaviorally similar, not analyst-defined industry peers. Use as a directional comparison, not a precise peer group."

const CARD =
  'bg-white border border-[#E5E5E5] rounded-xl shadow-card p-4'

export default function PeerValuationChart({ ticker, isFinancialSector = false }: PeerValuationChartProps) {
  const [data, setData]       = useState<PeersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/peers?ticker=${encodeURIComponent(ticker)}`, { signal: controller.signal })
      .then(r => r.json())
      .then((d: PeersResponse & { error?: string }) => {
        if (cancelled) return
        if (d.error) { setError(d.error); return }
        setData(d)
      })
      .catch(e => { if (!cancelled && e?.name !== 'AbortError') setError('Failed to load peer data') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true; controller.abort() }
  }, [ticker])

  useEffect(() => load(), [load])

  // ── Derived plot data ────────────────────────────────────────────────────

  const points: PlotPoint[] = useMemo(() => {
    if (!data) return []
    return [
      {
        x: data.anchor.forwardPE,
        y: data.anchor.epsGrowth * 100,
        ticker: data.anchor.ticker,
        name: data.anchor.name,
        marketCap: data.anchor.marketCap,
        analystCount: data.anchor.analystCount,
        isAnchor: true,
      },
      ...data.peers.map(p => ({
        x: p.forwardPE,
        y: p.epsGrowth * 100,
        ticker: p.ticker,
        name: p.name,
        marketCap: p.marketCap,
        analystCount: p.analystCount,
        isAnchor: false,
      })),
    ].filter(p => p.x != null && isFinite(p.x) && p.y != null && isFinite(p.y))
  }, [data])

  // Safe domain computation — guards against empty array
  const { xMin, xMax, yMin, yMax, pegLine1, pegLine15 } = useMemo(() => {
    if (points.length === 0) return { xMin: 0, xMax: 60, yMin: 0, yMax: 60, pegLine1: [], pegLine15: [] }
    const allX = points.map(p => p.x)
    const allY = points.map(p => p.y)
    const xMinV = Math.max(0, Math.floor((Math.min(...allX) - 5) / 5) * 5)
    const xMaxV = Math.ceil((Math.max(...allX) + 5) / 5) * 5
    // Don't clamp yMin to 0 — show negative EPS growth if present
    const yMinV = Math.floor((Math.min(...allY) - 5) / 10) * 10
    const yMaxV = Math.ceil((Math.max(...allY) + 10) / 10) * 10

    // PEG lines: y = x / peg — coordinates in data space (x = PE, y = EPS growth %)
    // Using ComposedChart <Line> with separate dataset correctly renders these in data space
    const buildLine = (peg: number) => [
      { lx: xMinV, ly: xMinV / peg },
      { lx: xMaxV, ly: xMaxV / peg },
    ]

    return { xMin: xMinV, xMax: xMaxV, yMin: yMinV, yMax: yMaxV, pegLine1: buildLine(1), pegLine15: buildLine(1.5) }
  }, [points])

  // ── Skeleton ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={CARD}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-3.5 w-36 rounded bg-[#F4F3EF] motion-safe:animate-pulse" />
          <div className="h-3 w-20 rounded bg-[#F4F3EF] motion-safe:animate-pulse" />
        </div>
        <div className="h-[260px] rounded-xl bg-[#F4F3EF] motion-safe:animate-pulse" />
        <div className="mt-3 h-3 w-48 rounded bg-[#F4F3EF] motion-safe:animate-pulse" />
      </div>
    )
  }

  // Ghost card for no-data states — keeps layout stable and signals the feature exists
  if (error || !data || data.peers.length === 0) {
    const friendlyError = error === 'Failed to fetch peer data'
      ? 'Unable to load peer data right now. Try refreshing.'
      : (error ?? 'No comparable peers found for this stock on Yahoo Finance.')
    return (
      <div className={cn(CARD, 'flex items-center gap-3 py-5')}>
        <div className="w-7 h-7 rounded-lg bg-[#F4F3EF] border border-[#E3E1DA] flex items-center justify-center shrink-0">
          <Info className="w-3.5 h-3.5 text-[#8A95A6]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#566174]">Peer comparison unavailable</p>
          <p className="text-[11px] text-[#8A95A6] mt-0.5 truncate">
            {friendlyError}
          </p>
        </div>
        {error && (
          <button
            type="button"
            onClick={load}
            aria-label="Retry loading peer data"
            className="text-[#8A95A6] hover:text-[#566174] transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className={CARD}
      role="region"
      aria-label={`P/E vs EPS growth peer comparison for ${ticker}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[13px] font-[700] text-[#06101F] leading-tight">
          P/E vs. next-12-month EPS growth — peer comparison
        </p>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[11px] font-[600] text-[#566174]">
            <span>Yahoo peers</span>
            <InfoTooltip content={PEER_TOOLTIP_TEXT} />
          </div>
          <button
            type="button"
            onClick={load}
            aria-label="Refresh peer data"
            className="text-[#8A95A6] hover:text-[#566174] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <p className="text-[11px] text-[#8A95A6] mb-3">
        Forward P/E (x) vs. consensus next-12-month EPS growth (%).
        {isFinancialSector && (
          <span className="ml-1 text-[#B56A00]">P/E and EPS growth are less reliable for financials — interpret with caution.</span>
        )}
      </p>

      <ResponsiveContainer width="100%" height={260}>
        {/* ComposedChart: Scatter for bubbles + Line for PEG reference lines in data space */}
        <ComposedChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F4F3EF" />

          <XAxis
            type="number" dataKey="x"
            domain={[xMin, xMax]}
            tickFormatter={v => `${v}x`}
            tick={{ fontSize: 10, fill: '#8A95A6' }}
            axisLine={false} tickLine={false}
            name="P/E"
          >
            <Label value="P/E ratio (x)" position="insideBottom" offset={-16} style={{ fontSize: 10, fill: '#8A95A6' }} />
          </XAxis>

          <YAxis
            type="number" dataKey="y"
            domain={[yMin, yMax]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 10, fill: '#8A95A6' }}
            axisLine={false} tickLine={false} width={38}
            name="EPS growth"
          />

          {/* PEG = 1 reference line rendered as a proper data-space Line */}
          <Line
            data={pegLine1}
            dataKey="ly"
            xAxisId={0} yAxisId={0}
            dot={false} activeDot={false}
            stroke="#10B981" strokeWidth={1} strokeDasharray="4 3"
            isAnimationActive={false}
            name="PEG = 1"
            legendType="none"
          />

          {/* PEG = 1.5 reference line */}
          <Line
            data={pegLine15}
            dataKey="ly"
            xAxisId={0} yAxisId={0}
            dot={false} activeDot={false}
            stroke="#F59E0B" strokeWidth={1} strokeDasharray="4 3"
            isAnimationActive={false}
            name="PEG = 1.5"
            legendType="none"
          />

          <Tooltip
            content={<PeerTooltip />}
            cursor={{ strokeDasharray: '3 3', stroke: '#CDD1C8' }}
          />

          <Scatter
            data={points}
            shape={<BubbleDot />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend + insight row */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#2563EB]" />
          <span className="text-[10px] text-[#566174] font-medium">{ticker}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#566174] opacity-70" />
          <span className="text-[10px] text-[#566174]">Peers</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: '#10B981', backgroundImage: 'repeating-linear-gradient(90deg,#10B981 0,#10B981 4px,transparent 4px,transparent 7px)' }} />
          <span className="text-[10px] text-[#8A95A6]">PEG = 1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: '#F59E0B', backgroundImage: 'repeating-linear-gradient(90deg,#F59E0B 0,#F59E0B 4px,transparent 4px,transparent 7px)' }} />
          <span className="text-[10px] text-[#8A95A6]">PEG = 1.5</span>
        </div>
        <span className="text-[10px] text-[#8A95A6] ml-auto hidden sm:block">
          Bubble number = analyst count behind estimate
        </span>
      </div>

      {/* Accessible data table for screen readers */}
      <table className="sr-only">
        <caption>P/E vs EPS growth peer comparison for {ticker}</caption>
        <thead>
          <tr>
            <th>Ticker</th><th>Company</th><th>Forward P/E</th><th>NTM EPS Growth</th><th>Analysts</th>
          </tr>
        </thead>
        <tbody>
          {points.map(p => (
            <tr key={p.ticker}>
              <td>{p.ticker}</td>
              <td>{p.name}</td>
              <td>{p.x != null ? `${p.x.toFixed(1)}x` : '—'}</td>
              <td>{p.y != null ? `${p.y >= 0 ? '+' : ''}${p.y.toFixed(1)}%` : '—'}</td>
              <td>{p.analystCount ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
