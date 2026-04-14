import { PHASES } from './phases'
import type { AllAnswers, PhaseScores, PhaseDefinition } from './types'

/**
 * Score a single phase: yes=1, partial=0.5, no=0, null=0 (unanswered)
 * Returns 0.0–1.0
 */
export function scorePhase(answers: AllAnswers, phase: PhaseDefinition): number {
  const questions = phase.questions
  if (!questions.length) return 0

  let total = 0
  let earned = 0

  for (const q of questions) {
    const w = q.weight ?? 1
    total += w
    const a = answers[q.id]
    if (a === 'yes') earned += w
    else if (a === 'partial') earned += w * 0.5
  }

  return total > 0 ? earned / total : 0
}

/** Score all 5 phases. Returns a PhaseScores object. */
export function scoreAll(answers: AllAnswers): PhaseScores {
  return {
    1: scorePhase(answers, PHASES[0]),
    2: scorePhase(answers, PHASES[1]),
    3: scorePhase(answers, PHASES[2]),
    4: scorePhase(answers, PHASES[3]),
    5: scorePhase(answers, PHASES[4]),
  }
}

/**
 * Equally-weighted composite of all 5 phase scores.
 * Returns 0.0–1.0
 */
export function overallScore(phaseScores: Partial<PhaseScores>): number {
  const values = Object.values(phaseScores).filter((v): v is number => typeof v === 'number')
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/**
 * How many questions in a phase have been answered (not null).
 */
export function answeredCount(answers: AllAnswers, phase: PhaseDefinition): number {
  return phase.questions.filter((q) => answers[q.id] != null).length
}

/**
 * Overall completion percentage across all phases (0–100).
 */
export function completionPct(answers: AllAnswers): number {
  const total = PHASES.reduce((sum, p) => sum + p.questions.length, 0)
  if (!total) return 0
  const answered = PHASES.reduce((sum, p) => sum + answeredCount(answers, p), 0)
  return Math.round((answered / total) * 100)
}

/**
 * What phase should the user be on? First phase with unanswered questions,
 * or 5 if all are complete.
 */
export function currentPhaseFromAnswers(answers: AllAnswers): number {
  for (const phase of PHASES) {
    if (answeredCount(answers, phase) < phase.questions.length) return phase.id
  }
  return 5
}
