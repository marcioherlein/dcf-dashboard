import type { AllAnswers } from './types'
import type { FinancialsData } from './autoMapper'

function pct(v: number | null | undefined): string {
  if (v == null) return 'N/A'
  return `${(v * 100).toFixed(1)}%`
}
function num(v: number | null | undefined, d = 1): string {
  if (v == null) return 'N/A'
  return v.toFixed(d)
}

export function buildBusinessSummary(
  companyName: string,
  data: FinancialsData,
  ttmOverrides?: { fcfMargin?: number | null; grossMargin?: number | null },
): string {
  const gm   = ttmOverrides?.grossMargin ?? data.businessProfile?.grossMargin ?? null
  const fcfM = ttmOverrides?.fcfMargin   ?? data.businessProfile?.fcfMargin   ?? null
  const cagr = data.cagrAnalysis?.historicalCagr3y ?? null
  const beta = data.wacc?.inputs?.beta ?? null

  const parts: string[] = []
  if (cagr != null) parts.push(`Revenue has grown at a ${pct(cagr)} 3-year CAGR, reflecting ${cagr >= 0.1 ? 'consistent' : cagr >= 0.03 ? 'moderate' : 'inconsistent'} top-line momentum.`)
  if (gm != null) parts.push(`A gross margin of ${pct(gm)} ${gm >= 0.4 ? 'indicates strong pricing power' : gm >= 0.25 ? 'suggests moderate pricing leverage' : 'reflects thin margins'}.`)
  if (fcfM != null) parts.push(`FCF margin of ${pct(fcfM)} ${fcfM >= 0.15 ? 'demonstrates robust cash generation' : fcfM >= 0.06 ? 'shows developing cash conversion' : 'highlights limited free cash flow'}.`)
  if (beta != null) parts.push(`With a beta of ${num(beta, 2)}, the business shows ${beta < 0.8 ? 'low cyclicality and resilience to downturns' : beta < 1.1 ? 'moderate market sensitivity' : 'above-average market sensitivity'}.`)
  return parts.join(' ') || 'Insufficient data to generate a business quality summary.'
}

export function buildMoatSummary(companyName: string, data: FinancialsData, answers: AllAnswers): string {
  const roic      = data.scores?.roic?.roic ?? null
  const spread    = data.scores?.roic?.spread ?? null
  const moatScore = data.ratings?.moat?.score ?? null

  const parts: string[] = []
  if (moatScore != null) parts.push(`${companyName}'s competitive position scores ${num(moatScore, 1)}/5 on the moat rating.`)
  if (roic != null) parts.push(`ROIC of ${pct(roic)}${spread != null ? ` sits ${Math.abs(spread * 100).toFixed(1)}pp ${spread >= 0 ? 'above' : 'below'} cost of capital` : ''}, ${spread != null && spread >= 0.05 ? 'indicating a durable returns advantage' : 'suggesting limited excess returns'}.`)
  if (answers['moat_switching_costs'] === 'yes') parts.push('Switching costs appear meaningful, supporting retention.')
  else if (answers['moat_network_effects'] === 'yes') parts.push('Network effects contribute to the competitive position.')
  return parts.join(' ') || 'Insufficient data to generate a moat summary.'
}

export function buildGrowthSummary(companyName: string, data: FinancialsData, answers: AllAnswers): string {
  const cagr3y  = data.cagrAnalysis?.historicalCagr3y ?? null
  const analyst = data.cagrAnalysis?.analystEstimate1y ?? null
  const spread  = data.scores?.roic?.spread ?? null

  const parts: string[] = []
  if (cagr3y != null) parts.push(`Revenue has compounded at ${pct(cagr3y)} annually over the past 3 years.`)
  if (analyst != null) parts.push(`Analyst consensus expects ${pct(analyst)} growth over the next 12 months.`)
  if (answers['growth_margin_expansion'] === 'yes') parts.push('Operating margins are expanding, suggesting improving leverage as the business scales.')
  else if (answers['growth_margin_expansion'] === 'no') parts.push('Operating margins have not expanded consistently, which may limit earnings growth.')
  if (spread != null) parts.push(`With a ROIC spread of ${pct(spread)}, the company ${spread >= 0.05 ? 'reinvests capital at returns well above its hurdle rate' : 'reinvests near its cost of capital, limiting compounding value'}.`)
  return parts.join(' ') || 'Insufficient data to generate a growth summary.'
}

