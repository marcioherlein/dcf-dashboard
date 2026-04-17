'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase } from '@/lib/simplifier/scoring'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildValuationSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCardLight from '../QuestionCardLight'

interface ValuationTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

const VAL_QUESTION_IDS = ['val_price_reasonable', 'val_margin_of_safety']

export default function ValuationTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: ValuationTabProps) {
  const phase  = PHASES[4]
  const valQs  = phase.questions.filter(q => VAL_QUESTION_IDS.includes(q.id))
  const valRaw = valQs.length ? valQs.reduce((sum, q) => {
    const a = answers[q.id]
    return sum + (a === 'yes' ? 1 : a === 'partial' ? 0.5 : 0)
  }, 0) / valQs.length : 0
  const score = 1 + valRaw * 4

  const d = data as any
  const upsidePct  = d.fairValue?.upsidePct ?? null
  const peRatio    = d.quote?.peRatio ?? null
  const bull       = d.scenarios?.bull?.fairValue ?? null
  const base       = d.scenarios?.base?.fairValue ?? null
  const bear       = d.scenarios?.bear?.fairValue ?? null
  const price      = d.quote?.price ?? null
  const valRating  = data.ratings?.valuation?.score ?? null

  function pct(v: number | null) { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }
  function money(v: number | null) { return v == null ? '—' : `$${v.toFixed(2)}` }
  function num(v: number | null, d = 1) { return v == null ? '—' : v.toFixed(d) }

  const upsideColor = upsidePct == null ? 'text-[#6B6A72]' : upsidePct >= 0.25 ? 'text-[#1f6feb]' : upsidePct >= 0.05 ? 'text-[#9a6700]' : 'text-[#cf222e]'
  const upsideLabel = upsidePct == null ? '' : upsidePct >= 0.25 ? 'Attractive' : upsidePct >= 0.05 ? 'Fair Value' : 'Expensive'

  const summary = buildValuationSummary(companyName, data, answers)

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 5 · Part B</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Valuation</h2>
          <p className="text-sm text-[#6B6A72] mt-0.5">Determine whether the current price offers a sufficient margin of safety.</p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1">
          <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider">DCF Upside</p>
          <p className={`text-2xl font-bold font-mono ${upsideColor}`}>
            {upsidePct != null ? `${upsidePct >= 0 ? '+' : ''}${pct(upsidePct)}` : '—'}
          </p>
          {upsideLabel && <p className={`text-[11px] font-semibold ${upsideColor}`}>{upsideLabel}</p>}
        </div>
      </div>

      {/* Scenario table */}
      {(bull != null || base != null || bear != null) && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">DCF Scenarios</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Bear Case', value: bear, color: 'text-[#cf222e]', bg: 'bg-[#FEE2E2]', border: 'border-[#FECACA]' },
              { label: 'Base Case', value: base, color: 'text-[#9a6700]', bg: 'bg-[#FEF9C3]', border: 'border-[#FDE68A]' },
              { label: 'Bull Case', value: bull, color: 'text-[#1f6feb]', bg: 'bg-[#EEF4FF]', border: 'border-[#DCE6F5]' },
            ].map(s => {
              const upside = s.value != null && price != null ? (s.value - price) / price : null
              return (
                <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
                  <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider mb-1">{s.label}</p>
                  <p className={`text-base font-bold font-mono ${s.color}`}>{money(s.value)}</p>
                  {upside != null && (
                    <p className={`text-[11px] font-semibold mt-0.5 ${s.color}`}>
                      {upside >= 0 ? '+' : ''}{pct(upside)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Key valuation metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Current Price',  value: money(price) },
          { label: 'P/E Ratio',      value: peRatio != null ? `${num(peRatio)}x` : '—' },
          { label: 'Valuation Rating', value: valRating != null ? `${num(valRating)}/5` : '—' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-[#E8E6E0] bg-white px-4 py-3">
            <p className="text-[11px] text-[#6B6A72] uppercase tracking-wider mb-1">{m.label}</p>
            <p className="text-base font-semibold font-mono text-[#2D2C31]">{m.value}</p>
          </div>
        ))}
      </div>

      <SectionSummary text={summary} label="Valuation Analysis" />

      <div className="flex flex-col gap-3">
        {valQs.map(q => (
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
