'use client'

import {
  ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Label,
} from 'recharts'
import { cn } from '@/lib/utils'
import { CHART_COLORS } from '@/lib/chartColors'

// ─── Types (shared with ExpandedPeerChartDialog) ──────────────────────────────

export interface PlotPoint {
  x: number             // forwardPE
  y: number             // epsGrowth as %
  ticker: string
  name: string
  marketCap: number | null
  analystCount: number | null
  isAnchor: boolean
  /** color hex from CHART_COLORS palette */
  color: string
  /** true when added manually and still loading data */
  isLoading?: boolean
  /** true when the ticker has no forward estimates */
  hasError?: boolean
}

export interface ChartDomain {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  pegLine1: Array<{ lx: number; ly: number }>
  pegLine15: Array<{ lx: number; ly: number }>
}

interface PeerValuationChartCoreProps {
  points: PlotPoint[]
  domain: ChartDomain
  isFinancialSector?: boolean
  /** Larger rendering for the expanded dialog */
  expanded?: boolean
  /** Called when a bubble is tapped — sets selected ticker */
  onSelect?: (ticker: string | null) => void
  selectedTicker?: string | null
}

// ─── Custom bubble dot ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BubbleDot(props: any) {
  const { cx, cy, payload, onClick, selectedTicker, expanded } = props
  if (cx == null || cy == null || !payload) return null

  const { isAnchor, ticker, analystCount, color, isLoading, hasError } = payload as PlotPoint
  const baseR = expanded ? (isAnchor ? 28 : 22) : (isAnchor ? 22 : 18)
  const isSelected = selectedTicker === ticker
  const r = isSelected ? baseR + 4 : baseR

  if (isLoading) {
    return (
      <g onClick={() => onClick?.(ticker)} style={{ cursor: 'pointer' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 3" opacity={0.5} />
      </g>
    )
  }

  if (hasError) {
    return (
      <g onClick={() => onClick?.(ticker)} style={{ cursor: 'pointer' }}>
        <circle cx={cx} cy={cy} r={r} fill="#F5F5F5" stroke="#E5E5E5" strokeWidth={1.5} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#9B9B9B">?</text>
      </g>
    )
  }

  const tickerSize = (ticker?.length ?? 0) > 3 ? 7.5 : 8.5

  return (
    <g onClick={() => onClick?.(ticker)} style={{ cursor: 'pointer' }}>
      {isSelected && (
        <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke="white" strokeWidth={2.5} />
      )}
      <circle cx={cx} cy={cy} r={r} fill={color} opacity={isSelected ? 1 : 0.85} />
      <text
        x={cx} y={analystCount != null ? cy - 1.5 : cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={tickerSize} fontWeight="700" fill="white"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {ticker}
      </text>
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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PeerTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p: PlotPoint = payload[0]?.payload
  if (!p || p.isLoading || p.hasError) return null

  const peg = p.x > 0 && p.y > 0 ? p.x / p.y : null
  const pegStr = peg?.toFixed(2) ?? null

  const mcap = p.marketCap != null
    ? p.marketCap >= 1e12 ? `$${(p.marketCap / 1e12).toFixed(1)}T`
    : p.marketCap >= 1e9  ? `$${(p.marketCap / 1e9).toFixed(1)}B`
    : `$${(p.marketCap / 1e6).toFixed(0)}M`
    : null

  const pegCls = peg == null ? ''
    : peg <= 1   ? 'text-[#11875D]'
    : peg <= 2   ? 'text-[#B56A00]'
    : 'text-[#D83B3B]'

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-lg px-3 py-2.5 min-w-[160px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
        <p className="text-[12px] font-bold text-[#111111]">{p.ticker}</p>
      </div>
      <p className="text-[11px] text-[#6B6B6B] mb-2 truncate max-w-[180px]">{p.name}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-[11px] text-[#6B6B6B]">Forward P/E</span>
          <span className="text-[11px] font-semibold font-mono text-[#111111]">{p.x != null ? `${p.x.toFixed(1)}×` : '—'}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[11px] text-[#6B6B6B]">NTM EPS growth</span>
          <span className="text-[11px] font-semibold font-mono text-[#111111]">
            {p.y != null ? `${p.y >= 0 ? '+' : ''}${p.y.toFixed(1)}%` : '—'}
          </span>
        </div>
        {pegStr && (
          <div className="flex justify-between gap-4 pt-1 border-t border-[#E5E5E5] mt-1">
            <span className="text-[11px] text-[#6B6B6B]">PEG ratio</span>
            <span className={cn('text-[11px] font-bold font-mono', pegCls)}>{pegStr}</span>
          </div>
        )}
        {mcap && (
          <div className="flex justify-between gap-4">
            <span className="text-[11px] text-[#6B6B6B]">Market cap</span>
            <span className="text-[11px] font-semibold font-mono text-[#111111]">{mcap}</span>
          </div>
        )}
        {p.analystCount != null && (
          <div className="flex justify-between gap-4">
            <span className="text-[11px] text-[#6B6B6B]">Analysts</span>
            <span className="text-[11px] font-semibold font-mono text-[#111111]">{p.analystCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Exported domain calculator ───────────────────────────────────────────────

export function computeChartDomain(points: PlotPoint[]): ChartDomain {
  const validPoints = points.filter(p => !p.isLoading && !p.hasError)
  if (validPoints.length === 0) return { xMin: 0, xMax: 60, yMin: 0, yMax: 60, pegLine1: [], pegLine15: [] }

  const allX = validPoints.map(p => p.x)
  const allY = validPoints.map(p => p.y)

  const pad = (arr: number[], pct: number) => {
    const range = Math.max(...arr) - Math.min(...arr)
    const padAmt = range * pct || 5
    return { min: Math.min(...arr) - padAmt, max: Math.max(...arr) + padAmt }
  }

  const xPad = pad(allX, 0.15)
  const yPad = pad(allY, 0.15)

  const xMin = Math.max(0, Math.floor(xPad.min / 5) * 5)
  const xMax = Math.ceil(xPad.max / 5) * 5
  const yMin = Math.floor(yPad.min / 10) * 10
  const yMax = Math.ceil(yPad.max / 10) * 10

  const buildLine = (peg: number) => [
    { lx: xMin, ly: xMin / peg },
    { lx: xMax, ly: xMax / peg },
  ]

  return { xMin, xMax, yMin, yMax, pegLine1: buildLine(1), pegLine15: buildLine(1.5) }
}

// ─── Legend strip ─────────────────────────────────────────────────────────────

export function PeerChartLegend({ points, expanded }: { points: PlotPoint[]; expanded?: boolean }) {
  const visiblePoints = points.filter(p => !p.hasError)
  return (
    <div className={cn('flex items-center gap-3 flex-wrap', expanded ? 'px-1' : 'mt-2')}>
      {visiblePoints.map(p => (
        <div key={p.ticker} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[10px] text-[#6B6B6B] font-medium">{p.ticker}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#9B9B9B 0,#9B9B9B 4px,transparent 4px,transparent 7px)' }} />
        <span className="text-[10px] text-[#8A95A6]">PEG = 1</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-0.5" style={{ backgroundImage: 'repeating-linear-gradient(90deg,#C8C8C8 0,#C8C8C8 4px,transparent 4px,transparent 7px)' }} />
        <span className="text-[10px] text-[#8A95A6]">PEG = 1.5</span>
      </div>
      {expanded && (
        <span className="text-[10px] text-[#9B9B9B] ml-auto">Number inside bubble = analyst count</span>
      )}
    </div>
  )
}

// ─── Core chart ───────────────────────────────────────────────────────────────

export default function PeerValuationChartCore({
  points,
  domain,
  isFinancialSector,
  expanded,
  onSelect,
  selectedTicker,
}: PeerValuationChartCoreProps) {
  const { xMin, xMax, yMin, yMax, pegLine1, pegLine15 } = domain
  const height = expanded ? 380 : 260

  return (
    <div>
      {isFinancialSector && (
        <p className="text-[11px] text-[#B56A00] mb-2">
          P/E and EPS growth are less reliable for financials — interpret with caution.
        </p>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart margin={{ top: 10, right: expanded ? 56 : 20, bottom: 30, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
          <XAxis
            type="number" dataKey="x"
            domain={[xMin, xMax]}
            tickFormatter={v => `${v}x`}
            tick={{ fontSize: expanded ? 11 : 10, fill: '#6B6B6B' }}
            axisLine={false} tickLine={false}
            name="P/E"
          >
            <Label value="P/E ratio (x)" position="insideBottom" offset={-16} style={{ fontSize: expanded ? 11 : 10, fill: '#6B6B6B' }} />
          </XAxis>
          <YAxis
            type="number" dataKey="y"
            domain={[yMin, yMax]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: expanded ? 11 : 10, fill: '#6B6B6B' }}
            axisLine={false} tickLine={false} width={38}
            name="EPS growth"
          />

          {/* PEG = 1 reference line — neutral, not semantic green */}
          <Line
            data={pegLine1}
            dataKey="ly"
            xAxisId={0} yAxisId={0}
            dot={false} activeDot={false}
            stroke="#9B9B9B" strokeWidth={1} strokeDasharray="4 3"
            isAnimationActive={false}
            name="PEG = 1"
            legendType="none"
          >
            {expanded && <Label value="PEG=1" position="right" fontSize={9} fill="#9B9B9B" />}
          </Line>

          {/* PEG = 1.5 reference line */}
          <Line
            data={pegLine15}
            dataKey="ly"
            xAxisId={0} yAxisId={0}
            dot={false} activeDot={false}
            stroke="#C8C8C8" strokeWidth={1} strokeDasharray="4 3"
            isAnimationActive={false}
            name="PEG = 1.5"
            legendType="none"
          >
            {expanded && <Label value="PEG=1.5" position="right" fontSize={9} fill="#C8C8C8" />}
          </Line>

          <Tooltip
            content={<PeerTooltip />}
            cursor={{ strokeDasharray: '3 3', stroke: '#E5E5E5' }}
          />

          <Scatter
            data={points}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shape={(p: any) => <BubbleDot {...p} onClick={onSelect} selectedTicker={selectedTicker} expanded={expanded} />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Re-export CHART_COLORS so importers only need this file for chart types
export { CHART_COLORS }
