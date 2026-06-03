'use client'
import { useState } from 'react'
import { buildHealthInterpretation, buildRiskSummary } from '@/lib/simplifier/summaryBuilder'
import type { StockRatings } from '@/lib/dcf/calculateRatings'
import type { PiotroskiResult, AltmanResult, BeneishResult, ROICResult } from '@/lib/dcf/calculateScores'
import RiskRadar from './RiskRadar'

interface ScoresData {
  piotroski: PiotroskiResult
  altman: AltmanResult | null
  beneish: BeneishResult | null
  roic: ROICResult
}

interface Props {
  ratings: StockRatings
  scores: ScoresData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  financialsData?: any
  collapsible?: boolean
  nextEarningsDate?: string | null
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        aria-label="More information"
        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <svg className="w-3 h-3 text-slate-400 cursor-help" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 max-w-[min(208px,calc(100vw-2rem))] rounded-lg bg-slate-800 px-2.5 py-2 text-[11px] text-white shadow-lg opacity-0 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 transition-opacity z-50 leading-snug text-left normal-case tracking-normal font-normal">
        {text}
      </span>
    </span>
  )
}

const BUSINESS_QUALITY_KEYS = ['profitability', 'liquidity', 'growth', 'moat'] as const
const VALUATION_KEYS = ['valuation'] as const

