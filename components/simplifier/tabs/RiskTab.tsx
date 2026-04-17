'use client'

import { PHASES } from '@/lib/simplifier/phases'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildRiskSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCircle from '../QuestionCircle'

interface RiskTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

// Only the first 4 questions of phase 5 are "risk" questions (risk_*)
const RISK_QUESTION_IDS = ['risk_regulatory', 'risk_competitive_disruption', 'risk_financial_health', 'risk_macro_exposure']

export default function RiskTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: RiskTabProps) {
  const phase     = PHASES[4]
  const riskQs    = phase.questions.filter(q => RISK_QUESTION_IDS.includes(q.id))
  // Score only risk questions for the circle
  const riskRaw   = riskQs.length ? riskQs.reduce((sum, q) => {
    const a = answers[q.id]
    return sum + (a === 'yes' ? 1 : a === 'partial' ? 0.5 : 0)
  }, 0) / riskQs.length : 0
  const score = 1 + riskRaw * 4

  const altmanZone  = data.scores?.altman?.zone ?? null
  const beta        = data.wacc?.inputs?.beta ?? null
  const beneishFlag = data.scores?.beneish?.flag ?? null

  function num(v: number | null, d = 2) { return v == null ? '—' : v.toFixed(d) }

  const altmanColor = altmanZone === 'Safe' ? 'text-[#1f6feb]' : altmanZone === 'Grey' ? 'text-[#9a6700]' : altmanZone === 'Distress' ? 'text-[#cf222e]' : 'text-[#2D2C31]'
  const beneishColor = beneishFlag === 'Clean' ? 'text-[#1f6feb]' : beneishFlag === 'Warning' ? 'text-[#9a6700]' : 'text-[#cf222e]'

  const riskMetrics = [
    { label: 'Altman Zone',  value: altmanZone ?? '—',           color: altmanColor },
    { label: 'Beta',         value: num(beta),                   color: 'text-[#2D2C31]' },
    { label: 'Beneish Flag', value: beneishFlag ?? '—',          color: beneishColor },
  ]

  const summary = buildRiskSummary(companyName, data)

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 5 · Part A</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Risk Assessment</h2>
          <p className="text-sm text-[#6B6A72] mt-0.5">Assess key risks including balance sheet health, competitive threats and macro sensitivity.</p>
        </div>
        <div className="hidden sm:grid grid-cols-3 gap-3">
          {riskMetrics.map(m => (
            <div key={m.label} className="text-right">
              <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider">{m.label}</p>
              <p className={`text-sm font-semibold font-mono ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk indicator cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#E8E6E0] bg-white px-4 py-3">
          <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider mb-1">Altman Z-Score</p>
          <p className={`text-base font-bold font-mono ${altmanColor}`}>{altmanZone ?? '—'}</p>
          <p className="text-[11px] text-[#6B6A72] mt-0.5">
            {altmanZone === 'Safe' ? 'Low insolvency risk' : altmanZone === 'Grey' ? 'Monitor closely' : altmanZone === 'Distress' ? 'High risk' : 'No data'}
          </p>
        </div>
        <div className="rounded-xl border border-[#E8E6E0] bg-white px-4 py-3">
          <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider mb-1">Market Sensitivity</p>
          <p className="text-base font-bold font-mono text-[#2D2C31]">β {num(beta)}</p>
          <p className="text-[11px] text-[#6B6A72] mt-0.5">
            {beta == null ? 'No data' : beta < 0.8 ? 'Defensive' : beta < 1.2 ? 'Market-like' : 'High volatility'}
          </p>
        </div>
        <div className="rounded-xl border border-[#E8E6E0] bg-white px-4 py-3">
          <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider mb-1">Earnings Quality</p>
          <p className={`text-base font-bold font-mono ${beneishColor}`}>{beneishFlag ?? '—'}</p>
          <p className="text-[11px] text-[#6B6A72] mt-0.5">
            {beneishFlag === 'Clean' ? 'No red flags' : beneishFlag === 'Warning' ? 'Warrants scrutiny' : beneishFlag === 'Manipulator' ? 'Potential manipulation' : 'No data'}
          </p>
        </div>
      </div>

      <SectionSummary text={summary} label="Risk Analysis" />

      <div className="flex flex-col gap-3">
        {riskQs.map(q => (
          <QuestionCircle
            key={q.id}
            questionId={q.id}
            text={q.text}
            answer={answers[q.id] ?? null}
            hint={autoMap[q.id] ?? null}
            note={notes[q.id] ?? ''}
            onChange={onChange}
            onNoteChange={onNoteChange}
          />
        ))}
      </div>
    </div>
  )
}
