'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { fmtPrice } from '@/lib/formatters'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { runMonteCarlo, buildMCInputs, type MCResult, type MCInputs } from '@/lib/valuation/montecarloDCF'
import type { ValuationAssumptions, CockpitSnapshot } from '@/lib/valuation/cockpit'

interface Props {
  assumptions: ValuationAssumptions
  snapshot: CockpitSnapshot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData: Record<string, any>
  sensitivity: Partial<Record<keyof ValuationAssumptions, number>>
  currentPrice: number
  currency: string
}

// ── Histogram bar component ──────────────────────────────────────────────────

function Histogram({
  histogram, p10, p50, p90, currentPrice, currency,
}: {
  histogram: MCResult['histogram']
  p10: number; p50: number; p90: number
  currentPrice: number; currency: string
}) {
  if (histogram.length === 0) return null
  const maxPct = Math.max(...histogram.map(b => b.pct))

  return (
    <div className="space-y-1">
      {/* Bars */}
      <div className="flex items-end gap-px h-20 w-full">
        {histogram.map((b, i) => {
          const height = maxPct > 0 ? (b.pct / maxPct) * 100 : 0
          const isCurrentPrice = currentPrice >= b.lo && currentPrice < b.hi
          const isP50 = p50 >= b.lo && p50 < b.hi
          const isTail = b.hi <= p10
          const isCore = b.lo >= p10 && b.hi <= p90
          return (
            <div
              key={i}
              className="flex-1 rounded-t-[1px] transition-none"
              style={{
                height: `${Math.max(2, height)}%`,
                backgroundColor: isCurrentPrice
                  ? '#2563EB'
                  : isP50
                  ? '#10B981'
                  : isTail
                  ? 'rgba(239,68,68,0.5)'
                  : isCore
                  ? 'rgba(100,116,139,0.35)'
                  : 'rgba(100,116,139,0.18)',
              }}
              title={`${fmtPrice(b.lo, currency)} – ${fmtPrice(b.hi, currency)}: ${(b.pct * 100).toFixed(1)}%`}
            />
          )
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex justify-between text-[9px] text-slate-400 font-mono">
        <span>{fmtPrice(histogram[0]?.lo ?? 0, currency)}</span>
        <span>{fmtPrice(histogram[Math.floor(histogram.length / 2)]?.lo ?? 0, currency)}</span>
        <span>{fmtPrice(histogram[histogram.length - 1]?.hi ?? 0, currency)}</span>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap mt-1">
        {[
          { color: '#EF4444', opacity: 0.5, label: 'P10 tail' },
          { color: '#64748B', opacity: 0.35, label: 'P10–P90 range' },
          { color: '#10B981', opacity: 1, label: 'P50 (fair value)' },
          { color: '#2563EB', opacity: 1, label: 'Current price' },
        ].map(({ color, opacity, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: color, opacity }} />
            <span className="text-[9px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Regime bar ───────────────────────────────────────────────────────────────

function RegimeBar({ probabilities }: { probabilities: [number, number, number] }) {
  const [bear, base, bull] = probabilities
  return (
    <div>
      <p className="text-[10px] font-[650] text-slate-500 mb-1.5">
        Regime time allocation
        <InfoTooltip text="Proportion of simulation steps spent in each regime across all 10,000 paths. Driven by Markov transition matrix weighted by sensitivity analysis." side="top" />
      </p>
      <div className="flex h-4 rounded-full overflow-hidden w-full">
        <div className="h-full bg-red-400/70 transition-none" style={{ width: `${bear * 100}%` }} />
        <div className="h-full bg-slate-300 transition-none" style={{ width: `${base * 100}%` }} />
        <div className="h-full bg-emerald-400/70 transition-none" style={{ width: `${bull * 100}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-[9px] font-mono text-slate-400">
        <span className="text-red-500 font-[600]">Bear {(bear * 100).toFixed(0)}%</span>
        <span className="text-slate-500 font-[600]">Base {(base * 100).toFixed(0)}%</span>
        <span className="text-emerald-600 font-[600]">Bull {(bull * 100).toFixed(0)}%</span>
      </div>
    </div>
  )
}

// ── Percentile strip ─────────────────────────────────────────────────────────

function PercentileStrip({
  p10, p25, p50, p75, p90, currentPrice, currency,
}: {
  p10: number; p25: number; p50: number; p75: number; p90: number
  currentPrice: number; currency: string
}) {
  const items = [
    { label: 'P10',    value: p10,  color: 'text-red-500',     sub: 'Worst 10%' },
    { label: 'P25',    value: p25,  color: 'text-orange-500',  sub: '1st quartile' },
    { label: 'P50',    value: p50,  color: 'text-blue-600',    sub: 'Median (FV)' },
    { label: 'P75',    value: p75,  color: 'text-emerald-500', sub: '3rd quartile' },
    { label: 'P90',    value: p90,  color: 'text-emerald-600', sub: 'Best 10%' },
  ]
  return (
    <div className="grid grid-cols-5 gap-px bg-slate-100 rounded-xl overflow-hidden border border-slate-100">
      {items.map(({ label, value, color, sub }) => {
        const upside = currentPrice > 0 ? (value - currentPrice) / currentPrice : null
        return (
          <div key={label} className="bg-white px-2 py-2.5 flex flex-col items-center gap-0.5">
            <span className="text-[9px] font-[700] text-slate-400 uppercase tracking-wide">{label}</span>
            <span className={cn('text-[13px] font-[800] tabular-nums', color)}>
              {fmtPrice(value, currency)}
            </span>
            {upside != null && (
              <span className={cn('text-[9px] font-[600] tabular-nums', upside >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(0)}%
              </span>
            )}
            <span className="text-[8px] text-slate-300 leading-none">{sub}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function MonteCarloPanel({
  assumptions, snapshot, apiData, sensitivity, currentPrice, currency,
}: Props) {
  const [result, setResult] = useState<MCResult | null>(null)
  const [running, setRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const [nPaths, setNPaths] = useState<5_000 | 10_000 | 50_000>(10_000)
  const runIdRef = useRef(0)

  const runSimulation = useCallback(() => {
    setRunning(true)
    const myRunId = ++runIdRef.current
    // Defer to next tick so the loading state renders before the blocking computation
    setTimeout(() => {
      try {
        const inputs: MCInputs = {
          ...buildMCInputs(assumptions, snapshot, apiData, sensitivity),
          nPaths,
        }
        const r = runMonteCarlo(inputs)
        if (runIdRef.current === myRunId) {
          setResult(r)
          setHasRun(true)
        }
      } finally {
        if (runIdRef.current === myRunId) setRunning(false)
      }
    }, 0)
  }, [assumptions, snapshot, apiData, sensitivity, nPaths])

  // Run once on mount
  useEffect(() => {
    if (!hasRun) runSimulation()
  }, [hasRun, runSimulation])

  const noData = snapshot.baseFCF <= 0 || snapshot.sharesM <= 0

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-[700] text-slate-900">Monte Carlo DCF</p>
              <span className="px-1.5 py-0.5 text-[9px] font-[700] uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 rounded-full">Beta</span>
              <InfoTooltip
                text="10,000 simulation paths. Each path evolves through Bear / Base / Bull regimes via a Markov chain calibrated to this company's own historical distribution. Longstaff-Schwartz pricing for real options (abandonment floor + expansion optionality). P50 is the reported fair value."
                side="bottom"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Markov-chain regime transitions · Longstaff-Schwartz real options
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Path count selector */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {([5_000, 10_000, 50_000] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setNPaths(n)}
                  className={cn(
                    'text-[10px] font-[650] px-2 py-1 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    nPaths === n ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  {n >= 10_000 ? `${n / 1000}k` : `${n / 1000}k`}
                </button>
              ))}
            </div>

            <button
              onClick={runSimulation}
              disabled={running || noData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-[11px] font-[650] hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
            >
              {running ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running…
                </>
              ) : (
                <>Re-run</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-5">

        {noData ? (
          <div className="py-8 text-center">
            <p className="text-[12px] font-[600] text-slate-500">Insufficient FCF data</p>
            <p className="text-[11px] text-slate-400 mt-1">Monte Carlo DCF requires positive trailing FCF and share count.</p>
          </div>
        ) : !result || running ? (
          <div className="space-y-3">
            <div className="h-20 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          </div>
        ) : (
          <>
            {/* Histogram */}
            <div>
              <p className="text-[10px] font-[650] text-slate-500 mb-2">
                Fair value distribution ({result.nPaths.toLocaleString()} paths, {result.numYears}Y horizon)
              </p>
              <Histogram
                histogram={result.histogram}
                p10={result.p10}
                p50={result.p50}
                p90={result.p90}
                currentPrice={currentPrice}
                currency={currency}
              />
            </div>

            {/* Percentile strip */}
            <PercentileStrip
              p10={result.p10}
              p25={result.p25}
              p50={result.p50}
              p75={result.p75}
              p90={result.p90}
              currentPrice={currentPrice}
              currency={currency}
            />

            {/* Regime bar */}
            <RegimeBar probabilities={result.regimeProbabilities} />

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

              {/* Std dev */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[9px] font-[650] text-slate-400 uppercase tracking-wide mb-1">
                  Std deviation
                  <InfoTooltip text="Standard deviation of fair value across all paths. Higher = wider outcome range." side="top" />
                </p>
                <p className="text-[14px] font-[750] tabular-nums text-slate-700">{fmtPrice(result.stdDev, currency)}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {result.mean > 0 ? ((result.stdDev / result.mean) * 100).toFixed(0) : '—'}% of mean
                </p>
              </div>

              {/* CVaR ratio */}
              <div className={cn(
                'rounded-xl border px-3 py-2.5',
                result.cvarRatio >= 0.65 ? 'border-emerald-200 bg-emerald-50'
                  : result.cvarRatio >= 0.40 ? 'border-amber-200 bg-amber-50'
                  : 'border-red-200 bg-red-50'
              )}>
                <p className="text-[9px] font-[650] text-slate-400 uppercase tracking-wide mb-1">
                  Tail risk ratio
                  <InfoTooltip text="CVaR(P10) / mean. Expected value in worst 10% of outcomes divided by the mean. 1.0 = no tail risk. Below 0.50 = severe left tail." side="top" />
                </p>
                <p className={cn(
                  'text-[14px] font-[750] tabular-nums',
                  result.cvarRatio >= 0.65 ? 'text-emerald-700'
                    : result.cvarRatio >= 0.40 ? 'text-amber-700'
                    : 'text-red-600'
                )}>
                  {result.cvarRatio.toFixed(2)}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {result.cvarRatio >= 0.65 ? 'Contained left tail'
                    : result.cvarRatio >= 0.40 ? 'Moderate tail risk'
                    : 'Heavy left tail'}
                </p>
              </div>

              {/* Abandonment option */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[9px] font-[650] text-slate-400 uppercase tracking-wide mb-1">
                  Abandonment option
                  <InfoTooltip text="Longstaff-Schwartz value of the option to liquidate the firm (at cash / shares) if cumulative FCF turns deeply negative. Bounds the worst-case left tail." side="top" />
                </p>
                <p className="text-[14px] font-[750] tabular-nums text-slate-700">
                  {result.abandonmentOptionValue > 0.001
                    ? '+' + fmtPrice(result.abandonmentOptionValue, currency)
                    : '—'}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">per share (LS)</p>
              </div>

              {/* Expansion option */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[9px] font-[650] text-slate-400 uppercase tracking-wide mb-1">
                  Expansion option
                  <InfoTooltip text="Value of the option to deploy additional capex for 2 extra FCF years when year-3 CAGR beats the historical P75 threshold. Captures compounder optionality." side="top" />
                </p>
                <p className="text-[14px] font-[750] tabular-nums text-slate-700">
                  {result.expansionOptionValue > 0.001
                    ? '+' + fmtPrice(result.expansionOptionValue, currency)
                    : '—'}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5">per share (LS)</p>
              </div>
            </div>

            {/* Inputs summary */}
            <details className="group">
              <summary className="flex items-center gap-1.5 cursor-pointer list-none text-[10px] font-[650] text-slate-400 hover:text-slate-600 transition-colors select-none">
                <span className="text-[9px] group-open:rotate-90 transition-transform inline-block">▶</span>
                Regime calibration inputs
              </summary>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                {[
                  { label: 'P25 Growth', value: result.inputs.p25Growth != null ? `${(result.inputs.p25Growth * 100).toFixed(1)}%` : 'derived' },
                  { label: 'P75 Growth', value: result.inputs.p75Growth != null ? `${(result.inputs.p75Growth * 100).toFixed(1)}%` : 'derived' },
                  { label: 'P25 Margin', value: result.inputs.p25Margin != null ? `${(result.inputs.p25Margin * 100).toFixed(1)}%` : 'derived' },
                  { label: 'P75 Margin', value: result.inputs.p75Margin != null ? `${(result.inputs.p75Margin * 100).toFixed(1)}%` : 'derived' },
                  { label: 'Sens. WACC', value: result.inputs.sensWacc.toFixed(3) },
                  { label: 'Sens. CAGR', value: result.inputs.sensCagr.toFixed(3) },
                  { label: 'Sens. Margin', value: result.inputs.sensMarg.toFixed(3) },
                  { label: 'Liquidation floor', value: result.inputs.liquidationPerShare != null ? fmtPrice(result.inputs.liquidationPerShare, currency) : 'none' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                    <p className="text-[9px] text-slate-400">{label}</p>
                    <p className="font-[650] text-slate-600 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Disclaimer */}
            <p className="text-[9px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
              Beta model — for exploratory analysis only. P50 is reported as this method's fair value contribution when weighted into the main blend. Real option values are not added to the point estimate; they are informational. Not financial advice.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
