// ─── Forward valuation assumptions (set by computeForwardValuation) ──────────

export interface ValuationAssumptions {
  ltvRevenue: number         // LTM revenue (raw $, USD-adjusted for ADRs)
  sharesOutstanding: number  // shares (raw)
  revenueCAGR: number        // estimated 5Y CAGR (decimal)
  profitMargin2031: number   // projected 2031 net margin (decimal)
  peRatio2031: number        // normalized exit PE multiple
  dilutionRate: number       // annual share dilution (decimal)
  discountRate: number       // WACC (decimal)
  yearsToTarget: number      // = 5
  targetPrice2031: number    // computed 2031 price
  fairValue: number          // discounted fair value today
  priceTarget1Y: number      // 1-year price target
  upside: number             // (fairValue − price) / price
  // Evidence strings for modal display
  cagrEvidence: string       // e.g. "YoY growth +24.3% → mean-reverted to 18.0%"
  marginEvidence: string     // e.g. "Current net margin 8.2% → projected 10.5%"
  peEvidence: string         // e.g. "Current trailing PE 32× → sector target 22×"
  dilutionEvidence: string   // e.g. "Tech layer, growth stage → 3.0% annual dilution"
  waccEvidence: string       // e.g. "Beta 1.3, RF 4.5%, ERP 5.5% → WACC 11.4%"
  // ADR/currency note
  currencyNote: string | null  // non-null when financial currency ≠ USD
}

export interface ScoreBreakdown {
  pegScore: number
  pfcfScore: number
  evEbitdaScore: number
  pbScore: number
  debtScore: number
  roeScore: number
  marginScore: number
  growthScore: number
  fcfYieldScore: number   // replaces currentRatioScore — cash yield is king
}

export interface ValuationMetrics {
  ticker: string
  name: string
  layer: number
  layerLabel: string
  sublayer?: string
  error?: boolean

  // Price & market
  price: number | null
  marketCap: number | null
  change1d: number | null      // today % change (not decimal — raw %, e.g. 1.5 = 1.5%)
  change52w: number | null     // 52-week % change (decimal, e.g. 0.15 = 15%)

  // Valuation multiples
  pe: number | null            // Trailing P/E
  forwardPe: number | null     // Forward P/E
  peg: number | null           // PEG ratio
  pb: number | null            // Price/Book
  ps: number | null            // Price/Sales (TTM)
  pfcf: number | null          // Price/FCF (negative when FCF < 0 — that IS the signal)
  evEbitda: number | null      // EV/EBITDA
  evRevenue: number | null     // EV/Revenue

  // Cash flow (raw $ values)
  freeCashflow: number | null
  operatingCashflow: number | null
  totalRevenue: number | null
  ebitda: number | null

  // Profitability (as decimals, e.g. 0.45 = 45%)
  grossMargin: number | null
  operatingMargin: number | null
  profitMargin: number | null
  fcfMargin: number | null      // FCF / Revenue (computed)
  roe: number | null            // Return on equity (decimal)
  roa: number | null            // Return on assets (decimal)

  // Balance sheet
  totalCash: number | null
  totalDebt: number | null
  netDebt: number | null        // totalDebt - totalCash (negative = net cash)
  netDebtToEbitda: number | null // netDebt / EBITDA (leverage quality)
  debtToEquity: number | null   // Yahoo reports in %, e.g. 47.5 = 47.5%
  currentRatio: number | null
  quickRatio: number | null

  // Growth (decimal, e.g. 0.12 = 12%)
  revenueGrowth: number | null
  earningsGrowth: number | null

  // Other
  dividendYield: number | null  // decimal
  beta: number | null
  fcfYield: number | null       // FCF / marketCap (negative when FCF < 0)

  // Forward valuation (computed by lib/ai-stack/valuation.ts)
  sharesOutstanding: number | null
  fairValue: number | null
  priceTarget1Y: number | null
  upside: number | null             // decimal, e.g. 0.56 = +56% upside
  valAssumptions: ValuationAssumptions | null
  financialCurrency: string         // reporting currency (USD for most; EUR for ASML, CAD for ENB, etc.)

  // Score
  valueScore: number            // 0–100
  scoreBreakdown: ScoreBreakdown
}

