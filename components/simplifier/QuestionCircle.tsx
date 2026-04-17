'use client'

import { useState } from 'react'
import type { Answer, AutoHint } from '@/lib/simplifier/types'

interface QuestionCircleProps {
  questionId: string
  text: string
  answer: Answer
  hint: AutoHint | null
  note: string
  onChange: (id: string, answer: Answer) => void
  onNoteChange: (id: string, note: string) => void
}

// Cycle order on click
const CYCLE: Answer[] = ['yes', 'partial', 'no', null]

function nextAnswer(current: Answer): Answer {
  const idx = CYCLE.indexOf(current)
  return CYCLE[(idx + 1) % CYCLE.length]
}

type AnswerState = NonNullable<Answer> | 'unanswered'
function stateOf(a: Answer): AnswerState {
  return a ?? 'unanswered'
}

const CIRCLE_CONFIG: Record<AnswerState, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
  yes: {
    bg: 'bg-[#1f6feb]',
    border: 'border-[#1f6feb]',
    label: 'Yes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  partial: {
    bg: 'bg-[#9a6700]',
    border: 'border-[#9a6700]',
    label: 'Partial',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
  },
  no: {
    bg: 'bg-[#cf222e]',
    border: 'border-[#cf222e]',
    label: 'No',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
  },
  unanswered: {
    bg: 'bg-white',
    border: 'border-[#E8E6E0]',
    label: '',
    icon: null,
  },
}

export default function QuestionCircle({
  questionId, text, answer, hint, note, onChange, onNoteChange,
}: QuestionCircleProps) {
  const [showNote, setShowNote] = useState(!!note)
  const state = stateOf(answer)
  const cfg   = CIRCLE_CONFIG[state]

  return (
    <div className="rounded-xl border border-[#E8E6E0] bg-white p-4 flex gap-4">
      {/* Circle trigger */}
      <button
        onClick={() => onChange(questionId, nextAnswer(answer))}
        title={cfg.label || 'Click to answer'}
        className={`shrink-0 w-12 h-12 rounded-full border-2 ${cfg.bg} ${cfg.border} flex items-center justify-center transition-all hover:scale-105 shadow-sm`}
      >
        {cfg.icon}
      </button>

      {/* Question body */}
      <div className="flex-1 min-w-0">
        <p className="text-[#2D2C31] text-sm leading-relaxed">{text}</p>

        {/* Hint chip */}
        {hint && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#1f6feb] bg-[#EEF4FF] border border-[#DCE6F5] rounded px-2 py-0.5 mt-1.5 w-fit font-mono">
            <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" className="opacity-60">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 6h1.5v5.5h-1.5Zm0-2.5h1.5v1.5h-1.5Z"/>
            </svg>
            {hint.displayValue}
          </span>
        )}

        {/* Note toggle */}
        <div className="mt-2">
          <button
            onClick={() => setShowNote(v => !v)}
            className="text-[11px] text-[#6B6A72] hover:text-[#1f6feb] flex items-center gap-1 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className={`transition-transform ${showNote ? 'rotate-90' : ''}`}>
              <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/>
            </svg>
            {showNote ? 'Hide note' : 'Add note'}
          </button>
          {showNote && (
            <textarea
              value={note}
              onChange={e => onNoteChange(questionId, e.target.value)}
              placeholder="Add context or notes…"
              rows={2}
              className="mt-1.5 w-full bg-[#F7F6F1] border border-[#E8E6E0] rounded-lg text-[#2D2C31] text-xs px-3 py-2 placeholder-[#6B6A72] resize-none focus:outline-none focus:border-[#1f6feb] transition-colors"
            />
          )}
        </div>
      </div>

      {/* Status label on right */}
      {answer != null && (
        <div className="shrink-0 flex flex-col items-end justify-start pt-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${
            answer === 'yes' ? 'text-[#1f6feb]' : answer === 'partial' ? 'text-[#9a6700]' : 'text-[#cf222e]'
          }`}>
            {cfg.label}
          </span>
        </div>
      )}
    </div>
  )
}
