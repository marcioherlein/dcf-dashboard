'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from 'recharts'

// ─── types ────────────────────────────────────────────────────────────────────

interface HistoricalPoint {
  fiscalYear: string
  pe: number | null
  evEbitda: number | null
  evRevenue: number | null
}

interface Props {
  historicalMultiples: HistoricalPoint[]
  currentPE?: number | null
  currentEVEbitda?: number | null
  currentEVRevenue?: number | null
  sectorBenchmarks?: { exitPE: number; exitMultiple: number; revenueMultiple: number } | null
}

// ─── config ───────────────────────────────────────────────────────────────────

type Metric = 'pe' | 'evEbitda' | 'evRevenue'

const METRICS: Array<{ key: Metric; label: string; hex: string; sectorKey: keyof NonNullable<Props['sectorBenchmarks']> }> = [
  { key: 'pe',        label: 'P/E',        hex: '#8b5cf6', sectorKey: 'exitPE'          },
  { key: 'evEbitda',  label: 'EV/EBITDA',  hex: '#f59e0b', sectorKey: 'exitMultiple'    },
  { key: 'evRevenue', label: 'EV/Revenue', hex: '#10b981', sectorKey: 'revenueMultiple' },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2
}

function shortYear(fy: string): string {
  const m = fy.match(/\d{4}/)
  return m ? "'" + m[0].slice(2) : fy
}

// ─── custom tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, hex }: any) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value as number | null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-md text-xs">
      <p className="text-slate-500 mb-1">{label === 'TTM' ? 'Trailing 12M' : label}</p>
      {v != null ? (
        <p className="font-bold tabular-nums" style={{ color: hex }}>{v.toFixed(1)}×</p>
      ) : (
        <p className="text-slate-400">N/A</p>
      )}
    </div>
  )
}

// ─── custom dot ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomDot(props: any) {
  const { cx, cy, payload, hex } = props
  if (cy == null) return null
  const isTTM = payload?.label === 'TTM'
  if (isTTM) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill={hex} stroke="white" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={10} fill={hex} fillOpacity={0.2} />
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={3} fill={hex} stroke="white" strokeWidth={1.5} />
}

// ─── main component ───────────────────────────────────────────────────────────

export default function HistoricalMultiplesChart({
  historicalMultiples,
  currentPE,
  currentEVEbitda,
  currentEVRevenue,
  sectorBenchmarks,
}: Props) {
  const [active, setActive] = useState<Metric>('pe')

  const cfg = METRICS.find(m => m.key === active)!

  // Build chart data — last 5 fiscal years + TTM
  const chartData = useMemo(() => {
    const rows = historicalMultiples.slice(-5)
    const points = rows.map(r => ({
      label: shortYear(r.fiscalYear),
      value: r[active] != null && r[active]! > 0 ? r[active] : null,
    }))

    const ttmVal = active === 'pe' ? currentPE
      : active === 'evEbitda' ? currentEVEbitda
      : currentEVRevenue

    if (ttmVal != null && ttmVal > 0) {
      points.push({ label: 'TTM', value: ttmVal })
    }

    return points
  }, [historicalMultiples, active, currentPE, currentEVEbitda, currentEVRevenue])

  const historicalVals = useMemo(() => {
    return chartData
      .filter(p => p.label !== 'TTM' && p.value != null)
      .map(p => p.value as number)
  }, [chartData])

  const histAvg = historicalVals.length >= 2 ? median(historicalVals) : null
  const sectorVal = sectorBenchmarks ? sectorBenchmarks[cfg.sectorKey] : null

  // Dynamic Y domain with headroom
  const allVals = chartData.filter(p => p.value != null).map(p => p.value as number)
  if (histAvg != null) allVals.push(histAvg)
  if (sectorVal != null) allVals.push(sectorVal)
  const yMin = allVals.length > 0 ? Math.max(0, Math.min(...allVals) * 0.75) : 0
  const yMax = allVals.length > 0 ? Math.max(...allVals) * 1.20 : 50

  if (chartData.filter(p => p.value != null).length === 0) return null

  const ttmVal = chartData.find(p => p.label === 'TTM')?.value ?? null
  const isElevated = ttmVal != null && histAvg != null && ttmVal > histAvg * 1.5

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 sm:px-5 py-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
            Historical Valuation Multiples
          </p>
          {isElevated && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 inline-block">
              Current {cfg.label} elevated vs. 5-year history — exit multiple will mean-revert
            </p>
          )}
        </div>
        {/* Metric tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setActive(m.key)}
              className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
              style={active === m.key
                ? { background: 'white', color: m.hex, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                : { color: '#94a3b8' }
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id={`hmc-grad-${active}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cfg.hex} stopOpacity={0.15} />
              <stop offset="95%" stopColor={cfg.hex} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v.toFixed(0) + '×'}
            width={34}
          />

          <Tooltip content={<ChartTooltip hex={cfg.hex} />} />

          {/* Gradient area fill */}
          <Area
            type="monotone"
            dataKey="value"
            fill={`url(#hmc-grad-${active})`}
            stroke="none"
            connectNulls
            dot={false}
            activeDot={false}
          />

          {/* Historical average */}
          {histAvg != null && (
            <ReferenceLine
              y={histAvg}
              stroke="#94a3b8"
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{
                value: `Avg ${histAvg.toFixed(1)}×`,
                position: 'insideTopRight',
                fontSize: 9,
                fill: '#94a3b8',
              }}
            />
          )}

          {/* Sector median */}
          {sectorVal != null && (
            <ReferenceLine
              y={sectorVal}
              stroke="#3b82f6"
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{
                value: `Sector ${sectorVal.toFixed(1)}×`,
                position: 'insideBottomRight',
                fontSize: 9,
                fill: '#3b82f6',
              }}
            />
          )}

          {/* Main line */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={cfg.hex}
            strokeWidth={2}
            connectNulls
            dot={<CustomDot hex={cfg.hex} />}
            activeDot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: cfg.hex }} />
          Annual
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <svg width="12" height="8"><circle cx="6" cy="4" r="4" fill={cfg.hex} /></svg>
          TTM (current)
        </span>
        {histAvg != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="inline-block w-5 border-t border-dashed border-slate-400" />
            5yr median
          </span>
        )}
        {sectorVal != null && (
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="inline-block w-5 border-t border-dashed border-blue-400" />
            Sector median
          </span>
        )}
      </div>
    </div>
  )
}
