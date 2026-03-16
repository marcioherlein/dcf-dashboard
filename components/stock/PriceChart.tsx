'use client'
import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { fmt } from '@/lib/utils'

const PERIODS = ['1mo', '3mo', '1y', '5y'] as const
type Period = typeof PERIODS[number]

interface ValuationLevels {
  fcffFairValue?: number | null
  triangulatedFairValue?: number | null
  analystTarget?: number | null
}

interface Props extends ValuationLevels {
  ticker: string
  isDark?: boolean
}

interface Bar { date: string; close: number }

// TradingView-style price label on the right edge of a reference line
function PriceTag({ viewBox, color, labelText, isDark }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewBox?: any; color: string; labelText: string; isDark?: boolean
}) {
  if (!viewBox) return null
  const { x, y, width } = viewBox
  const rx = x + width + 6
  const tagW = Math.max(labelText.length * 6.2, 64)
  const bg = color
  return (
    <g>
      {/* connector dot */}
      <circle cx={x + width} cy={y} r={2.5} fill={color} opacity={0.9} />
      {/* badge */}
      <rect x={rx} y={y - 9} width={tagW} height={18} rx={4} fill={bg} opacity={0.92} />
      <text x={rx + 5} y={y + 4.5} fontSize={9.5} fontWeight={700} fill={isDark ? '#fff' : '#fff'} fontFamily="-apple-system, monospace">
        {labelText}
      </text>
    </g>
  )
}

const LINES = [
  { key: 'fcffFairValue',         label: 'DCF',     color: '#6366f1', dash: '5 3' },
  { key: 'triangulatedFairValue', label: '▲ Target', color: '#8b5cf6', dash: '4 2' },
  { key: 'analystTarget',         label: 'Analyst',  color: '#f59e0b', dash: '4 3' },
] as const

export default function PriceChart({ ticker, isDark, fcffFairValue, triangulatedFairValue, analystTarget }: Props) {
  const [period, setPeriod] = useState<Period>('1y')
  const [data, setData] = useState<Bar[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/historical?ticker=${ticker}&period=${period}`)
      .then((r) => r.json())
      .then((raw: { date: string; close: number }[]) => {
        setData(raw.map((p) => ({
          date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
          close: p.close,
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [ticker, period])

  const pDataMin = data.length ? Math.min(...data.map((d) => d.close)) : 0
  const pDataMax = data.length ? Math.max(...data.map((d) => d.close)) : 1

  const up = data.length >= 2 && data[data.length - 1].close >= data[0].close

  // Build valuation levels map
  const levels: Record<string, number | null | undefined> = { fcffFairValue, triangulatedFairValue, analystTarget }

  // Extend Y domain to include visible valuation lines (capped at 2× or 0.4× price range to avoid distortion)
  const hardMin = pDataMin * 0.4
  const hardMax = pDataMax * 2.2
  const valuationValues = LINES
    .map(l => levels[l.key])
    .filter((v): v is number => v != null && v > hardMin && v < hardMax)
  const domainMin = Math.max(Math.min(pDataMin * 0.97, ...valuationValues) * 0.97, hardMin)
  const domainMax = Math.min(Math.max(pDataMax * 1.01, ...valuationValues) * 1.02, hardMax)

  const tickFill = isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af'
  const tooltipStyle = isDark
    ? { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12, color: '#fff' }
    : { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12 }

  // Right-side margin must accommodate price tag labels
  const hasAnyLine = LINES.some(l => levels[l.key] != null && (levels[l.key] as number) > hardMin && (levels[l.key] as number) < hardMax)

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70">Price Chart</h2>
          {/* Valuation level legend */}
          {hasAnyLine && (
            <div className="flex items-center gap-2.5">
              {LINES.map((l) => {
                const v = levels[l.key]
                if (v == null || v <= hardMin || v >= hardMax) return null
                return (
                  <span key={l.key} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: l.color }}>
                    <span className="inline-block h-0.5 w-3.5" style={{ background: l.color, opacity: 0.7 }} />
                    {l.label} ${fmt(v as number)}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                period === p
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-black'
                  : 'text-gray-500 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-white/25">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: hasAnyLine ? 96 : 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity={isDark ? 0.20 : 0.15} />
                  <stop offset="95%" stopColor={up ? '#10b981' : '#ef4444'} stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: tickFill }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[domainMin, domainMax]}
                tick={{ fontSize: 10, fill: tickFill }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                width={50}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`$${fmt(v as number)}`, 'Price']}
              />

              {/* Valuation reference lines */}
              {LINES.map((l) => {
                const v = levels[l.key]
                if (v == null || v <= hardMin || v >= hardMax) return null
                const labelText = `${l.label}  $${(v as number).toFixed(2)}`
                return (
                  <ReferenceLine
                    key={l.key}
                    y={v as number}
                    stroke={l.color}
                    strokeDasharray={l.dash}
                    strokeWidth={1.5}
                    strokeOpacity={0.75}
                    label={{
                      content: (props: unknown) => (
                        <PriceTag
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          viewBox={(props as any).viewBox}
                          color={l.color}
                          labelText={labelText}
                          isDark={isDark}
                        />
                      ),
                    }}
                  />
                )
              })}

              <Area
                type="monotone"
                dataKey="close"
                stroke={up ? '#10b981' : '#ef4444'}
                fill="url(#grad)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
