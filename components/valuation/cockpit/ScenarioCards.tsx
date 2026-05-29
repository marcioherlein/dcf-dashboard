'use client'

import { TrendingDown, Target, TrendingUp } from 'lucide-react'
import { fmtPrice } from '@/lib/formatters'
import type { CockpitOutput } from '@/lib/valuation/cockpit'

interface Props {
  scenarios: CockpitOutput['scenarios']
  currentPrice: number
  currency: string
}

type IconComp = React.ComponentType<{ size?: number; className?: string }>

function ScenarioCard({
  label, description, fv, wacc, cagr, baseWacc, baseCagr, currentPrice, currency, accentText, bgClass, borderClass, Icon,
}: {
  label: string; description: string; fv: number | null; wacc: number; cagr: number
  baseWacc: number; baseCagr: number
  currentPrice: number; currency: string
  accentText: string; bgClass: string; borderClass: string
  Icon?: IconComp
}) {
  const upside = fv != null && currentPrice > 0 ? (fv - currentPrice) / currentPrice : null
  const upColor = upside != null ? (upside >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'
  const waccDelta = wacc - baseWacc
  const cagrDelta = cagr - baseCagr
  const isBase = Math.abs(waccDelta) < 0.0001 && Math.abs(cagrDelta) < 0.0001

  return (
    <div className={`rounded-xl border ${bgClass} ${borderClass} px-4 py-4 min-w-[220px] sm:min-w-0 snap-start flex-shrink-0 sm:flex-shrink ${isBase ? 'ring-2 ring-blue-300 shadow-sm' : ''}`}>
      <div className="flex items-center justify-between mb-0.5">
        <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${accentText}`}>
          {Icon && <Icon size={12} className="shrink-0" />}
          <span>{label}</span>
        </div>
        {upside != null && (
          <span className={`text-xs font-bold tabular-nums ${upColor}`}>
            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[11px] text-[#64748B] mb-2 leading-tight">{description}</p>
      <p className={`${isBase ? 'text-3xl' : 'text-2xl'} font-bold tabular-nums text-slate-900 leading-none mb-3`}>
        {fv != null ? fmtPrice(fv, currency) : '—'}
      </p>
      <div className="flex gap-4">
        <div>
          <p className="text-[11px] text-[#64748B] mb-0.5">WACC</p>
          <p className="text-[12px] font-[650] text-[#334155] tabular-nums">
            {(wacc * 100).toFixed(1)}%
            {!isBase && Math.abs(waccDelta) > 0.0001 && (
              <span className={`ml-1 text-[11px] font-[500] ${waccDelta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                ({waccDelta > 0 ? '+' : ''}{(waccDelta * 100).toFixed(1)}%)
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#64748B] mb-0.5">5Y CAGR</p>
          <p className="text-[12px] font-[650] text-[#334155] tabular-nums">
            {(cagr * 100).toFixed(1)}%
            {!isBase && Math.abs(cagrDelta) > 0.0001 && (
              <span className={`ml-1 text-[11px] font-[500] ${cagrDelta > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                ({cagrDelta > 0 ? '+' : ''}{(cagrDelta * 100).toFixed(1)}%)
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ScenarioCards({ scenarios, currentPrice, currency }: Props) {
  const base = scenarios.base
  return (
    <div className="bg-white rounded-[18px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[12px] font-[650] text-[#475569]">Scenario Analysis</p>
        <span className="text-[11px] text-[#94A3B8]">Blended estimate at stressed assumptions</span>
      </div>
      <p className="text-[11px] text-[#94A3B8] mb-3">All four methods re-run at each stress — same blend as Base.</p>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:snap-none sm:pb-0 sm:mx-0 sm:px-0">
        <ScenarioCard
          label="Bear Case" description="If growth slows & margins compress"
          fv={scenarios.bear.fairValue} wacc={scenarios.bear.wacc} cagr={scenarios.bear.cagr}
          baseWacc={base.wacc} baseCagr={base.cagr}
          currentPrice={currentPrice} currency={currency}
          accentText="text-red-600" bgClass="bg-red-50" borderClass="border-red-200"
          Icon={TrendingDown as IconComp}
        />
        <ScenarioCard
          label="Base Case" description="Our best estimate"
          fv={scenarios.base.fairValue} wacc={scenarios.base.wacc} cagr={scenarios.base.cagr}
          baseWacc={base.wacc} baseCagr={base.cagr}
          currentPrice={currentPrice} currency={currency}
          accentText="text-blue-600" bgClass="bg-blue-50" borderClass="border-blue-200"
          Icon={Target as IconComp}
        />
        <ScenarioCard
          label="Bull Case" description="If growth accelerates & scale improves"
          fv={scenarios.bull.fairValue} wacc={scenarios.bull.wacc} cagr={scenarios.bull.cagr}
          baseWacc={base.wacc} baseCagr={base.cagr}
          currentPrice={currentPrice} currency={currency}
          accentText="text-emerald-600" bgClass="bg-emerald-50" borderClass="border-emerald-200"
          Icon={TrendingUp as IconComp}
        />
      </div>
    </div>
  )
}
