export type Answer = 'yes' | 'partial' | 'no' | null

export type ListTag = 'buy' | 'watch' | 'pass' | null

export interface QuestionDef {
  id: string
  text: string
  /** Which autoMapper field drives the pre-fill (null = manual only) */
  autoMapKey: string | null
  /** Weight for phase scoring (default 1) */
  weight?: number
}

export interface PhaseDefinition {
  id: number
  name: string
  description: string
  questions: QuestionDef[]
}

export type PhaseAnswers = Record<string, Answer>       // questionId → answer
export type AllAnswers   = Record<string, Answer>       // flat, all phases combined

export type NoteMap = Record<string, string>            // questionId → note text

export interface AutoHint {
  suggestedAnswer: Answer
  rationale: string    // e.g. "Gross Margin 68.4%"
  displayValue: string // formatted value shown in chip
}

export type SimplifierAutoMap = Record<string, AutoHint> // questionId → hint

export interface PhaseScores {
  1: number; 2: number; 3: number; 4: number; 5: number
}

export interface FinancialSnapshot {
  grossMargin:    number | null
  fcfMargin:      number | null
  moatScore:      number | null
  roic:           number | null
  cagr3y:         number | null
  insiderPct:     number | null
  beta:           number | null
  upsidePct:      number | null
  price:          number | null
  marketCap:      number | null
  fairValue:      number | null
  // Extended live metrics — stored at save time, refreshable
  peRatio:        number | null | undefined
  pegRatio:       number | null | undefined
  evToEbitda:     number | null | undefined
  dividendYield:  number | null | undefined
  return1y:       number | null | undefined
  return3y:       number | null | undefined
  return5y:       number | null | undefined
  spy1y:          number | null | undefined
  spy3y:          number | null | undefined
  spy5y:          number | null | undefined
  bearScenario:   number | null | undefined
  baseScenario:   number | null | undefined
  bullScenario:   number | null | undefined
  piotroski:      number | null | undefined
  metricsUpdatedAt: string | null | undefined  // ISO date — used for staleness indicator
}

export interface WatchlistEntry {
  ticker:           string
  companyName:      string
  updatedAt:        string            // ISO date string
  currentPhase:     number            // 1–5
  answers:          AllAnswers
  notes:            NoteMap
  phaseScores:      Partial<PhaseScores>
  overallScore:     number | null     // 0.0–1.0
  snapshot:         FinancialSnapshot
  listTag:          ListTag           // user's manual classification
  groupName?:       string | null     // user-defined portfolio group
}
