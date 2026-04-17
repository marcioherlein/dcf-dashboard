'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { answeredCount } from '@/lib/simplifier/scoring'
import type { AllAnswers } from '@/lib/simplifier/types'

export type TabId = 'ticker' | 'business' | 'moat' | 'growth' | 'management' | 'risk' | 'valuation' | 'score'

export const TABS: { id: TabId; label: string; phaseId?: number }[] = [
  { id: 'ticker',     label: 'TICKER' },
  { id: 'business',   label: 'BUSINESS',   phaseId: 1 },
  { id: 'moat',       label: 'MOAT',       phaseId: 2 },
  { id: 'growth',     label: 'GROWTH',     phaseId: 3 },
  { id: 'management', label: 'MANAGEMENT', phaseId: 4 },
  { id: 'risk',       label: 'RISK',       phaseId: 5 },
  { id: 'valuation',  label: 'VALUATION',  phaseId: 5 },
  { id: 'score',      label: 'SCORE' },
]

interface SimplifierTabBarProps {
  activeTab: TabId
  answers: AllAnswers
  onTabChange: (tab: TabId) => void
}

export default function SimplifierTabBar({ activeTab, answers, onTabChange }: SimplifierTabBarProps) {
  return (
    <div className="border-b border-[#E8E6E0] bg-white sticky top-0 z-20">
      <div className="flex overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const phase = tab.phaseId != null ? PHASES.find((p) => p.id === tab.phaseId) : null
          const isComplete = phase
            ? answeredCount(answers, phase) === phase.questions.length
            : false
          const isActive = tab.id === activeTab

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-3 text-[11px] font-semibold tracking-wider whitespace-nowrap transition-colors border-b-2 ${
                isActive
                  ? 'border-[#1f6feb] text-[#1f6feb]'
                  : 'border-transparent text-[#6B6A72] hover:text-[#2D2C31]'
              }`}
            >
              {tab.label}
              {/* Completion dot */}
              {phase && (
                <span className={`w-1 h-1 rounded-full ${isComplete ? 'bg-[#1f6feb]' : 'bg-[#E8E6E0]'}`} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
