/**
 * V2 Valuation Engine — Result Types
 *
 * All models return a structured ValuationResult instead of throwing exceptions
 * or silently substituting fabricated values.
 *
 * A missing result is analytically preferable to a fabricated result.
 */

// ─── Status ───────────────────────────────────────────────────────────────────

export type ValuationStatus =
  | 'success'            // model ran, produced a credible value
  | 'not_applicable'     // model is structurally wrong for this company type
  | 'insufficient_data'  // required inputs missing; no value manufactured
  | 'validation_error'   // inputs present but failed financial sanity checks
  | 'v1_fallback'        // v2 not yet implemented; delegated to v1

// ─── Unit safety ──────────────────────────────────────────────────────────────
//
// TypeScript nominal types that prevent mixing raw dollars with millions.
// Use the toMillions() / toRaw() helpers defined in units.ts.

export type RawDollars  = number & { readonly __unit: 'raw_dollars' }
export type Millions    = number & { readonly __unit: 'millions' }
export type Percentage  = number & { readonly __unit: 'decimal_percentage' }
export type PerShare    = number & { readonly __unit: 'per_share' }
export type Multiplier  = number & { readonly __unit: 'multiplier' }
export type Years       = number & { readonly __unit: 'years' }

// ─── Financial datum with provenance ──────────────────────────────────────────

export interface FinancialDatum {
  value:         number | null
  currency:      string
  unit:          'raw' | 'thousands' | 'millions'
  periodStart?:  string   // ISO date
  periodEnd?:    string   // ISO date
  fiscalPeriod?: string   // e.g. "FY2024" | "Q2 2024"
  source:        string   // e.g. "fmp" | "yahoo" | "derived" | "fallback"
  retrievedAt?:  string   // ISO datetime
  filingDate?:   string   // original SEC/filing date
  isRestated?:   boolean
  confidence?:   'high' | 'medium' | 'low'
}

// ─── Individual model result ──────────────────────────────────────────────────

export interface ModelResult {
  id:          string         // unique model identifier
  status:      ValuationStatus
  fairValue:   number | null  // per share, null when status !== 'success'
  errors:      string[]       // machine-readable error codes
  warnings:    string[]       // non-blocking cautions
  inputsUsed:  Record<string, unknown>   // snapshot of inputs actually consumed
  diagnostics: Record<string, unknown>  // intermediate outputs for debugging
}

// ─── Blended output ───────────────────────────────────────────────────────────

export interface BlendedResult {
  blendedFairValue:       number | null
  modelResults:           ModelResult[]
  weights:                Record<string, number>  // model id → fractional weight
  effectiveModelCount:    number                  // models that contributed (status === 'success')
  terminalValueShare:     number | null           // TV / EV for primary DCF
  confidenceDiagnostics:  ConfidenceDiagnostics
}

// ─── Confidence ───────────────────────────────────────────────────────────────

export interface ConfidenceDiagnostics {
  /** 0–100 score derived from data quality, model fit, and uncertainty */
  overallScore:         number
  dataQualityScore:     number
  forecastReliability:  number
  modelFitScore:        number
  terminalValueShare:   number | null
  analystCoverage:      number | null  // number of analysts
  analystDispersion:    number | null  // std dev of targets / mean
  keyWarnings:          string[]
  /** Human-readable summary explaining the confidence level */
  summary:              string
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

export interface ScenarioAssumptions {
  revenueGrowth: number
  ebitMargin:    number
  wacc:          number
  terminalG:     number
  exitMultiple?: number
}

export interface ScenarioResult {
  label:        'bull' | 'base' | 'bear'
  fairValue:    number | null
  assumptions:  ScenarioAssumptions
  status:       ValuationStatus
}

export interface ScenariosV2 {
  bull: ScenarioResult
  base: ScenarioResult
  bear: ScenarioResult
  /** Validation: base should be between bear and bull. */
  isMonotonic: boolean
  inversionWarning?: string
}

// ─── Full V2 output ───────────────────────────────────────────────────────────

export interface CockpitOutputV2 {
  /** Per-share blended fair value across all applicable models */
  blendedFairValue:         number | null
  /** Individual model results with status and diagnostics */
  modelResults:             ModelResult[]
  scenarios:                ScenariosV2
  verdict:                  'Undervalued' | 'Fairly Valued' | 'Overvalued' | 'Insufficient Data'
  upsidePct:                number | null
  confidence:               'high' | 'medium' | 'low'
  confidenceDiagnostics:    ConfidenceDiagnostics
  marketImpliedGrowth:      number | null
  /** Which engine produced this output */
  engineVersion:            'v2'
  /** Any data quality warnings that should be surfaced to users */
  dataWarnings:             string[]
}

// ─── V2 snapshot (extends V1 with provenance) ────────────────────────────────

export interface CockpitSnapshotV2 {
  // Identity
  ticker:            string
  currency:          string
  valuationDate:     string   // ISO date when snapshot was built

  // Price
  currentPrice:      number
  marketCap:         FinancialDatum

  // Income statement inputs
  ttmRevenue:        FinancialDatum
  ttmEbit:           FinancialDatum | null
  ttmEbitda:         FinancialDatum | null
  ttmNetIncome:      FinancialDatum | null
  ttmDna:            FinancialDatum | null   // depreciation & amortization
  ttmCapex:          FinancialDatum | null
  ttmNwcDelta:       FinancialDatum | null   // change in net working capital

  // Balance sheet
  cashAndEquivalents: FinancialDatum
  totalDebt:          FinancialDatum
  leaseLiabilities?:  FinancialDatum | null
  preferredStock?:    FinancialDatum | null
  minorityInterest?:  FinancialDatum | null
  pensionDeficit?:    FinancialDatum | null

  // Shares
  dilutedShares:     FinancialDatum   // millions
  basicShares:       FinancialDatum   // millions
  sbcAnnual?:        FinancialDatum | null

  // Quality / returns
  roic?:             number | null
  roe?:              number | null
  bookValuePerShare?: number | null

  // Classification
  companyType:       string
  sector:            string | null
  industry:          string | null

  // Growth context
  historicalCagr3y:  number | null
  analystCagr1y:     number | null
  analystCagr2y:     number | null
}
