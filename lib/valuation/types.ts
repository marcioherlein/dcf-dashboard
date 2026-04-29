/**
 * Canonical valuation input schema.
 *
 * Every field is required or explicitly optional-with-fallback.
 * Missing required fields produce structured errors — no silent defaults.
 *
 * Source traceability:
 *   - research/assumption_hierarchy.json  — input priority and forbidden sources
 *   - research/validation_rules.json      — hard errors if bounds violated
 *   - research/valuation_framework.json   — formula definitions
 */

export interface ValuationInput {
  // ── Identifying ──────────────────────────────────────────────────────────
  ticker: string
  companyName: string
  companyType: 'financial' | 'dividend' | 'growth' | 'startup' | 'standard'
  sector: string
  industry: string

  // ── Market data ───────────────────────────────────────────────────────────
  currentPrice: number               // USD per share
  sharesOutstanding: number          // millions (diluted)
  marketCapM: number                 // millions USD

  // ── Capital structure ────────────────────────────────────────────────────
  cashM: number                      // millions USD (cash + short-term investments)
  totalDebtM: number                 // millions USD (market value; for most co's D ≈ N)
  debtToEquity: number               // totalDebtM / marketCapM
  longTermDebtM: number              // millions USD (used for financial co's)

  // ── Discount rate inputs ─────────────────────────────────────────────────
  rfRate: number                     // 10Y Treasury yield (FRED). Source: assumption_hierarchy RF
  beta: number                       // Levered beta (regression preferred, Yahoo fallback)
  erp: number                        // Equity risk premium (Damodaran). Default: 0.046
  costOfDebt: number                 // Interest expense / avg gross debt
  taxRate: number                    // Effective tax rate [0.05, 0.40]

  // ── Derived discount rates (computed by normalizer) ─────────────────────
  costOfEquity: number               // CAPM: rfRate + beta * erp
  afterTaxCostOfDebt: number         // costOfDebt * (1 - taxRate)
  wacc: number                       // Weighted average cost of capital

  // ── Cash flow inputs ─────────────────────────────────────────────────────
  baseFCF: number                    // Base free cash flow (millions USD, normalized 2Y avg)
  cagr: number                       // Blended FCF/revenue CAGR for forecast period
  terminalG: number                  // Terminal growth rate (must be < wacc)
  growthModel: 'two_stage' | 'three_stage'

  // ── Income statement (last 4 actuals + projections, millions USD) ─────────
  netIncomeM: number                 // Trailing net income (millions, for FCFE/DDM)
  revenueM: number                   // TTM revenue (millions)
  fcfM: number                       // TTM FCF (millions, for yield checks)
  grossMargin: number | null         // 0.0–1.0
  fcfMargin: number | null           // 0.0–1.0 (can be negative)
  operatingMargin: number | null     // 0.0–1.0

  // ── Dividend data (for DDM) ───────────────────────────────────────────────
  dividendPerShare: number           // Annualized DPS (0 if no dividend)
  dividendYield: number | null       // Trailing yield
  payoutRatio: number                // DPS / EPS

  // ── Scores (for interpretation layer) ────────────────────────────────────
  piotroskiScore: number | null      // 0–9
  altmanZone: 'Safe' | 'Grey' | 'Distress' | null
  beneishFlag: 'Clean' | 'Warning' | 'Manipulator' | null
  roic: number | null                // Return on invested capital (0.0–1.0+)
  spread: number | null              // ROIC - WACC

  // ── CAGR analysis ─────────────────────────────────────────────────────────
  historicalCagr3y: number           // 3Y historical CAGR
  analystEstimate1y: number          // Consensus analyst 1Y estimate
  blendedCagr: number                // Weighted blend of above

  // ── DCF computed values (filled by engine) ───────────────────────────────
  /** Explicit forecast cash flows (10 years). Filled by engine. */
  projectedFCFs?: Array<{ year: number; cashFlow: number; discounted: number }>
  evFromFCFF?: number                // Enterprise value from FCFF DCF (millions)
  equityValueFromFCFF?: number       // E = EV + cash - debt (millions)
  fairValuePerShareFCFF?: number     // Per share (USD)
  upsidePctFCFF?: number             // (fairValue - price) / price

  /** Scenario outputs */
  scenarios?: {
    bull: ScenarioOutput
    base: ScenarioOutput
    bear: ScenarioOutput
  }

  /** Multi-model triangulation */
  triangulatedFairValue?: number     // Weighted average of applicable models
  triangulatedUpsidePct?: number
  effectiveWeights?: { fcff: number; fcfe: number; ddm: number; multiples: number }

  // ── Model applicability flags ─────────────────────────────────────────────
  fcfeApplicable: boolean
  ddmApplicable: boolean
  multiplesApplicable: boolean
}

export interface ScenarioOutput {
  fairValue: number
  wacc: number
  cagr: number
  terminalG: number
  upsidePct: number
}

export interface ValuationError {
  code: string         // e.g. 'V1', 'W3'
  severity: 'ERROR' | 'WARNING'
  field: string
  message: string
  sourceRule: string   // e.g. 'ssrn-1025424 Error I.6.1'
}

export interface ValuationResult {
  input: ValuationInput
  errors: ValuationError[]
  warnings: ValuationError[]
  computed: boolean    // false if any ERROR exists
  /** FCF DCF result — always attempted unless company is financial */
  fcff: ModelResult | null
  /** FCFE result — for financial companies and others when applicable */
  fcfe: ModelResult | null
  /** DDM result — for dividend payers */
  ddm: ModelResult | null
  /** Relative multiples cross-check */
  multiples: MultiplesResult | null
  /** Triangulated fair value (weighted blend) */
  triangulated: TriangulatedResult | null
  /** Interpretation paragraph (auto-generated from inputs + results) */
  interpretation: ValuationInterpretation
}

export interface ModelResult {
  modelId: string
  label: string
  applicable: boolean
  notApplicableReason?: string
  fairValuePerShare: number | null
  upsidePct: number | null
  evM: number | null
  equityValueM: number | null
  assumptions: Record<string, number | string>
  sourceFormula: string     // e.g. "ssrn-256987 eq[4],[5]"
}

export interface MultiplesResult {
  peImplied: number | null
  pbImplied: number | null
  evEbitdaImplied: number | null
  evRevenueImplied: number | null
  blendedFairValue: number | null
  blendedUpsidePct: number | null
  source: string
}

export interface TriangulatedResult {
  fairValue: number
  upsidePct: number
  weights: { fcff: number; fcfe: number; ddm: number; multiples: number }
  upsideZone: 'Attractive' | 'Fair Value' | 'Expensive'
  zoneColor: string
}

export interface ValuationInterpretation {
  summary: string          // 2–3 sentence paragraph
  primaryMethod: string
  rationale: string
  scenarioRange: string    // "$X – $Y (bear–bull)"
  keyRisk: string
  marginOfSafetyRecommendation: string
}
