export interface ScoreBreakdown {
  pegScore: number
  pfcfScore: number
  evEbitdaScore: number
  pbScore: number
  debtScore: number
  roeScore: number
  marginScore: number
  growthScore: number
  currentRatioScore: number
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
  change1d: number | null      // today % change
  change52w: number | null     // 52-week % change (decimal, e.g. 0.15 = 15%)

  // Valuation multiples
  pe: number | null            // Trailing P/E
  forwardPe: number | null     // Forward P/E
  peg: number | null           // PEG ratio
  pb: number | null            // Price/Book
  ps: number | null            // Price/Sales (TTM)
  pfcf: number | null          // Price/Free Cash Flow (computed: mktCap/FCF)
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
  roe: number | null           // Return on equity (decimal)
  roa: number | null           // Return on assets (decimal)

  // Balance sheet
  debtToEquity: number | null  // Yahoo reports in %, e.g. 47.5 = 47.5% D/E
  currentRatio: number | null
  quickRatio: number | null
  totalCash: number | null
  totalDebt: number | null

  // Growth (decimal, e.g. 0.12 = 12%)
  revenueGrowth: number | null
  earningsGrowth: number | null

  // Other
  dividendYield: number | null // decimal
  beta: number | null
  fcfYield: number | null      // FCF / marketCap (decimal)

  // Score
  valueScore: number           // 0–100
  scoreBreakdown: ScoreBreakdown
}

// ─── Scoring helpers ────────────────────────────────────────────────────────

function scorePegInline(peg: number | null): number {
  if (peg === null || !isFinite(peg)) return 5
  if (peg < 0) return 3
  if (peg < 1)   return 10
  if (peg < 1.5) return 8
  if (peg < 2)   return 6
  if (peg < 3)   return 4
  return 2
}

// P/FCF: lower is better. Negative FCF → bad.
function scorePfcf(pfcf: number | null): number {
  if (pfcf === null || !isFinite(pfcf)) return 5
  if (pfcf < 0) return 2
  if (pfcf < 10)  return 10
  if (pfcf < 15)  return 9
  if (pfcf < 20)  return 7
  if (pfcf < 30)  return 5
  if (pfcf < 50)  return 3
  return 2
}

// EV/EBITDA: lower is better
function scoreEvEbitda(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v < 0)   return 3
  if (v < 8)   return 10
  if (v < 12)  return 8
  if (v < 16)  return 6
  if (v < 25)  return 4
  return 2
}

// P/B: lower is better (tech gets some lenience via overall score weighting)
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

// Debt/Equity — Yahoo reports in %, e.g. 47.5 = 47.5% D/E (0.475 ratio)
function scoreDebt(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v < 0)    return 5  // negative D/E (more cash than debt)
  if (v < 20)   return 10
  if (v < 50)   return 9
  if (v < 100)  return 7
  if (v < 200)  return 5
  if (v < 400)  return 3
  return 2
}

// ROE: higher is better (decimal format from Yahoo, e.g. 0.15 = 15%)
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

// Gross margin: higher is better (moat indicator) — decimal format
function scoreMargin(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v < 0)     return 1
  if (v >= 0.60) return 10
  if (v >= 0.40) return 8
  if (v >= 0.25) return 6
  if (v >= 0.15) return 4
  return 2
}

// Revenue growth: higher is better — decimal format
function scoreGrowth(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v >= 0.30) return 10
  if (v >= 0.20) return 9
  if (v >= 0.10) return 7
  if (v >= 0.05) return 5
  if (v >= 0)    return 4
  return 2  // negative growth
}

// Current ratio: higher is better
function scoreCurrentRatio(v: number | null): number {
  if (v === null || !isFinite(v)) return 5
  if (v >= 3.0) return 10
  if (v >= 2.0) return 9
  if (v >= 1.5) return 7
  if (v >= 1.0) return 5
  if (v >= 0.5) return 3
  return 1
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function computeValueScore(m: Partial<ValuationMetrics>): {
  score: number
  breakdown: ScoreBreakdown
} {
  const pegScore          = scorePegInline(m.peg ?? null)
  const pfcfScore         = scorePfcf(m.pfcf ?? null)
  const evEbitdaScore     = scoreEvEbitda(m.evEbitda ?? null)
  const pbScore           = scorePb(m.pb ?? null)
  const debtScore         = scoreDebt(m.debtToEquity ?? null)
  const roeScore          = scoreRoe(m.roe ?? null)
  const marginScore       = scoreMargin(m.grossMargin ?? null)
  const growthScore       = scoreGrowth(m.revenueGrowth ?? null)
  const currentRatioScore = scoreCurrentRatio(m.currentRatio ?? null)

  // Weights (sum = 1.0)
  const raw =
    pegScore          * 0.16 +
    pfcfScore         * 0.16 +
    evEbitdaScore     * 0.13 +
    pbScore           * 0.07 +
    debtScore         * 0.12 +
    roeScore          * 0.13 +
    marginScore       * 0.10 +
    growthScore       * 0.08 +
    currentRatioScore * 0.05

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
      currentRatioScore,
    },
  }
}

// ─── Color helpers used by the UI ───────────────────────────────────────────

export function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Undervalued',  color: '#16a34a' }
  if (score >= 55) return { label: 'Fair Value',    color: '#65a30d' }
  if (score >= 40) return { label: 'Fairly Priced', color: '#d97706' }
  if (score >= 25) return { label: 'Overvalued',    color: '#ea580c' }
  return               { label: 'Expensive',        color: '#dc2626' }
}

export function metricColor(
  value: number | null,
  type: 'pe' | 'peg' | 'pfcf' | 'evEbitda' | 'evRev' | 'pb' | 'ps' | 'debtEq'
      | 'roe' | 'margin' | 'growth' | 'current' | 'fcfYield' | 'divYield',
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
      if (value < 0)   return r
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
      if (value >= 0.05) return g; if (value >= 0.02) return n; return y
    case 'divYield':
      if (value >= 0.03) return g; if (value > 0) return n; return 'text-slate-400'
    default: return n
  }
}
