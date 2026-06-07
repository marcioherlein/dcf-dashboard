'use client'

import { fmtPrice } from '@/lib/formatters'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface ScenarioData {
  fairValue: number
  wacc: number
  cagr: number
  terminalG: number
}

interface ModelMethodology {
  companyType: string
  companyTypeLabel: string
  rationale: string
  weights: { ufcfPGM: number; ufcfEM: number; lfcfPGM: number; lfcfEM: number }
}

interface Props {
  scenarios: {
    bull: ScenarioData
    base: ScenarioData
    bear: ScenarioData
    modelMethodology?: ModelMethodology
  }
  currentPrice: number
  currency?: string
}

function ScenarioCol({
  label,
  scenario,
  currentPrice,
  currency,
  isFeatured,
}: {
  label: string
  scenario: ScenarioData
  currentPrice: number
  currency: string
  isFeatured?: boolean
}) {
  const upside = currentPrice > 0 ? (scenario.fairValue - currentPrice) / currentPrice : null

  return (
    <div className={`flex flex-col gap-3 px-4 py-4 rounded-xl border min-w-[200px] sm:min-w-0 snap-start flex-shrink-0 sm:flex-shrink ${
      isFeatured
        ? 'border-[#93B4F5] bg-[#EAF1FF]/50'
        : 'border-[#E3E1DA] bg-white'
    }`}>
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          label === 'Bull' ? 'text-[#11875D]' :
          label === 'Bear' ? 'text-[#D83B3B]' : 'text-[#2563EB]'
        }`}>{label}</span>
        {isFeatured && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EAF1FF] text-[#2563EB] font-bold">Base case</span>
        )}
      </div>

      {upside != null && (
        <div>
          <p className={`text-2xl font-bold tabular-nums leading-none ${
            upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'
          }`}>
            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] text-[#8A95A6] mt-1">
            {label === 'Bull' ? 'sustained growth + margin expansion'
             : label === 'Bear' ? 'slowdown or execution miss'
             : 'central estimate'}
          </p>
        </div>
      )}

      <div>
        <p className="text-[10px] text-[#566174]">Fair Value</p>
        <p className={`text-base font-semibold tabular-nums ${
          isFeatured ? 'text-[#2563EB]' : upside != null && upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'
        }`}>
          {fmtPrice(scenario.fairValue, currency)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-2 border-t border-[#E3E1DA]">
        <div>
          <Tooltip>
            <TooltipTrigger
              render={<p className="text-[10px] text-[#8A95A6] uppercase tracking-wider cursor-help underline decoration-dotted" />}
            >
              WACC
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-[11px]">
              Discount rate used to value future cash flows. Higher WACC = stricter hurdle = lower fair value.
            </TooltipContent>
          </Tooltip>
          <p className="text-xs font-semibold tabular-nums text-[#06101F]">{(scenario.wacc * 100).toFixed(1)}%</p>
        </div>
        <div>
          <Tooltip>
            <TooltipTrigger
              render={<p className="text-[10px] text-[#8A95A6] uppercase tracking-wider cursor-help underline decoration-dotted" />}
            >
              CAGR
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-[11px]">
              Assumed annual revenue growth rate for the next 5 years in this scenario.
            </TooltipContent>
          </Tooltip>
          <p className="text-xs font-semibold tabular-nums text-[#06101F]">{(scenario.cagr * 100).toFixed(1)}%</p>
        </div>
        <div>
          <Tooltip>
            <TooltipTrigger
              render={<p className="text-[10px] text-[#8A95A6] uppercase tracking-wider cursor-help underline decoration-dotted" />}
            >
              Terminal G
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-[11px]">
              Growth rate assumed to continue forever after year 5. Typically kept near long-run GDP growth (2–4%).
            </TooltipContent>
          </Tooltip>
          <p className="text-xs font-semibold tabular-nums text-[#06101F]">{(scenario.terminalG * 100).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  )
}

export default function ScenarioComparisonCard({ scenarios, currentPrice, currency = 'USD' }: Props) {
  if (!scenarios?.base?.fairValue) return null

  const m = scenarios.modelMethodology

  return (
    <div className="glass-card-light rounded-xl p-5">
      <h3 className="text-[13px] font-semibold text-[#06101F] mb-3">Scenario analysis</h3>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:snap-none sm:pb-0 sm:mx-0 sm:px-0">
        <ScenarioCol label="Bear" scenario={scenarios.bear} currentPrice={currentPrice} currency={currency} />
        <ScenarioCol label="Base" scenario={scenarios.base} currentPrice={currentPrice} currency={currency} isFeatured />
        <ScenarioCol label="Bull" scenario={scenarios.bull} currentPrice={currentPrice} currency={currency} />
      </div>

      {m && (
        <div className="mt-4 pt-3 border-t border-[#E3E1DA]">
          <p className="text-[12px] font-semibold text-[#566174] mb-2">Model weights</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {m.weights.ufcfPGM > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EAF1FF] text-[#2563EB] font-semibold border border-blue-100">
                Unlevered + Perpetuity {Math.round(m.weights.ufcfPGM * 100)}%
              </span>
            )}
            {m.weights.ufcfEM > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold border border-indigo-100">
                Unlevered + Exit Multiple {Math.round(m.weights.ufcfEM * 100)}%
              </span>
            )}
            {m.weights.lfcfPGM > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-semibold border border-violet-100">
                Levered + Perpetuity {Math.round(m.weights.lfcfPGM * 100)}%
              </span>
            )}
            {m.weights.lfcfEM > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-semibold border border-purple-100">
                Levered + Exit Multiple {Math.round(m.weights.lfcfEM * 100)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-[#8A95A6] leading-relaxed">
            <span className="text-[#566174] font-semibold">{m.companyTypeLabel}:</span>{' '}
            {m.rationale}
          </p>
        </div>
      )}

      <p className="text-[10px] text-[#8A95A6] mt-3 leading-relaxed">
        <span className="text-[#D83B3B] font-medium">Bear:</span> WACC +1%, CAGR −20%, Terminal G −0.5pp from base.{' '}
        <span className="text-[#2563EB] font-medium">Base:</span> Full DCF Modelling Table result — Damodaran 4-method blend.{' '}
        <span className="text-[#11875D] font-medium">Bull:</span> WACC −1%, CAGR +20%, Terminal G +0.5pp from base.
      </p>
    </div>
  )
}
