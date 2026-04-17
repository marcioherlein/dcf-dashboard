'use client'

import { useState } from 'react'
import type { Answer, AutoHint } from '@/lib/simplifier/types'

interface QuestionCardLightProps {
  questionId: string
  text: string
  answer: Answer
  hint: AutoHint | null
  note: string
  onChange: (id: string, answer: Answer) => void
  onNoteChange: (id: string, note: string) => void
}

const OPTIONS: { value: Answer; label: string; activeClass: string; dotClass: string }[] = [
  { value: 'yes',     label: 'Yes',     activeClass: 'bg-[#dbeafe] border-[#1f6feb] text-[#1f6feb]', dotClass: 'bg-[#1f6feb]' },
  { value: 'partial', label: 'Partial', activeClass: 'bg-[#fef9c3] border-[#9a6700] text-[#9a6700]', dotClass: 'bg-[#9a6700]' },
  { value: 'no',      label: 'No',      activeClass: 'bg-[#fee2e2] border-[#cf222e] text-[#cf222e]', dotClass: 'bg-[#cf222e]' },
]

export default function QuestionCardLight({
  questionId, text, answer, hint, note, onChange, onNoteChange,
}: QuestionCardLightProps) {
  const [showNote, setShowNote] = useState(!!note)

  return (
    <div className="rounded-xl border border-[#E8E6E0] bg-white p-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-[#2D2C31] text-sm leading-relaxed">{text}</p>
        {hint && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#1f6feb] bg-[#EEF4FF] border border-[#DCE6F5] rounded px-2 py-0.5 w-fit font-mono">
            <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" className="opacity-60">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 6h1.5v5.5h-1.5Zm0-2.5h1.5v1.5h-1.5Z"/>
            </svg>
            {hint.displayValue}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(questionId, opt.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              answer === opt.value
                ? opt.activeClass
                : 'bg-[#F7F6F1] border-[#E8E6E0] text-[#6B6A72] hover:border-[#1f6feb]/40 hover:text-[#2D2C31]'
            }`}
          >
            {answer === opt.value && (
              <span className={`w-1.5 h-1.5 rounded-full ${opt.dotClass}`} />
            )}
            {opt.label}
          </button>
        ))}
      </div>

      <div>
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
            className="mt-2 w-full bg-[#F7F6F1] border border-[#E8E6E0] rounded-lg text-[#2D2C31] text-xs px-3 py-2 placeholder-[#6B6A72] resize-none focus:outline-none focus:border-[#1f6feb] transition-colors"
          />
        )}
      </div>
    </div>
  )
}
