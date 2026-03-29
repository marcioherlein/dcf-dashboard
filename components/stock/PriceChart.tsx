'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  ComposedChart, AreaChart, Area, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
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

interface Bar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ── Technical indicator helpers ──────────────────────────────────────────────

function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    const slice = closes.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

function calcEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  const out: (number | null)[] = []
  let ema: number | null = null
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { out.push(null); continue }
    if (ema === null) {
      ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
    } else {
      ema = closes[i] * k + ema * (1 - k)
    }
    out.push(Math.round(ema * 100) / 100)
  }
  return out
}

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(period).fill(null)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff)
  }
  avgGain /= period; avgLoss /= period
  out.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    out.push(avgLoss === 0 ? 100 : Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 10) / 10)
  }
  return out
}

function calcBB(closes: number[], period = 20, stdDev = 2): { upper: number | null; lower: number | null }[] {
  return closes.map((_, i) => {
    if (i < period - 1) return { upper: null, lower: null }
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period)
    return {
      upper: Math.round((mean + stdDev * std) * 100) / 100,
      lower: Math.round((mean - stdDev * std) * 100) / 100,
    }
  })
}

// ── Price label on right edge of reference line ───────────────────────────────
function PriceTag({ viewBox, color, labelText }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewBox?: any; color: string; labelText: string
}) {
  if (!viewBox) return null
  const { x, y, width } = viewBox
  const rx = x + width + 6
  const tagW = Math.max(labelText.length * 6.2, 64)
  return (
    <g>
      <circle cx={x + width} cy={y} r={2.5} fill={color} opacity={0.9} />
      <rect x={rx} y={y - 9} width={tagW} height={18} rx={4} fill={color} opacity={0.92} />
      <text x={rx + 5} y={y + 4.5} fontSize={9.5} fontWeight={700} fill="#fff" fontFamily="-apple-system, monospace">
        {labelText}
      </text>
    </g>
  )
}

const VAL_LINES = [
  { key: 'fcffFairValue',         label: 'DCF',     color: '#6366f1', dash: '5 3' },
  { key: 'triangulatedFairValue', label: '▲ Target', color: '#8b5cf6', dash: '4 2' },
  { key: 'analystTarget',         label: 'Analyst',  color: '#f59e0b', dash: '4 3' },
] as const

// MA indicator config
const MA_INDICATORS = [
  { key: 'sma20',  label: 'SMA 20',  color: '#f59e0b', type: 'sma' as const, period: 20 },
  { key: 'sma50',  label: 'SMA 50',  color: '#3b82f6', type: 'sma' as const, period: 50 },
  { key: 'sma200', label: 'SMA 200', color: '#ef4444', type: 'sma' as const, period: 200 },
  { key: 'ema20',  label: 'EMA 20',  color: '#10b981', type: 'ema' as const, period: 20 },
]

type MAKey = typeof MA_INDICATORS[number]['key']
type SubPanel = 'volume' | 'rsi'

// ── Tooltip formatters ────────────────────────────────────────────────────────
function PriceTooltip({ active, payload, label, isDark }: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  label?: string
  isDark?: boolean
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const bg = isDark ? '#1a1a1a' : '#fff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  const text = isDark ? '#fff' : '#111'
  const muted = isDark ? 'rgba(255,255,255,0.4)' : '#6b7280'
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '8px 12px', fontSize: 11, color: text, minWidth: 140 }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: muted }}>{label}</div>
      {d.open != null && <div style={{ color: muted }}>O <span style={{ color: text, fontWeight: 600 }}>${fmt(d.open)}</span></div>}
      {d.high != null && <div style={{ color: muted }}>H <span style={{ color: '#10b981', fontWeight: 600 }}>${fmt(d.high)}</span></div>}
      {d.low  != null && <div style={{ color: muted }}>L <span style={{ color: '#ef4444', fontWeight: 600 }}>${fmt(d.low)}</span></div>}
      <div style={{ color: muted }}>C <span style={{ color: text, fontWeight: 700 }}>${fmt(d.close)}</span></div>
      {d.volume > 0 && <div style={{ color: muted, marginTop: 2 }}>Vol <span style={{ color: text }}>{(d.volume / 1e6).toFixed(2)}M</span></div>}
      {d.sma20  != null && <div style={{ color: '#f59e0b', marginTop: 2 }}>SMA20 ${fmt(d.sma20)}</div>}
      {d.sma50  != null && <div style={{ color: '#3b82f6' }}>SMA50 ${fmt(d.sma50)}</div>}
      {d.sma200 != null && <div style={{ color: '#ef4444' }}>SMA200 ${fmt(d.sma200)}</div>}
      {d.ema20  != null && <div style={{ color: '#10b981' }}>EMA20 ${fmt(d.ema20)}</div>}
      {d.bbUpper != null && <div style={{ color: '#a78bfa', marginTop: 2 }}>BB+ ${fmt(d.bbUpper)}</div>}
      {d.bbLower != null && <div style={{ color: '#a78bfa' }}>BB− ${fmt(d.bbLower)}</div>}
    </div>
  )
}

