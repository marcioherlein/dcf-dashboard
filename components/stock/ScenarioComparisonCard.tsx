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
    <div className={`flex flex-col gap-3 px-4 py-4 rounded-xl border ${
      isFeatured
        ? 'border-blue-200 bg-blue-50/50'
        : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${
          label === 'Bull' ? 'text-emerald-600' :
          label === 'Bear' ? 'text-red-600' : 'text-blue-600'
        }`}>{label}</span>
        {isFeatured && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Base case</span>
        )}
      </div>

      {upside != null && (
        <div>
          <p className={`text-2xl font-bold tabular-nums leading-none ${
            upside >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {label === 'Bull' ? 'sustained growth + margin expansion'
             : label === 'Bear' ? 'slowdown or execution miss'
             : 'central estimate'}
          </p>
        </div>
      )}

      <div>
        <p className="text-[10px] text-slate-500">Fair Value</p>
        <p className={`text-base font-semibold tabular-nums ${
          isFeatured ? 'text-blue-700' : upside != null && upside >= 0 ? 'text-emerald-600' : 'text-red-600'
        }`}>
          {fmtPrice(scenario.fairValue, currency)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-2 border-t border-slate-100">
        <div>
          <Tooltip>
            <TooltipTrigger
              render={<p className="text-[10px] text-slate-400 uppercase tracking-wider cursor-help underline decoration-dotted" />}
            >
              WACC
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-[11px]">
              Discount rate used to value future cash flows. Higher WACC = stricter hurdle = lower fair value.
            </TooltipContent>
          </Tooltip>
          <p className="text-xs font-semibold tabular-nums text-slate-700">{(scenario.wacc * 100).toFixed(1)}%</p>
        </div>
        <div>
          <Tooltip>
            <TooltipTrigger
              render={<p className="text-[10px] text-slate-400 uppercase tracking-wider cursor-help underline decoration-dotted" />}
            >
              CAGR
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-[11px]">
              Assumed annual revenue growth rate for the next 5 years in this scenario.
            </TooltipContent>
          </Tooltip>
          <p className="text-xs font-semibold tabular-nums text-slate-700">{(scenario.cagr * 100).toFixed(1)}%</p>
        </div>
        <div>
          <Tooltip>
            <TooltipTrigger
              render={<p className="text-[10px] text-slate-400 uppercase tracking-wider cursor-help underline decoration-dotted" />}
            >
              Terminal G
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-[11px]">
              Growth rate assumed to continue forever after year 5. Typically kept near long-run GDP growth (2–4%).
            </TooltipContent>
          </Tooltip>
          <p className="text-xs font-semibold tabular-nums text-slate-700">{(scenario.terminalG * 100).toFixed(1)}%</p>
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
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
        Bull / Base / Bear Scenarios
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ScenarioCol label="Bear" scenario={scenarios.bear} currentPrice={currentPrice} currency={currency} />
        <ScenarioCol label="Base" scenario={scenarios.base} currentPrice={currentPrice} currency={currency} isFeatured />
        <ScenarioCol label="Bull" scenario={scenarios.bull} currentPrice={currentPrice} currency={currency} />
      </div>

      {m && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            How the Base Was Computed — Full DCF Modelling Table
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {m.weights.ufcfPGM > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100">
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
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <span className="text-slate-600 font-semibold">{m.companyTypeLabel}:</span>{' '}
            {m.rationale}
          </p>
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
        <span className="text-red-500 font-medium">Bear:</span> WACC +1%, CAGR −20%, Terminal G −0.5pp from base.{' '}
        <span className="text-blue-500 font-medium">Base:</span> Full DCF Modelling Table result — Damodaran 4-method blend.{' '}
        <span className="text-emerald-500 font-medium">Bull:</span> WACC −1%, CAGR +20%, Terminal G +0.5pp from base.
      </p>
    </div>
  )
}
