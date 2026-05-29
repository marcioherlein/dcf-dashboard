'use client'

import { TrendingUp, BarChart2, BarChart, Target } from 'lucide-react'
import { fmtPrice } from '@/lib/formatters'
import type { CockpitMethodResult } from '@/lib/valuation/cockpit'

interface Props {
  methods: CockpitMethodResult[]
  currentPrice: number
  currency: string
  cagr?: number
  fcfMargin?: number | null
  ttmEbitdaDollars?: number | null
}

type IconComp = React.ComponentType<{ size?: number; className?: string }>

const METHOD_CFG: Record<string, {
  iconBg: string; iconText: string
  barBg: string; valueBg: string; valueText: string
  driverLabel: string
  Icon: IconComp
}> = {
  forward_pe: {
    iconBg: 'bg-blue-100', iconText: 'text-blue-600',
    barBg: 'bg-blue-500', valueBg: 'bg-blue-50', valueText: 'text-blue-700',
    driverLabel: 'Est. EPS growth',
    Icon: TrendingUp as IconComp,
  },
  ev_ebitda: {
    iconBg: 'bg-indigo-100', iconText: 'text-indigo-600',
    barBg: 'bg-indigo-400', valueBg: 'bg-indigo-50', valueText: 'text-indigo-700',
    driverLabel: 'TTM EBITDA',
    Icon: BarChart2 as IconComp,
  },
  revenue_multiple: {
    iconBg: 'bg-purple-100', iconText: 'text-purple-600',
    barBg: 'bg-purple-500', valueBg: 'bg-purple-50', valueText: 'text-purple-700',
    driverLabel: 'Revenue growth (CAGR)',
    Icon: BarChart as IconComp,
  },
  core_dcf: {
    iconBg: 'bg-emerald-100', iconText: 'text-emerald-600',
    barBg: 'bg-emerald-500', valueBg: 'bg-emerald-50', valueText: 'text-emerald-700',
    driverLabel: 'FCF margin (TTM)',
    Icon: Target as IconComp,
  },
}

const CONFIDENCE_CHIP = {
  high:   { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'High confidence'   },
  medium: { bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700',   label: 'Medium confidence' },
  low:    { bg: 'bg-slate-100 border-slate-200',    text: 'text-slate-500',   label: 'Low confidence'    },
}

function driverValue(
  id: string,
  cagr?: number,
  fcfMargin?: number | null,
  ttmEbitdaDollars?: number | null,
): { text: string; hasValue: boolean } {
  if (id === 'forward_pe' || id === 'revenue_multiple') {
    if (cagr != null) return { text: `+${(cagr * 100).toFixed(0)}%`, hasValue: true }
  }
  if (id === 'ev_ebitda') {
    if (ttmEbitdaDollars != null && ttmEbitdaDollars > 0) {
      const b = ttmEbitdaDollars / 1e9
      const m = ttmEbitdaDollars / 1e6
      return { text: b >= 1 ? `$${b.toFixed(1)}B` : `$${m.toFixed(0)}M`, hasValue: true }
    }
  }
  if (id === 'core_dcf') {
    if (fcfMargin != null && fcfMargin > 0)
      return { text: `${(fcfMargin * 100).toFixed(1)}%`, hasValue: true }
  }
  return { text: 'N/A', hasValue: false }
}

export default function ValuationMethodCards({
  methods, currentPrice: _currentPrice, currency, cagr, fcfMargin, ttmEbitdaDollars,
}: Props) {
  const validTotal = methods
    .filter(m => m.fairValue != null && m.fairValue > 0)
    .reduce((s, m) => s + m.weight, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-800 mb-1">Valuation Models</p>
          <p className="text-xs text-slate-400">Detailed breakdown of each model and its contribution to blended fair value</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
          </svg>
          Methodology &amp; assumptions
        </span>
      </div>

      {/* Cards grid — horizontal scroll on mobile, grid on sm+ */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:snap-none sm:pb-0 sm:mx-0 sm:px-0 items-start">
        {methods.map(m => {
          const cfg      = METHOD_CFG[m.id]
          const hasValue = m.fairValue != null && m.fairValue > 0
          const conf     = hasValue ? CONFIDENCE_CHIP[m.confidence] : null
          const effectiveWeight = hasValue && validTotal > 0 ? m.weight / validTotal : 0
          const effectivePct   = Math.round(effectiveWeight * 100)
          const upColor  = m.upsidePct != null
            ? (m.upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')
            : 'text-slate-400'
          const dv = cfg ? driverValue(m.id, cagr, fcfMargin, ttmEbitdaDollars) : null

          return (
            <div
              key={m.id}
              className={`rounded-xl border flex flex-col p-4 gap-3 min-w-[200px] sm:min-w-0 snap-start flex-shrink-0 sm:flex-shrink ${
                hasValue ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/50'
              }`}
            >
              {/* Method header: icon + name + confidence chip */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {cfg && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                      <cfg.Icon size={13} className={cfg.iconText} />
                    </div>
                  )}
                  <span className={`text-sm font-bold truncate ${hasValue ? 'text-slate-800' : 'text-slate-400'}`}>
                    {m.method}
                  </span>
                </div>
                {conf ? (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${conf.bg} ${conf.text}`}>
                    {conf.label}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-slate-100 border-slate-200 text-slate-400">
                    Unavailable
                  </span>
                )}
              </div>

              {/* Fair value */}
              <div>
                <p className="text-[10px] text-slate-400 mb-0.5">Fair Value</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
                    {m.fairValue != null ? fmtPrice(m.fairValue, currency) : '—'}
                  </span>
                  {m.upsidePct != null && (
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-semibold tabular-nums leading-tight ${upColor}`}>
                        {m.upsidePct >= 0 ? '+' : ''}{(m.upsidePct * 100).toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-400 leading-tight">vs current price</span>
                    </div>
                  )}
                  {!hasValue && <span className="text-sm text-slate-400">N/A</span>}
                </div>
              </div>

              {/* Error or description */}
              {!hasValue && m.errors.length > 0 ? (
                <p className="text-[11px] text-slate-400 italic leading-relaxed">{m.errors[0]}</p>
              ) : hasValue ? (
                <p className="text-[11px] text-slate-500 leading-relaxed">{m.description}</p>
              ) : null}

              {/* Key Driver */}
              {cfg && (
                <div>
                  <p className="text-[10px] text-slate-400 mb-1.5">Key Driver</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-600 font-medium">{cfg.driverLabel}</span>
                    {dv && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 tabular-nums ${
                        dv.hasValue
                          ? `${cfg.valueBg} ${cfg.valueText}`
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {dv.text}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Effective Blend Weight */}
              <div className="mt-auto pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-slate-400">Effective Blend Weight</span>
                  <span className={`text-[11px] font-bold tabular-nums ${
                    hasValue ? (cfg?.valueText ?? 'text-slate-600') : 'text-slate-300'
                  }`}>
                    {effectivePct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cfg?.barBg ?? 'bg-slate-300'}`}
                    style={{ width: `${effectivePct}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <div className="mt-4 space-y-1.5">
        {methods.some(m => m.fairValue == null || m.fairValue <= 0) && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
            </svg>
            Unavailable models are excluded from the blend. Remaining weights are redistributed proportionally.
          </p>
        )}
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
          </svg>
          Weights reflect our conviction in each model&apos;s reliability given current data quality and market context.
        </p>
      </div>
    </div>
  )
}
