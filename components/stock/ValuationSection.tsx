'use client'
import ValuationMethods from '@/components/stock/ValuationMethods'
import { buildValuationSummary } from '@/lib/simplifier/summaryBuilder'

interface Scenario {
  fairValue: number
  wacc: number
  cagr: number
  terminalG: number
}

interface Props {
  companyName: string
  currency: string
  fairValuePerShare: number
  upsidePct: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valuationMethods: any
  scenarios: {
    bull: Scenario
    base: Scenario
    bear: Scenario
  }
  currentPrice: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  financialsData?: any
}

function ZoneBadge({ upsidePct }: { upsidePct: number }) {
  if (upsidePct >= 0.25) return <span className="rounded-full bg-green-100 text-green-700 px-3 py-0.5 text-xs font-semibold">Attractive</span>
  if (upsidePct >= 0.05) return <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-0.5 text-xs font-semibold">Fair Value</span>
  return <span className="rounded-full bg-red-100 text-red-700 px-3 py-0.5 text-xs font-semibold">Expensive</span>
}

function ScenarioBar({ bull, base, bear, current, currency }: {
  bull: number; base: number; bear: number; current: number; currency: string
}) {
  const min = Math.min(bear, current) * 0.9
  const max = Math.max(bull, current) * 1.1
  const range = max - min

  const toPos = (v: number) => range > 0 ? Math.max(0, Math.min(100, ((v - min) / range) * 100)) : 50

  const bearPos    = toPos(bear)
  const basePos    = toPos(base)
  const bullPos    = toPos(bull)
  const currentPos = toPos(current)

  const fmt = (v: number) => `${currency}${v.toFixed(0)}`

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 px-5 py-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">Scenario Range</p>
      <div className="relative h-8">
        {/* Range bar */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gradient-to-r from-red-300 via-blue-400 to-green-400"
          style={{ left: `${bearPos}%`, width: `${bullPos - bearPos}%` }}
        />
        {/* Bear */}
        <div className="absolute" style={{ left: `${bearPos}%`, transform: 'translateX(-50%)' }}>
          <div className="w-3 h-3 rounded-full bg-red-400 border-2 border-white shadow" />
          <p className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-red-600 font-semibold whitespace-nowrap">{fmt(bear)}</p>
          <p className="absolute top-8.5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 whitespace-nowrap">Bear</p>
        </div>
        {/* Base */}
        <div className="absolute" style={{ left: `${basePos}%`, transform: 'translateX(-50%)' }}>
          <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow" />
          <p className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-blue-700 font-semibold whitespace-nowrap">{fmt(base)}</p>
          <p className="absolute top-8.5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 whitespace-nowrap">Base</p>
        </div>
        {/* Bull */}
        <div className="absolute" style={{ left: `${bullPos}%`, transform: 'translateX(-50%)' }}>
          <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow" />
          <p className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-green-700 font-semibold whitespace-nowrap">{fmt(bull)}</p>
          <p className="absolute top-8.5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 whitespace-nowrap">Bull</p>
        </div>
        {/* Current price */}
        <div className="absolute" style={{ left: `${currentPos}%`, transform: 'translateX(-50%)' }}>
          <div className="w-0.5 h-6 bg-slate-400 mx-auto" />
          <p className="text-[9px] text-slate-500 text-center whitespace-nowrap mt-0.5">Now</p>
        </div>
      </div>
      <div className="mt-10" />
    </div>
  )
}

export default function ValuationSection({
  companyName, currency, fairValuePerShare, upsidePct,
  valuationMethods, scenarios, currentPrice, financialsData,
}: Props) {
  const upSign   = upsidePct >= 0 ? '+' : ''
  const upColor  = upsidePct >= 0.05 ? 'text-green-600' : 'text-red-600'
  const rationale: string = valuationMethods?.rationale ?? ''
  const summary  = financialsData ? buildValuationSummary(companyName, financialsData) : null

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-6 space-y-6">
      <h2 className="text-base font-semibold text-slate-900">What Is It Worth?</h2>

      {/* Answer header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-3xl font-bold text-slate-900">{currency}{fairValuePerShare.toFixed(2)}</span>
        <span className={`text-xl font-bold ${upColor}`}>{upSign}{(upsidePct * 100).toFixed(1)}% upside</span>
        <ZoneBadge upsidePct={upsidePct} />
      </div>

      {/* Rationale */}
      {rationale && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-xs text-blue-700 leading-relaxed">{rationale}</p>
        </div>
      )}

      {/* 4 method cards */}
      <ValuationMethods valuationMethods={valuationMethods} currency={currency} />

      {/* Scenario bar */}
      <ScenarioBar
        bull={scenarios.bull.fairValue}
        base={scenarios.base.fairValue}
        bear={scenarios.bear.fairValue}
        current={currentPrice}
        currency={currency}
      />

      {/* Plain-English summary */}
      {summary && (
        <p className="text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-4">{summary}</p>
      )}
    </div>
  )
}
