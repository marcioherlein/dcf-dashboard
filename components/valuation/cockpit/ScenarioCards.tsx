'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitOutput } from '@/lib/valuation/cockpit'

interface Props {
  scenarios: CockpitOutput['scenarios']
  currentPrice: number
  currency: string
}

function ScenarioCard({
  label, fv, wacc, cagr, currentPrice, currency, accentText, bgClass, borderClass,
}: {
  label: string; fv: number | null; wacc: number; cagr: number
  currentPrice: number; currency: string
  accentText: string; bgClass: string; borderClass: string
}) {
  const upside = fv != null && currentPrice > 0 ? (fv - currentPrice) / currentPrice : null
  const upColor = upside != null ? (upside >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'
  return (
    <div className={`rounded-xl border ${bgClass} ${borderClass} px-5 py-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${accentText}`}>{label}</p>
        {upside != null && (
          <span className={`text-[11px] font-bold tabular-nums ${upColor}`}>
            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none mb-3">
        {fv != null ? fmtPrice(fv, currency) : '—'}
      </p>
      <div className="flex gap-4">
        <div>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">WACC</p>
          <p className="text-[11px] font-semibold text-slate-600 tabular-nums">{(wacc * 100).toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">5Y CAGR</p>
          <p className="text-[11px] font-semibold text-slate-600 tabular-nums">{(cagr * 100).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  )
}

export default function ScenarioCards({ scenarios, currentPrice, currency }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Scenario Range</p>
      <div className="grid grid-cols-3 gap-3">
        <ScenarioCard
          label="Bear Case"
          fv={scenarios.bear.fairValue}
          wacc={scenarios.bear.wacc}
          cagr={scenarios.bear.cagr}
          currentPrice={currentPrice}
          currency={currency}
          accentText="text-red-600"
          bgClass="bg-red-50"
          borderClass="border-red-200"
        />
        <ScenarioCard
          label="Base Case"
          fv={scenarios.base.fairValue}
          wacc={scenarios.base.wacc}
          cagr={scenarios.base.cagr}
          currentPrice={currentPrice}
          currency={currency}
          accentText="text-blue-600"
          bgClass="bg-blue-50"
          borderClass="border-blue-200"
        />
        <ScenarioCard
          label="Bull Case"
          fv={scenarios.bull.fairValue}
          wacc={scenarios.bull.wacc}
          cagr={scenarios.bull.cagr}
          currentPrice={currentPrice}
          currency={currency}
          accentText="text-emerald-600"
          bgClass="bg-emerald-50"
          borderClass="border-emerald-200"
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-3">
        Bear: WACC +1%, CAGR −2% · Base: current assumptions · Bull: WACC −1%, CAGR +2%
      </p>
    </div>
  )
}
