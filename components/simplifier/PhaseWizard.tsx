'use client'

import { useState, useEffect } from 'react'
import { PHASES } from '@/lib/simplifier/phases'
import { scoreAll, overallScore } from '@/lib/simplifier/scoring'
import type { AllAnswers, NoteMap, SimplifierAutoMap, WatchlistEntry } from '@/lib/simplifier/types'
import { buildPhasePrompt, buildFullPrompt, buildFinancialContext } from '@/lib/simplifier/promptBuilder'
import WizardProgressBar from './WizardProgressBar'
import PhasePanel from './PhasePanel'
import PromptDrawer from './PromptDrawer'
import OverallScoreCard from './OverallScoreCard'

interface FinancialsMeta {
  ticker: string
  companyName: string
  sector?: string
  grossMargin?: number | null
  fcfMargin?: number | null
  cagr3y?: number | null
  moatScore?: number | null
  roic?: number | null
  beta?: number | null
  upsidePct?: number | null
  insiderPct?: number | null
  altmanZone?: string | null
  beneishFlag?: string | null
  piotroskiScore?: number | null
}

interface PhaseWizardProps {
  autoMap: SimplifierAutoMap
  financialsMeta: FinancialsMeta
  initialEntry: Pick<WatchlistEntry, 'answers' | 'notes'> | null
  onSave: (entry: Partial<WatchlistEntry>) => Promise<void>
}

export default function PhaseWizard({ autoMap, financialsMeta, initialEntry, onSave }: PhaseWizardProps) {
  const [currentPhase, setCurrentPhase]   = useState(1)
  const [answers, setAnswers]             = useState<AllAnswers>(initialEntry?.answers ?? {})
  const [notes, setNotes]                 = useState<NoteMap>(initialEntry?.notes ?? {})
  const [showPrompt, setShowPrompt]       = useState(false)
  const [promptText, setPromptText]       = useState('')
  const [promptPhaseName, setPromptPhaseName] = useState('')
  const [saving, setSaving]               = useState(false)
  const [savedAt, setSavedAt]             = useState<string | null>(null)

  // Pre-fill from autoMap on first load (only for questions not already answered)
  useEffect(() => {
    if (Object.keys(answers).length > 0) return
    const prefilled: AllAnswers = {}
    for (const phase of PHASES) {
      for (const q of phase.questions) {
        const hint = autoMap[q.id]
        if (hint?.suggestedAnswer) prefilled[q.id] = hint.suggestedAnswer
      }
    }
    if (Object.keys(prefilled).length > 0) setAnswers(prefilled)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleAnswerChange(id: string, answer: import('@/lib/simplifier/types').Answer) {
    setAnswers((prev) => ({ ...prev, [id]: answer }))
  }

  function handleNoteChange(id: string, note: string) {
    setNotes((prev) => ({ ...prev, [id]: note }))
  }

  async function handleSave() {
    setSaving(true)
    const phaseScores = scoreAll(answers)
    const overall     = overallScore(phaseScores)
    await onSave({
      answers,
      notes,
      currentPhase,
      phaseScores,
      overallScore: overall,
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)
    setSavedAt(new Date().toLocaleTimeString())
  }

  function openPhasePrompt() {
    const phase = PHASES[currentPhase - 1]
    const context = buildFinancialContext(financialsMeta)
    const text = buildPhasePrompt(phase, answers, financialsMeta.companyName, context)
    setPromptText(text)
    setPromptPhaseName(`Phase ${phase.id}: ${phase.name}`)
    setShowPrompt(true)
  }

  function openFullPrompt() {
    const context = buildFinancialContext(financialsMeta)
    const text = buildFullPrompt(answers, financialsMeta.companyName, financialsMeta.ticker, context)
    setPromptText(text)
    setPromptPhaseName('Full Analysis')
    setShowPrompt(true)
  }

  const phaseScores = scoreAll(answers)
  const isAllComplete = PHASES.every(
    (p) => p.questions.every((q) => answers[q.id] != null)
  )

  const activePhase = PHASES.find((p) => p.id === currentPhase)!

  return (
    <div className="flex flex-col gap-5">
      {/* Progress bar */}
      <WizardProgressBar
        currentPhase={currentPhase}
        answers={answers}
        onPhaseClick={setCurrentPhase}
      />

      {/* Phase panel */}
      <div className="rounded-xl border border-[#21262d] bg-[#0d1117] p-5">
        {/* Phase header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[#e6edf3] font-semibold text-base">
              Phase {activePhase.id}: {activePhase.name}
            </h2>
            <p className="text-[#8b949e] text-xs mt-0.5">{activePhase.description}</p>
          </div>
          <button
            onClick={openPhasePrompt}
            className="flex items-center gap-1.5 text-xs text-[#8b949e] border border-[#30363d] rounded px-3 py-1.5 hover:border-[#6e7681] hover:text-[#e6edf3] transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 2.75A2.75 2.75 0 0 1 2.75 0h10.5A2.75 2.75 0 0 1 16 2.75v8.5A2.75 2.75 0 0 1 13.25 14H8.56l-2.35 2.35a1 1 0 0 1-1.7-.71V14H2.75A2.75 2.75 0 0 1 0 11.25Z"/>
            </svg>
            Get AI Analysis
          </button>
        </div>

        <PhasePanel
          phase={activePhase}
          answers={answers}
          notes={notes}
          autoMap={autoMap}
          onAnswerChange={handleAnswerChange}
          onNoteChange={handleNoteChange}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentPhase((p) => Math.max(1, p - 1))}
          disabled={currentPhase === 1}
          className="flex items-center gap-1.5 text-sm text-[#8b949e] disabled:opacity-30 hover:text-[#e6edf3] transition-colors disabled:cursor-not-allowed"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z"/>
          </svg>
          Previous
        </button>

        <div className="flex items-center gap-3">
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs text-[#8b949e] border border-[#30363d] rounded px-3 py-1.5 hover:border-[#6e7681] hover:text-[#e6edf3] transition-all disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Progress'}
          </button>
          {savedAt && (
            <span className="text-[11px] text-[#3fb950]">Saved {savedAt}</span>
          )}
        </div>

        {currentPhase < 5 ? (
          <button
            onClick={() => setCurrentPhase((p) => Math.min(5, p + 1))}
            className="flex items-center gap-1.5 text-sm text-[#79c0ff] hover:text-[#e6edf3] transition-colors"
          >
            Next
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 text-sm text-white bg-[#1f6feb] rounded px-4 py-1.5 hover:bg-[#388bfd] transition-colors"
          >
            Complete
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/>
            </svg>
          </button>
        )}
      </div>

      {/* Overall score card — shown when all phases have any data */}
      {isAllComplete && (
        <OverallScoreCard
          phaseScores={phaseScores}
          companyName={financialsMeta.companyName}
          onGetFullAnalysis={openFullPrompt}
        />
      )}

      {/* Prompt drawer */}
      {showPrompt && (
        <PromptDrawer
          prompt={promptText}
          phaseName={promptPhaseName}
          onClose={() => setShowPrompt(false)}
        />
      )}
    </div>
  )
}
