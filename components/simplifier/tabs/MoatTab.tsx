'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase } from '@/lib/simplifier/scoring'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildMoatSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCircle from '../QuestionCircle'

interface MoatTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

export default function MoatTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: MoatTabProps) {
  const phase = PHASES[1]
  const raw   = scorePhase(answers, phase)
  const score = 1 + raw * 4

  const roic      = data.scores?.roic?.roic ?? null
  const spread    = data.scores?.roic?.spread ?? null
  const moatScore = data.ratings?.moat?.score ?? null

  function pct(v: number | null) { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }
  function num(v: number | null, d = 1) { return v == null ? '—' : v.toFixed(d) }

  const metrics = [
    { label: 'ROIC',        value: pct(roic) },
    { label: 'ROIC Spread', value: pct(spread) },
    { label: 'Moat Rating', value: moatScore != null ? `${num(moatScore)}/5` : '—' },
  ]

  const summary = buildMoatSummary(companyName, data, answers)

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 2</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Competitive Moat</h2>
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

      {/* ROIC vs WACC visual */}
      {roic != null && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">ROIC vs Cost of Capital</p>
          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-16 rounded-t-md"
                style={{
                  height: `${Math.max(8, Math.min(100, (roic * 100) * 2))}px`,
                  background: (spread ?? 0) >= 0 ? '#1f6feb' : '#cf222e',
                }}
              />
              <p className="text-[11px] font-mono text-[#2D2C31]">{pct(roic)}</p>
              <p className="text-[10px] text-[#6B6A72]">ROIC</p>
            </div>
            {spread != null && (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-16 rounded-t-md bg-[#DCE6F5]"
                  style={{ height: `${Math.max(8, Math.min(100, ((roic - spread) * 100) * 2))}px` }}
                />
                <p className="text-[11px] font-mono text-[#2D2C31]">{pct(roic - spread)}</p>
                <p className="text-[10px] text-[#6B6A72]">WACC</p>
              </div>
            )}
            {spread != null && (
              <div className="ml-4">
                <p className="text-[11px] text-[#6B6A72] uppercase tracking-wider mb-1">Spread</p>
                <p className={`text-xl font-bold font-mono ${spread >= 0 ? 'text-[#1f6feb]' : 'text-[#cf222e]'}`}>
                  {spread >= 0 ? '+' : ''}{pct(spread)}
                </p>
                <p className="text-[11px] text-[#6B6A72]">{spread >= 0.05 ? 'Durable advantage' : spread >= 0 ? 'Modest advantage' : 'Below cost of capital'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <SectionSummary text={summary} label="Moat Analysis" />

      <div className="flex flex-col gap-3">
        {phase.questions.map(q => (
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
