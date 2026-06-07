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

function buildRationale(
  waccDelta: number,
  cagrDelta: number,
  isBase: boolean,
): string {
  if (isBase) return 'Current assumptions as configured in the workbench below.'
  const parts: string[] = []
  if (Math.abs(waccDelta) > 0.0001) {
    parts.push(waccDelta > 0
      ? `WACC +${(waccDelta * 100).toFixed(1)}pp — higher risk premium or rate environment`
      : `WACC ${(waccDelta * 100).toFixed(1)}pp — lower cost of capital`)
  }
  if (Math.abs(cagrDelta) > 0.0001) {
    parts.push(cagrDelta > 0
      ? `revenue CAGR +${(cagrDelta * 100).toFixed(1)}pp — faster growth materialises`
      : `revenue CAGR ${(cagrDelta * 100).toFixed(1)}pp — growth disappoints`)
  }
  return parts.length > 0 ? parts.join('; ') + '.' : 'Stressed assumptions.'
}

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
  const upColor = upside != null ? (upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]') : 'text-[#8A95A6]'
  const waccDelta = wacc - baseWacc
  const cagrDelta = cagr - baseCagr
  const isBase = Math.abs(waccDelta) < 0.0001 && Math.abs(cagrDelta) < 0.0001
  const rationale = buildRationale(waccDelta, cagrDelta, isBase)

  return (
    <div className={`rounded-xl border ${bgClass} ${borderClass} px-4 py-4 ${isBase ? 'ring-2 ring-blue-300 shadow-sm' : ''}`}>
      <div className="flex items-center justify-between mb-0.5">
        <div className={`flex items-center gap-1.5 text-xs font-bold ${accentText}`}>
          {Icon && <Icon size={12} className="shrink-0" />}
          <span>{label}</span>
        </div>
        {upside != null && (
          <span className={`text-xs font-bold tabular-nums ${upColor}`}>
            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[11px] text-[#566174] mb-2 leading-tight">{description}</p>
      <p className={`${isBase ? 'text-3xl' : 'text-2xl'} font-bold tabular-nums text-[#06101F] leading-none mb-2`}>
        {fv != null ? fmtPrice(fv, currency) : '—'}
      </p>
      <p className="text-[11px] text-[#566174] leading-snug mb-3">{rationale}</p>
      <div className="flex gap-4">
        <div>
          <p className="text-[11px] text-[#566174] mb-0.5">WACC</p>
          <p className="text-[12px] font-[650] text-[#566174] tabular-nums">
            {(wacc * 100).toFixed(1)}%
            {!isBase && Math.abs(waccDelta) > 0.0001 && (
              <span className={`ml-1 text-[11px] font-[500] ${waccDelta > 0 ? 'text-[#D83B3B]' : 'text-[#11875D]'}`}>
                ({waccDelta > 0 ? '+' : ''}{(waccDelta * 100).toFixed(1)}%)
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#566174] mb-0.5">5Y CAGR</p>
          <p className="text-[12px] font-[650] text-[#566174] tabular-nums">
            {(cagr * 100).toFixed(1)}%
            {!isBase && Math.abs(cagrDelta) > 0.0001 && (
              <span className={`ml-1 text-[11px] font-[500] ${cagrDelta > 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
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
    <div className="bg-white rounded-[20px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[12px] font-[650] text-[#566174]">Scenario Analysis</p>
        <span className="text-[11px] text-[#566174]">All four methods re-run at each stress, same blend as Base</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <ScenarioCard
          label="Bear Case" description="Growth slows, margins compress"
          fv={scenarios.bear.fairValue} wacc={scenarios.bear.wacc} cagr={scenarios.bear.cagr}
          baseWacc={base.wacc} baseCagr={base.cagr}
          currentPrice={currentPrice} currency={currency}
          accentText="text-[#D83B3B]" bgClass="bg-[#FCEAEA]" borderClass="border-[#F0B8B8]"
          Icon={TrendingDown as IconComp}
        />
        <ScenarioCard
          label="Base Case" description="Model assumptions as configured"
          fv={scenarios.base.fairValue} wacc={scenarios.base.wacc} cagr={scenarios.base.cagr}
          baseWacc={base.wacc} baseCagr={base.cagr}
          currentPrice={currentPrice} currency={currency}
          accentText="text-[#2563EB]" bgClass="bg-[#EAF1FF]" borderClass="border-[#93B4F5]"
          Icon={Target as IconComp}
        />
        <ScenarioCard
          label="Bull Case" description="Growth accelerates, scale improves"
          fv={scenarios.bull.fairValue} wacc={scenarios.bull.wacc} cagr={scenarios.bull.cagr}
          baseWacc={base.wacc} baseCagr={base.cagr}
          currentPrice={currentPrice} currency={currency}
          accentText="text-[#11875D]" bgClass="bg-[#E8F7EF]" borderClass="border-[#A3D9BE]"
          Icon={TrendingUp as IconComp}
        />
      </div>
    </div>
  )
}
