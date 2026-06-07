'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { fmtPrice } from '@/lib/formatters'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { runMonteCarlo, buildMCInputs, type MCResult, type MCInputs } from '@/lib/valuation/montecarloDCF'
import type { ValuationAssumptions, CockpitSnapshot } from '@/lib/valuation/cockpit'

interface Props {
  assumptions:  ValuationAssumptions
  snapshot:     CockpitSnapshot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData:      Record<string, any>
  sensitivity:  Partial<Record<keyof ValuationAssumptions, number>>
  currentPrice: number
  currency:     string
}

// ── CVaR quality dots ─────────────────────────────────────────────────────────

function cvarDots(ratio: number): { dots: number; label: string; color: string } {
  if (ratio >= 0.80) return { dots: 5, label: 'Excellent tail shape',  color: 'text-[#11875D]' }
  if (ratio >= 0.65) return { dots: 4, label: 'Contained tail risk',   color: 'text-[#11875D]' }
  if (ratio >= 0.50) return { dots: 3, label: 'Moderate tail risk',    color: 'text-[#B56A00]'   }
  if (ratio >= 0.35) return { dots: 2, label: 'Elevated tail risk',    color: 'text-orange-500'  }
  return               { dots: 1, label: 'Severe left tail',           color: 'text-[#D83B3B]'     }
}

function CvarDots({ ratio }: { ratio: number }) {
  const { dots, label, color } = cvarDots(ratio)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={cn('w-2 h-2 rounded-full', i < dots ? color.replace('text-', 'bg-') : 'bg-[#E3E1DA]')}
          />
        ))}
      </div>
      <span className={cn('text-[10px] font-[650]', color)}>{label}</span>
    </div>
  )
}

// ── Plain-language summary ────────────────────────────────────────────────────

function buildSummary(result: MCResult, currentPrice: number, currency: string): string {
  const lo = fmtPrice(result.p25, currency)
  const hi = fmtPrice(result.p75, currency)
  const pct = Math.round((result.p75 - result.p25) / result.mean * 100)
  const upsideMed = currentPrice > 0 ? ((result.adjustedP50 - currentPrice) / currentPrice * 100) : null
  const upStr = upsideMed != null
    ? ` The median scenario implies ${upsideMed >= 0 ? '+' : ''}${upsideMed.toFixed(0)}% vs current price.`
    : ''
  return `In 50% of ${result.nPaths.toLocaleString()} simulated paths, fair value falls between ${lo} and ${hi} — a ${pct}% spread driven by regime uncertainty.${upStr}`
}

// ── Histogram ────────────────────────────────────────────────────────────────

