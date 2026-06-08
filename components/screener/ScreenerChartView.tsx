'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { sectorColor } from '@/lib/chartColors'
import type { ScreenerStock } from '@/app/api/screener/route'
import type { AxisConfig, AxisField, BubbleSizeField } from './AxisPicker'
import { AXIS_FIELD_LABELS } from './AxisPicker'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScatterPoint {
  x: number
  y: number
  z: number
  ticker: string
  name: string
  sector: string | null
  color: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getValue(stock: ScreenerStock, field: AxisField): number | null {
  switch (field) {
    case 'trailingPE':    return stock.trailingPE
    case 'beta':          return stock.beta
    case 'marketCap':     return stock.marketCap
    case 'price':         return stock.price
    case 'dividendYield': return stock.dividendYield != null ? stock.dividendYield * 100 : null
    default:              return null
  }
}

function getSizeValue(stock: ScreenerStock, field: BubbleSizeField): number {
  if (field === 'fixed') return 1
  if (field === 'marketCap') return stock.marketCap ?? 1
  if (field === 'beta') return stock.beta ?? 1
  return 1
}

function formatAxisValue(value: number, field: AxisField): string {
  switch (field) {
    case 'trailingPE':    return `${value.toFixed(1)}×`
    case 'beta':          return value.toFixed(2)
    case 'marketCap':
      if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
      if (value >= 1e9)  return `$${(value / 1e9).toFixed(1)}B`
      return `$${(value / 1e6).toFixed(0)}M`
    case 'price':         return `$${value.toFixed(2)}`
    case 'dividendYield': return `${value.toFixed(2)}%`
    default:              return String(value)
  }
}

function pad12(arr: number[]): [number, number] {
  if (arr.length === 0) return [0, 1]
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const range = Math.max(max - min, 1e-6)
  const p = range * 0.12
  return [min - p, max + p]
}

// ─── Chart label overlay (rendered via SVG foreignObject-free approach) ───────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartDot(props: any) {
  const { cx, cy, payload, r, onSelect, selected } = props
  if (cx == null || cy == null || !payload) return null
  const p: ScatterPoint = payload
  const isSelected = selected === p.ticker
  const radius = Math.max(5, r ?? 8)
  const tickerLen = p.ticker.length
  const fontSize = tickerLen > 4 ? 6 : tickerLen > 3 ? 6.5 : 7

  return (
    <g
      onClick={() => onSelect?.(isSelected ? null : p.ticker)}
      style={{ cursor: 'pointer' }}
    >
      {isSelected && (
        <circle cx={cx} cy={cy} r={radius + 3} fill="none" stroke="white" strokeWidth={2} />
      )}
      <circle cx={cx} cy={cy} r={radius} fill={p.color} opacity={isSelected ? 1 : 0.82} />
      {radius >= 8 && (
        <text
          x={cx} y={cy + 0.5}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={fontSize} fontWeight="600" fill="white"
          style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'DM Mono, monospace' }}
        >
          {p.ticker.length > 4 ? p.ticker.slice(0, 4) : p.ticker}
        </text>
      )}
    </g>
  )
}

// ─── Dynamic Recharts import ──────────────────────────────────────────────────

const DynamicScatter = dynamic(
  () => import('recharts').then(m => {
    const { ResponsiveContainer, ComposedChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis, Label } = m

    return function InnerChart({
      data,
      xDomain,
      yDomain,
      config,
      onSelect,
      selected,
    }: {
      data: ScatterPoint[]
      xDomain: [number, number]
      yDomain: [number, number]
      config: AxisConfig
      onSelect: (ticker: string | null) => void
      selected: string | null
    }) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 12, right: 20, bottom: 36, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
            <XAxis
              type="number"
              dataKey="x"
              domain={xDomain}
              tick={{ fontSize: 10, fill: '#6B6B6B' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => formatAxisValue(v, config.xField)}
            >
              <Label
                value={AXIS_FIELD_LABELS[config.xField]}
                position="insideBottom"
                offset={-20}
                style={{ fontSize: 10, fill: '#6B6B6B' }}
              />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              domain={yDomain}
              tick={{ fontSize: 10, fill: '#6B6B6B' }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={v => formatAxisValue(v, config.yField)}
            >
              <Label
                value={AXIS_FIELD_LABELS[config.yField]}
                angle={-90}
                position="insideLeft"
                offset={12}
                style={{ fontSize: 10, fill: '#6B6B6B' }}
              />
            </YAxis>
            <ZAxis dataKey="z" range={[40, 400]} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Tooltip content={() => null as any} />
            <Scatter
              data={data}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shape={(p: any) => <ChartDot {...p} onSelect={onSelect} selected={selected} />}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )
    }
  }),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><div className="w-5 h-5 border-2 border-[#E5E5E5] border-t-[#9B9B9B] rounded-full animate-spin" /></div> },
)

// ─── Tooltip card ─────────────────────────────────────────────────────────────

