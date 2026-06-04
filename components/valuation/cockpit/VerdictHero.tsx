'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { fmtPrice } from '@/lib/formatters'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { VERDICT_DISPLAY } from '@/lib/brand'
import type { CockpitOutput } from '@/lib/valuation/cockpit'
import type { StarRatingResult } from '@/lib/valuation/valueInvestingAnalysis'
import ShareCardModal from '@/components/valuation/ShareCardModal'

interface Props {
  output: CockpitOutput
  currentPrice: number
  changePct: number | null
  currency: string
  ticker: string
  companyName?: string
  starRating?: StarRatingResult | null
}

// Tailwind color classes derived from insic brand palette
const VERDICT_TAILWIND: Record<CockpitOutput['verdict'], string> = {
  'Undervalued':       'text-[#5F790B]',
  'Fairly Valued':     'text-[#2563EB]',
  'Overvalued':        'text-[#D83B3B]',
  'Insufficient Data': 'text-[#64748B]',
}

const CONVICTION_LABEL: Record<string, string> = {
  high:   'High confidence',
  medium: 'Moderate confidence',
  low:    'Low confidence',
}
function ScenarioSlider({
  bear, base, bull, currentPrice, currency,
}: {
  bear: number | null
  base: number | null
  bull: number | null
  currentPrice: number
  currency: string
}) {
  if (bear == null || base == null || bull == null) return null
  const lo = Math.min(bear, bull)
  const hi = Math.max(bear, bull)
  const range = hi - lo
  if (range <= 0) return null

  const basePct = Math.max(2, Math.min(98, ((base - lo) / range) * 100))
  const currentPct = Math.max(0, Math.min(100, ((currentPrice - lo) / range) * 100))
  const currentOutside = currentPrice < lo || currentPrice > hi

  const bearUpside = currentPrice > 0 ? ((bear - currentPrice) / currentPrice * 100) : null
  const baseUpside = currentPrice > 0 ? ((base - currentPrice) / currentPrice * 100) : null
  const bullUpside = currentPrice > 0 ? ((bull - currentPrice) / currentPrice * 100) : null

  const fmtPct = (v: number | null) =>
    v == null ? '' : ` ${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 mb-1.5">
        <span>Bear</span>
        <span>Base</span>
        <span>Bull</span>
      </div>

      {/* Track */}
      <div className="relative h-2 rounded-full bg-gradient-to-r from-[#F0B8B8] via-[#E3E6E0] to-[#BFD2A1]">
        {/* Base case dot — olive */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#5F790B] shadow-sm z-10"
          style={{ left: `${basePct}%`, transform: 'translate(-50%, -50%)' }}
          title={`Base: ${fmtPrice(base, currency)}`}
        />
        {/* Current price tick */}
        {!currentOutside && (
          <div
            className="absolute top-0 h-full w-px bg-slate-400 opacity-60"
            style={{ left: `${currentPct}%` }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex items-start justify-between mt-2 text-[11px]">
        <div>
          <p className="font-[650] text-slate-700 tabular-nums">{fmtPrice(bear, currency)}</p>
          {bearUpside != null && (
            <p className={`text-[10px] font-semibold tabular-nums ${bearUpside >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmtPct(bearUpside)}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="font-[700] text-[#2563EB] tabular-nums">{fmtPrice(base, currency)}</p>
          {baseUpside != null && (
            <p className={`text-[10px] font-semibold tabular-nums ${baseUpside >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmtPct(baseUpside)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-[650] text-slate-700 tabular-nums">{fmtPrice(bull, currency)}</p>
          {bullUpside != null && (
            <p className={`text-[10px] font-semibold tabular-nums ${bullUpside >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmtPct(bullUpside)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerdictHero({
  output, currentPrice, changePct, currency, ticker, companyName = '', starRating,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false)
  const vd = VERDICT_DISPLAY[output.verdict] ?? VERDICT_DISPLAY['Insufficient Data']
  const verdictTailwind = VERDICT_TAILWIND[output.verdict]
  const conv = CONVICTION_LABEL[output.divergence.overallConfidence] ?? 'Moderate confidence'
  const validCount = output.methods.filter(m => m.fairValue != null && m.fairValue > 0).length

  const efficiency = output.blendedFairValue != null && output.blendedFairValue > 0 && currentPrice > 0
    ? currentPrice / output.blendedFairValue
    : null

  const upsideSign = output.upsidePct != null && output.upsidePct >= 0 ? '+' : ''
  const upColor = output.upsidePct != null
    ? (output.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')
    : 'text-slate-400'

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1px_360px]">

        {/* ── Left: Verdict + metrics ── */}
        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Eyebrow + Share button */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-[700] uppercase tracking-widest text-slate-400">Our Verdict</span>
            <button
              onClick={() => setShareOpen(true)}
              aria-label="Share valuation card"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 text-[11px] font-[650] text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              <Share2 size={11} />
              Share
            </button>
          </div>

          {/* Headline */}
          <div>
            <h2 className="text-[2rem] sm:text-[2.5rem] font-[800] leading-[1.1] tracking-tight text-slate-900" style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif', textWrap: 'balance' }}>
              <span>{ticker} looks </span>
              <span className={verdictTailwind}>{vd.word}</span>
            </h2>

            {/* Conviction line */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-[650] text-slate-500">
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {conv}
              </span>
              <span className="text-slate-200 text-[10px]">·</span>
              <span className="text-[11px] text-slate-400">{validCount} of {output.methods.length} models</span>
              {starRating && (
                <>
                  <span className="text-slate-200 text-[10px]">·</span>
                  <div
                    className="flex items-center gap-1"
                    role="img"
                    aria-label={`${starRating.stars} out of 5 stars — ${starRating.label}`}
                  >
                    <div className="flex items-center gap-px" aria-hidden="true">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} className={`w-2.5 h-2.5 ${i < starRating.stars ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-[10px] font-[650] text-slate-500">{starRating.label}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Three key numbers */}
          <div className="grid grid-cols-3 gap-0 border border-slate-100 rounded-xl overflow-hidden">
            {/* Fair Value */}
            <div className="px-4 py-3 flex flex-col gap-0.5">
              <p className="text-[10px] font-[650] text-slate-400">
                Fair value
                {' '}<InfoTooltip text="Weighted average of available valuation models." />
              </p>
              <p className="text-[18px] sm:text-[20px] font-[750] tabular-nums text-slate-900 leading-tight">
                {output.blendedFairValue != null ? fmtPrice(output.blendedFairValue, currency) : '—'}
              </p>
              <p className="text-[10px] text-slate-400">Per share</p>
            </div>

            {/* Divider */}
            <div className="border-l border-r border-slate-100 px-4 py-3 flex flex-col gap-0.5">
              <p className="text-[10px] font-[650] text-slate-400">
                Current price
                {changePct != null && (
                  <span className={`ml-1 ${changePct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                )}
              </p>
              <p className="text-[18px] sm:text-[20px] font-[750] tabular-nums text-slate-900 leading-tight">
                {fmtPrice(currentPrice, currency)}
              </p>
              <p className="text-[10px] text-slate-400">Per share</p>
            </div>

            {/* Upside */}
            <div className="px-4 py-3 flex flex-col gap-0.5">
              <p className="text-[10px] font-[650] text-slate-400">Upside / Downside</p>
              <p className={`text-[18px] sm:text-[20px] font-[750] tabular-nums leading-tight ${upColor}`}>
                {output.upsidePct != null
                  ? `${upsideSign}${(output.upsidePct * 100).toFixed(1)}%`
                  : '—'}
              </p>
              <p className="text-[10px] text-slate-400">Total return potential</p>
            </div>
          </div>

          {/* Efficiency metric */}
          {efficiency != null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] font-[650] text-slate-600">
                You pay{' '}
                <span className="font-[750] text-slate-800 tabular-nums">
                  {efficiency.toFixed(2) === '1.00'
                    ? '$1.00'
                    : `$${efficiency.toFixed(2)}`}
                </span>{' '}
                per $1 of estimated value.
              </p>
              <InfoTooltip
                text="Current price divided by blended fair value. Below $1.00 means you are buying a dollar of estimated value at a discount."
                side="top"
              />
            </div>
          )}

          {/* Market-implied CAGR if available */}
          {output.marketImpliedGrowth != null && (
            <p className="text-[11px] text-slate-400 leading-snug">
              Market pricing in{' '}
              <span className="font-[650] text-slate-600">
                {(output.marketImpliedGrowth * 100).toFixed(1)}% 5Y revenue CAGR
              </span>{' '}
              at current price.
            </p>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="hidden lg:block bg-slate-100" />

        {/* ── Right: Scenario range ── */}
        <div className="px-6 py-5 flex flex-col justify-center gap-4 border-t border-slate-100 lg:border-t-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-[650] text-slate-500">Scenario range</p>
            <InfoTooltip text="Bear, Base, and Bull cases re-run all four valuation methods at stressed assumptions (±2pp WACC, ±4pp CAGR)." />
          </div>
          <ScenarioSlider
            bear={output.scenarios.bear.fairValue}
            base={output.scenarios.base.fairValue}
            bull={output.scenarios.bull.fairValue}
            currentPrice={currentPrice}
            currency={currency}
          />
        </div>

      </div>

      <ShareCardModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        ticker={ticker}
        companyName={companyName}
        output={output}
        currentPrice={currentPrice}
        currency={currency}
      />
    </div>
  )
}