// ─── Scoring helpers ────────────────────────────────────────────────────────

// PEG: < 1 is undervalued (Peter Lynch), growth at a fair price
function scorePeg(peg: number | null): number {
  if (peg === null || !isFinite(peg)) return 5
  if (peg < 0) return 3
  if (peg < 1)   return 10
  if (peg < 1.5) return 8
  if (peg < 2)   return 6
  if (peg < 3)   return 4
  return 2
}

// P/FCF: negative FCF is a strong negative signal (not neutral)
// Negative P/FCF = FCF < 0. The company is burning cash.
function scorePfcf(pfcf: number | null): number {
  if (pfcf === null || !isFinite(pfcf)) return 5
  if (pfcf < 0)   return 1   // negative FCF — burning cash
  if (pfcf < 10)  return 10
  if (pfcf < 15)  return 9
  if (pfcf < 20)  return 7
  if (pfcf < 30)  return 5
  if (pfcf < 50)  return 3
  return 2
}

// EV/EBITDA: whole-company cost vs operating earnings. Damodaran's preferred multiple.
function scoreEvEbitda(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v < 0)   return 3
  if (v < 8)   return 10
  if (v < 12)  return 8
  if (v < 16)  return 6
  if (v < 25)  return 4
  return 2
}

// P/B: Graham floor. Less relevant for high-ROIC tech but important for industrials.
function scorePb(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v < 0)   return 3
  if (v < 1)   return 10
  if (v < 2)   return 8
  if (v < 3)   return 7
  if (v < 5)   return 5
  if (v < 10)  return 3
  return 2
}

// Debt/Equity (Yahoo %, e.g. 47.5 = 47.5%)
function scoreDebt(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v < 0)    return 5   // negative = more cash than debt
  if (v < 20)   return 10
  if (v < 50)   return 9
  if (v < 100)  return 7
  if (v < 200)  return 5
  if (v < 400)  return 3
  return 2
}

// ROE: Buffett's favourite quality signal. > 15% consistently = moat.
function scoreRoe(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v < 0)     return 1
  if (v >= 0.30) return 10
  if (v >= 0.20) return 9
  if (v >= 0.15) return 8
  if (v >= 0.10) return 6
  if (v >= 0.05) return 4
  return 2
}

// Gross Margin: > 40% = pricing power moat (Buffett). Durable advantage indicator.
function scoreMargin(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v < 0)     return 1
  if (v >= 0.60) return 10
  if (v >= 0.40) return 8
  if (v >= 0.25) return 6
  if (v >= 0.15) return 4
  return 2
}

// Revenue growth: business must grow to be worth a premium
function scoreGrowth(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v >= 0.30) return 10
  if (v >= 0.20) return 9
  if (v >= 0.10) return 7
  if (v >= 0.05) return 5
  if (v >= 0)    return 4
  return 2   // negative growth
}

// FCF Yield = FCF / Market Cap. This is the single most important value signal.
// High yield = you're being paid in cash flow. < 0 = company is burning cash.
function scoreFcfYield(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v < -0.10)  return 1   // burning > 10% of market cap in FCF
  if (v < 0)      return 2   // any negative FCF = bad
  if (v < 0.02)   return 3   // < 2% yield = expensive (P/FCF > 50)
  if (v < 0.04)   return 5   // 2–4% yield = neutral
  if (v < 0.06)   return 7   // 4–6% yield = attractive (P/FCF 17–25)
  if (v < 0.08)   return 9   // 6–8% yield = very attractive (P/FCF 12–17)
  return 10                  // > 8% yield = excellent (P/FCF < 12.5)
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function computeValueScore(m: Partial<ValuationMetrics>): {
  score: number
  breakdown: ScoreBreakdown
} {
  const pegScore      = scorePeg(m.peg ?? null)
  const pfcfScore     = scorePfcf(m.pfcf ?? null)
  const evEbitdaScore = scoreEvEbitda(m.evEbitda ?? null)
  const pbScore       = scorePb(m.pb ?? null)
  const debtScore     = scoreDebt(m.debtToEquity ?? null)
  const roeScore      = scoreRoe(m.roe ?? null)
  const marginScore   = scoreMargin(m.grossMargin ?? null)
  const growthScore   = scoreGrowth(m.revenueGrowth ?? null)
  const fcfYieldScore = scoreFcfYield(m.fcfYield ?? null)

  // Weights (sum = 1.0)
  // FCF yield is the top signal — you're buying a stream of cash.
  // EV/EBITDA captures leverage the P/E misses.
  // PEG rewards quality growth at a fair price.
  const raw =
    fcfYieldScore  * 0.18 +  // cash is king — most reliable undervalue signal
    evEbitdaScore  * 0.15 +  // enterprise-level value, penalizes debt
    pegScore       * 0.13 +  // growth-adjusted price (Lynch)
    roeScore       * 0.12 +  // business quality (Buffett)
    pfcfScore      * 0.10 +  // direct cash multiple, penalizes negative FCF
    marginScore    * 0.10 +  // moat / pricing power (Buffett)
    debtScore      * 0.09 +  // balance sheet risk
    growthScore    * 0.08 +  // top-line momentum
    pbScore        * 0.05    // asset floor (Graham)

  // Scale 0–10 → 0–100
  const score = Math.round(raw * 10)

  return {
    score,
    breakdown: {
      pegScore,
      pfcfScore,
      evEbitdaScore,
      pbScore,
      debtScore,
      roeScore,
      marginScore,
      growthScore,
      fcfYieldScore,
    },
  }
}

