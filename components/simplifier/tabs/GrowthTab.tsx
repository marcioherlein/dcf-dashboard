'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase } from '@/lib/simplifier/scoring'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildGrowthSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCardLight from '../QuestionCardLight'

interface GrowthTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

export default function GrowthTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: GrowthTabProps) {
  const phase = PHASES[2]
  const raw   = scorePhase(answers, phase)
  const score = 1 + raw * 4

  const cagr3y  = data.cagrAnalysis?.historicalCagr3y ?? null
  const analyst = data.cagrAnalysis?.analystEstimate1y ?? null
  const spread  = data.scores?.roic?.spread ?? null

  // Operating margin trend from income statement
  const isRows = (data.financialStatements?.incomeStatement ?? [])
    .filter((r) => !r.isProjected && r.operatingMargin != null)
    .slice(0, 4)
    .reverse() // oldest first for chart

  function pct(v: number | null) { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }

  const metrics = [
    { label: '3Y Rev CAGR',  value: pct(cagr3y) },
    { label: 'Analyst Est.', value: pct(analyst) },
    { label: 'ROIC Spread',  value: pct(spread) },
  ]

  const summary = buildGrowthSummary(companyName, data, answers)

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 3</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Growth</h2>
          <p className="text-sm text-[#6B6A72] mt-0.5">{phase.description}</p>
        </div>
        <div className="hidden sm:grid grid-cols-3 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="text-right">
              <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider">{m.label}</p>
              <p className="text-sm font-semibold font-mono text-[#2D2C31]">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Operating margin trend */}
      {isRows.length >= 2 && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">Operating Margin Trend</p>
          <div className="flex items-end gap-3 h-20">
            {isRows.map((row, i) => {
              const val = row.operatingMargin!
              const barH = Math.max(4, Math.min(72, Math.abs(val) * 200))
              const isPositive = val >= 0
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: `${barH}px`,
                      background: isPositive ? '#1f6feb' : '#cf222e',
                      opacity: 0.7 + (i / isRows.length) * 0.3,
                    }}
                  />
                  <p className="text-[10px] font-mono text-[#2D2C31]">{pct(val)}</p>
                  <p className="text-[9px] text-[#6B6A72]">{row.year}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <SectionSummary text={summary} label="Growth Analysis" />

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
