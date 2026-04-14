'use client'

import { useState } from 'react'
import type { Answer, AutoHint } from '@/lib/simplifier/types'
import AutoHintChip from './AutoHintChip'

interface QuestionCardProps {
  questionId: string
  text: string
  answer: Answer
  hint: AutoHint | null
  note: string
  onChange: (id: string, answer: Answer) => void
  onNoteChange: (id: string, note: string) => void
}

const OPTIONS: { value: Answer; label: string; activeClass: string }[] = [
  { value: 'yes',     label: 'YES',     activeClass: 'bg-[#1f6feb] border-[#388bfd] text-white' },
  { value: 'partial', label: 'PARTIAL', activeClass: 'bg-[#d29922] border-[#e3b341] text-[#1a1a1a]' },
  { value: 'no',      label: 'NO',      activeClass: 'bg-[#da3633] border-[#f85149] text-white' },
]

export default function QuestionCard({
  questionId, text, answer, hint, note, onChange, onNoteChange,
}: QuestionCardProps) {
  const [showNote, setShowNote] = useState(!!note)

  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 flex flex-col gap-3">
      {/* Question text + hint chip */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[#e6edf3] text-sm leading-relaxed">{text}</p>
        {hint && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-[#8b949e]">Auto-filled:</span>
            <AutoHintChip displayValue={hint.displayValue} rationale={hint.rationale} />
          </div>
        )}
      </div>

      {/* YES / PARTIAL / NO toggle */}
      <div className="flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(questionId, opt.value)}
            className={`flex-1 py-1.5 text-xs font-semibold tracking-wide rounded border transition-all ${
              answer === opt.value
                ? opt.activeClass
                : 'bg-transparent border-[#30363d] text-[#8b949e] hover:border-[#6e7681] hover:text-[#e6edf3]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Notes toggle + textarea */}
      <div>
        <button
          onClick={() => setShowNote((v) => !v)}
          className="text-[11px] text-[#8b949e] hover:text-[#e6edf3] flex items-center gap-1 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className={`transition-transform ${showNote ? 'rotate-90' : ''}`}>
            <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/>
          </svg>
          {showNote ? 'Hide note' : 'Add note'}
        </button>
        {showNote && (
          <textarea
            value={note}
            onChange={(e) => onNoteChange(questionId, e.target.value)}
            placeholder="Add context or notes…"
            rows={2}
            className="mt-2 w-full bg-[#0d1117] border border-[#30363d] rounded text-[#e6edf3] text-xs px-3 py-2 placeholder-[#484f58] resize-none focus:outline-none focus:border-[#388bfd] transition-colors"
          />
        )}
      </div>
    </div>
  )
}
