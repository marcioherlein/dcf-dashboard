'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase } from '@/lib/simplifier/scoring'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildBusinessSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCardLight from '../QuestionCardLight'

interface BusinessTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

export default function BusinessTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: BusinessTabProps) {
  const phase = PHASES[0]
  const raw   = scorePhase(answers, phase)       // 0–1
  const score = 1 + raw * 4                      // 1–5

  const gm   = data.businessProfile?.grossMargin ?? null
  const fcfM = data.businessProfile?.fcfMargin ?? null
  const cagr = data.cagrAnalysis?.historicalCagr3y ?? null
  const beta = data.wacc?.inputs?.beta ?? null

  function pct(v: number | null) { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }
  function num(v: number | null, d = 2) { return v == null ? '—' : v.toFixed(d) }

  const metrics = [
    { label: 'Gross Margin', value: pct(gm) },
    { label: 'FCF Margin',   value: pct(fcfM) },
    { label: '3Y Rev CAGR',  value: pct(cagr) },
    { label: 'Beta',         value: num(beta) },
  ]

  const summary = buildBusinessSummary(companyName, data, answers)

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 1</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Business Quality</h2>
          <p className="text-sm text-[#6B6A72] mt-0.5">{phase.description}</p>
        </div>
        {/* Mini metrics row */}
        <div className="hidden sm:grid grid-cols-2 gap-2">
          {metrics.map(m => (
            <div key={m.label} className="text-right">
              <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider">{m.label}</p>
              <p className="text-sm font-semibold font-mono text-[#2D2C31]">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Smart summary */}
      <SectionSummary text={summary} label="Business Quality Analysis" />

      {/* Questions */}
      <div className="flex flex-col gap-3">
        {phase.questions.map(q => (
          <QuestionCardLight
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