const CATEGORY_LABELS: Record<string, string> = {
  profitability: 'Profitability',
  liquidity: 'Liquidity',
  growth: 'Growth',
  moat: 'Economic Moat',
  valuation: 'Valuation',
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  const filled = Math.round(Math.min(Math.max(score, 0), 5))
  const barColor =
    color === 'emerald' || color === 'green' ? 'bg-emerald-500' :
    color === 'blue' ? 'bg-blue-500' :
    color === 'amber' || color === 'orange' ? 'bg-amber-500' :
    'bg-red-500'

  return (
    <div className="flex items-center gap-1.5 mt-1 w-full max-w-[160px]">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-2 w-7 sm:w-6 rounded-full transition-colors ${i <= filled ? barColor : 'bg-slate-200'}`}
        />
      ))}
    </div>
  )
}

function CategoryRow({ catKey, ratings }: { catKey: string; ratings: StockRatings }) {
  const cat = ratings[catKey as keyof StockRatings] as StockRatings['profitability'] | undefined
  if (!cat || !('grade' in cat)) return null
  return (
    <div className="flex items-start gap-3 sm:gap-4 py-3 min-h-[44px]">
      <div className="min-w-[6rem] max-w-[9rem] shrink-0">
        <p className="text-[13px] font-medium text-slate-600">{CATEGORY_LABELS[catKey]}</p>
        <ScoreBar score={cat.score} color={cat.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={`text-sm font-bold ${cat.color === 'emerald' || cat.color === 'green' ? 'text-emerald-600' : cat.color === 'blue' ? 'text-blue-600' : cat.color === 'amber' || cat.color === 'orange' ? 'text-amber-600' : 'text-red-600'}`}>
            {cat.grade}
          </span>
          <span className="text-[12px] text-slate-500">{cat.label}</span>
        </div>
        {cat.summary && (
          <p className="text-[12px] text-slate-500 leading-relaxed">{cat.summary}</p>
        )}
      </div>
    </div>
  )
}

export default function HealthSection({ ratings, scores, financialsData, collapsible, nextEarningsDate }: Props) {
  const [open, setOpen] = useState(true)
  const piotroski       = scores.piotroski?.score ?? null
  const altmanZone      = scores.altman?.zone ?? null
  const altmanReliable  = scores.altman?.isReliable ?? true
  const beneishFlag     = scores.beneish?.flag ?? null
  const overallGrade    = ratings.overall?.grade ?? 'N/A'

  const healthInterp = buildHealthInterpretation({ piotroski, altmanZone, beneishFlag, overallGrade })
  const riskSummary  = financialsData ? buildRiskSummary('this company', financialsData) : null

  return (
    <div className="rounded-xl card overflow-hidden">
      {collapsible ? (
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-slate-50/60 transition-colors min-h-[44px]"
        >
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Financial Health</h2>
            <p className="text-[10px] text-slate-400">
              <span className="text-emerald-600 font-semibold">A</span> Excellent&nbsp;·&nbsp;
              <span className="text-blue-500 font-semibold">B</span> Good&nbsp;·&nbsp;
              <span className="text-amber-600 font-semibold">C</span> Average&nbsp;·&nbsp;
              <span className="text-red-500 font-semibold">D/F</span> Weak
            </p>
          </div>
          <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      ) : (
        <div className="flex items-start sm:items-center justify-between px-4 sm:px-6 pt-5 pb-1 flex-wrap gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Financial Health</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[10px] text-slate-400">
              <span className="text-emerald-600 font-semibold">A</span> Excellent&nbsp;·&nbsp;
              <span className="text-blue-500 font-semibold">B</span> Good&nbsp;·&nbsp;
              <span className="text-amber-600 font-semibold">C</span> Average&nbsp;·&nbsp;
              <span className="text-red-500 font-semibold">D/F</span> Weak
            </p>
            {overallGrade && overallGrade !== 'N/A' && (
              <span className="text-[32px] font-black text-slate-800 leading-none">{overallGrade}</span>
            )}
          </div>
        </div>
      )}

      {(!collapsible || open) && (
      <>
      {/* Earnings countdown notice */}
      {nextEarningsDate && (() => {
        const d = new Date(nextEarningsDate)
        const daysUntil = Math.ceil((d.getTime() - Date.now()) / 86400000)
        if (daysUntil < 0 || daysUntil > 45) return null
        const label = daysUntil === 0 ? 'Earnings today' : daysUntil === 1 ? 'Earnings tomorrow' : `Earnings in ${daysUntil} days`
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        return (
          <div className="mx-4 sm:mx-6 mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-amber-800">{label} — {dateStr}</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Health scores are based on the most recent filing. New data will be available after the report.</p>
            </div>
          </div>
        )
      })()}
      <div className="px-4 sm:px-6 pb-6 pt-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Category scores — two labeled groups */}
        <div className="space-y-5">
          {/* Business Quality */}
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-3">Business Quality</p>
            <div className="space-y-4">
              {BUSINESS_QUALITY_KEYS.map((key) => (
                <CategoryRow key={key} catKey={key} ratings={ratings} />
              ))}
            </div>
          </div>

          {/* Price vs. Value */}
          <div className="pt-1 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 mb-3 mt-3">Price vs. Value</p>
            <div className="space-y-4">
              {VALUATION_KEYS.map((key) => (
                <CategoryRow key={key} catKey={key} ratings={ratings} />
              ))}
            </div>
          </div>
        </div>

        {/* Quality signals + summary */}
        <div className="space-y-5">
          {(piotroski != null || altmanZone || beneishFlag) && (
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-3">Quality Signals</p>
            <div className="space-y-2">
              {piotroski != null && (
                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white border border-slate-200 px-4 py-3 min-h-[44px]">
                  <span className="text-[13px] text-slate-500 min-w-0">
                    Piotroski F-Score
                    <InfoTip text="9-point checklist of profitability, leverage, and efficiency. Score 8–9 = strong financial health; below 4 = signals weakness." />
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[32px] font-black text-slate-900 tabular-nums">{piotroski}/9</span>
                    <span className={`text-[12px] font-medium rounded-full px-2.5 py-1 ${piotroski >= 8 ? 'bg-emerald-100 text-emerald-700' : piotroski >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {piotroski >= 8 ? 'Strong' : piotroski >= 4 ? 'Mixed' : 'Weak'}
                    </span>
                  </div>
                </div>
              )}
              {altmanZone && (
                <div className="flex items-center justify-between gap-2 flex-wrap rounded-lg bg-white border border-slate-200 px-4 py-3 min-h-[44px]">
                  <span className="text-[13px] text-slate-500 min-w-0">
                    Altman Z-Score
                    <InfoTip text="Predicts bankruptcy risk using financial ratios. Safe Zone (above 2.99) = low risk; Distress Zone (below 1.81) = elevated risk." />
                    {!altmanReliable && (
                      <span className="ml-1.5 text-[11px] text-amber-600 font-medium">(EM — limited reliability)</span>
                    )}
                  </span>
                  <span className={`text-[12px] font-semibold rounded-full px-2.5 py-1 shrink-0 ${altmanZone === 'Safe' ? 'bg-emerald-100 text-emerald-700' : altmanZone === 'Grey' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {altmanZone} Zone
                  </span>
                </div>
              )}
              {beneishFlag && (
                <div className="flex items-start justify-between gap-2 flex-wrap rounded-lg bg-white border border-slate-200 px-4 py-3 min-h-[44px]">
                  <span className="text-[13px] text-slate-500 min-w-0">
                    Beneish M-Score
                    <InfoTip text="Statistical model detecting potential earnings manipulation. 'Clean' = low manipulation risk; 'Warning' = borderline; 'Elevated Risk' = above the threshold, though large-caps commonly trigger this without actual manipulation." />
                  </span>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[12px] font-semibold rounded-full px-2.5 py-1 shrink-0 ${beneishFlag === 'Clean' ? 'bg-emerald-100 text-emerald-700' : beneishFlag === 'Warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {beneishFlag === 'Manipulator' ? 'Elevated Risk' : beneishFlag}
                    </span>
                    {beneishFlag === 'Manipulator' && (
                      <span className="text-[10px] text-slate-400 text-right leading-snug max-w-[160px]">
                        Large-caps often trigger this threshold. Verify with other signals.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Plain-English interpretation */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
            <p className="text-[13px] text-blue-700 leading-relaxed">{healthInterp}</p>
            {riskSummary && (
              <p className="text-[13px] text-blue-600 leading-relaxed mt-1">{riskSummary}</p>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Risk Radar — 5-dimension risk breakdown */}
      {financialsData && <RiskRadar financialsData={financialsData} />}

      </> )} {/* end collapsible content */}
    </div>
  )
}
