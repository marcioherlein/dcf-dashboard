'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitOutput } from '@/lib/valuation/cockpit'

interface Props {
  output: CockpitOutput
  currentPrice: number
  changePct: number | null
  currency: string
}

const VERDICT_STYLE = {
  Undervalued:         { text: 'text-emerald-600' },
  'Fairly Valued':     { text: 'text-[#2563EB]' },
  Overvalued:          { text: 'text-red-600' },
  'Insufficient Data': { text: 'text-[#64748B]' },
}

function CellLabel({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <p className="text-[11px] font-[650] text-[#64748B]" title={title}>
      {children}
    </p>
  )
}

export default function SummaryCards({ output, currentPrice, changePct, currency }: Props) {
  const vstyle = VERDICT_STYLE[output.verdict]
  const upsideSign = output.upsidePct != null && output.upsidePct >= 0 ? '+' : ''
  const upColor = output.upsidePct != null ? (output.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-[#94A3B8]'
  const methodsComputed = output.methods.filter(m => m.fairValue != null).length

  const fvDisplay = output.blendedFairValue != null ? fmtPrice(output.blendedFairValue, currency) : '—'
  const upDisplay = output.upsidePct != null ? `${upsideSign}${(output.upsidePct * 100).toFixed(1)}%` : '—'

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
          {output.upsidePct != null && (
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
    </div>
  )
}
