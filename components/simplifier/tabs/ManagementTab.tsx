'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase } from '@/lib/simplifier/scoring'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildManagementSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCardLight from '../QuestionCardLight'

interface ManagementTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

export default function ManagementTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: ManagementTabProps) {
  const phase = PHASES[3]
  const raw   = scorePhase(answers, phase)
  const score = 1 + raw * 4

  const insiderPct  = data.ownership?.insiderPct ?? null
  const piotroski   = data.scores?.piotroski?.score ?? null
  const beneishFlag = data.scores?.beneish?.flag ?? null
  const criteria    = data.scores?.piotroski?.criteria ?? []

  function pct(v: number | null) { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }

  const metrics = [
    { label: 'Insider Own.',    value: pct(insiderPct) },
    { label: 'Piotroski F',     value: piotroski != null ? `${piotroski}/9` : '—' },
    { label: 'Beneish M',       value: beneishFlag ?? '—' },
  ]

  const beneishColor = beneishFlag === 'Clean' ? 'text-[#1f6feb]' : beneishFlag === 'Warning' ? 'text-[#9a6700]' : 'text-[#cf222e]'

  const summary = buildManagementSummary(companyName, data, answers)

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 4</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Management</h2>
          <p className="text-sm text-[#6B6A72] mt-0.5">{phase.description}</p>
        </div>
        <div className="hidden sm:grid grid-cols-3 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="text-right">
              <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider">{m.label}</p>
              <p className={`text-sm font-semibold font-mono ${m.label === 'Beneish M' ? beneishColor : 'text-[#2D2C31]'}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Piotroski breakdown */}
      {criteria.length > 0 && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">
            Piotroski F-Score: {piotroski}/9
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {criteria.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${c.pass ? 'bg-[#EEF4FF] text-[#1f6feb]' : 'bg-[#FEE2E2] text-[#cf222e]'}`}>
                  {c.pass ? '✓' : '✗'}
                </span>
                <span className="text-xs text-[#2D2C31]">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SectionSummary text={summary} label="Management Analysis" />

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
