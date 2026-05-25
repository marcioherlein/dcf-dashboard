'use client'

import { fmtPrice } from '@/lib/formatters'

interface ScenarioData {
  fairValue: number
  wacc: number
  cagr: number
  terminalG: number
}

interface Props {
  scenarios: {
    bull: ScenarioData
    base: ScenarioData
    bear: ScenarioData
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
  const isUp = upside != null && upside >= 0

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
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">Base case</span>
        )}
      </div>

      {/* Consequence — primary signal */}
      {upside != null && (
        <div>
          <p className={`text-2xl font-bold tabular-nums leading-none ${
            upside >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {label === 'Bull' ? 'if growth exceeds expectations'
             : label === 'Bear' ? 'if growth disappoints'
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
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">WACC</p>
          <p className="text-xs font-semibold tabular-nums text-slate-700">{(scenario.wacc * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">CAGR</p>
          <p className="text-xs font-semibold tabular-nums text-slate-700">{(scenario.cagr * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">Terminal G</p>
          <p className="text-xs font-semibold tabular-nums text-slate-700">{(scenario.terminalG * 100).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  )
}

export default function ScenarioComparisonCard({ scenarios, currentPrice, currency = 'USD' }: Props) {
  if (!scenarios?.base?.fairValue) return null

  return (
    <div className="glass-card-light rounded-xl p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
        Bull / Base / Bear Scenarios
      </p>
      <div className="grid grid-cols-3 gap-3">
        <ScenarioCol label="Bear" scenario={scenarios.bear} currentPrice={currentPrice} currency={currency} />
        <ScenarioCol label="Base" scenario={scenarios.base} currentPrice={currentPrice} currency={currency} isFeatured />
        <ScenarioCol label="Bull" scenario={scenarios.bull} currentPrice={currentPrice} currency={currency} />
      </div>
      <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
        Bear: WACC +1%, CAGR −20%. Bull: WACC −1%, CAGR +20%. Base is the model&apos;s central estimate.
      </p>
    </div>
  )
}
