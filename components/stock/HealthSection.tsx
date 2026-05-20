'use client'
import { buildHealthInterpretation, buildRiskSummary } from '@/lib/simplifier/summaryBuilder'
import type { StockRatings } from '@/lib/dcf/calculateRatings'
import type { PiotroskiResult, AltmanResult, BeneishResult, ROICResult } from '@/lib/dcf/calculateScores'

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
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-1.5 w-6 rounded-full transition-colors ${i <= filled ? barColor : 'bg-white/10'}`}
        />
      ))}
    </div>
  )
}

function CategoryRow({ catKey, ratings }: { catKey: string; ratings: StockRatings }) {
  const cat = ratings[catKey as keyof StockRatings] as StockRatings['profitability'] | undefined
  if (!cat || !('grade' in cat)) return null
  return (
    <div className="flex items-start gap-4">
      <div className="w-32 shrink-0">
        <p className="text-xs font-medium text-slate-300">{CATEGORY_LABELS[catKey]}</p>
        <ScoreBar score={cat.score} color={cat.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-sm font-bold ${cat.color === 'emerald' || cat.color === 'green' ? 'text-emerald-400' : cat.color === 'blue' ? 'text-blue-400' : cat.color === 'amber' || cat.color === 'orange' ? 'text-amber-400' : 'text-red-400'}`}>
            {cat.grade}
          </span>
          <span className="text-xs text-slate-500">{cat.label}</span>
        </div>
        {cat.summary && (
          <p className="text-[11px] text-slate-500 leading-relaxed">{cat.summary}</p>
        )}
      </div>
    </div>
  )
}

export default function HealthSection({ ratings, scores, financialsData }: Props) {
  const piotroski       = scores.piotroski?.score ?? null
  const altmanZone      = scores.altman?.zone ?? null
  const altmanReliable  = scores.altman?.isReliable ?? true
  const beneishFlag     = scores.beneish?.flag ?? null
  const overallGrade    = ratings.overall?.grade ?? 'N/A'

  const healthInterp = buildHealthInterpretation({ piotroski, altmanZone, beneishFlag, overallGrade })
  const riskSummary  = financialsData ? buildRiskSummary('this company', financialsData) : null

  return (
    <div className="rounded-2xl glass-card border-[rgba(59,130,246,0.15)] p-6">
      <h2 className="text-base font-semibold text-slate-100 mb-5">Financial Health</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Category scores — two labeled groups */}
        <div className="space-y-5">
          {/* Business Quality */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Business Quality</p>
            <div className="space-y-4">
              {BUSINESS_QUALITY_KEYS.map((key) => (
                <CategoryRow key={key} catKey={key} ratings={ratings} />
              ))}
            </div>
          </div>

          {/* Price vs. Value */}
          <div className="pt-1 border-t border-white/8">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 mt-3">Price vs. Value</p>
            <div className="space-y-4">
              {VALUATION_KEYS.map((key) => (
                <CategoryRow key={key} catKey={key} ratings={ratings} />
              ))}
            </div>
          </div>
        </div>

        {/* Quality signals + summary */}
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Quality Signals</p>
            <div className="space-y-2">
              {piotroski != null && (
                <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/8 px-4 py-2.5">
                  <span className="text-xs text-slate-400">Piotroski F-Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100 tabular-nums">{piotroski}/9</span>
                    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${piotroski >= 7 ? 'bg-emerald-500/20 text-emerald-300' : piotroski >= 4 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                      {piotroski >= 7 ? 'Strong' : piotroski >= 4 ? 'Mixed' : 'Weak'}
                    </span>
                  </div>
                </div>
              )}
              {altmanZone && (
                <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/8 px-4 py-2.5">
                  <span className="text-xs text-slate-400">
                    Altman Z-Score
                    {!altmanReliable && (
                      <span className="ml-1.5 text-[10px] text-amber-400 font-medium">(EM — limited reliability)</span>
                    )}
                  </span>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${altmanZone === 'Safe' ? 'bg-emerald-500/20 text-emerald-300' : altmanZone === 'Grey' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                    {altmanZone} Zone
                  </span>
                </div>
              )}
              {beneishFlag && (
                <div className="flex items-center justify-between rounded-lg bg-white/5 border border-white/8 px-4 py-2.5">
                  <span className="text-xs text-slate-400">Beneish M-Score</span>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${beneishFlag === 'Clean' ? 'bg-emerald-500/20 text-emerald-300' : beneishFlag === 'Warning' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
                    {beneishFlag}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Plain-English interpretation */}
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
            <p className="text-xs text-blue-300 leading-relaxed">{healthInterp}</p>
            {riskSummary && (
              <p className="text-xs text-blue-400 leading-relaxed mt-1">{riskSummary}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
