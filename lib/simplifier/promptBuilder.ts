import { PHASES } from './phases'
import type { AllAnswers, PhaseDefinition } from './types'
import { scorePhase } from './scoring'

/**
 * Build an AI analysis prompt for a single phase.
 */
export function buildPhasePrompt(
  phase: PhaseDefinition,
  answers: AllAnswers,
  companyName: string,
  financialContext: string,
): string {
  const phaseScore = scorePhase(answers, phase)
  const scorePct   = Math.round(phaseScore * 100)

  const lines: string[] = [
    `# ${companyName} — Phase ${phase.id}: ${phase.name} Analysis`,
    '',
    `I am conducting a structured investment analysis of **${companyName}**.`,
    `I have completed Phase ${phase.id} (${phase.name}) of my evaluation.`,
    '',
    '## My Phase Assessment',
    `Overall phase score: **${scorePct}%**`,
    '',
    '### Questions & My Answers',
  ]

  for (const q of phase.questions) {
    const answer = answers[q.id]
    const answerLabel =
      answer === 'yes' ? '✅ YES'
      : answer === 'partial' ? '⚠️ PARTIAL'
      : answer === 'no' ? '❌ NO'
      : '❓ Not answered'
    lines.push(`- **${q.text}**`)
    lines.push(`  Answer: ${answerLabel}`)
  }

  lines.push(
    '',
    '## Key Financial Context',
    financialContext,
    '',
    `## Request`,
    `Please provide a deeper analysis of ${companyName} specifically on **${phase.name}**.`,
    `Focus on:`,
    `1. Do you agree or disagree with my assessments above? Explain your reasoning.`,
    `2. What key evidence supports or contradicts each answer?`,
    `3. What am I missing or overlooking in this phase?`,
    `4. What is the biggest risk or strength I should weigh?`,
    '',
    `Be specific, concise, and use publicly available information. If you lack recent data, say so.`,
  )

  return lines.join('\n')
}

/**
 * Build a comprehensive full-analysis prompt after completing all 5 phases.
 */
export function buildFullPrompt(
  answers: AllAnswers,
  companyName: string,
  ticker: string,
  financialContext: string,
): string {
  const lines: string[] = [
    `# ${companyName} (${ticker}) — Complete Investment Analysis`,
    '',
    `I have completed a 5-phase structured analysis of **${companyName} (${ticker})**.`,
    `Below are my assessments. Please review, challenge, and deepen this analysis.`,
    '',
    '## Financial Context',
    financialContext,
    '',
    '## My Phase-by-Phase Assessment',
  ]

  for (const phase of PHASES) {
    const phaseScore = scorePhase(answers, phase)
    const scorePct   = Math.round(phaseScore * 100)
    lines.push(``, `### Phase ${phase.id}: ${phase.name} — Score: ${scorePct}%`)

    for (const q of phase.questions) {
      const answer = answers[q.id]
      const label  =
        answer === 'yes' ? '✅ YES'
        : answer === 'partial' ? '⚠️ PARTIAL'
        : answer === 'no' ? '❌ NO'
        : '❓ Unanswered'
      lines.push(`- ${q.text} → ${label}`)
    }
  }

  lines.push(
    '',
    '## My Request',
    `1. **Investment Thesis**: Based on this analysis, what is the most compelling bull and bear case for ${companyName}?`,
    `2. **Key Risks**: What are the top 3 risks I should monitor?`,
    `3. **Disagreements**: Which of my phase answers do you most disagree with, and why?`,
    `4. **Valuation Check**: Does the current valuation make sense given the quality of the business?`,
    `5. **Final Verdict**: Would you rate this as a Strong Buy / Buy / Hold / Avoid, and why?`,
    '',
    `Be specific and cite evidence where possible. Flag any areas where your information may be outdated.`,
  )

  return lines.join('\n')
}

/**
 * Build a short financial context string to embed in prompts.
 */
export function buildFinancialContext(data: {
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
}): string {
  const pct = (v: number | null | undefined) =>
    v != null ? `${(v * 100).toFixed(1)}%` : 'N/A'
  const num = (v: number | null | undefined, decimals = 2) =>
    v != null ? v.toFixed(decimals) : 'N/A'

  return [
    `- Ticker: ${data.ticker}  |  Sector: ${data.sector ?? 'N/A'}`,
    `- Gross Margin: ${pct(data.grossMargin)}  |  FCF Margin: ${pct(data.fcfMargin)}`,
    `- 3Y Revenue CAGR: ${pct(data.cagr3y)}  |  ROIC: ${pct(data.roic)}`,
    `- Moat Score: ${num(data.moatScore, 1)}/5  |  Beta: ${num(data.beta, 2)}`,
    `- DCF Upside: ${pct(data.upsidePct)}  |  Insider %: ${pct(data.insiderPct)}`,
    `- Altman Z: ${data.altmanZone ?? 'N/A'}  |  Beneish: ${data.beneishFlag ?? 'N/A'}  |  Piotroski: ${data.piotroskiScore ?? 'N/A'}/9`,
  ].join('\n')
}
