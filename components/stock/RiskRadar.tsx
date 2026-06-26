'use client'

// Risk Radar: 5-dimension risk scorecard computed from existing financials data.
// Dimensions: Valuation Risk · Financial Stability · Earnings Quality · Market Sensitivity · Macro/Country Risk

interface RiskDimension {
  label: string
  level: 'Low' | 'Moderate' | 'Elevated' | 'High'
  score: number // 0 (low risk) → 3 (high risk)
  detail: string
}

const LEVEL_CONFIG = {
  Low:      { bar: 'bg-[#E8F7EF]0', text: 'text-[#11875D]', bg: 'bg-[#E8F7EF]',  border: 'border-[#A3D9BE]', dot: 'bg-[#E8F7EF]0' },
  Moderate: { bar: 'bg-[#B56A00]',   text: 'text-[#B56A00]',   bg: 'bg-[#FFF4DA]',    border: 'border-[#F3D391]',   dot: 'bg-[#B56A00]'   },
  Elevated: { bar: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  dot: 'bg-orange-500'  },
  High:     { bar: 'bg-[#FCEAEA]0',     text: 'text-[#D83B3B]',     bg: 'bg-[#FCEAEA]',      border: 'border-[#F0B8B8]',     dot: 'bg-[#FCEAEA]0'     },
}