function TooltipCard({
  point,
  config,
  onClose,
  onNavigate,
}: {
  point: ScatterPoint
  config: AxisConfig
  onClose: () => void
  onNavigate: (ticker: string) => void
}) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-lg px-3 py-3 w-[220px]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: point.color }} />
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#111111] font-mono">{point.ticker}</p>
            <p className="text-[10px] text-[#6B6B6B] truncate">{point.name}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-[#9B9B9B] hover:text-[#111111] p-0.5 shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-3">
          <span className="text-[11px] text-[#6B6B6B]">{AXIS_FIELD_LABELS[config.xField]}</span>
          <span className="text-[11px] font-semibold font-mono text-[#111111]">{formatAxisValue(point.x, config.xField)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[11px] text-[#6B6B6B]">{AXIS_FIELD_LABELS[config.yField]}</span>
          <span className="text-[11px] font-semibold font-mono text-[#111111]">{formatAxisValue(point.y, config.yField)}</span>
        </div>
        {point.sector && (
          <div className="flex justify-between gap-3">
            <span className="text-[11px] text-[#6B6B6B]">Sector</span>
            <span className="text-[11px] font-semibold text-[#111111] truncate max-w-[110px] text-right">{point.sector}</span>
          </div>
        )}
      </div>
      <button
        onClick={() => onNavigate(point.ticker)}
        className="mt-2.5 w-full text-center text-[11px] font-semibold text-olive-700 hover:text-olive-600 py-1.5 rounded-lg hover:bg-olive-50 transition-colors"
      >
        Open analysis →
      </button>
    </div>
  )
}

// ─── Sector legend ────────────────────────────────────────────────────────────

function SectorLegend({ sectors }: { sectors: string[] }) {
  if (sectors.length === 0) return null
  const visible = sectors.slice(0, 8)
  const overflow = sectors.length - visible.length
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {visible.map(s => (
        <div key={s} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sectorColor(s) }} />
          <span className="text-[10px] text-[#6B6B6B] leading-none">{s}</span>
        </div>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-[#9B9B9B]">+{overflow} more</span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ScreenerChartViewProps {
  stocks: ScreenerStock[]
  config: AxisConfig
}

export default function ScreenerChartView({ stocks, config }: ScreenerChartViewProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)

  const { points, xDomain, yDomain, nullCount, sectors } = useMemo(() => {
    const pts: ScatterPoint[] = []
    let nulls = 0
    const sectorSet = new Set<string>()

    // Compute size normalization
    const sizeValues = stocks
      .map(s => getSizeValue(s, config.zField))
      .filter(v => v > 0 && isFinite(v))
    const maxSize = sizeValues.length > 0 ? Math.max(...sizeValues) : 1

    for (const stock of stocks) {
      const x = getValue(stock, config.xField)
      const y = getValue(stock, config.yField)
      if (x == null || !isFinite(x) || y == null || !isFinite(y)) {
        nulls++
        continue
      }
      const rawSize = getSizeValue(stock, config.zField)
      const z = config.zField === 'fixed' ? 1 : Math.max(0.05, rawSize / maxSize)

      if (stock.sector) sectorSet.add(stock.sector)
      pts.push({
        x, y, z,
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        color: sectorColor(stock.sector),
      })
    }

    // Cap at 250 for performance
    const cappedPts = pts.slice(0, 250)

    const xs = cappedPts.map(p => p.x)
    const ys = cappedPts.map(p => p.y)

    return {
      points: cappedPts,
      xDomain: pad12(xs) as [number, number],
      yDomain: pad12(ys) as [number, number],
      nullCount: nulls,
      sectors: Array.from(sectorSet).sort(),
    }
  }, [stocks, config])

  const selectedPoint = useMemo(
    () => points.find(p => p.ticker === selected) ?? null,
    [points, selected],
  )

  if (stocks.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-sm flex flex-col items-center justify-center py-16 gap-3">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="10" cy="22" r="4" fill="#E5E5E5"/><circle cx="18" cy="14" r="5" fill="#E5E5E5"/><circle cx="26" cy="8" r="3" fill="#E5E5E5"/></svg>
        <p className="text-[13px] font-semibold text-[#6B6B6B]">No companies match your filters</p>
        <p className="text-[11px] text-[#9B9B9B]">Try broadening the sector or market cap filter</p>
      </div>
    )
  }

  if (points.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-sm flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-[13px] font-semibold text-[#6B6B6B]">No data for selected axes</p>
        <p className="text-[11px] text-[#9B9B9B]">
          {nullCount} of {stocks.length} stocks are missing values for the selected fields. Try different axes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Chart card */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-sm overflow-hidden">
        <div
          className="relative"
          style={{ height: 'clamp(280px, 52vw, 420px)' }}
        >
          <DynamicScatter
            data={points}
            xDomain={xDomain}
            yDomain={yDomain}
            config={config}
            onSelect={setSelected}
            selected={selected}
          />
        </div>

        {/* Bottom bar */}
        <div className="px-4 py-2.5 border-t border-[#E5E5E5] flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <SectorLegend sectors={sectors} />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {points.length < stocks.length && (
              <span className="text-[10px] text-[#9B9B9B]">Showing {points.length} of {stocks.length}</span>
            )}
            {nullCount > 0 && (
              <span className="text-[10px] text-[#9B9B9B]">{nullCount} hidden (no data)</span>
            )}
          </div>
        </div>
      </div>

      {/* Selected tooltip card — desktop inline, mobile floating */}
      {selectedPoint && (
        <div className="sm:absolute sm:right-4 sm:top-4">
          <TooltipCard
            point={selectedPoint}
            config={config}
            onClose={() => setSelected(null)}
            onNavigate={ticker => {
              setSelected(null)
              router.push(`/stock/${ticker}`)
            }}
          />
        </div>
      )}
    </div>
  )
}
