'use client'

import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct } from '@/lib/formatters'
import { ConsensusRangeBar } from '@/components/valuation/ValuationSummary'
import { AlertTriangle, Bookmark, TrendingUp } from 'lucide-react'

type VerdictZone = 'undervalued' | 'fairvalue' | 'overvalued' | 'unknown'

interface Props {
  ticker: string
  companyName: string
  sector: string
  price: number
  currency: string
  grade: string
  gradeLabel: string
  fairValue: number | null
  upsidePct: number | null
  bearFV: number | null
  bullFV: number | null
  verdictZone: VerdictZone
  topRisk: string | null
  topDrivers: string[]
  methodCount?: number
  onSave: () => void
  onViewValuation: () => void
}

const ZONE_STYLES: Record<VerdictZone, { banner: string; badge: string; text: string; dot: string }> = {
  undervalued: {
    banner: 'bg-emerald-50 border-emerald-200',
    badge:  'bg-emerald-600 text-white',
    text:   'text-emerald-800',
    dot:    'bg-emerald-500',
  },
  fairvalue: {
    banner: 'bg-amber-50 border-amber-200',
    badge:  'bg-amber-500 text-white',
    text:   'text-amber-800',
    dot:    'bg-amber-400',
  },
  overvalued: {
    banner: 'bg-red-50 border-red-200',
    badge:  'bg-red-600 text-white',
    text:   'text-red-800',
    dot:    'bg-red-500',
  },
  unknown: {
    banner: 'bg-slate-50 border-slate-200',
    badge:  'bg-slate-500 text-white',
    text:   'text-slate-700',
    dot:    'bg-slate-400',
  },
}

function verdictText(zone: VerdictZone, upsidePct: number | null, fairValue: number | null, price: number, currency: string): string {
  const fv = fairValue != null ? fmtPrice(fairValue, currency) : null
  const pct = upsidePct != null ? Math.abs(upsidePct * 100).toFixed(0) + '%' : null
  if (zone === 'undervalued') return fv && pct ? `Trading ${pct} below our fair value estimate of ${fv} — looks undervalued` : 'Looks undervalued based on our model'
  if (zone === 'overvalued')  return fv && pct ? `Trading ${pct} above our fair value estimate of ${fv} — looks overvalued`  : 'Looks overvalued based on our model'
  if (zone === 'fairvalue')   return fv ? `Trading near our fair value estimate of ${fv} — fairly valued` : 'Trading near fair value'
  return 'Insufficient data to determine valuation'
}

export default function InvestmentVerdictCard({
  price, currency,
  grade, gradeLabel,
  fairValue, upsidePct,
  bearFV, bullFV,
  verdictZone, topRisk, topDrivers,
  methodCount,
  onSave, onViewValuation,
}: Props) {
  const styles = ZONE_STYLES[verdictZone]
  const bear = bearFV ?? (fairValue != null ? fairValue * 0.85 : null)
  const bull = bullFV ?? (fairValue != null ? fairValue * 1.15 : null)

  return (
    <div className={cn('rounded-xl border overflow-hidden', styles.banner)}>

      {/* Verdict banner */}
      <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {/* Grade badge */}
          <div className={cn('flex-shrink-0 rounded-lg w-12 h-12 flex items-center justify-center text-xl font-extrabold', styles.badge)}>
            {grade}
          </div>
          <div>
            <p className={cn('text-sm font-semibold leading-snug', styles.text)}>
              {verdictText(verdictZone, upsidePct, fairValue, price, currency)}
            </p>
            {gradeLabel && (
              <p className="text-[11px] text-slate-500 mt-0.5">{gradeLabel}</p>
            )}
            {methodCount != null && methodCount > 0 && (
              <p className="text-[10px] text-slate-400 mt-0.5">Based on {methodCount} valuation method{methodCount !== 1 ? 's' : ''} · <span className="italic">model estimate, not a prediction</span></p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] text-slate-500">
                Current price: <span className="font-mono font-semibold text-slate-700">{fmtPrice(price, currency)}</span>
              </span>
              {fairValue != null && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-[11px] text-slate-500">
                    Fair value: <span className="font-mono font-semibold text-slate-700">{fmtPrice(fairValue, currency)}</span>
                  </span>
                </>
              )}
              {upsidePct != null && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className={cn('text-[11px] font-bold', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {fmtPct(upsidePct)} upside
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Range bar */}
      {bear != null && bull != null && fairValue != null && (
        <div className="px-5 pb-3 border-t border-current/10 pt-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Range across all valuation methods</p>
          <ConsensusRangeBar
            bear={bear}
            base={fairValue}
            bull={bull}
            price={price}
            currency={currency}
          />
        </div>
      )}

      {/* Drivers + Risk row */}
      {(topDrivers.length > 0 || topRisk != null) && (
        <div className="px-5 py-3 border-t border-current/10 flex flex-wrap gap-4">
          {topDrivers.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold shrink-0">Key drivers</span>
              {topDrivers.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 text-[11px] text-slate-600 px-2.5 py-0.5">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)} />
                  {d}
                </span>
              ))}
            </div>
          )}
          {topRisk != null && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-500 shrink-0" />
              <span className="text-[11px] text-amber-700">{topRisk}</span>
            </div>
          )}
        </div>
      )}

      {/* CTA row */}
      <div className="grid grid-cols-2 border-t border-current/10">
        <button
          onClick={onViewValuation}
          className="flex items-center justify-center gap-1.5 px-4 py-3.5 text-[13px] font-bold text-blue-700 hover:bg-blue-50 transition-colors border-r border-current/10"
        >
          <TrendingUp size={14} className="shrink-0" />
          View full valuation
        </button>
        <button
          onClick={onSave}
          className="flex items-center justify-center gap-1.5 px-4 py-3.5 text-[13px] font-bold text-slate-700 hover:bg-white/60 transition-colors"
        >
          <Bookmark size={14} className="shrink-0" />
          Save analysis
        </button>
      </div>
    </div>
  )
}
