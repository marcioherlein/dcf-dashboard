'use client'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'
import InfoTooltip from '@/components/ui/InfoTooltip'

interface Props {
  price: number
  /** shares in millions (fairValue.sharesOutstanding) */
  sharesM: number | null
  /** cash in millions (fairValue.cash) */
  cashM: number | null
  /** debt in millions (fairValue.debt) */
  debtM: number | null
  /** revenue in millions (businessProfile.revenueM) */
  revenueM: number | null
  /** FCF / Revenue (businessProfile.fcfMargin) */
  fcfMargin: number | null
  wacc: number
  terminalG: number
  /** 3Y historical revenue CAGR (cagrAnalysis.historicalCagr3y) */
  historicalCAGR?: number | null
  isEmergingMarket?: boolean
}

const INTERP_STYLES = {
  conservative:    { bar: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  reasonable:      { bar: 'bg-blue-500',    text: 'text-blue-700',    chip: 'bg-blue-50 border-blue-200 text-blue-700' },
  aggressive:      { bar: 'bg-amber-500',   text: 'text-amber-700',   chip: 'bg-amber-50 border-amber-200 text-amber-700' },
  very_aggressive: { bar: 'bg-red-500',     text: 'text-red-700',     chip: 'bg-red-50 border-red-200 text-red-700' },
  not_meaningful:  { bar: 'bg-slate-300',   text: 'text-slate-500',   chip: 'bg-slate-50 border-slate-200 text-slate-500' },
}

const INTERP_LABELS: Record<string, string> = {
  conservative:    'Conservative',
  reasonable:      'Reasonable',
  aggressive:      'Aggressive',
  very_aggressive: 'Very Aggressive',
  not_meaningful:  'Not Applicable',
}

export default function ReverseDcfCallout({
  price, sharesM, cashM, debtM, revenueM, fcfMargin,
  wacc, terminalG, historicalCAGR, isEmergingMarket,
}: Props) {
  const result = useMemo(() => computeReverseDCF({
    currentPrice:     price,
    sharesOutstanding: sharesM != null ? sharesM * 1e6 : null,
    cashM,
    debtM,
    lastRevenue:  revenueM != null ? revenueM * 1e6 : null,
    lastFCFMargin: fcfMargin,
    wacc,
    terminalG,
    historicalCAGR,
  }), [price, sharesM, cashM, debtM, revenueM, fcfMargin, wacc, terminalG, historicalCAGR])

  const styles = INTERP_STYLES[result.interpretation]
  const label  = INTERP_LABELS[result.interpretation]

  const impliedPct    = result.impliedCAGR != null ? result.impliedCAGR * 100 : null
  const historicalPct = historicalCAGR != null ? historicalCAGR * 100 : null

  const scale      = Math.max(impliedPct ?? 0, historicalPct ?? 0, 12)
  const impliedW   = impliedPct    != null ? Math.min(100, (impliedPct    / scale) * 100) : 0
  const historicalW = historicalPct != null ? Math.min(100, (historicalPct / scale) * 100) : 0

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/30 overflow-hidden shadow-card">

      {/* Header */}
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            What the Market Is Pricing In
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-slate-900 flex items-center gap-1">
            Reverse DCF Analysis
            <InfoTooltip content="Works backward from today's price to estimate the revenue growth rate the market is already pricing in. If the implied growth rate seems unrealistic, the stock may be expensive. Not a buy/sell signal." />
          </h3>
        </div>
        <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap', styles.chip)}>
          {label}
        </span>
      </div>

      {/* Scale legend */}
      {result.interpretation !== 'not_meaningful' && (
        <div className="px-4 sm:px-5 pt-3 pb-0 flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
          <span className="font-medium">Expectation scale:</span>
          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">Conservative</span>
          <span className="text-slate-300">→</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-500">Moderate</span>
          <span className="text-slate-300">→</span>
          <span className="px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">Aggressive</span>
          <span className="text-slate-300">→</span>
          <span className="px-1.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">Very Aggressive</span>
        </div>
      )}

      {/* Body */}
      <div className="px-4 sm:px-5 py-4 space-y-4">
        {result.interpretation === 'not_meaningful' ? (
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
            <span className="text-slate-400 text-lg leading-none mt-0.5 shrink-0">—</span>
            <p className="text-sm text-slate-500 leading-relaxed">{result.interpretationText}</p>
          </div>
        ) : (
          <>
            {/* Two-column layout: numbers left, bars right */}
            <div className="flex flex-col sm:flex-row gap-5">

              {/* Left: CAGR numbers + gap callout */}
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-end gap-4 sm:gap-6 flex-wrap">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                      Implied 5Y Revenue CAGR
                    </p>
                    <p className={cn('text-2xl sm:text-3xl font-bold tabular-nums font-mono leading-none', styles.text)}>
                      {impliedPct != null ? `${impliedPct.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                  {historicalPct != null && (
                    <div className="mb-0.5">
                      <p className="text-[11px] text-slate-400 mb-0.5">3Y Historical</p>
                      <p className="text-lg font-semibold tabular-nums font-mono text-slate-700 leading-none">
                        {historicalPct.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Gap callout */}
                {historicalPct != null && impliedPct != null && Math.abs(impliedPct - historicalPct) > 1 && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[12px] text-slate-600 leading-relaxed">
                    The market assumes <strong>{impliedPct.toFixed(1)}%</strong> growth — that&apos;s{' '}
                    <strong className={impliedPct < historicalPct ? 'text-amber-700' : 'text-emerald-700'}>
                      {Math.abs(impliedPct - historicalPct).toFixed(1)}pp {impliedPct < historicalPct ? 'below' : 'above'}
                    </strong>{' '}
                    the 3-year historical track record of <strong>{historicalPct.toFixed(1)}%</strong>.
                  </div>
                )}
              </div>

              {/* Right: horizontal bar comparison */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-slate-500">Implied 5Y CAGR</span>
                    <span className={cn('text-[11px] font-semibold tabular-nums font-mono', styles.text)}>
                      {impliedPct != null ? `${impliedPct.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', styles.bar)}
                      style={{ width: `${impliedW}%` }}
                    />
                  </div>
                </div>
                {historicalPct != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-slate-500">3Y Historical CAGR</span>
                      <span className="text-[11px] font-semibold tabular-nums font-mono text-slate-600">
                        {historicalPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400 transition-all duration-700 delay-100"
                        style={{ width: `${historicalW}%` }}
                      />
                    </div>
                  </div>
                )}
                {/* Axis labels */}
                <div className="flex justify-between">
                  <span className="text-[10px] text-slate-300">0%</span>
                  <span className="text-[10px] text-slate-300">{Math.ceil(scale / 10) * 10}%</span>
                </div>
              </div>
            </div>

            {/* Interpretation text */}
            <p className="text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
              {result.interpretationText}
            </p>

            {/* Negative implied growth plain-language callout */}
            {impliedPct != null && impliedPct < 0 && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-[12px] text-blue-700 leading-relaxed">
                <strong>What does a negative implied growth rate mean?</strong> The market is pricing this stock as if revenue will shrink over the next 5 years. This reflects very conservative (bearish) expectations — which can represent an opportunity if you believe the business will return to growth.
              </div>
            )}
          </>
        )}

        {/* EM warning */}
        {isEmergingMarket && result.interpretation !== 'not_meaningful' && (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
            <span className="text-amber-600 text-base leading-none mt-0.5 shrink-0">⚠</span>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              <strong>Emerging market:</strong> historical CAGR benchmark may be distorted by currency effects. Interpret with caution.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-t border-slate-100">
        <p className="text-[10px] text-slate-400">
          Reverse DCF solves for the revenue growth rate already priced in, holding FCF margin and WACC constant. Not a buy/sell signal.
        </p>
      </div>
    </div>
  )
}