function Histogram({
  histogram, p10, p25, p75, p90, currentPrice, adjustedP50, currency,
}: {
  histogram: MCResult['histogram']
  p10: number; p25: number; p75: number; p90: number
  currentPrice: number; adjustedP50: number; currency: string
}) {
  if (!histogram.length) return null
  const maxPct = Math.max(...histogram.map(b => b.pct), 0.001)

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-px h-16 w-full" role="img" aria-label="Fair value distribution histogram">
        {histogram.map((b, i) => {
          const h = (b.pct / maxPct) * 100
          const isPrice   = currentPrice >= b.lo && currentPrice < b.hi
          const isAdjP50  = adjustedP50 >= b.lo && adjustedP50 < b.hi
          const isTailLo  = b.hi <= p10
          const isTailHi  = b.lo >= p90
          const isCore    = b.lo >= p25 && b.hi <= p75
          return (
            <div
              key={i}
              className="flex-1 rounded-t-[1px]"
              style={{
                height: `${Math.max(3, h)}%`,
                backgroundColor:
                  isPrice   ? '#2563EB' :
                  isAdjP50  ? '#5F790B' :
                  isTailLo  ? 'rgba(216,59,59,0.45)' :
                  isTailHi  ? 'rgba(95,121,11,0.35)' :
                  isCore    ? 'rgba(95,121,11,0.22)' :
                              'rgba(100,116,139,0.20)',
              }}
              title={`${fmtPrice(b.lo, currency)}–${fmtPrice(b.hi, currency)}: ${(b.pct*100).toFixed(1)}%`}
            />
          )
        })}
      </div>

      {/* X-axis */}
      <div className="flex justify-between text-[11px] text-[#8A95A6] font-mono tabular-nums">
        <span>{fmtPrice(histogram[0]?.lo ?? 0, currency)}</span>
        <span>{fmtPrice(histogram[Math.floor(histogram.length / 2)]?.lo ?? 0, currency)}</span>
        <span>{fmtPrice(histogram[histogram.length - 1]?.hi ?? 0, currency)}</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {[
          { color: 'rgba(216,59,59,0.45)', label: 'P10 tail' },
          { color: 'rgba(95,121,11,0.22)', label: 'P25–P75' },
          { color: '#5F790B',              label: 'Adjusted P50' },
          { color: '#2563EB',              label: 'Current price' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[11px] text-[#566174]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Percentile strip ──────────────────────────────────────────────────────────

function PercentileStrip({
  p10, p25, p75, p90, adjustedP50, cvarDiscount, currentPrice, currency,
}: {
  p10: number; p25: number; p75: number; p90: number
  adjustedP50: number; cvarDiscount: number
  currentPrice: number; currency: string
}) {
  const items = [
    { label: 'P10',  value: p10,          color: 'text-[#D83B3B]', sub: 'Worst 10%'    },
    { label: 'P25',  value: p25,          color: 'text-orange-500', sub: '1st quartile' },
    { label: 'P50',  value: adjustedP50,  color: 'text-[#5F790B]',  sub: cvarDiscount > 0.001 ? `−${(cvarDiscount*100).toFixed(0)}% CVaR adj` : 'Median'  },
    { label: 'P75',  value: p75,          color: 'text-[#11875D]', sub: '3rd quartile' },
    { label: 'P90',  value: p90,          color: 'text-[#11875D]', sub: 'Best 10%'     },
  ]
  return (
    <div className="grid grid-cols-5 gap-px bg-[#F4F3EF] rounded-xl overflow-hidden border border-[#E3E1DA]">
      {items.map(({ label, value, color, sub }) => {
        const upside = currentPrice > 0 ? (value - currentPrice) / currentPrice : null
        return (
          <div key={label} className="bg-white px-2 py-2.5 flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-[700] text-[#8A95A6] uppercase tracking-wide">{label}</span>
            <span className={cn('text-[13px] font-[800] tabular-nums leading-tight', color)}>
              {fmtPrice(value, currency)}
            </span>
            {upside != null && (
              <span className={cn('text-[11px] font-[650] tabular-nums', upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(0)}%
              </span>
            )}
            <span className="text-[8px] text-[#8A95A6] leading-none text-center">{sub}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Regime bar ────────────────────────────────────────────────────────────────

function RegimeBar({ probs }: { probs: [number, number, number] }) {
  const [bear, base, bull] = probs
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-[10px] font-[650] text-[#566174]">Regime time allocation</p>
        <InfoTooltip
          text="Proportion of simulation steps spent in Bear, Base, and Bull regimes across all paths. Calibrated to this company's historical growth and margin distribution."
          side="top"
        />
      </div>
      <div className="flex h-3 rounded-full overflow-hidden w-full">
        <div className="h-full bg-[#D83B3B]/50" style={{ width: `${bear*100}%` }} />
        <div className="h-full bg-[#CDD1C8]"    style={{ width: `${base*100}%` }} />
        <div className="h-full bg-[#5F790B]/50" style={{ width: `${bull*100}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[11px] font-[650] text-[#D83B3B] tabular-nums">Bear {(bear*100).toFixed(0)}%</span>
        <span className="text-[11px] font-[650] text-[#566174] tabular-nums">Base {(base*100).toFixed(0)}%</span>
        <span className="text-[11px] font-[650] text-[#5F790B] tabular-nums">Bull {(bull*100).toFixed(0)}%</span>
      </div>
    </div>
  )
}

// ── First-run onboarding tooltip ──────────────────────────────────────────────

const ONBOARD_KEY = 'mc_panel_onboarded_v1'

function OnboardTooltip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-[#BFD2A1] bg-[#F6FAEA] p-4 text-[11px] text-[#3D5A08] leading-relaxed">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="font-[700] text-[12px] text-[#5F790B]">What is this?</p>
          <p>
            Instead of a single fair value estimate, this model runs {(10_000).toLocaleString()} independent futures for the company.
            Each path moves through realistic economic regimes — Bear, Base, and Bull — using this company&apos;s own historical data to calibrate what &quot;bad&quot; and &quot;good&quot; look like for this specific business.
          </p>
          <p>
            The result is a <strong>distribution</strong> of fair values. The <strong>P50</strong> (median) is the adjusted fair value.
            The width of the distribution tells you how uncertain the model is — a tight band means high conviction, a wide band means outcome uncertainty is genuinely high.
          </p>
          <p>
            The <strong>tail risk score</strong> (●●●●○) measures how bad the worst 10% of scenarios are relative to the average. A full 5 dots means even bad scenarios aren&apos;t catastrophic. 1–2 dots means the left tail is severe.
          </p>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss explanation"
          className="shrink-0 text-[#5F790B] hover:text-[#3D5A08] text-[16px] leading-none mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] rounded"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MonteCarloPanel({
  assumptions, snapshot, apiData, sensitivity, currentPrice, currency,
}: Props) {
  const [result,    setResult]    = useState<MCResult | null>(null)
  const [running,   setRunning]   = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const [hasRun,    setHasRun]    = useState(false)
  const [showOnboard, setShowOnboard] = useState(false)
  const [nPaths, setNPaths] = useState<5_000 | 10_000 | 50_000>(10_000)
  const runIdRef = useRef(0)

  // First-run onboarding check
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined' && !localStorage.getItem(ONBOARD_KEY)) {
        setShowOnboard(true)
      }
    } catch { /* ignore */ }
  }, [])

  function dismissOnboard() {
    setShowOnboard(false)
    try { localStorage.setItem(ONBOARD_KEY, '1') } catch { /* ignore */ }
  }

  const runSimulation = useCallback(() => {
    setRunning(true)
    const id = ++runIdRef.current
    setTimeout(() => {
      try {
        const inputs: MCInputs = { ...buildMCInputs(assumptions, snapshot, apiData, sensitivity), nPaths }
        const r = runMonteCarlo(inputs)
        if (runIdRef.current === id) { setResult(r); setHasRun(true) }
      } finally {
        if (runIdRef.current === id) setRunning(false)
      }
    }, 0)
  }, [assumptions, snapshot, apiData, sensitivity, nPaths])

  useEffect(() => { if (!hasRun) runSimulation() }, [hasRun, runSimulation])

  const noData = snapshot.baseFCF <= 0 || snapshot.sharesM <= 0

  // ── Collapsed card view (peer method card) ────────────────────────────────
  const fairValue = result?.adjustedP50 ?? null
  const upside    = fairValue != null && currentPrice > 0 ? (fairValue - currentPrice) / currentPrice : null
  const upColor   = upside != null ? (upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]') : 'text-[#8A95A6]'
  const cv        = result ? cvarDots(result.cvarRatio) : null

  return (
    <div className={cn(
      'bg-white rounded-[14px] border shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden transition-colors',
      expanded ? 'border-[#BFD2A1]' : 'border-[#E6ECF5]'
    )}>

      {/* ── Method card header — matches ValuationMethodCards style ── */}
      <button
        onClick={() => { setExpanded(e => !e); if (!expanded && !hasRun) runSimulation() }}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-[#F4F3EF]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-inset"
        aria-expanded={expanded}
      >
        {/* Expand chevron */}
        <svg
          className={cn('w-3.5 h-3.5 text-[#8A95A6] shrink-0 transition-transform duration-150', expanded && 'rotate-90')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        {/* Method label */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[13px] font-[700] text-[#06101F] truncate">Monte Carlo DCF</span>
          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-[700] uppercase tracking-wide bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391] rounded-full">
            Beta
          </span>
          <InfoTooltip
            text="10,000 Markov-regime simulation paths with Longstaff-Schwartz real options. P50 adjusted for tail risk via CVaR. Analyst consensus anchors years 1–3."
            side="bottom"
          />
        </div>

        {/* Fair value + upside — shown collapsed */}
        {!expanded && (
          <div className="flex items-center gap-4 shrink-0">
            {running ? (
              <div className="flex items-center gap-1.5 text-[11px] text-[#8A95A6]">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Running…
              </div>
            ) : fairValue != null ? (
              <>
                <div className="text-right">
                  <p className="text-[13px] font-[750] tabular-nums text-[#06101F]">{fmtPrice(fairValue, currency)}</p>
                  {upside != null && (
                    <p className={cn('text-[11px] font-[650] tabular-nums', upColor)}>
                      {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
                {cv && (
                  <div className="flex items-center gap-0.5" aria-label={`Tail risk: ${cv.label}`} title={cv.label}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className={cn('w-1.5 h-1.5 rounded-full', i < cv.dots ? cv.color.replace('text-', 'bg-') : 'bg-[#E3E1DA]')} />
                    ))}
                  </div>
                )}
              </>
            ) : noData ? (
              <span className="text-[11px] text-[#8A95A6]">Insufficient data</span>
            ) : null}
          </div>
        )}
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-[#E3E1DA]">

          {/* Onboarding tooltip — first time only */}
          {showOnboard && (
            <div className="pt-4">
              <OnboardTooltip onDismiss={dismissOnboard} />
            </div>
          )}

          {/* Header controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-4">
            {result && (
              <p className="text-[11px] text-[#566174] leading-snug max-w-[480px]">
                {buildSummary(result, currentPrice, currency)}
              </p>
            )}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <div className="flex items-center gap-1 rounded-lg border border-[#E3E1DA] p-0.5 bg-[#F4F3EF]">
                {([5_000, 10_000, 50_000] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setNPaths(n)}
                    className={cn(
                      'text-[10px] font-[650] px-2 py-1 rounded-md transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#5F790B]',
                      nPaths === n ? 'bg-white text-[#06101F] shadow-sm' : 'text-[#8A95A6] hover:text-[#566174]'
                    )}
                  >
                    {n / 1000}k
                  </button>
                ))}
              </div>
              <button
                onClick={runSimulation}
                disabled={running || noData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5F790B] text-white text-[11px] font-[650] hover:bg-[#4A6009] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1"
              >
                {running ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Running…
                  </>
                ) : 'Re-run'}
              </button>
            </div>
          </div>

          {noData ? (
            <div className="py-8 text-center rounded-xl border border-[#E3E1DA] bg-[#F4F3EF]">
              <p className="text-[12px] font-[650] text-[#566174]">Insufficient data</p>
              <p className="text-[11px] text-[#8A95A6] mt-1">Requires positive trailing FCF and diluted share count.</p>
            </div>
          ) : !result || running ? (
            <div className="space-y-3">
              <div className="h-16 bg-[#F4F3EF] rounded-lg animate-pulse" />
              <div className="h-10 bg-[#F4F3EF] rounded-xl animate-pulse" />
              <div className="grid grid-cols-4 gap-2">
                {[0,1,2,3].map(i => <div key={i} className="h-14 bg-[#F4F3EF] rounded-lg animate-pulse" />)}
              </div>
            </div>
          ) : (
            <>
              {/* Histogram */}
              <Histogram
                histogram={result.histogram}
                p10={result.p10} p25={result.p25}
                p75={result.p75} p90={result.p90}
                currentPrice={currentPrice}
                adjustedP50={result.adjustedP50}
                currency={currency}
              />

              {/* Percentile strip */}
              <PercentileStrip
                p10={result.p10} p25={result.p25}
                p75={result.p75} p90={result.p90}
                adjustedP50={result.adjustedP50}
                cvarDiscount={result.cvarDiscount}
                currentPrice={currentPrice}
                currency={currency}
              />

              {/* CVaR + regime row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* CVaR */}
                <div className="rounded-xl border border-[#E3E1DA] bg-[#F4F3EF] px-4 py-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-[650] text-[#566174]">Tail risk quality</p>
                    <InfoTooltip
                      text={`CVaR ratio: ${result.cvarRatio.toFixed(2)}. Expected value in worst 10% of paths divided by the overall mean. 1.0 = no tail drag. Below 0.50 = severe left tail. A ${(result.cvarDiscount * 100).toFixed(0)}% discount has been applied to the reported P50.`}
                      side="top"
                    />
                  </div>
                  <CvarDots ratio={result.cvarRatio} />
                  <p className="text-[11px] text-[#8A95A6] tabular-nums">
                    CVaR ratio {result.cvarRatio.toFixed(2)}
                    {result.cvarDiscount > 0.001 && (
                      <span className="text-orange-500 ml-1">· −{(result.cvarDiscount*100).toFixed(0)}% applied to P50</span>
                    )}
                  </p>
                </div>

                {/* Regime bar */}
                <div className="rounded-xl border border-[#E3E1DA] bg-[#F4F3EF] px-4 py-3">
                  <RegimeBar probs={result.regimeProbabilities} />
                </div>
              </div>

              {/* Real options */}
              {(result.abandonmentOptionValue > 0.001 || result.expansionOptionValue > 0.001) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#E3E1DA] bg-[#F4F3EF] px-3 py-2.5">
                    <p className="text-[11px] font-[650] text-[#8A95A6] uppercase tracking-wide mb-1">
                      Abandonment option
                      <InfoTooltip text="Value of the right to liquidate the firm at cash value if cumulative FCF turns deeply negative. Computed via Longstaff-Schwartz backward induction." side="top" />
                    </p>
                    <p className="text-[14px] font-[750] tabular-nums text-[#06101F]">
                      {result.abandonmentOptionValue > 0.001
                        ? '+' + fmtPrice(result.abandonmentOptionValue, currency)
                        : '—'}
                    </p>
                    <p className="text-[11px] text-[#8A95A6] mt-0.5">per share</p>
                  </div>
                  <div className="rounded-xl border border-[#E3E1DA] bg-[#F4F3EF] px-3 py-2.5">
                    <p className="text-[11px] font-[650] text-[#8A95A6] uppercase tracking-wide mb-1">
                      Expansion option
                      <InfoTooltip text="Value of deploying additional capex for 2 extra FCF years when year-3+ CAGR beats the historical P75. Captures compounder optionality." side="top" />
                    </p>
                    <p className="text-[14px] font-[750] tabular-nums text-[#06101F]">
                      {result.expansionOptionValue > 0.001
                        ? '+' + fmtPrice(result.expansionOptionValue, currency)
                        : '—'}
                    </p>
                    <p className="text-[11px] text-[#8A95A6] mt-0.5">per share</p>
                  </div>
                </div>
              )}

              {/* Calibration details */}
              <details className="group">
                <summary className="flex items-center gap-1.5 cursor-pointer list-none text-[10px] font-[650] text-[#8A95A6] hover:text-[#566174] transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 rounded">
                  <span className="text-[10px] group-open:rotate-90 transition-transform inline-block">▶</span>
                  Calibration details
                </summary>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Bear growth',     value: result.inputs.p25Growth != null ? `${(result.inputs.p25Growth*100).toFixed(1)}%` : 'derived' },
                    { label: 'Bull growth',     value: result.inputs.p75Growth != null ? `${(result.inputs.p75Growth*100).toFixed(1)}%` : 'derived' },
                    { label: 'Bear margin',     value: result.inputs.p25Margin != null ? `${(result.inputs.p25Margin*100).toFixed(1)}%` : 'derived' },
                    { label: 'Bull margin',     value: result.inputs.p75Margin != null ? `${(result.inputs.p75Margin*100).toFixed(1)}%` : 'derived' },
                    { label: 'G/M correlation', value: result.inputs.growthMarginCorr.toFixed(2) },
                    { label: 'Analyst Y1 rev',  value: result.inputs.analystRevY1 != null ? fmtPrice(result.inputs.analystRevY1, currency) : 'none' },
                    { label: 'Liq. floor',      value: result.inputs.liquidationPerShare != null ? fmtPrice(result.inputs.liquidationPerShare, currency) : 'none' },
                    { label: 'Std deviation',   value: fmtPrice(result.stdDev, currency) },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg border border-[#E3E1DA] bg-white px-2.5 py-1.5">
                      <p className="text-[11px] text-[#8A95A6]">{label}</p>
                      <p className="text-[11px] font-[650] text-[#566174] mt-0.5 tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              </details>

              <p className="text-[11px] text-[#8A95A6] leading-relaxed border-t border-[#E3E1DA] pt-3">
                Beta model — exploratory analysis only. P50 is CVaR-adjusted and shown as this method&apos;s fair value estimate. Real option values are informational; they are not added to the point estimate. Not financial advice.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
