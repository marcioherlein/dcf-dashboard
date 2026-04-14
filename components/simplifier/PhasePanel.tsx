'use client'

import type { PhaseDefinition, AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import QuestionCard from './QuestionCard'

interface PhasePanelProps {
  phase: PhaseDefinition
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onAnswerChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

export default function PhasePanel({
  phase, answers, notes, autoMap, onAnswerChange, onNoteChange,
}: PhasePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Phase header */}
      <div className="mb-1">
        <p className="text-[#8b949e] text-sm">{phase.description}</p>
      </div>

      {/* Questions */}
      {phase.questions.map((q) => (
        <QuestionCard
          key={q.id}
          questionId={q.id}
          text={q.text}
          answer={answers[q.id] ?? null}
          hint={autoMap[q.id] ?? null}
          note={notes[q.id] ?? ''}
          onChange={onAnswerChange}
          onNoteChange={onNoteChange}
        />
      ))}
    </div>
  )
}
