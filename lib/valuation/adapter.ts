/**
 * Valuation input adapter.
 *
 * Maps the raw output from /api/financials (FinancialsData shape) into
 * the canonical ValuationInput schema. Every field is explicitly sourced.
 *
 * Layers:
 *   yahoo raw data → /api/financials → FinancialsData  →  this adapter  →  ValuationInput
 *
 * Source: research/assumption_hierarchy.json (input priority per field)
 */

import type { ValuationInput } from './types'
import { VALUATION_CONFIG } from '@/config/valuation.config'

export function adaptFinancialsToValuationInput(
  ticker: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): ValuationInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any

  // ── Identifying ──────────────────────────────────────────────────────────
  const companyType = d.valuationMethods?.companyType ?? 'standard'
  const sector = d.businessProfile?.industry ?? ''
  const industry = d.businessProfile?.industry ?? ''

  // ── Market data ───────────────────────────────────────────────────────────
  const currentPrice: number = d.quote?.price ?? 0
  const sharesM: number = d.quote?.sharesOutstanding != null
    ? (d.quote.sharesOutstanding as number) / 1e6
    : (d.fairValue as any)?.sharesOutstanding ?? 0
  const marketCapM: number = d.quote?.marketCap != null
    ? (d.quote.marketCap as number) / 1e6
    : currentPrice * sharesM

  // ── Capital structure ────────────────────────────────────────────────────
  const cashM: number = d.fairValue?.cash ?? 0
  const totalDebtM: number = d.fairValue?.debt ?? 0
  const longTermDebtM: number = d.fairValue?.debt ?? totalDebtM
  const debtToEquity: number = marketCapM > 0 ? totalDebtM / marketCapM : 0.30

  // ── Discount rate inputs ─────────────────────────────────────────────────
  // Source: assumption_hierarchy.json RF_risk_free_rate → FRED 10Y
  const rfRate: number = d.wacc?.inputs?.rfRate ?? 0.045
  const beta: number = d.wacc?.inputs?.beta ?? 1.0
  const erp: number = VALUATION_CONFIG.erp
  const costOfDebt: number = d.wacc?.inputs?.costOfDebt ?? rfRate + 0.015
  const taxRate: number = d.wacc?.inputs?.taxRate ?? 0.21

  // ── Derived discount rates ────────────────────────────────────────────────
  const costOfEquity: number = d.wacc?.costOfEquity ?? rfRate + beta * erp
  const afterTaxCostOfDebt: number = d.wacc?.afterTaxCostOfDebt ?? costOfDebt * (1 - taxRate)
  const wacc: number = d.wacc?.wacc ?? costOfEquity * 0.7 + afterTaxCostOfDebt * 0.3

  // ── Cash flow inputs ──────────────────────────────────────────────────────
  const baseFCF: number = d.dcf?.baseFCF ?? 0
  const cagr: number = d.cagrAnalysis?.blended ?? d.cagrAnalysis?.historicalCagr3y ?? 0.05
  const historicalCagr3y: number = d.cagrAnalysis?.historicalCagr3y ?? 0
  const analystEstimate1y: number = d.cagrAnalysis?.analystEstimate1y ?? 0
  const blendedCagr: number = d.cagrAnalysis?.blended ?? cagr

  // Terminal growth derived from cagr per research/model_selection_rules.json
  const cfg = VALUATION_CONFIG.terminalGrowth
  const baseTerminalG = cagr > 0.15 ? cfg.highGrowth : cagr > 0.05 ? cfg.standard : cfg.mature
  const terminalG = Math.min(baseTerminalG, wacc - cfg.waccBuffer)
  const growthModel: 'two_stage' | 'three_stage' =
    (cagr > 0.15 || companyType === 'growth' || companyType === 'startup') ? 'three_stage' : 'two_stage'

  // ── Income statement ──────────────────────────────────────────────────────
  const revenueM: number = d.businessProfile?.revenueM ?? 0
  const netIncomeM: number = d.netIncome?.normalizedM ?? 0
  const fcfM: number = baseFCF
  const grossMargin: number | null = d.businessProfile?.grossMargin ?? null
  const fcfMargin: number | null = d.businessProfile?.fcfMargin ?? null
  const operatingMargin: number | null = d.businessProfile?.operatingMargin ?? null

  // ── Dividend data ─────────────────────────────────────────────────────────
  const dividendPerShare: number = d.dividend?.perShare ?? 0
  const dividendYield: number | null = d.dividend?.yield ?? null
  const payoutRatio: number = d.dividend?.payoutRatio ?? 0

  // ── Scores ────────────────────────────────────────────────────────────────
  const piotroskiScore: number | null = d.scores?.piotroski?.score ?? null
  const altmanZone: ValuationInput['altmanZone'] = d.scores?.altman?.zone ?? null
  const beneishFlag: ValuationInput['beneishFlag'] = d.scores?.beneish?.flag ?? null
  const roic: number | null = d.scores?.roic?.roic ?? null
  const spread: number | null = d.scores?.roic?.spread ?? null

  // ── Scenarios (from existing /api/financials output) ─────────────────────
  const bull = d.scenarios?.bull
  const base = d.scenarios?.base
  const bear = d.scenarios?.bear

  const existingScenarios = (bull && base && bear) ? {
    bull: {
      fairValue: bull.fairValue ?? 0,
      wacc: bull.wacc ?? wacc,
      cagr: bull.cagr ?? cagr,
      terminalG: bull.terminalG ?? terminalG,
      upsidePct: currentPrice > 0 ? ((bull.fairValue ?? 0) - currentPrice) / currentPrice : 0,
    },
    base: {
      fairValue: base.fairValue ?? base.upside ?? 0,
      wacc,
      cagr,
      terminalG,
      upsidePct: base.upside ?? d.fairValue?.upsidePct ?? 0,
    },
    bear: {
      fairValue: bear.fairValue ?? 0,
      wacc: bear.wacc ?? wacc,
      cagr: bear.cagr ?? cagr,
      terminalG: bear.terminalG ?? terminalG,
      upsidePct: currentPrice > 0 ? ((bear.fairValue ?? 0) - currentPrice) / currentPrice : 0,
    },
  } : undefined

  // ── Model applicability flags ─────────────────────────────────────────────
  const fcfeApplicable: boolean = d.valuationMethods?.models?.fcfe?.applicable ?? false
  const ddmApplicable: boolean = (d.valuationMethods?.models?.ddm?.applicable ?? false) && dividendPerShare > 0
  const multiplesApplicable: boolean = d.valuationMethods?.models?.multiples?.blendedFairValue != null

  // ── DCF outputs from existing engine ─────────────────────────────────────
  const fairValuePerShareFCFF: number = d.fairValue?.fairValuePerShare ?? 0
  const upsidePctFCFF: number = d.fairValue?.upsidePct ?? 0
  const evFromFCFF: number = d.fairValue?.ev ?? 0
  const equityValueFromFCFF: number = d.fairValue?.equityValue ?? 0

  // ── Triangulation ─────────────────────────────────────────────────────────
  const triangulatedFairValue: number = d.valuationMethods?.triangulatedFairValue ?? fairValuePerShareFCFF
  const triangulatedUpsidePct: number = d.valuationMethods?.triangulatedUpsidePct ?? upsidePctFCFF
  const effectiveWeights = d.valuationMethods?.effectiveWeights ?? { fcff: 100, fcfe: 0, ddm: 0, multiples: 0 }

  return {
    ticker,
    companyName: d.name ?? ticker,
    companyType,
    sector,
    industry,
    currentPrice,
    sharesOutstanding: sharesM,
    marketCapM,
    cashM,
    totalDebtM,
    longTermDebtM,
    debtToEquity,
    rfRate,
    beta,
    erp,
    costOfDebt,
    taxRate,
    costOfEquity,
    afterTaxCostOfDebt,
    wacc,
    baseFCF,
    cagr,
    terminalG,
    growthModel,
    netIncomeM,
    revenueM,
    fcfM,
    grossMargin,
    fcfMargin,
    operatingMargin,
    dividendPerShare,
    dividendYield,
    payoutRatio,
    piotroskiScore,
    altmanZone,
    beneishFlag,
    roic,
    spread,
    historicalCagr3y,
    analystEstimate1y,
    blendedCagr,
    scenarios: existingScenarios,
    fairValuePerShareFCFF,
    upsidePctFCFF,
    evFromFCFF,
    equityValueFromFCFF,
    triangulatedFairValue,
    triangulatedUpsidePct,
    effectiveWeights,
    fcfeApplicable,
    ddmApplicable,
    multiplesApplicable,
  }
}
