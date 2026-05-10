'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import MultiTickerChart, { type OHLCV } from '@/components/charts/MultiTickerChart'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ComparePoint {
  date: string
  a: number
  b: number
  ratio: number
  ratioInv: number
}

interface Stats {
  correlation: number
  aReturn: number
  bReturn: number
  currentRatio: number
  meanRatio: number
  ratioZScore: number
  maxDivergence: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pearsonCorr(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx; const dy = ys[i] - my
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy
  }
  const denom = Math.sqrt(dx2 * dy2)
  return denom === 0 ? 0 : num / denom
}

function buildCompareData(aRaw: OHLCV[], bRaw: OHLCV[]): { points: ComparePoint[]; stats: Stats } {
  const empty = { points: [], stats: { correlation: 0, aReturn: 0, bReturn: 0, currentRatio: 0, meanRatio: 0, ratioZScore: 0, maxDivergence: 0 } }
  const bMap = new Map(bRaw.map(r => [r.date.slice(0, 10), r.close]))
  const aligned = aRaw
    .map(r => ({ date: r.date.slice(0, 10), aClose: r.close, bClose: bMap.get(r.date.slice(0, 10)) }))
    .filter((r): r is { date: string; aClose: number; bClose: number } => r.bClose !== undefined && r.aClose > 0 && r.bClose > 0)
  if (aligned.length < 2) return empty

  const a0 = aligned[0].aClose; const b0 = aligned[0].bClose
  const points: ComparePoint[] = aligned.map(r => {
    const aN = (r.aClose / a0) * 100; const bN = (r.bClose / b0) * 100
    return {
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
      a: Math.round(aN * 100) / 100,
      b: Math.round(bN * 100) / 100,
      ratio: Math.round((aN / bN) * 10000) / 10000,
      ratioInv: Math.round((bN / aN) * 10000) / 10000,
    }
  })

  const aNorms = points.map(p => p.a); const bNorms = points.map(p => p.b)
  const ratios = points.map(p => p.ratio)
  const meanRatio = ratios.reduce((s, v) => s + v, 0) / ratios.length
  const stdRatio = Math.sqrt(ratios.reduce((s, v) => s + Math.pow(v - meanRatio, 2), 0) / ratios.length)
  const currentRatio = ratios[ratios.length - 1]

  return {
    points,
    stats: {
      correlation: Math.round(pearsonCorr(aNorms, bNorms) * 1000) / 1000,
      aReturn: Math.round((aNorms[aNorms.length - 1] - 100) * 100) / 100,
      bReturn: Math.round((bNorms[bNorms.length - 1] - 100) * 100) / 100,
      currentRatio,
      meanRatio: Math.round(meanRatio * 10000) / 10000,
      ratioZScore: stdRatio > 0 ? Math.round(((currentRatio - meanRatio) / stdRatio) * 100) / 100 : 0,
      maxDivergence: Math.round(Math.max(...points.map(p => Math.abs(p.a - p.b))) * 100) / 100,
    },
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className="text-base font-bold tabular-nums" style={{ color: color ?? '#0f172a' }}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Ratio Tooltip ────────────────────────────────────────────────────────────
function RatioTooltip({ active, payload, label, mean, color }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  active?: boolean; payload?: any[]; label?: string; mean: number; color: string
}) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value as number
  const pct = ((v - mean) / mean) * 100
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-card-md">
      <div className="text-slate-400 mb-1">{label}</div>
      <div className="font-semibold tabular-nums" style={{ color }}>{v.toFixed(4)}</div>
      <div className="text-[10px] mt-0.5" style={{ color: pct >= 0 ? '#059669' : '#DC2626' }}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}% vs mean
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ComparePage() {
  const [chartTickers, setChartTickers] = useState<string[]>(['NVDA', 'AMD'])
  const [pairData, setPairData] = useState<{ points: ComparePoint[]; stats: Stats } | null>(null)

  const COLOR_A = '#818cf8'
  const COLOR_B = '#34d399'

  const tickerA = chartTickers[0] ?? ''
  const tickerB = chartTickers[1] ?? ''

  const handleDataReady = useCallback((tickers: string[], data: Map<string, OHLCV[]>) => {
    if (tickers.length < 2) { setPairData(null); return }
    const aRaw = data.get(tickers[0]) ?? []
    const bRaw = data.get(tickers[1]) ?? []
    if (aRaw.length === 0 || bRaw.length === 0) return
    setPairData(buildCompareData(aRaw, bRaw))
  }, [])

  const stats = pairData?.stats ?? null
  const points = pairData?.points ?? []
  const ratioMean = stats?.meanRatio ?? 1

  const correlationColor = !stats ? '#94a3b8'
    : stats.correlation >= 0.8 ? '#059669'
    : stats.correlation >= 0.5 ? '#D97706'
    : '#DC2626'

  const zScoreColor = !stats ? '#94a3b8'
    : Math.abs(stats.ratioZScore) >= 2 ? '#DC2626'
    : Math.abs(stats.ratioZScore) >= 1 ? '#D97706'
    : '#059669'

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-white">
        <h1 className="text-base font-semibold text-slate-900">Multi-Ticker Comparison</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Add tickers via the search tag · Compare indexed performance · Pairs analysis for first two tickers
        </p>
      </div>

      {/* Chart */}
      <div className="px-6 pt-6">
        <MultiTickerChart
          initialTickers={['NVDA', 'AMD']}
          height={320}
          defaultPeriod="1y"
          onTickersChange={setChartTickers}
          onDataReady={handleDataReady}
        />
      </div>

      {/* Pairs analysis — only when exactly 2 tickers */}
      {chartTickers.length >= 2 && stats && points.length > 0 && (
        <div className="px-6 py-6 space-y-6">

          {/* KPI stats */}
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

          {/* Divergence signal banner */}
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
                  ? <><span className="font-semibold">{tickerA}</span> is trading expensive relative to <span className="font-semibold">{tickerB}</span> ({stats.ratioZScore.toFixed(2)}σ above mean)</>
                  : <><span className="font-semibold">{tickerB}</span> is trading expensive relative to <span className="font-semibold">{tickerA}</span> ({Math.abs(stats.ratioZScore).toFixed(2)}σ below mean)</>
                }
                {'. Mean-reversion thesis: '}
                {stats.ratioZScore > 0
                  ? `consider short ${tickerA} / long ${tickerB}`
                  : `consider long ${tickerA} / short ${tickerB}`
                }
              </div>
            </div>
          )}

          {/* Ratio charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: `${tickerA} / ${tickerB} Ratio`, dataKey: 'ratio', color: COLOR_A, mean: ratioMean },
              { label: `${tickerB} / ${tickerA} Ratio`, dataKey: 'ratioInv', color: COLOR_B, mean: 1 / ratioMean },
            ].map(({ label, dataKey, color, mean }) => (
              <div key={dataKey} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} tickFormatter={v => v.toFixed(3)} domain={['auto', 'auto']} />
                      <ReferenceLine y={mean} stroke="#D97706" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'mean', position: 'right', fontSize: 9, fill: '#D97706' }} />
                      <Tooltip content={<RatioTooltip mean={mean} color={color} />} />
                      <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          {/* Pairs trading explainer */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider mb-3">How to read this</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[12px] text-slate-600 leading-relaxed">
              <div><span className="text-slate-800 font-semibold">Indexed chart</span><br />Both prices rebased to 100. Widening gap = divergence. Correlated names usually mean-revert.</div>
              <div><span className="text-slate-800 font-semibold">Ratio chart</span><br />A/B rising = A outperforming. A/B above mean = A historically expensive vs B. Mean-reversion: short A, long B.</div>
              <div><span className="text-slate-800 font-semibold">Z-score signal</span><br />|Z| &gt; 2σ = statistically extreme. High correlation + extreme Z = strongest pairs signal. Not investment advice.</div>
            </div>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-3">
            {chartTickers.slice(0, 4).map((t, i) => (
              <Link
                key={t}
                href={`/stock/${t}`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                <span style={{ color: ['#818cf8', '#34d399', '#fb923c', '#f472b6'][i] }}>▶</span>
                {' '}Full analysis: {t}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Hint when only 1 ticker */}
      {chartTickers.length < 2 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm text-slate-400">Add a second ticker above to see pairs analysis</p>
        </div>
      )}
    </div>
  )
}
