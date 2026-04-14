'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { answeredCount } from '@/lib/simplifier/scoring'
import type { AllAnswers } from '@/lib/simplifier/types'
import PhaseScoreBadge from './PhaseScoreBadge'
import { scorePhase } from '@/lib/simplifier/scoring'

interface WizardProgressBarProps {
  currentPhase: number
  answers: AllAnswers
  onPhaseClick: (phase: number) => void
}

export default function WizardProgressBar({ currentPhase, answers, onPhaseClick }: WizardProgressBarProps) {
  return (
    <div className="flex items-start gap-1 w-full overflow-x-auto pb-1">
      {PHASES.map((phase, idx) => {
        const isActive    = phase.id === currentPhase
        const answered    = answeredCount(answers, phase)
        const total       = phase.questions.length
        const isComplete  = answered === total
        const score       = isComplete ? scorePhase(answers, phase) : null
        const hasStarted  = answered > 0

        return (
          <button
            key={phase.id}
            onClick={() => onPhaseClick(phase.id)}
            className={`group flex flex-col items-center gap-1.5 flex-1 min-w-[80px] px-2 py-2 rounded-lg border transition-all text-left ${
              isActive
                ? 'border-[#388bfd] bg-[#1f2d3d]'
                : hasStarted
                ? 'border-[#30363d] bg-[#161b22] hover:border-[#6e7681]'
                : 'border-[#21262d] bg-transparent hover:border-[#30363d]'
            }`}
          >
            {/* Step number + completion indicator */}
            <div className="flex items-center justify-between w-full">
              <span className={`text-[11px] font-semibold font-mono ${isActive ? 'text-[#79c0ff]' : 'text-[#8b949e]'}`}>
                {idx + 1}
              </span>
              {isComplete ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="#3fb950">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
                </svg>
              ) : hasStarted ? (
                <span className="text-[10px] text-[#8b949e] font-mono">{answered}/{total}</span>
              ) : null}
            </div>

            {/* Phase name */}
            <span className={`text-[11px] leading-tight w-full ${isActive ? 'text-[#e6edf3]' : 'text-[#8b949e] group-hover:text-[#c9d1d9]'}`}>
              {phase.name}
            </span>

            {/* Score badge when complete */}
            {score !== null && <PhaseScoreBadge score={score} size="sm" />}
          </button>
        )
      })}
    </div>
  )
}
