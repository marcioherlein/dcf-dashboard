/**
 * Valuation module developer configuration.
 *
 * This file controls which models are enabled, which VTS theory is used,
 * and global constants that override defaults.
 *
 * All values here are traceable to:
 *   - /research/valuation_framework.json    — model definitions + formulas
 *   - /research/model_selection_rules.json  — when to use each model
 *   - /research/assumption_hierarchy.json   — input source priority
 *   - /research/validation_rules.json       — hard errors + warnings
 */

export const VALUATION_CONFIG = {
  /**
   * VTS theory used when computing APV or checking consistency.
   * Options: 'T1_Fernandez_2007' | 'T2_Miles_Ezzell' | 'T3_MM' | 'T4_Myers' | 'T5_Miller'
   * Default: T1_Fernandez_2007 — applies when debt is rebalanced to target D/E (most public companies).
   * Source: research/valuation_framework.json GROUP_E_VTS_THEORIES
   */
  vtsTheory: 'T1_Fernandez_2007' as const,

  /**
   * Beta levering formula tied to VTS theory.
   * Must match vtsTheory to avoid leverage cost double-counting.
   * Source: research/valuation_framework.json BETA_LEVERING_FORMULAS
   */
  betaLeveringFormula: 'Fernandez_2007' as const,

  /**
   * Equity Risk Premium (Damodaran implied ERP).
   * Update annually from: https://pages.stern.nyu.edu/~adamodar/
   * Current value: Damodaran Jan 2025.
   * Source: research/assumption_hierarchy.json ERP_equity_risk_premium
   */
  erp: 0.046,

  /**
   * Terminal growth rate bounds.
   * Hard ceiling: WACC - 0.005 (enforced at runtime).
   * Source: research/validation_rules.json V1, W1
   */
  terminalGrowth: {
    highGrowth: 0.025,    // CAGR > 15%
    standard: 0.020,      // CAGR 5–15%
    mature: 0.015,        // CAGR < 5%
    absoluteFloor: 0.00,
    waccBuffer: 0.005,    // terminal_g <= wacc - waccBuffer
  },

  /**
   * Upside zones for UI color coding.
   * Source: ValuationTab.tsx existing logic (preserved)
   */
  upsideZones: {
    attractive: 0.25,   // >= 25% → Attractive
    fairValue: 0.05,    // >= 5%  → Fair Value
    // below 5% → Expensive
  },

  /**
   * Scenario adjustments (bull/base/bear).
   * Applied as deltas to base WACC, CAGR, and terminal G.
   * Source: calculateFairValue.ts buildScenarios()
   */
  scenarios: {
    bull: { waccAdj: -0.01, cagrAdj: +0.02, tgAdj: +0.005 },
    base: { waccAdj: 0.00, cagrAdj: 0.00,  tgAdj: 0.000 },
    bear: { waccAdj: +0.01, cagrAdj: -0.02, tgAdj: -0.005 },
  },

  /**
   * Models enabled for primary computation.
   * Weights are in research/model_selection_rules.json.
   * Disable a model here to exclude it from triangulation.
   */
  enabledModels: {
    fcff: true,       // FCFF/WACC DCF (D2) — primary for most companies
    fcfe: true,       // FCFE (D6 proxy) — primary for financial companies
    ddm: true,        // DDM — for dividend payers
    multiples: true,  // Relative multiples — cross-check
    apv: false,       // APV (D4) — off by default, requires explicit VTS theory + Ku
  },

  /**
   * Validation thresholds (match research/validation_rules.json).
   */
  validation: {
    maxTerminalGrowthAbsolute: 0.05,    // warn if > 5%
    maxResidualValuePct: 0.85,          // warn if terminal value > 85% of EV
    maxBeta: 3.5,
    minBeta: 0.3,
    maxDebtToEquity: 3.0,              // warn above this
    consistencyTolerancePct: 0.005,    // 0.5% divergence between methods = warning
    maxUpsideMagnitude: 2.0,           // warn if |upside| > 200%
    maxRfRate: 0.20,
    minRfRate: 0.001,
  },

  /**
   * Display precision.
   */
  display: {
    fairValueDecimals: 2,
    percentDecimals: 1,
    multipleDecimals: 1,
    ratioDecimals: 2,
  },
} as const

export type VtsTheory = typeof VALUATION_CONFIG.vtsTheory
export type BetaLeveringFormula = typeof VALUATION_CONFIG.betaLeveringFormula
