import type { PiotroskiResult, AltmanResult, BeneishResult, ROICResult } from '@/lib/dcf/calculateScores'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalStatus = 'pass' | 'fail' | 'na'

export interface VerdictSignal {
  label: string          // short display label
  status: SignalStatus
  value: string          // raw formatted value shown next to the status
  detail?: string        // optional tooltip / secondary line
}

export interface VerdictDimension {
  id: string
  label: string
  signals: VerdictSignal[]
  passingCount: number
}

export type VerdictLabel = 'Strong fundamentals' | 'Mixed signals' | 'Multiple concerns'

export interface VerdictResult {
  dimensions: VerdictDimension[]
  totalPassing: number
  totalSignals: number
  label: VerdictLabel
  color: 'green' | 'amber' | 'red'
  /** One-line headline: "MSFT passes 9 of 11 checks — strong fundamentals." */
  headline: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(v: number | null | undefined, decimals = 1): string {
  if (v == null || !isFinite(v)) return 'N/A'
  return (v * 100).toFixed(decimals) + '%'
}

function fmt2(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return 'N/A'
  return v.toFixed(2)
}

function signal(
  label: string,
  pass: boolean | null,
  value: string,
  detail?: string,
): VerdictSignal {
  return { label, status: pass === null ? 'na' : pass ? 'pass' : 'fail', value, detail }
}

// Find a Piotroski criterion by partial name match
function pioC(piotroski: PiotroskiResult | null | undefined, nameFragment: string): boolean | null {
  if (!piotroski) return null
  const c = piotroski.criteria.find(c => c.name.toLowerCase().includes(nameFragment.toLowerCase()))
  return c?.pass ?? null
}

// ─── Core computation ─────────────────────────────────────────────────────────

export interface VerdictInputs {
  // Identification
  ticker?: string | null
  // Valuation
  upsidePct: number | null | undefined           // decimal, e.g. 0.23 = 23% upside
  roic: ROICResult | null | undefined
  analystRecommendation: string | null | undefined  // 'strongBuy' | 'buy' | 'hold' | 'sell' | etc.
  // Quality scores
  piotroski: PiotroskiResult | null | undefined
  altman: AltmanResult | null | undefined
  beneish: BeneishResult | null | undefined
  // Business profile
  fcfMargin: number | null | undefined           // decimal
  grossMargin: number | null | undefined         // decimal (current)
  netMargin: number | null | undefined           // decimal
  revenueCAGR: number | null | undefined         // decimal, 3y historical
}

export function computeVerdict(inputs: VerdictInputs): VerdictResult {
  const {
    ticker,
    upsidePct, roic, analystRecommendation,
    piotroski, altman, beneish,
    fcfMargin, grossMargin, netMargin, revenueCAGR: _revenueCAGR,
  } = inputs

  // ── Dimension 1: Valuation ─────────────────────────────────────────────────
  const analystBullish = analystRecommendation != null
    ? ['strongbuy', 'buy', 'strong_buy', 'strong buy'].includes(analystRecommendation.toLowerCase())
    : null

  const valuation: VerdictSignal[] = [
    signal(
      'DCF upside',
      upsidePct != null ? upsidePct >= 0.15 : null,
      upsidePct != null ? (upsidePct >= 0 ? '+' : '') + pct(upsidePct, 1) : 'N/A',
      'Pass when ≥ 15% margin of safety',
    ),
    signal(
      'ROIC > WACC',
      roic?.dataAvailable && roic.spread != null ? roic.spread > 0 : null,
      roic?.dataAvailable && roic.roic != null && roic.spread != null
        ? `${pct(roic.roic, 1)} spread ${roic.spread > 0 ? '+' : ''}${pct(roic.spread, 1)}`
        : 'N/A',
      'Value created when ROIC exceeds cost of capital',
    ),
    signal(
      'Analyst consensus',
      analystBullish,
      analystRecommendation
        ? analystRecommendation.replace(/([A-Z])/g, ' $1').trim()
        : 'N/A',
      'Pass when consensus is Buy or Strong Buy',
    ),
  ]

  // ── Dimension 2: Business quality ─────────────────────────────────────────
  const fScore = piotroski?.score ?? null
  const grossMarginRising = pioC(piotroski, 'gross margin')
  const noShareDilution = pioC(piotroski, 'share dilution') ?? pioC(piotroski, 'dilution')

  const quality: VerdictSignal[] = [
    signal(
      'Piotroski F-score',
      fScore != null ? fScore >= 6 : null,
      fScore != null ? `${fScore} / 9  (${piotroski!.label})` : 'N/A',
      '≥ 6 = sound financial health (0–9 scale)',
    ),
    signal(
      'FCF positive',
      fcfMargin != null ? fcfMargin > 0 : null,
      pct(fcfMargin, 1),
      'Free cash flow margin > 0',
    ),
    signal(
      'Gross margin stable',
      grossMarginRising,
      grossMargin != null ? pct(grossMargin, 1) : 'N/A',
      'Pass when gross margin not deteriorating year-over-year',
    ),
  ]

  // ── Dimension 3: Financial health ─────────────────────────────────────────
  const leverageFalling = pioC(piotroski, 'leverage')
  const _liquidityRising = pioC(piotroski, 'liquidity')

  const health: VerdictSignal[] = [
    signal(
      'Altman Z-score',
      altman != null ? altman.zone === 'Safe' : null,
      altman != null ? `${fmt2(altman.zScore)}  (${altman.zone})` : 'N/A',
      'Safe zone = low bankruptcy risk',
    ),
    signal(
      'Leverage falling',
      leverageFalling,
      leverageFalling === null ? 'N/A'
        : leverageFalling ? 'Debt/Assets ↓' : 'Debt/Assets ↑',
      'Long-term debt relative to assets is decreasing',
    ),
    signal(
      'Share count stable',
      noShareDilution,
      noShareDilution === null ? 'N/A'
        : noShareDilution ? 'No dilution' : 'Diluting',
      'Shares outstanding not increasing materially',
    ),
  ]

  // ── Dimension 4: Earnings integrity ───────────────────────────────────────
  const notManipulator = beneish != null
    ? beneish.flag !== 'Manipulator'
    : null
  const accrualQuality = pioC(piotroski, 'accrual')
  const roaPositive = pioC(piotroski, 'roa positive')

  const integrity: VerdictSignal[] = [
    signal(
      'Beneish M-score',
      notManipulator,
      beneish != null
        ? `${beneish.mScore.toFixed(2)}  (${beneish.flag})`
        : 'N/A',
      'No earnings manipulation signals detected',
    ),
    signal(
      'Cash > accruals',
      accrualQuality,
      accrualQuality === null ? 'N/A'
        : accrualQuality ? 'OCF > Net income' : 'Accrual concern',
      'Cash earnings exceed reported net income (accrual quality)',
    ),
    signal(
      'Profitability',
      roaPositive,
      netMargin != null ? `Net margin ${pct(netMargin, 1)}` : 'N/A',
      'Return on assets positive',
    ),
  ]

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const allDimensions = [
    { id: 'valuation',  label: 'Valuation',         signals: valuation },
    { id: 'quality',    label: 'Business Quality',   signals: quality },
    { id: 'health',     label: 'Financial Health',   signals: health },
    { id: 'integrity',  label: 'Earnings Integrity', signals: integrity },
  ].map(d => ({
    ...d,
    passingCount: d.signals.filter(s => s.status === 'pass').length,
  }))

  const totalSignals = allDimensions.reduce((s, d) => s + d.signals.filter(sig => sig.status !== 'na').length, 0)
  const totalPassing = allDimensions.reduce((s, d) => s + d.passingCount, 0)

  const ratio = totalSignals > 0 ? totalPassing / totalSignals : 0
  const label: VerdictLabel = ratio >= 0.75
    ? 'Strong fundamentals'
    : ratio >= 0.5
    ? 'Mixed signals'
    : 'Multiple concerns'
  const color = ratio >= 0.75 ? 'green' : ratio >= 0.5 ? 'amber' : 'red'

  // Headline: "MSFT passes 9 of 11 checks — strong fundamentals."
  const name = ticker ? ticker.toUpperCase() : 'This stock'
  const verdictPhrase =
    color === 'green' ? 'strong fundamentals'
    : color === 'amber' ? 'mixed signals'
    : 'multiple concerns'
  const headline = `${name} passes ${totalPassing} of ${totalSignals} checks — ${verdictPhrase}.`

  return { dimensions: allDimensions, totalPassing, totalSignals, label, color, headline }
}
