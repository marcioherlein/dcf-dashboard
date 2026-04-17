'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase, overallScore } from '@/lib/simplifier/scoring'
import type { AllAnswers } from '@/lib/simplifier/types'
import ScoreCircle from '../ScoreCircle'

interface ScoreTabProps {
  ticker: string
  companyName: string
  answers: AllAnswers
  onSave?: () => void
  saveLabel?: string
  saving?: boolean
}

const DIMENSIONS = [
  { label: 'Business Quality', phaseIdx: 0, description: 'Revenue predictability, margins, and unit economics' },
  { label: 'Competitive Moat',  phaseIdx: 1, description: 'ROIC spread, switching costs, intangibles' },
  { label: 'Growth',            phaseIdx: 2, description: 'Revenue CAGR, margin expansion, analyst estimates' },
  { label: 'Management',        phaseIdx: 3, description: 'Insider ownership, Piotroski, Beneish' },
  { label: 'Risk',              phaseIdx: 4, description: 'Altman Z, beta, earnings quality, macro exposure', sliceIds: ['risk_regulatory','risk_competitive_disruption','risk_financial_health','risk_macro_exposure'] },
  { label: 'Valuation',         phaseIdx: 4, description: 'DCF upside, margin of safety', sliceIds: ['val_price_reasonable','val_margin_of_safety'] },
]

function dimensionScore(answers: AllAnswers, dim: typeof DIMENSIONS[0]): number {
  const phase = PHASES[dim.phaseIdx]
  const qs    = dim.sliceIds ? phase.questions.filter(q => dim.sliceIds!.includes(q.id)) : phase.questions
  if (!qs.length) return 0
  const raw = qs.reduce((sum, q) => {
    const a = answers[q.id]
    return sum + (a === 'yes' ? 1 : a === 'partial' ? 0.5 : 0)
  }, 0) / qs.length
  return 1 + raw * 4
}

function scoreLabel(s: number): string {
  if (s >= 4.5) return 'Excellent'
  if (s >= 3.5) return 'Strong'
  if (s >= 2.5) return 'Average'
  if (s >= 1.5) return 'Weak'
  return 'Poor'
}
function scoreBarColor(s: number): string {
  if (s >= 4.5) return 'bg-[#1f6feb]'
  if (s >= 3.5) return 'bg-[#0969da]'
  if (s >= 2.5) return 'bg-[#9a6700]'
  return 'bg-[#cf222e]'
}
function scoreBadgeClass(s: number): string {
  if (s >= 4.5) return 'bg-[#EEF4FF] text-[#1f6feb] border-[#DCE6F5]'
  if (s >= 3.5) return 'bg-[#DBEAFE] text-[#0969da] border-[#BFDBFE]'
  if (s >= 2.5) return 'bg-[#FEF9C3] text-[#9a6700] border-[#FDE68A]'
  return 'bg-[#FEE2E2] text-[#cf222e] border-[#FECACA]'
}

export default function ScoreTab({
  ticker, companyName, answers, onSave, saveLabel = 'Save to Watchlist', saving = false,
}: ScoreTabProps) {
  const phaseScoresRaw = {
    1: scorePhase(answers, PHASES[0]),
    2: scorePhase(answers, PHASES[1]),
    3: scorePhase(answers, PHASES[2]),
    4: scorePhase(answers, PHASES[3]),
    5: scorePhase(answers, PHASES[4]),
  }
  const overall1to5 = 1 + overallScore(phaseScoresRaw) * 4

  const dimScores = DIMENSIONS.map(d => ({
    ...d,
    score: dimensionScore(answers, d),
  }))

  return (
    <div className="flex flex-col gap-6">
      {/* Overall score card */}
      <div className="rounded-xl border border-[#DCE6F5] bg-[#EEF4FF] p-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreCircle score={overall1to5} size="lg" />
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl font-bold text-[#2D2C31]">{companyName}</h2>
          <p className="text-[#6B6A72] text-sm mt-0.5 font-mono">{ticker}</p>
          <p className="text-[#1f6feb] font-semibold mt-2">
            {scoreLabel(overall1to5)} — Overall Investment Score
          </p>
          <p className="text-[#6B6A72] text-sm mt-1">
            Based on your analysis across all 6 dimensions.
          </p>
        </div>
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="shrink-0 px-5 py-2.5 bg-[#1f6feb] text-white text-sm font-semibold rounded-xl hover:bg-[#1a5fc7] disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : saveLabel}
          </button>
        )}
      </div>

      {/* Dimension breakdown */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-4">Score by Dimension</p>
        <div className="flex flex-col gap-4">
          {dimScores.map(d => (
            <div key={d.label} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <p className="text-xs font-semibold text-[#2D2C31]">{d.label}</p>
                <p className="text-[10px] text-[#6B6A72] leading-tight mt-0.5">{d.description}</p>
              </div>
              <div className="flex-1 h-2 bg-[#F7F6F1] rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${scoreBarColor(d.score)}`}
                  style={{ width: `${((d.score - 1) / 4) * 100}%` }}
                />
              </div>
              <div className="w-20 shrink-0 flex items-center justify-end gap-1.5">
                <span className="text-sm font-bold font-mono text-[#2D2C31]">{d.score.toFixed(1)}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${scoreBadgeClass(d.score)}`}>
                  {scoreLabel(d.score)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Are you interested? CTA */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">Are You Interested?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Strong Buy',     minScore: 4.5, color: 'border-[#DCE6F5] bg-[#EEF4FF] text-[#1f6feb]' },
            { label: 'Watch List',     minScore: 3.5, color: 'border-[#FDE68A] bg-[#FEF9C3] text-[#9a6700]' },
            { label: 'Pass for Now',   minScore: 0,   color: 'border-[#FECACA] bg-[#FEE2E2] text-[#cf222e]' },
          ].map(opt => {
            const isActive =
              opt.minScore === 4.5 ? overall1to5 >= 4.5 :
              opt.minScore === 3.5 ? overall1to5 >= 3.5 && overall1to5 < 4.5 :
              overall1to5 < 3.5
            return (
              <div
                key={opt.label}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${opt.color} ${isActive ? 'ring-2 ring-offset-1 ring-current' : 'opacity-40'}`}
              >
                {isActive && <span className="mr-1">→</span>}
                {opt.label}
                {isActive && (
                  <p className="text-[11px] font-normal mt-1 opacity-80">
                    {opt.label === 'Strong Buy' ? `Score ${overall1to5.toFixed(1)} — high conviction opportunity.` :
                     opt.label === 'Watch List' ? `Score ${overall1to5.toFixed(1)} — monitor for better entry.` :
                     `Score ${overall1to5.toFixed(1)} — risk/reward not compelling.`}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