// ─── Color helpers used by the UI ───────────────────────────────────────────

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Undervalued',   color: '#16a34a' }
  if (score >= 55) return { label: 'Fair Value',     color: '#65a30d' }
  if (score >= 40) return { label: 'Fairly Priced',  color: '#d97706' }
  if (score >= 25) return { label: 'Overvalued',     color: '#ea580c' }
  return               { label: 'Expensive',         color: '#dc2626' }
}

export function metricColor(
  value: number | null,
  type: 'pe' | 'peg' | 'pfcf' | 'evEbitda' | 'evRev' | 'pb' | 'ps' | 'debtEq'
      | 'roe' | 'margin' | 'growth' | 'current' | 'fcfYield' | 'divYield'
      | 'fcfMargin' | 'netDebtEbitda',
): string {
  if (value === null || !isFinite(value)) return 'text-slate-400'
  const g = 'text-emerald-600'
  const y = 'text-amber-600'
  const r = 'text-red-500'
  const n = 'text-slate-700'

  switch (type) {
    case 'pe':
      if (value < 15) return g; if (value < 25) return n; if (value < 40) return y; return r
    case 'peg':
      if (value < 0)   return 'text-slate-400'
      if (value < 1)   return g; if (value < 2) return n; return r
    case 'pfcf':
      if (value < 0)   return r   // negative FCF — burning cash
      if (value < 15)  return g; if (value < 30) return n; return r
    case 'evEbitda':
      if (value < 0)   return 'text-slate-400'
      if (value < 12)  return g; if (value < 20) return n; return r
    case 'evRev':
      if (value < 3)   return g; if (value < 8) return n; return r
    case 'pb':
      if (value < 2)   return g; if (value < 4) return n; return r
    case 'ps':
      if (value < 3)   return g; if (value < 8) return n; return r
    case 'debtEq':
      if (value < 50)  return g; if (value < 150) return n; return r
    case 'roe':
      if (value >= 0.15) return g; if (value >= 0.08) return n; if (value < 0) return r; return y
    case 'margin':
      if (value >= 0.40) return g; if (value >= 0.20) return n; if (value < 0) return r; return y
    case 'growth':
      if (value >= 0.10) return g; if (value >= 0) return n; return r
    case 'current':
      if (value >= 1.5) return g; if (value >= 1.0) return n; return r
    case 'fcfYield':
      if (value < 0)     return r          // negative FCF = burning cash
      if (value >= 0.06) return g; if (value >= 0.03) return n; return y
    case 'fcfMargin':
      if (value < 0)     return r
      if (value >= 0.15) return g; if (value >= 0.05) return n; return y
    case 'netDebtEbitda':
      if (value < 0)   return g    // net cash position = excellent
      if (value < 1.5) return g; if (value < 3) return n; return r
    case 'divYield':
      if (value >= 0.03) return g; if (value > 0) return n; return 'text-slate-400'
    default: return n
  }
}