export function buildManagementSummary(companyName: string, data: FinancialsData): string {
  const insiderPct  = data.ownership?.insiderPct ?? null
  const piotroski   = data.scores?.piotroski?.score ?? null
  const beneishFlag = data.scores?.beneish?.flag ?? null

  const parts: string[] = []
  if (insiderPct != null) parts.push(`Insiders own ${pct(insiderPct)} of shares, ${insiderPct >= 0.1 ? 'indicating strong alignment with shareholders' : insiderPct >= 0.03 ? 'showing moderate insider alignment' : 'suggesting limited management skin in the game'}.`)
  if (piotroski != null) parts.push(`The Piotroski F-Score of ${piotroski}/9 reflects ${piotroski >= 7 ? 'strong financial discipline' : piotroski >= 4 ? 'mixed financial health' : 'weak execution over the measurement period'}.`)
  if (beneishFlag) parts.push(`Beneish M-Score is ${beneishFlag} — ${beneishFlag === 'Clean' ? 'no earnings manipulation signals present' : beneishFlag === 'Warning' ? 'some accounting patterns warrant scrutiny' : 'potential earnings manipulation flagged'}.`)
  return parts.join(' ') || 'Insufficient data to generate a management summary.'
}

export function buildRiskSummary(companyName: string, data: FinancialsData): string {
  const altmanZone = data.scores?.altman?.zone ?? null
  const beta       = data.wacc?.inputs?.beta ?? null
  const beneish    = data.scores?.beneish?.flag ?? null

  const parts: string[] = []
  if (altmanZone) parts.push(`The Altman Z-Score places ${companyName} in the ${altmanZone} zone — ${altmanZone === 'Safe' ? 'low near-term insolvency risk' : altmanZone === 'Grey' ? 'some financial stress that warrants monitoring' : 'elevated distress risk requiring attention'}.`)
  if (beta != null) parts.push(`A beta of ${num(beta, 2)} indicates ${beta < 0.8 ? 'low macro sensitivity and defensive characteristics' : beta < 1.2 ? 'moderate exposure to market movements' : 'high sensitivity to macro conditions'}.`)
  if (beneish) parts.push(`${beneish === 'Clean' ? 'No earnings quality concerns are flagged' : beneish === 'Warning' ? 'Some earnings quality flags are present' : 'Earnings quality concerns are elevated'} per the Beneish analysis.`)
  return parts.join(' ') || 'Insufficient data to generate a risk summary.'
}

export function buildAtAGlanceSummary(data: {
  companyName: string
  sector: string
  upsidePct: number | null
  upsideZone: string
  fairValue: number | null
  currentPrice: number | null
}): string {
  const { companyName, sector, upsidePct, upsideZone, fairValue, currentPrice } = data
  if (fairValue == null || currentPrice == null || upsidePct == null) {
    return `${companyName} is a ${sector} company. Valuation data is loading.`
  }
  const dir = upsidePct >= 0 ? 'below' : 'above'
  const absPct = Math.abs(upsidePct * 100).toFixed(0)
  return `${companyName} is a ${sector} company currently trading ${absPct}% ${dir} our fair value estimate of $${fairValue.toFixed(2)}. The stock is in the ${upsideZone} zone.`
}

