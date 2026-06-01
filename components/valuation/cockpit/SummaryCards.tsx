'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitOutput } from '@/lib/valuation/cockpit'
import type { StarRatingResult } from '@/lib/valuation/valueInvestingAnalysis'

function buildSynthesis(output: CockpitOutput, currency: string): string | null {
  const { upsidePct, blendedFairValue, divergence, marketImpliedGrowth } = output
  if (blendedFairValue == null || upsidePct == null) return null

  const sign = upsidePct >= 0 ? '+' : ''
  const pct  = `${sign}${(upsidePct * 100).toFixed(0)}%`
  const fv   = fmtPrice(blendedFairValue, currency)
  const validCount = output.methods.filter(m => m.fairValue != null && m.fairValue > 0).length
  const confMap = { high: 'High', medium: 'Moderate', low: 'Low' } as const
  const conf = confMap[divergence.overallConfidence]

  const impliedPart = marketImpliedGrowth != null
    ? ` Market pricing in ${(marketImpliedGrowth * 100).toFixed(0)}% 5Y CAGR.`
    : ''

  return `Blended fair value ${fv} — ${pct} vs current price. ${conf} conviction across ${validCount} of ${output.methods.length} models.${impliedPart}`
}

interface Props {
  output: CockpitOutput
  currentPrice: number
  changePct: number | null
  currency: string
  starRating?: StarRatingResult | null
}

const VERDICT_STYLE = {
  Undervalued:         { text: 'text-emerald-600' },
  'Fairly Valued':     { text: 'text-[#2563EB]' },
  Overvalued:          { text: 'text-red-600' },
  'Insufficient Data': { text: 'text-[#64748B]' },
}

const STAR_COLORS: Record<number, string> = {
  5: 'text-emerald-500',
  4: 'text-emerald-400',
  3: 'text-amber-400',
  2: 'text-orange-400',
  1: 'text-red-500',
}

function CellLabel({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <p className="text-[11px] font-[650] text-[#64748B]" title={title}>
      {children}
    </p>
  )
}

export default function SummaryCards({ output, currentPrice, changePct, currency, starRating }: Props) {
  const vstyle = VERDICT_STYLE[output.verdict]
  const upsideSign = output.upsidePct != null && output.upsidePct >= 0 ? '+' : ''
  const upColor = output.upsidePct != null ? (output.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-[#94A3B8]'
  const methodsComputed = output.methods.filter(m => m.fairValue != null).length

  const fvDisplay = output.blendedFairValue != null ? fmtPrice(output.blendedFairValue, currency) : '—'
  const upDisplay = output.upsidePct != null ? `${upsideSign}${(output.upsidePct * 100).toFixed(1)}%` : '—'
  const synthesis = buildSynthesis(output, currency)

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-[#F1F5F9]">

        {/* Current Price */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <CellLabel>Current Price</CellLabel>
          <p className="text-[20px] font-[750] tabular-nums text-[#0F172A] leading-none">
            {fmtPrice(currentPrice, currency)}
          </p>
          {changePct != null && (
            <p className={`text-[11px] font-[650] tabular-nums ${changePct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}% today
            </p>
          )}
        </div>

        {/* Blended Fair Value */}
        <div className="px-5 py-4 flex flex-col gap-1 border-t-2 border-[#2563EB]">
          <CellLabel title="Weighted average of available valuation models. Unavailable models are excluded and weights redistributed.">
            Blended Fair Value
          </CellLabel>
          <div key={`fv-${fvDisplay}`} className="value-flash rounded-[6px] -mx-1 px-1">
            <p className="text-[20px] font-[750] tabular-nums text-[#0F172A] leading-none">
              {fvDisplay}
            </p>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            {methodsComputed} of {output.methods.length} models{methodsComputed < output.methods.length ? ' · weights redistributed' : ''}
          </p>
        </div>

        {/* Upside / Downside */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <CellLabel>Upside / Downside</CellLabel>
          <div key={`up-${upDisplay}`} className="value-flash rounded-[6px] -mx-1 px-1">
            <p className={`text-[20px] font-[750] tabular-nums leading-none ${upColor}`}>
              {upDisplay}
            </p>
          </div>
          <p className="text-[11px] text-[#94A3B8]">vs current price</p>
        </div>

        {/* Investment Verdict */}
        <div className="px-5 py-4 flex flex-col gap-1">
          <CellLabel>Investment Verdict</CellLabel>
          <p className={`text-[18px] font-[750] leading-tight transition-colors duration-300 ${vstyle.text}`}>
            {output.verdict}
          </p>
          {starRating && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <svg
                    key={i}
                    className={`w-2.5 h-2.5 ${i < starRating.stars ? STAR_COLORS[starRating.stars] : 'text-slate-200'}`}
                    fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-[10px] font-[650] text-slate-500">{starRating.label}</span>
            </div>
          )}
          {!starRating && output.upsidePct != null && (
            <p className="text-[11px] text-[#94A3B8]">{methodsComputed} of {output.methods.length} models</p>
          )}
        </div>

        {/* Market-Implied CAGR */}
        <div className="px-5 py-4 flex flex-col gap-1 col-span-2 md:col-span-1">
          <CellLabel title="The revenue CAGR the market is pricing into the current share price, derived from a reverse DCF.">
            Market-Implied CAGR
          </CellLabel>
          {output.marketImpliedGrowth != null ? (
            <>
              <p className="text-[20px] font-[750] tabular-nums text-[#0F172A] leading-none">
                {(output.marketImpliedGrowth * 100).toFixed(1)}%
              </p>
              <p className="text-[11px] text-[#94A3B8]">5Y CAGR priced in by market</p>
            </>
          ) : (
            <p className="text-[13px] text-[#94A3B8]">—</p>
          )}
        </div>

      </div>

      {/* Synthesis strip — assembled verdict from existing data */}
      {synthesis && (
        <div className="border-t border-[#F1F5F9] px-5 py-2.5 flex items-center gap-2.5">
          <span className={`text-[11px] font-[700] shrink-0 ${vstyle.text}`}>{output.verdict}</span>
          <span className="text-[#CBD5E1] text-[10px] shrink-0">·</span>
          <p className="text-[11px] text-[#64748B] leading-snug">{synthesis}</p>
        </div>
      )}
    </div>
  )
}