function RSITooltip({ active, payload, label, isDark }: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
  label?: string
  isDark?: boolean
}) {
  if (!active || !payload?.length) return null
  const rsi = payload[0]?.value
  if (rsi == null) return null
  const bg = isDark ? '#1a1a1a' : '#fff'
  const border = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
      <span style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#6b7280' }}>{label} · </span>
      <span style={{ fontWeight: 700, color: rsi > 70 ? '#ef4444' : rsi < 30 ? '#10b981' : isDark ? '#fff' : '#111' }}>RSI {rsi?.toFixed(1)}</span>
    </div>
  )
}

export default function PriceChart({ ticker, isDark, fcffFairValue, triangulatedFairValue, analystTarget }: Props) {
  const [period, setPeriod] = useState<Period>('1y')
  const [rawData, setRawData] = useState<Bar[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMA, setActiveMA] = useState<Set<MAKey>>(new Set(['sma50', 'sma200']))
  const [showBB, setShowBB] = useState(false)
  const [subPanel, setSubPanel] = useState<SubPanel>('volume')
  const [showSubPanel, setShowSubPanel] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/historical?ticker=${ticker}&period=${period}`)
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((raw: any[]) => {
        setRawData(raw.map((p) => ({
          date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: period === '5y' ? '2-digit' : undefined }),
          open: p.open ?? p.close,
          high: p.high ?? p.close,
          low: p.low ?? p.close,
          close: p.close,
          volume: p.volume ?? 0,
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [ticker, period])

  // Compute all indicators client-side
  const data = useMemo(() => {
    if (!rawData.length) return []
    const closes = rawData.map((d) => d.close)
    const sma20v  = calcSMA(closes, 20)
    const sma50v  = calcSMA(closes, 50)
    const sma200v = calcSMA(closes, 200)
    const ema20v  = calcEMA(closes, 20)
    const rsiV    = calcRSI(closes, 14)
    const bbV     = calcBB(closes, 20, 2)
    return rawData.map((d, i) => ({
      ...d,
      sma20:  sma20v[i],
      sma50:  sma50v[i],
      sma200: sma200v[i],
      ema20:  ema20v[i],
      rsi:    rsiV[i],
      bbUpper: bbV[i].upper,
      bbLower: bbV[i].lower,
    }))
  }, [rawData])

  const rsiData = useMemo(() => data.filter((d) => d.rsi != null), [data])

  const closes = data.map((d) => d.close)
  const pDataMin = closes.length ? Math.min(...closes) : 0
  const pDataMax = closes.length ? Math.max(...closes) : 1
  const up = data.length >= 2 && data[data.length - 1].close >= data[0].close
  const priceColor = up ? '#10b981' : '#ef4444'

  const levels: Record<string, number | null | undefined> = { fcffFairValue, triangulatedFairValue, analystTarget }
  const hardMin = pDataMin * 0.4
  const hardMax = pDataMax * 2.2
  const valuationValues = VAL_LINES.map(l => levels[l.key]).filter((v): v is number => v != null && v > hardMin && v < hardMax)
  const domainMin = Math.max(Math.min(pDataMin * 0.97, ...valuationValues) * 0.97, hardMin)
  const domainMax = Math.min(Math.max(pDataMax * 1.01, ...valuationValues) * 1.02, hardMax)

  const maxVolume = data.length ? Math.max(...data.map((d) => d.volume)) : 1

  const tickFill = isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af'
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : '#f3f4f6'
  const hasAnyLine = VAL_LINES.some(l => levels[l.key] != null && (levels[l.key] as number) > hardMin && (levels[l.key] as number) < hardMax)
  const rightMargin = hasAnyLine ? 96 : 12

  const toggleMA = (key: MAKey) => {
    setActiveMA(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // Last close for display
  const lastClose = data.length ? data[data.length - 1].close : null
  const firstClose = data.length ? data[0].close : null
  const changePct = firstClose && lastClose ? ((lastClose - firstClose) / firstClose) * 100 : null

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm dark:border-white/8 dark:bg-[#111]">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70">Price Chart</h2>
          {changePct != null && (
            <span className={`text-xs font-semibold tabular-nums ${changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
          {/* Valuation level legend */}
          {hasAnyLine && (
            <div className="hidden items-center gap-2.5 sm:flex">
              {VAL_LINES.map((l) => {
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

        {/* Period selector */}
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

      {/* ── Indicator toggles ── */}
      <div className="flex flex-wrap items-center gap-1.5 px-6 pb-3">
        {MA_INDICATORS.map((ind) => {
          const on = activeMA.has(ind.key as MAKey)
          return (
            <button
              key={ind.key}
              onClick={() => toggleMA(ind.key as MAKey)}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition border ${
                on ? 'opacity-100' : 'opacity-35'
              }`}
              style={{
                borderColor: ind.color,
                color: on ? ind.color : (isDark ? 'rgba(255,255,255,0.4)' : '#6b7280'),
                background: on ? `${ind.color}18` : 'transparent',
              }}
            >
              {ind.label}
            </button>
          )
        })}
        <button
          onClick={() => setShowBB(!showBB)}
          className={`rounded px-2 py-0.5 text-[10px] font-semibold transition border ${showBB ? 'opacity-100' : 'opacity-35'}`}
          style={{
            borderColor: '#a78bfa',
            color: showBB ? '#a78bfa' : (isDark ? 'rgba(255,255,255,0.4)' : '#6b7280'),
            background: showBB ? '#a78bfa18' : 'transparent',
          }}
        >
          BB (20,2)
        </button>

        <div className="ml-auto flex items-center gap-1">
          {(['volume', 'rsi'] as SubPanel[]).map((sp) => (
            <button
              key={sp}
              onClick={() => { setSubPanel(sp); setShowSubPanel(true) }}
              className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                showSubPanel && subPanel === sp
                  ? 'bg-gray-200 dark:bg-white/15 text-gray-700 dark:text-white/70'
                  : 'text-gray-400 dark:text-white/25 hover:bg-gray-100 dark:hover:bg-white/8'
              }`}
            >
              {sp.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => setShowSubPanel(!showSubPanel)}
            className="rounded px-1.5 py-0.5 text-[10px] text-gray-400 dark:text-white/25 hover:bg-gray-100 dark:hover:bg-white/8"
          >
            {showSubPanel ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* ── Main price chart ── */}
      <div className="h-64 px-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-white/25">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: rightMargin, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={priceColor} stopOpacity={isDark ? 0.18 : 0.12} />
                  <stop offset="95%" stopColor={priceColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: tickFill }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis
                yAxisId="price"
                domain={[domainMin, domainMax]}
                tick={{ fontSize: 10, fill: tickFill }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
                width={50}
              />
              <Tooltip content={<PriceTooltip isDark={isDark} />} />

              {/* Bollinger Bands */}
              {showBB && (
                <>
                  <Line yAxisId="price" type="monotone" dataKey="bbUpper" stroke="#a78bfa" strokeWidth={1} dot={false} strokeDasharray="3 2" isAnimationActive={false} connectNulls />
                  <Line yAxisId="price" type="monotone" dataKey="bbLower" stroke="#a78bfa" strokeWidth={1} dot={false} strokeDasharray="3 2" isAnimationActive={false} connectNulls />
                </>
              )}

              {/* Price area */}
              <Area yAxisId="price" type="monotone" dataKey="close" stroke={priceColor} fill="url(#priceGrad)" strokeWidth={2} dot={false} isAnimationActive={false} />

              {/* MA lines */}
              {MA_INDICATORS.map((ind) => {
                if (!activeMA.has(ind.key as MAKey)) return null
                return (
                  <Line
                    key={ind.key}
                    yAxisId="price"
                    type="monotone"
                    dataKey={ind.key}
                    stroke={ind.color}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls
                  />
                )
              })}

              {/* Valuation reference lines */}
              {VAL_LINES.map((l) => {
                const v = levels[l.key]
                if (v == null || v <= hardMin || v >= hardMax) return null
                const labelText = `${l.label}  $${(v as number).toFixed(2)}`
                return (
                  <ReferenceLine
                    key={l.key}
                    yAxisId="price"
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
                        />
                      ),
                    }}
                  />
                )
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Sub-panel: Volume or RSI ── */}
      {showSubPanel && !loading && data.length > 0 && (
        <div className="h-20 px-1 pb-3 pt-1">
          {subPanel === 'volume' ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 0, right: rightMargin, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis
                  tick={{ fontSize: 9, fill: tickFill }}
                  tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`}
                  width={50}
                  domain={[0, maxVolume * 3]}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const vol = payload[0]?.value as number
                    return (
                      <div style={{ background: isDark ? '#1a1a1a' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`, borderRadius: 8, padding: '4px 8px', fontSize: 11 }}>
                        <span style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#6b7280' }}>{label} · </span>
                        <span style={{ fontWeight: 700, color: isDark ? '#fff' : '#111' }}>Vol {(vol / 1e6).toFixed(2)}M</span>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="volume" fill={isDark ? 'rgba(255,255,255,0.12)' : '#d1d5db'} isAnimationActive={false} radius={[1, 1, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rsiData} margin={{ top: 0, right: rightMargin, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis
                  domain={[0, 100]}
                  ticks={[30, 50, 70]}
                  tick={{ fontSize: 9, fill: tickFill }}
                  tickLine={false} axisLine={false}
                  width={50}
                />
                <Tooltip content={<RSITooltip isDark={isDark} />} />
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="3 2" strokeWidth={1} strokeOpacity={0.5} />
                <ReferenceLine y={30} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1} strokeOpacity={0.5} />
                <ReferenceLine y={50} stroke={isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'} strokeWidth={1} />
                <Area type="monotone" dataKey="rsi" stroke="#8b5cf6" fill="#8b5cf618" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          <div className="flex justify-center">
            <span className="text-[9px] text-gray-300 dark:text-white/20 font-medium tracking-wide">
              {subPanel === 'volume' ? 'VOLUME' : 'RSI (14)'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