function level(score: number): 'Low' | 'Moderate' | 'Elevated' | 'High' {
  if (score <= 0.5) return 'Low'
  if (score <= 1.5) return 'Moderate'
  if (score <= 2.5) return 'Elevated'
  return 'High'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeRiskDimensions(data: any): RiskDimension[] {
  const beta:          number | null = data.wacc?.inputs?.beta ?? null
  const crp:           number        = data.wacc?.crp ?? 0
  const altmanZone:    string | null = data.scores?.altman?.zone ?? null
  const beneishFlag:   string | null = data.scores?.beneish?.flag ?? null
  const piotroski:     number | null = data.scores?.piotroski?.score ?? null
  const upsidePct:     number | null = data.fairValue?.upsidePct ?? null
  const ownership                    = data.ownership ?? {}
  const shortPct:      number | null = ownership.shortPct != null ? (ownership.shortPct > 1 ? ownership.shortPct : ownership.shortPct * 100) : null
  const debtToEbitda:  number | null = (() => {
    const bs  = data.financialStatements?.balanceSheet ?? []
    const is  = data.financialStatements?.incomeStatement ?? []
    const lastBS = bs.filter((r: any) => !r.isProjected).slice(-1)[0]
    const lastIS = is.filter((r: any) => !r.isProjected).slice(-1)[0]
    if (!lastBS || !lastIS) return null
    const debt   = (lastBS.longTermDebt ?? 0) as number
    const ebitda = (lastIS.ebitda ?? 0) as number
    if (ebitda <= 0) return null
    return debt / ebitda
  })()
  const currentRatio:  number | null = (() => {
    const bs = data.financialStatements?.balanceSheet ?? []
    const lastBS = bs.filter((r: any) => !r.isProjected).slice(-1)[0]
    if (!lastBS) return null
    const ca = lastBS.totalCurrentAssets ?? null
    const cl = lastBS.totalCurrentLiabilities ?? null
    if (!ca || !cl || cl === 0) return null
    return ca / cl
  })()

  const dims: RiskDimension[] = []

  // ── 1. Valuation Risk ─────────────────────────────────────────────────────
  {
    let score = 1 // default moderate
    let detail = 'Insufficient valuation data.'
    if (upsidePct != null) {
      if (upsidePct > 0.25) { score = 0; detail = `Model suggests ${(upsidePct * 100).toFixed(0)}% upside — stock appears undervalued.` }
      else if (upsidePct > 0.05) { score = 0.5; detail = `Modest ${(upsidePct * 100).toFixed(0)}% upside to fair value estimate.` }
      else if (upsidePct >= -0.10) { score = 1; detail = 'Trading near fair value — limited margin of safety.' }
      else if (upsidePct >= -0.25) { score = 2; detail = `Trading ${Math.abs(upsidePct * 100).toFixed(0)}% above fair value — elevated valuation risk.` }
      else { score = 3; detail = `Trading ${Math.abs(upsidePct * 100).toFixed(0)}% above fair value — significant downside risk if growth assumptions miss.` }
    }
    if (shortPct != null && shortPct > 15) {
      score = Math.min(3, score + 0.5)
      detail += ` High short interest (${shortPct.toFixed(1)}%) suggests market skepticism.`
    }
    dims.push({ label: 'Valuation Risk', level: level(score), score, detail })
  }

  // ── 2. Financial Stability ────────────────────────────────────────────────
  {
    let score = 1
    let detail = 'Insufficient balance sheet data.'
    const signals: string[] = []

    if (altmanZone) {
      if (altmanZone === 'Safe')     { score -= 0.5; signals.push('Altman Z-Score: Safe zone') }
      else if (altmanZone === 'Grey'){ score += 0.5; signals.push('Altman Z-Score: Grey zone') }
      else                           { score += 1.5; signals.push('Altman Z-Score: Distress zone') }
    }
    if (debtToEbitda != null) {
      if (debtToEbitda > 5)       { score += 1;   signals.push(`Net Debt/EBITDA: ${debtToEbitda.toFixed(1)}× (high leverage)`) }
      else if (debtToEbitda > 3)  { score += 0.5; signals.push(`Net Debt/EBITDA: ${debtToEbitda.toFixed(1)}×`) }
      else if (debtToEbitda < 1)  { score -= 0.5; signals.push(`Net Debt/EBITDA: ${debtToEbitda.toFixed(1)}× (low leverage)`) }
    }
    if (currentRatio != null) {
      if (currentRatio < 1)       { score += 0.5; signals.push(`Current ratio: ${currentRatio.toFixed(2)} (below 1)`) }
      else if (currentRatio >= 2) { score -= 0.25 }
    }
    if (piotroski != null) {
      if (piotroski >= 7) { score -= 0.5; signals.push(`Piotroski: ${piotroski}/9 (strong)`) }
      else if (piotroski <= 3) { score += 0.5; signals.push(`Piotroski: ${piotroski}/9 (weak)`) }
    }
    score = Math.max(0, Math.min(3, score))
    detail = signals.length ? signals.join(' · ') : 'Balance sheet data suggests ' + level(score).toLowerCase() + ' stability risk.'
    dims.push({ label: 'Financial Stability', level: level(score), score, detail })
  }

  // ── 3. Earnings Quality ───────────────────────────────────────────────────
  {
    let score = 1
    let detail = 'Insufficient earnings quality data.'
    const signals: string[] = []

    if (beneishFlag) {
      if (beneishFlag === 'Clean')       { score = 0;   signals.push('No manipulation signals (Beneish)') }
      else if (beneishFlag === 'Warning'){ score = 1.5; signals.push('Some accounting patterns flagged (Beneish)') }
      else                               { score = 2.5; signals.push('Elevated manipulation risk (Beneish)') }
    }
    if (piotroski != null) {
      if (piotroski >= 7)      { score = Math.max(0,   score - 0.5) }
      else if (piotroski <= 3) { score = Math.min(3, score + 0.5) }
    }
    score = Math.max(0, Math.min(3, score))
    detail = signals.length ? signals.join(' · ') : 'Earnings quality signals are ' + level(score).toLowerCase() + '.'
    dims.push({ label: 'Earnings Quality', level: level(score), score, detail })
  }

  // ── 4. Market Sensitivity ─────────────────────────────────────────────────
  {
    let score = 1
    let detail = 'Beta data unavailable.'
    if (beta != null) {
      if (beta <= 0.6)       { score = 0;   detail = `Beta ${beta.toFixed(2)} — low market sensitivity, defensive characteristics.` }
      else if (beta <= 0.9)  { score = 0.5; detail = `Beta ${beta.toFixed(2)} — below-market sensitivity.` }
      else if (beta <= 1.1)  { score = 1;   detail = `Beta ${beta.toFixed(2)} — moves roughly in line with the market.` }
      else if (beta <= 1.5)  { score = 1.5; detail = `Beta ${beta.toFixed(2)} — above-market sensitivity to macro moves.` }
      else if (beta <= 2.0)  { score = 2;   detail = `Beta ${beta.toFixed(2)} — high sensitivity to market conditions.` }
      else                   { score = 3;   detail = `Beta ${beta.toFixed(2)} — very high volatility relative to the market.` }
    }
    if (shortPct != null && shortPct > 10) {
      score = Math.min(3, score + 0.5)
      detail += ` Short interest at ${shortPct.toFixed(1)}% adds squeeze/volatility risk.`
    }
    dims.push({ label: 'Market Sensitivity', level: level(score), score, detail })
  }

  // ── 5. Macro & Country Risk ───────────────────────────────────────────────
  {
    let score: number
    let detail: string
    if (crp <= 0) {
      score = 0
      detail = 'Domiciled in a developed market with minimal country risk premium.'
    } else if (crp <= 0.02) {
      score = 0.5
      detail = `Low country risk premium (${(crp * 100).toFixed(2)}%) applied to WACC.`
    } else if (crp <= 0.05) {
      score = 1.5
      detail = `Moderate country risk premium (${(crp * 100).toFixed(1)}%) — emerging market exposure.`
    } else {
      score = 2.5
      detail = `High country risk premium (${(crp * 100).toFixed(1)}%) — significant geopolitical/macro risk.`
    }
    dims.push({ label: 'Macro & Country Risk', level: level(score), score, detail })
  }

  // ── 6. Short Interest ─────────────────────────────────────────────────────
  // Only add this dimension when short data is available
  if (shortPct != null) {
    let score: number
    let detail: string
    const daysLabel = (() => {
      const sr = ownership.shortRatio ?? null
      const srNorm = sr != null ? (sr > 365 ? sr / 365 : sr) : null  // guard against raw-shares values
      return srNorm != null && srNorm > 0 && srNorm < 100 ? ` · ${srNorm.toFixed(1)} days to cover` : ''
    })()

    if (shortPct < 5) {
      score = 0
      detail = `${shortPct.toFixed(1)}% of float is short — low crowding${daysLabel}.`
    } else if (shortPct < 15) {
      score = 1
      detail = `${shortPct.toFixed(1)}% of float is short — moderate${daysLabel}. Not unusual for large-caps.`
    } else if (shortPct < 25) {
      score = 2
      detail = `${shortPct.toFixed(1)}% of float is short — elevated${daysLabel}. Signals market skepticism, but also squeeze potential if sentiment flips.`
    } else {
      score = 3
      detail = `${shortPct.toFixed(1)}% of float is short — high crowding${daysLabel}. Over 1-in-4 shares are borrowed and sold short.`
    }
    dims.push({ label: 'Short Interest', level: level(score), score, detail })
  }

  return dims
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  financialsData: any
}

export default function RiskRadar({ financialsData }: Props) {
  const dims = computeRiskDimensions(financialsData)

  // Overall summary: weighted average toward worst
  const worst = dims.reduce((a, b) => a.score > b.score ? a : b)
  const avg   = dims.reduce((s, d) => s + d.score, 0) / dims.length

  const overallLevel = level(avg * 0.6 + worst.score * 0.4)
  const overallConfig = LEVEL_CONFIG[overallLevel]

  const overallLabel = overallLevel === 'Low' ? 'Low overall risk profile'
    : overallLevel === 'Moderate' ? 'Moderate risk — manageable signals'
    : overallLevel === 'Elevated' ? 'Elevated risk — monitor key metrics'
    : 'High risk — multiple concerns flagged'

  return (
    <div className="px-4 sm:px-6 py-5 border-t border-[#E3E1DA]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-[13px] font-semibold text-[#06101F]">Risk Profile</p>
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${overallConfig.bg} ${overallConfig.border} ${overallConfig.text}`}>
          {overallLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {dims.map((dim) => {
          const cfg = LEVEL_CONFIG[dim.level]
          const barPct = (dim.score / 3) * 100
          return (
            <div key={dim.label} className={`rounded-xl border p-3.5 ${cfg.bg} ${cfg.border}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-semibold text-[#06101F]">{dim.label}</p>
                <span className={`text-[10px] font-bold ${cfg.text}`}>{dim.level}</span>
              </div>
              {/* Risk bar */}
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2.5">
                <div
                  className={`h-full rounded-full ${cfg.bar} transition-all`}
                  style={{ width: `${Math.max(5, barPct)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#566174] leading-snug">{dim.detail}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
