'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, Legend,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────
interface OHLCV {
  date: string
  close: number
}

interface ComparePoint {
  date: string
  a: number         // normalized to 100
  b: number         // normalized to 100
  ratio: number     // A / B  (normalized)
  ratioInv: number  // B / A  (normalized)
}

interface Stats {
  correlation: number
  aReturn: number   // % over period
  bReturn: number
  currentRatio: number
  meanRatio: number
  ratioZScore: number
  maxDivergence: number // max abs diff of normalized prices
}

type Period = '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y'
const PERIODS: { label: string; value: Period }[] = [
  { label: '1M',  value: '1mo' },
  { label: '3M',  value: '3mo' },
  { label: '6M',  value: '6mo' },
  { label: '1Y',  value: '1y'  },
  { label: '2Y',  value: '2y'  },
  { label: '5Y',  value: '5y'  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pearsonCorr(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? 0 : num / denom
}

function buildCompareData(aRaw: OHLCV[], bRaw: OHLCV[]): { points: ComparePoint[]; stats: Stats } {
  // Align on common dates
  const bMap = new Map(bRaw.map((r) => [r.date.slice(0, 10), r.close]))
  const aligned = aRaw
    .map((r) => ({ date: r.date.slice(0, 10), aClose: r.close, bClose: bMap.get(r.date.slice(0, 10)) }))
    .filter((r): r is { date: string; aClose: number; bClose: number } => r.bClose !== undefined && r.aClose > 0 && r.bClose > 0)

  if (aligned.length < 2) return { points: [], stats: { correlation: 0, aReturn: 0, bReturn: 0, currentRatio: 0, meanRatio: 0, ratioZScore: 0, maxDivergence: 0 } }

  const a0 = aligned[0].aClose
  const b0 = aligned[0].bClose

  const points: ComparePoint[] = aligned.map((r) => {
    const aN = (r.aClose / a0) * 100
    const bN = (r.bClose / b0) * 100
    return {
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
      a: Math.round(aN * 100) / 100,
      b: Math.round(bN * 100) / 100,
      ratio: Math.round((aN / bN) * 10000) / 10000,
      ratioInv: Math.round((bN / aN) * 10000) / 10000,
    }
  })

  const aNorms = points.map((p) => p.a)
  const bNorms = points.map((p) => p.b)
  const ratios = points.map((p) => p.ratio)
  const meanRatio = ratios.reduce((s, v) => s + v, 0) / ratios.length
  const stdRatio = Math.sqrt(ratios.reduce((s, v) => s + Math.pow(v - meanRatio, 2), 0) / ratios.length)
  const currentRatio = ratios[ratios.length - 1]

  const maxDivergence = Math.max(...points.map((p) => Math.abs(p.a - p.b)))

  return {
    points,
    stats: {
      correlation: Math.round(pearsonCorr(aNorms, bNorms) * 1000) / 1000,
      aReturn: Math.round(((aNorms[aNorms.length - 1] - 100)) * 100) / 100,
      bReturn: Math.round(((bNorms[bNorms.length - 1] - 100)) * 100) / 100,
      currentRatio,
      meanRatio: Math.round(meanRatio * 10000) / 10000,
      ratioZScore: stdRatio > 0 ? Math.round(((currentRatio - meanRatio) / stdRatio) * 100) / 100 : 0,
      maxDivergence: Math.round(maxDivergence * 100) / 100,
    },
  }
}

// ─── Ticker Input ─────────────────────────────────────────────────────────────
function TickerInput({
  value, onChange, accent, label,
}: {
  value: string
  onChange: (v: string) => void
  accent: string
  label: string
}) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<{ symbol: string; longname?: string; shortname?: string }[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return }
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => { setResults(d); setOpen(d.length > 0); setLoading(false) })
        .catch(() => setLoading(false))
    }, 280)
  }, [query])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const select = (symbol: string) => {
    setQuery(symbol)
    setOpen(false)
    onChange(symbol)
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: accent }}>{label}</span>
      <div className="relative" ref={ref}>
        <div
          className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 transition-colors focus-within:shadow-sm"
          style={{ borderColor: open ? accent : '#e2e8f0' }}
        >
          <span className="text-[12px] font-bold shrink-0" style={{ color: accent }}>$</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) select(query.trim()) }}
            placeholder="AAPL, NVDA…"
            className="flex-1 bg-transparent text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none uppercase"
          />
          {loading && <div className="h-3 w-3 animate-spin rounded-full border border-slate-200 shrink-0" style={{ borderTopColor: accent }} />}
        </div>
        {open && (
          <div className="absolute left-0 right-0 top-full mt-0.5 bg-white border border-slate-200 rounded-lg shadow-card-md z-50 max-h-48 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => select(r.symbol)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
              >
                <span className="text-xs font-bold w-16 shrink-0" style={{ color: accent }}>{r.symbol}</span>
                <span className="text-[11px] text-slate-500 truncate">{r.longname ?? r.shortname}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CompareTooltip({ active, payload, label, tickerA }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active?: boolean; payload?: any[]; label?: string; tickerA: string; tickerB: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-card-md">
      <div className="text-slate-400 mb-1.5">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name ?? p.dataKey}</span>
          <span className="font-semibold tabular-nums" style={{ color: p.color }}>
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
      {/* Show Δ spread when both A and B present */}
      {payload.length === 2 && payload[0]?.name === tickerA && (
        <div className="mt-1 pt-1 border-t border-slate-100 flex justify-between">
          <span className="text-slate-400">Δ spread</span>
          <span className="font-semibold tabular-nums text-slate-700">
            {(payload[0].value - payload[1].value).toFixed(2)} pp
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-base font-bold tabular-nums" style={{ color: color ?? '#0f172a' }}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ComparePage() {
  const [tickerA, setTickerA] = useState('NVDA')
  const [tickerB, setTickerB] = useState('AMD')
  const [period, setPeriod]   = useState<Period>('1y')
  const [points, setPoints]   = useState<ComparePoint[]>([])
  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const COLOR_A = '#2563EB'
  const COLOR_B = '#059669'

  const load = useCallback(async () => {
    if (!tickerA || !tickerB) return
    setLoading(true)
    setError(null)
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/historical?ticker=${encodeURIComponent(tickerA)}&period=${period}`).then((r) => r.json()),
        fetch(`/api/historical?ticker=${encodeURIComponent(tickerB)}&period=${period}`).then((r) => r.json()),
      ])
      if (resA.error || resB.error) throw new Error(resA.error ?? resB.error)
      const { points: pts, stats: st } = buildCompareData(resA as OHLCV[], resB as OHLCV[])
      if (pts.length === 0) throw new Error('No overlapping data for selected period')
      setPoints(pts)
      setStats(st)
    } catch (e) {
      setError(String(e))
      setPoints([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [tickerA, tickerB, period])

  useEffect(() => { load() }, [load])

  const ratioMean = stats?.meanRatio ?? 1
  const correlationColor = stats == null ? '#94a3b8'
    : stats.correlation >= 0.8 ? '#059669'
    : stats.correlation >= 0.5 ? '#D97706'
    : '#DC2626'

  const zScoreColor = stats == null ? '#94a3b8'
    : Math.abs(stats.ratioZScore) >= 2 ? '#DC2626'
    : Math.abs(stats.ratioZScore) >= 1 ? '#D97706'
    : '#059669'

  return (
    <div className="min-h-screen bg-[#F8FAFB]">

      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-white">
        <h1 className="text-base font-semibold text-slate-900">Pairs Ratio Analysis</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Track relative performance between two instruments · Spot divergences · Pairs trading signals
        </p>
      </div>

      {/* Controls */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-end gap-4">
          <TickerInput value={tickerA} onChange={setTickerA} accent={COLOR_A} label="Company A" />

          <div className="flex items-center pb-2">
            <span className="text-2xl font-light text-slate-300">/</span>
          </div>

          <TickerInput value={tickerB} onChange={setTickerB} accent={COLOR_B} label="Company B" />

          {/* Period */}
          <div className="flex flex-col gap-1 ml-auto">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Period</span>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={[
                    'px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                    period === p.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Swap button */}
          <button
            onClick={() => { setTickerA(tickerB); setTickerB(tickerA) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-[12px] font-medium text-slate-600 hover:bg-slate-200 transition-colors self-end"
            title="Swap A and B"
          >
            ⇄ Swap
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="px-6 py-8 flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
          <span className="text-sm text-slate-500">Fetching data…</span>
        </div>
      )}

      {!loading && stats && points.length > 0 && (
        <div className="px-6 py-6 space-y-6">

          {/* ── KPI stats ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <StatCard
              label={`${tickerA} return`}
              value={`${stats.aReturn >= 0 ? '+' : ''}${stats.aReturn.toFixed(1)}%`}
              color={stats.aReturn >= 0 ? '#059669' : '#DC2626'}
            />
            <StatCard
              label={`${tickerB} return`}
              value={`${stats.bReturn >= 0 ? '+' : ''}${stats.bReturn.toFixed(1)}%`}
              color={stats.bReturn >= 0 ? '#059669' : '#DC2626'}
            />
            <StatCard
              label="Outperformer"
              value={stats.aReturn >= stats.bReturn ? tickerA : tickerB}
              sub={`by ${Math.abs(stats.aReturn - stats.bReturn).toFixed(1)} pp`}
              color={COLOR_A}
            />
            <StatCard
              label="Correlation"
              value={stats.correlation.toFixed(3)}
              sub={stats.correlation >= 0.8 ? 'High — trades as pair' : stats.correlation >= 0.5 ? 'Moderate' : 'Low — weak pair'}
              color={correlationColor}
            />
            <StatCard
              label={`${tickerA}/${tickerB} ratio`}
              value={stats.currentRatio.toFixed(4)}
              sub={`mean ${stats.meanRatio.toFixed(4)}`}
              color={COLOR_A}
            />
            <StatCard
              label="Ratio Z-score"
              value={stats.ratioZScore.toFixed(2)}
              sub={Math.abs(stats.ratioZScore) >= 2 ? '⚠ Extreme divergence' : Math.abs(stats.ratioZScore) >= 1 ? 'Elevated' : 'Near mean'}
              color={zScoreColor}
            />
            <StatCard
              label="Max spread"
              value={`${stats.maxDivergence.toFixed(1)} pp`}
              sub="peak divergence (indexed)"
            />
          </div>

          {/* ── Divergence signal banner ───────────────────────────────────── */}
          {Math.abs(stats.ratioZScore) >= 1.5 && (
            <div className={[
              'flex items-center gap-3 px-4 py-3 rounded-lg border text-sm',
              Math.abs(stats.ratioZScore) >= 2
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-amber-50 border-amber-200 text-amber-700',
            ].join(' ')}>
              <span className="text-base">{Math.abs(stats.ratioZScore) >= 2 ? '🔴' : '🟡'}</span>
              <div>
                <span className="font-semibold">
                  {Math.abs(stats.ratioZScore) >= 2 ? 'Extreme divergence' : 'Elevated divergence'} detected
                </span>
                {' — '}
                {stats.ratioZScore > 0
                  ? <><span className="font-semibold">{tickerA}</span> is trading expensive relative to <span className="font-semibold">{tickerB}</span> ({stats.ratioZScore.toFixed(2)}σ above mean ratio)</>
                  : <><span className="font-semibold">{tickerB}</span> is trading expensive relative to <span className="font-semibold">{tickerA}</span> ({Math.abs(stats.ratioZScore).toFixed(2)}σ below mean ratio)</>
                }
                {'. Mean-reversion thesis: '}
                {stats.ratioZScore > 0
                  ? `consider short ${tickerA} / long ${tickerB}`
                  : `consider long ${tickerA} / short ${tickerB}`
                }
              </div>
            </div>
          )}

          {/* ── Chart 1: Indexed prices ────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider">
                Indexed Price Performance
              </span>
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[11px] text-slate-400">Both rebased to 100 at start</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickLine={false} axisLine={false} width={44}
                    tickFormatter={(v) => v.toFixed(0)}
                  />
                  <ReferenceLine y={100} stroke="#e2e8f0" strokeDasharray="3 3" />
                  <Tooltip content={<CompareTooltip tickerA={tickerA} tickerB={tickerB} />} />
                  <Legend
                    formatter={(v) => <span className="text-[11px] text-slate-600">{v}</span>}
                    iconType="plainline" iconSize={16}
                  />
                  <Line
                    type="monotone" dataKey="a" name={tickerA}
                    stroke={COLOR_A} strokeWidth={2} dot={false} isAnimationActive={false}
                  />
                  <Line
                    type="monotone" dataKey="b" name={tickerB}
                    stroke={COLOR_B} strokeWidth={2} dot={false} isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Charts 2 & 3: Ratios side-by-side ─────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* A/B ratio */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: COLOR_A }}>
                  {tickerA} / {tickerB} Ratio
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false} axisLine={false} interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false} axisLine={false} width={48}
                      tickFormatter={(v) => v.toFixed(3)}
                      domain={['auto', 'auto']}
                    />
                    {/* Mean ratio reference line */}
                    <ReferenceLine
                      y={ratioMean}
                      stroke="#D97706" strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: 'mean', position: 'right', fontSize: 9, fill: '#D97706' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const v = payload[0]?.value as number
                        const pctFromMean = ((v - ratioMean) / ratioMean) * 100
                        return (
                          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-card-md">
                            <div className="text-slate-400 mb-1">{label}</div>
                            <div className="font-semibold tabular-nums" style={{ color: COLOR_A }}>{v.toFixed(4)}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: pctFromMean >= 0 ? '#059669' : '#DC2626' }}>
                              {pctFromMean >= 0 ? '+' : ''}{pctFromMean.toFixed(1)}% vs mean
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Line
                      type="monotone" dataKey="ratio" name={`${tickerA}/${tickerB}`}
                      stroke={COLOR_A} strokeWidth={1.5} dot={false} isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Ratio &gt; mean → {tickerA} expensive vs {tickerB} · Ratio &lt; mean → {tickerA} cheap vs {tickerB}
              </p>
            </div>

            {/* B/A ratio */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: COLOR_B }}>
                  {tickerB} / {tickerA} Ratio
                </span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false} axisLine={false} interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickLine={false} axisLine={false} width={48}
                      tickFormatter={(v) => v.toFixed(3)}
                      domain={['auto', 'auto']}
                    />
                    <ReferenceLine
                      y={1 / ratioMean}
                      stroke="#D97706" strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: 'mean', position: 'right', fontSize: 9, fill: '#D97706' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const v = payload[0]?.value as number
                        const inv = 1 / ratioMean
                        const pctFromMean = ((v - inv) / inv) * 100
                        return (
                          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-card-md">
                            <div className="text-slate-400 mb-1">{label}</div>
                            <div className="font-semibold tabular-nums" style={{ color: COLOR_B }}>{v.toFixed(4)}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: pctFromMean >= 0 ? '#059669' : '#DC2626' }}>
                              {pctFromMean >= 0 ? '+' : ''}{pctFromMean.toFixed(1)}% vs mean
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Line
                      type="monotone" dataKey="ratioInv" name={`${tickerB}/${tickerA}`}
                      stroke={COLOR_B} strokeWidth={1.5} dot={false} isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Ratio &gt; mean → {tickerB} expensive vs {tickerA} · Ratio &lt; mean → {tickerB} cheap vs {tickerA}
              </p>
            </div>
          </div>

          {/* ── Pairs trading explainer ───────────────────────────────────── */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider mb-3">How to read this</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12px] text-slate-600 leading-relaxed">
              <div>
                <span className="text-slate-800 font-semibold">Indexed chart</span>
                <br />Both prices rebased to 100 at period start. Widening gap = divergence. If they usually trade together, expect reversion.
              </div>
              <div>
                <span className="text-slate-800 font-semibold">Ratio chart</span>
                <br />A/B rising = A outperforming B. A/B above its mean = A historically expensive relative to B. Mean-reversion trade: short A, long B.
              </div>
              <div>
                <span className="text-slate-800 font-semibold">Z-score signal</span>
                <br />|Z| &gt; 2σ = statistically extreme divergence. High correlation + extreme Z-score = strongest pairs signal. This is NOT investment advice.
              </div>
            </div>
          </div>

          {/* ── Quick links ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/stock/${tickerA}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <span className="text-blue-500">▶</span> Full analysis: {tickerA}
            </Link>
            <Link
              href={`/stock/${tickerB}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-600 transition-colors"
            >
              <span className="text-emerald-500">▶</span> Full analysis: {tickerB}
            </Link>
          </div>

        </div>
      )}

      {/* Empty state */}
      {!loading && !error && points.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="text-4xl font-bold text-slate-200">A/B</div>
          <p className="text-sm text-slate-400">Select two tickers above to compare</p>
        </div>
      )}

    </div>
  )
}
