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
      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>{label}</span>
      <div className="relative" ref={ref}>
        <div
          className="flex items-center gap-2 bg-[#0d1117] border rounded-sm px-3 py-2 transition-colors focus-within:border-opacity-100"
          style={{ borderColor: open ? accent : '#30363d' }}
        >
          <span className="font-mono text-[11px] font-bold shrink-0" style={{ color: accent }}>$</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) select(query.trim()) }}
            placeholder="AAPL, NVDA…"
            className="flex-1 bg-transparent font-mono text-sm font-bold text-[#e6edf3] placeholder-[#484f58] focus:outline-none uppercase"
          />
          {loading && <div className="h-3 w-3 animate-spin rounded-full border border-[#30363d] shrink-0" style={{ borderTopColor: accent }} />}
        </div>
        {open && (
          <div className="absolute left-0 right-0 top-full mt-0.5 bg-[#161b22] border border-[#30363d] shadow-2xl z-50 max-h-48 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => select(r.symbol)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#21262d] border-b border-[#21262d] last:border-b-0 transition-colors"
              >
                <span className="font-mono text-xs font-bold w-16 shrink-0" style={{ color: accent }}>{r.symbol}</span>
                <span className="font-mono text-[10px] text-[#8b949e] truncate">{r.longname ?? r.shortname}</span>
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
    <div className="bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-xs font-mono shadow-2xl">
      <div className="text-[#8b949e] mb-1.5 text-[10px]">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name ?? p.dataKey}</span>
          <span className="font-bold tabular-nums" style={{ color: p.color }}>
            {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
      {/* Show Δ spread when both A and B present */}
      {payload.length === 2 && payload[0]?.name === tickerA && (
        <div className="mt-1 pt-1 border-t border-[#30363d] flex justify-between">
          <span className="text-[#6e7681]">Δ spread</span>
          <span className="font-bold tabular-nums text-[#e6edf3]">
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
    <div className="bg-[#0d1117] border border-[#21262d] rounded p-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-[#6e7681] mb-1">{label}</p>
      <p className="font-mono text-lg font-bold tabular-nums" style={{ color: color ?? '#e6edf3' }}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-[#484f58] mt-0.5">{sub}</p>}
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

  const COLOR_A = '#ff6600'
  const COLOR_B = '#388bfd'

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
  const correlationColor = stats == null ? '#6e7681'
    : stats.correlation >= 0.8 ? '#3fb950'
    : stats.correlation >= 0.5 ? '#d29922'
    : '#f85149'

  const zScoreColor = stats == null ? '#6e7681'
    : Math.abs(stats.ratioZScore) >= 2 ? '#f85149'
    : Math.abs(stats.ratioZScore) >= 1 ? '#d29922'
    : '#3fb950'

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">

      {/* Header */}
      <div className="px-6 py-4 border-b border-[#21262d]">
        <h1 className="font-mono text-base font-bold text-[#e6edf3] uppercase tracking-tight">Pairs Ratio Analysis</h1>
        <p className="font-mono text-[11px] text-[#8b949e] mt-0.5">
          Track relative performance between two instruments · Spot divergences · Pairs trading signals
        </p>
      </div>

      {/* Controls */}
      <div className="px-6 py-4 border-b border-[#21262d] bg-[#161b22]">
        <div className="flex flex-wrap items-end gap-4">
          <TickerInput value={tickerA} onChange={setTickerA} accent={COLOR_A} label="Company A" />

          <div className="flex items-center pb-2">
            <span className="font-mono text-2xl font-bold text-[#30363d]">/</span>
          </div>

          <TickerInput value={tickerB} onChange={setTickerB} accent={COLOR_B} label="Company B" />

          {/* Period */}
          <div className="flex flex-col gap-1 ml-auto">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#6e7681]">Period</span>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={[
                    'px-2.5 py-1.5 rounded font-mono text-[11px] font-semibold transition-colors',
                    period === p.value
                      ? 'bg-[#ff6600] text-black'
                      : 'bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d]',
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#21262d] border border-[#30363d] font-mono text-[11px] font-semibold text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition-colors self-end"
            title="Swap A and B"
          >
            ⇄ Swap
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-[#2d1418] border border-[#f85149]/40 rounded font-mono text-xs text-[#f85149]">
          {error}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="px-6 py-8 flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border border-[#30363d] border-t-[#ff6600]" />
          <span className="font-mono text-xs text-[#6e7681]">Fetching data…</span>
        </div>
      )}

      {!loading && stats && points.length > 0 && (
        <div className="px-6 py-6 space-y-8">

          {/* ── KPI stats ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <StatCard
              label={`${tickerA} return`}
              value={`${stats.aReturn >= 0 ? '+' : ''}${stats.aReturn.toFixed(1)}%`}
              color={stats.aReturn >= 0 ? '#3fb950' : '#f85149'}
            />
            <StatCard
              label={`${tickerB} return`}
              value={`${stats.bReturn >= 0 ? '+' : ''}${stats.bReturn.toFixed(1)}%`}
              color={stats.bReturn >= 0 ? '#3fb950' : '#f85149'}
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
              'flex items-center gap-3 px-4 py-3 rounded border font-mono text-xs',
              Math.abs(stats.ratioZScore) >= 2
                ? 'bg-[#2d1418] border-[#f85149]/40 text-[#f85149]'
                : 'bg-[#1f2014] border-[#d29922]/40 text-[#d29922]',
            ].join(' ')}>
              <span className="text-base">{Math.abs(stats.ratioZScore) >= 2 ? '🔴' : '🟡'}</span>
              <div>
                <span className="font-bold">
                  {Math.abs(stats.ratioZScore) >= 2 ? 'Extreme divergence' : 'Elevated divergence'} detected
                </span>
                {' — '}
                {stats.ratioZScore > 0
                  ? <><span className="font-bold">{tickerA}</span> is trading expensive relative to <span className="font-bold">{tickerB}</span> ({stats.ratioZScore.toFixed(2)}σ above mean ratio)</>
                  : <><span className="font-bold">{tickerB}</span> is trading expensive relative to <span className="font-bold">{tickerA}</span> ({Math.abs(stats.ratioZScore).toFixed(2)}σ below mean ratio)</>
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
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-[10px] font-bold text-[#ff6600] uppercase tracking-widest">
                Indexed Price Performance
              </span>
              <div className="flex-1 h-px bg-[#21262d]" />
              <span className="font-mono text-[9px] text-[#6e7681]">Both rebased to 100 at start · Divergence = opportunity</span>
            </div>
            <div className="bg-[#0d1117] border border-[#21262d] rounded p-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#21262d" vertical={false} />
                  <XAxis
                    dataKey="date" tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                    tickLine={false} axisLine={false} width={44}
                    tickFormatter={(v) => v.toFixed(0)}
                  />
                  <ReferenceLine y={100} stroke="#30363d" strokeDasharray="3 3" />
                  <Tooltip content={<CompareTooltip tickerA={tickerA} tickerB={tickerB} />} />
                  <Legend
                    formatter={(v) => <span className="font-mono text-[10px]">{v}</span>}
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
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: COLOR_A }}>
                  {tickerA} / {tickerB} Ratio
                </span>
                <div className="flex-1 h-px bg-[#21262d]" />
              </div>
              <div className="bg-[#0d1117] border border-[#21262d] rounded p-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#21262d" vertical={false} />
                    <XAxis
                      dataKey="date" tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                      tickLine={false} axisLine={false} interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                      tickLine={false} axisLine={false} width={48}
                      tickFormatter={(v) => v.toFixed(3)}
                      domain={['auto', 'auto']}
                    />
                    {/* Mean ratio reference line */}
                    <ReferenceLine
                      y={ratioMean}
                      stroke="#d29922" strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: 'mean', position: 'right', fontSize: 8, fill: '#d29922', fontFamily: 'IBM Plex Mono, monospace' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const v = payload[0]?.value as number
                        const pctFromMean = ((v - ratioMean) / ratioMean) * 100
                        return (
                          <div className="bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-xs font-mono shadow-2xl">
                            <div className="text-[#8b949e] mb-1 text-[10px]">{label}</div>
                            <div className="font-bold tabular-nums" style={{ color: COLOR_A }}>{v.toFixed(4)}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: pctFromMean >= 0 ? '#3fb950' : '#f85149' }}>
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
              <p className="font-mono text-[9px] text-[#484f58] mt-1.5">
                Ratio &gt; mean → {tickerA} expensive vs {tickerB} · Ratio &lt; mean → {tickerA} cheap vs {tickerB}
              </p>
            </div>

            {/* B/A ratio */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: COLOR_B }}>
                  {tickerB} / {tickerA} Ratio
                </span>
                <div className="flex-1 h-px bg-[#21262d]" />
              </div>
              <div className="bg-[#0d1117] border border-[#21262d] rounded p-4 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#21262d" vertical={false} />
                    <XAxis
                      dataKey="date" tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                      tickLine={false} axisLine={false} interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#6e7681', fontFamily: 'IBM Plex Mono, monospace' }}
                      tickLine={false} axisLine={false} width={48}
                      tickFormatter={(v) => v.toFixed(3)}
                      domain={['auto', 'auto']}
                    />
                    <ReferenceLine
                      y={1 / ratioMean}
                      stroke="#d29922" strokeDasharray="4 3" strokeWidth={1.5}
                      label={{ value: 'mean', position: 'right', fontSize: 8, fill: '#d29922', fontFamily: 'IBM Plex Mono, monospace' }}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const v = payload[0]?.value as number
                        const inv = 1 / ratioMean
                        const pctFromMean = ((v - inv) / inv) * 100
                        return (
                          <div className="bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-xs font-mono shadow-2xl">
                            <div className="text-[#8b949e] mb-1 text-[10px]">{label}</div>
                            <div className="font-bold tabular-nums" style={{ color: COLOR_B }}>{v.toFixed(4)}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: pctFromMean >= 0 ? '#3fb950' : '#f85149' }}>
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
              <p className="font-mono text-[9px] text-[#484f58] mt-1.5">
                Ratio &gt; mean → {tickerB} expensive vs {tickerA} · Ratio &lt; mean → {tickerB} cheap vs {tickerA}
              </p>
            </div>
          </div>

          {/* ── Pairs trading explainer ───────────────────────────────────── */}
          <div className="bg-[#161b22] border border-[#21262d] rounded p-4">
            <p className="font-mono text-[10px] font-bold text-[#ff6600] uppercase tracking-widest mb-2">How to read this</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[10px] text-[#8b949e] leading-relaxed">
              <div>
                <span className="text-[#e6edf3] font-semibold">Indexed chart</span>
                <br />Both prices rebased to 100 at period start. Widening gap = divergence. If they usually trade together, expect reversion.
              </div>
              <div>
                <span className="text-[#e6edf3] font-semibold">Ratio chart</span>
                <br />A/B rising = A outperforming B. A/B above its mean = A historically expensive relative to B. Mean-reversion trade: short A, long B.
              </div>
              <div>
                <span className="text-[#e6edf3] font-semibold">Z-score signal</span>
                <br />|Z| &gt; 2σ = statistically extreme divergence. High correlation + extreme Z-score = strongest pairs signal. This is NOT investment advice.
              </div>
            </div>
          </div>

          {/* ── Quick links ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/stock/${tickerA}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#21262d] border border-[#30363d] font-mono text-xs font-semibold text-[#e6edf3] hover:border-[#ff6600] hover:text-[#ff6600] transition-colors"
              style={{ borderColor: COLOR_A + '44' }}
            >
              <span style={{ color: COLOR_A }}>▶</span> Full analysis: {tickerA}
            </Link>
            <Link
              href={`/stock/${tickerB}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#21262d] border border-[#30363d] font-mono text-xs font-semibold text-[#e6edf3] hover:text-[#388bfd] transition-colors"
              style={{ borderColor: COLOR_B + '44' }}
            >
              <span style={{ color: COLOR_B }}>▶</span> Full analysis: {tickerB}
            </Link>
          </div>

        </div>
      )}

      {/* Empty state */}
      {!loading && !error && points.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="font-mono text-4xl text-[#30363d]">A/B</div>
          <p className="font-mono text-sm text-[#6e7681]">Select two tickers above to compare</p>
        </div>
      )}

    </div>
  )
}