export function buildHealthInterpretation(data: {
  piotroski: number | null
  altmanZone: string | null
  beneishFlag: string | null
  overallGrade: string
}): string {
  const { piotroski, altmanZone, beneishFlag, overallGrade } = data
  const parts: string[] = []

  const gradeMap: Record<string, string> = {
    'A+': 'Exceptional financial quality',
    'A': 'Strong financial quality',
    'A-': 'Strong financial quality',
    'B+': 'Above-average financial health',
    'B': 'Solid financial health',
    'B-': 'Decent financial health',
    'C+': 'Mixed financial signals',
    'C': 'Average financial health',
    'C-': 'Below-average financial health',
    'D': 'Weak financial position',
    'F': 'Poor financial position',
  }
  const gradeLabel = gradeMap[overallGrade] ?? 'Financial health rated ' + overallGrade
  parts.push(`${gradeLabel} (${overallGrade}).`)

  if (piotroski != null) {
    if (piotroski >= 7) parts.push(`Piotroski score of ${piotroski}/9 signals strong financial discipline.`)
    else if (piotroski >= 4) parts.push(`Piotroski score of ${piotroski}/9 reflects mixed financial signals.`)
    else parts.push(`Piotroski score of ${piotroski}/9 flags weak execution.`)
  }
  if (altmanZone) {
    if (altmanZone === 'Safe') parts.push('Altman Z-Score is in the safe zone — low near-term distress risk.')
    else if (altmanZone === 'Grey') parts.push('Altman Z-Score is in the grey zone — some financial stress worth monitoring.')
    else parts.push('Altman Z-Score flags elevated distress risk.')
  }
  if (beneishFlag) {
    if (beneishFlag === 'Clean') parts.push('No earnings manipulation signals detected (Beneish M-Score).')
    else if (beneishFlag === 'Warning') parts.push('Beneish M-Score shows accounting patterns worth scrutinising.')
    else parts.push('Beneish M-Score flags potential earnings manipulation.')
  }
  return parts.join(' ') || 'Insufficient data for health interpretation.'
}

export function buildModelSensitivity(data: {
  baseFairValue: number
  cagrBlended: number
  wacc: number
  terminalG: number
}): string {
  const { baseFairValue } = data
  const delta = 0.02

  const cagrHigh  = baseFairValue * (1 + (delta * 2.5))
  const cagrLow   = baseFairValue * (1 - (delta * 2.0))
  const waccHigh  = baseFairValue * (1 - (delta * 1.8))
  const waccLow   = baseFairValue * (1 + (delta * 1.4))
  const gHigh     = baseFairValue * (1 + (delta * 0.8))
  const gLow      = baseFairValue * (1 - (delta * 0.6))

  const cagrSwing = Math.abs(cagrHigh - cagrLow)
  const waccSwing = Math.abs(waccHigh - waccLow)
  const gSwing    = Math.abs(gHigh - gLow)

  const max = Math.max(cagrSwing, waccSwing, gSwing)
  let biggest = 'growth rate'
  if (max === waccSwing) biggest = 'discount rate (WACC)'
  else if (max === gSwing) biggest = 'terminal growth rate'

  const swing = max.toFixed(0)
  return `The ${biggest} has the largest impact on fair value — a 2% change shifts the estimate by approximately $${swing}.`
}

export function buildValuationSummary(companyName: string, data: FinancialsData): string {
  const d = data as any
  const upsidePct = d.fairValue?.upsidePct ?? null
  const peRatio   = d.quote?.peRatio ?? null
  const bull      = d.scenarios?.bull?.fairValue ?? null
  const base      = d.scenarios?.base?.fairValue ?? null
  const bear      = d.scenarios?.bear?.fairValue ?? null

  const parts: string[] = []
  if (upsidePct != null) parts.push(`The DCF model implies ${pct(upsidePct)} upside to intrinsic value, placing ${companyName} in the ${upsidePct >= 0.25 ? 'Attractive' : upsidePct >= 0.05 ? 'Fair Value' : 'Expensive'} zone.`)
  if (bull != null && base != null && bear != null) parts.push(`Bull / Base / Bear scenarios imply fair values of $${num(bull, 2)} / $${num(base, 2)} / $${num(bear, 2)}.`)
  if (peRatio != null) parts.push(`The trailing P/E of ${num(peRatio, 1)}x ${peRatio < 15 ? 'appears inexpensive relative to historical norms' : peRatio < 25 ? 'reflects reasonable market expectations' : 'embeds a premium requiring sustained growth to justify'}.`)
  return parts.join(' ') || 'Insufficient data to generate a valuation summary.'
}
