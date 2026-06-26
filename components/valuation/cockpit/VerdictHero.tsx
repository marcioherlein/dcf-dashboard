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
// VERDICT_TAILWIND kept for reference — replaced by VERDICT_DARK for dark surface
const _VERDICT_TAILWIND: Record<CockpitOutput['verdict'], string> = {
  'Undervalued':       'text-[#5F790B]',
  'Fairly Valued':     'text-[#2563EB]',
  'Overvalued':        'text-[#D83B3B]',
  'Insufficient Data': 'text-[#6B6B6B]',
}

const CONVICTION_LABEL: Record<string, string> = {
  high:   'High confidence',
  medium: 'Moderate confidence',
  low:    'Low confidence',
}
function ScenarioSlider({
  bear, base, bull, currentPrice, currency,
  bearWacc, baseWacc, bullWacc,
  bearCagr, baseCagr, bullCagr,
}: {
  bear: number | null
  base: number | null
  bull: number | null
  currentPrice: number
  currency: string
  bearWacc?: number
  baseWacc?: number
  bullWacc?: number
  bearCagr?: number
  baseCagr?: number
  bullCagr?: number
}) {
  if (bear == null || base == null || bull == null) return (
    <p className="text-[11px] text-white/35">Scenario range unavailable — insufficient model data.</p>
  )
  const lo = Math.min(bear, bull)
  const hi = Math.max(bear, bull)
  const range = hi - lo
  if (range <= 0) return (
    <p className="text-[11px] text-white/35">All scenarios converge to the same value.</p>
  )

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
      <div className="flex items-center justify-between text-[10px] font-semibold text-white/40 mb-1.5">
        <span>Bear</span>
        <span>Base</span>
        <span>Bull</span>
      </div>

      {/* Track */}
      <div className="relative h-2 rounded-full bg-gradient-to-r from-[#F0B8B8] via-[#FFF4DA] to-[#BFD2A1]" style={{ opacity: 0.85 }}>
        {/* Base case dot — olive */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#7CB518] shadow-sm z-10"
          style={{ left: `${basePct}%`, transform: 'translate(-50%, -50%)' }}
          title={`Base: ${fmtPrice(base, currency)}`}
        />
        {/* Current price tick */}
        {!currentOutside && (
          <div
            className="absolute top-0 h-full w-px bg-white/60"
            style={{ left: `${currentPct}%` }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex items-start justify-between mt-2 text-[11px]">
        <div>
          <p className="font-[650] text-white/80 tabular-nums">{fmtPrice(bear, currency)}</p>
          {bearUpside != null && (
            <p className={`text-[10px] font-semibold tabular-nums ${bearUpside >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
              {fmtPct(bearUpside)}
            </p>
          )}
          {(bearWacc != null || bearCagr != null) && (
            <p className="text-[9px] text-white/28 tabular-nums mt-0.5 leading-snug">
              {[bearWacc != null && `WACC ${(bearWacc*100).toFixed(1)}%`, bearCagr != null && `CAGR ${(bearCagr*100).toFixed(0)}%`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="text-center">
          <p className="font-[700] text-[#60A5FA] tabular-nums">{fmtPrice(base, currency)}</p>
          {baseUpside != null && (
            <p className={`text-[10px] font-semibold tabular-nums ${baseUpside >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
              {fmtPct(baseUpside)}
            </p>
          )}
          {(baseWacc != null || baseCagr != null) && (
            <p className="text-[9px] text-white/28 tabular-nums mt-0.5 leading-snug">
              {[baseWacc != null && `WACC ${(baseWacc*100).toFixed(1)}%`, baseCagr != null && `CAGR ${(baseCagr*100).toFixed(0)}%`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-[650] text-white/80 tabular-nums">{fmtPrice(bull, currency)}</p>
          {bullUpside != null && (
            <p className={`text-[10px] font-semibold tabular-nums ${bullUpside >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
              {fmtPct(bullUpside)}
            </p>
          )}
          {(bullWacc != null || bullCagr != null) && (
            <p className="text-[9px] text-white/28 tabular-nums mt-0.5 leading-snug">
              {[bullWacc != null && `WACC ${(bullWacc*100).toFixed(1)}%`, bullCagr != null && `CAGR ${(bullCagr*100).toFixed(0)}%`].filter(Boolean).join(' · ')}
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
  const conv = CONVICTION_LABEL[output.divergence.overallConfidence] ?? 'Moderate confidence'
  const validCount = output.methods.filter(m => m.fairValue != null && m.fairValue > 0).length

  const efficiency = output.blendedFairValue != null && output.blendedFairValue > 0 && currentPrice > 0
    ? currentPrice / output.blendedFairValue
    : null

  const upsideSign = output.upsidePct != null && output.upsidePct >= 0 ? '+' : ''
  const upColor = output.upsidePct != null
    ? (output.upsidePct >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]')
    : 'text-[#94A3B8]'

  return (
    <div
      className="rounded-[14px] overflow-hidden relative"
      style={{
        background: 'linear-gradient(160deg, #1e293b 0%, #334155 55%, #475569 100%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      }}
    >
      {/* Olive ambient glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(ellipse 55% 70% at 95% -5%, rgba(95,121,11,0.16) 0%, transparent 55%)',
        }}
      />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1px_360px]">

        {/* ── Left: Verdict + metrics ── */}
        <div className="px-6 py-5 flex flex-col gap-4">

          {/* Eyebrow + Share button */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-[700] text-white/45 uppercase tracking-widest">Our Verdict</span>
            <button
              onClick={() => setShareOpen(true)}
              aria-label="Share valuation card"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 text-[11px] font-[650] text-white/55 hover:border-white/30 hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0"
            >
              <Share2 size={11} />
              Share
            </button>
          </div>

          {/* Headline — fair value leads, verdict word follows */}
          <div>
            <p className="text-[10px] font-[650] text-white/45 leading-tight mb-1">Fair value estimate</p>
            <h2 className="text-[2rem] sm:text-[2.2rem] font-[800] leading-none tabular-nums text-white tracking-tight">
              {output.blendedFairValue != null ? fmtPrice(output.blendedFairValue, currency) : '—'}
            </h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-[700] border"
                style={{
                  color: vd.colorHex,
                  background: vd.bgHex,
                  borderColor: vd.borderHex,
                }}
              >
                {vd.word}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-[650] text-white/55">
                <svg className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {conv}
              </span>
              <span className="text-white/20 text-[10px]">·</span>
              <span className="text-[11px] text-white/45">{validCount} of {output.methods.length} models</span>
              {starRating && (
                <>
                  <span className="text-white/20 text-[10px]">·</span>
                  <div
                    className="flex items-center gap-1"
                    role="img"
                    aria-label={`${starRating.stars} out of 5 stars — ${starRating.label}`}
                  >
                    <div className="flex items-center gap-px" aria-hidden="true">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} className={`w-2.5 h-2.5 ${i < starRating.stars ? 'text-[#F59E0B]' : 'text-white/20'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-[10px] font-[650] text-white/45">{starRating.label}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-0 border border-white/12 rounded-xl overflow-hidden bg-white/5">
            {/* Fair Value */}
            <div className="px-3 py-3 flex flex-col gap-0.5">
              <p className="text-[10px] font-[650] text-white/45 leading-tight">
                Fair value
                {' '}<InfoTooltip text="Weighted average of available valuation models." />
              </p>
              <p className="text-[18px] sm:text-[22px] font-[750] tabular-nums text-white leading-tight">
                {output.blendedFairValue != null ? fmtPrice(output.blendedFairValue, currency) : '—'}
              </p>
              <p className="text-[10px] text-white/35">Per share</p>
            </div>

            {/* Divider */}
            <div className="border-l border-r border-white/12 px-3 py-3 flex flex-col gap-0.5">
              <p className="text-[10px] font-[650] text-white/45 leading-tight">
                Current price
                {changePct != null && (
                  <span className={`ml-1 ${changePct >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                    {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                  </span>
                )}
              </p>
              <p className="text-[18px] sm:text-[22px] font-[750] tabular-nums text-white leading-tight">
                {fmtPrice(currentPrice, currency)}
              </p>
              <p className="text-[10px] text-white/35">Per share</p>
            </div>

            {/* Upside */}
            <div className="px-3 py-3 flex flex-col gap-0.5">
              <p className="text-[10px] font-[650] text-white/45 leading-tight">Upside / Downside</p>
              <p className={`text-[18px] sm:text-[22px] font-[750] tabular-nums leading-tight ${upColor}`}>
                {output.upsidePct != null
                  ? `${upsideSign}${(output.upsidePct * 100).toFixed(1)}%`
                  : '—'}
              </p>
              <p className="text-[10px] text-white/35">Total return potential</p>
            </div>
          </div>

          {/* Efficiency metric */}
          {efficiency != null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 border border-white/10">
              <svg className="w-3.5 h-3.5 text-white/35 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[11px] font-[650] text-white/55">
                You pay{' '}
                <span className="font-[750] text-white tabular-nums">
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
            <p className="text-[11px] text-white/45 leading-snug">
              Market pricing in{' '}
              <span className="font-[650] text-white/80">
                {(output.marketImpliedGrowth * 100).toFixed(1)}% 5Y revenue CAGR
              </span>{' '}
              at current price.
            </p>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="hidden lg:block bg-white/10" />

        {/* ── Right: Scenario range ── */}
        <div className="px-6 py-5 flex flex-col justify-center gap-4 border-t border-white/10 lg:border-t-0 bg-white/4">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-[650] text-white/55">Scenario range</p>
            <InfoTooltip text="Bear, Base, and Bull cases re-run all four valuation methods at stressed assumptions (±2pp WACC, ±4pp CAGR)." />
          </div>
          <ScenarioSlider
            bear={output.scenarios.bear.fairValue}
            base={output.scenarios.base.fairValue}
            bull={output.scenarios.bull.fairValue}
            currentPrice={currentPrice}
            currency={currency}
            bearWacc={output.scenarios.bear.wacc}
            baseWacc={output.scenarios.base.wacc}
            bullWacc={output.scenarios.bull.wacc}
            bearCagr={output.scenarios.bear.cagr}
            baseCagr={output.scenarios.base.cagr}
            bullCagr={output.scenarios.bull.cagr}
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
