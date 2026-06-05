import { NextRequest, NextResponse } from 'next/server'
import { projectCashFlows } from '@/lib/dcf/projectCashFlows'
import { calculateFairValue, buildScenarios } from '@/lib/dcf/calculateFairValue'
import { VALUATION_CONFIG } from '@/config/valuation.config'
import { rateLimit } from '@/lib/rateLimit'

// Stateless recalculation endpoint.
// The client passes all base DCF inputs plus any overrides (CAGR, WACC, terminal g).
// We run the DCF math server-side and return updated fair value + scenarios.
// No Yahoo Finance calls — all inputs come from the client's already-loaded data.
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 10, 60000, 'recalculate')
  if (limited) return limited

  const p = req.nextUrl.searchParams

  const baseFCF      = parseFloat(p.get('baseFCF') ?? '')
  const baseCAGR     = parseFloat(p.get('cagr') ?? '')
  const baseWACC     = parseFloat(p.get('wacc') ?? '')
  const baseTerminalG = parseFloat(p.get('terminalG') ?? '')
  const growthModel  = (p.get('growthModel') ?? 'two-stage') as 'two-stage' | 'three-stage'
  const cashM        = parseFloat(p.get('cashM') ?? '0')
  const debtM        = parseFloat(p.get('debtM') ?? '0')
  const sharesM      = parseFloat(p.get('sharesM') ?? '1')
  const currentPrice = parseFloat(p.get('currentPrice') ?? '0')

  // Overrides (optional — NaN means use base value)
  const cagrOverride     = parseFloat(p.get('cagrOverride') ?? '')
  const waccOverride     = parseFloat(p.get('waccOverride') ?? '')
  const terminalGOverride = parseFloat(p.get('terminalGOverride') ?? '')

  const isFiniteNum = (v: number) => isFinite(v) && !isNaN(v)

  if ([baseFCF, baseCAGR, baseWACC, baseTerminalG, sharesM, currentPrice].some(v => !isFiniteNum(v))) {
    return NextResponse.json({ error: 'Missing required numeric parameters' }, { status: 400 })
  }

  const cagr     = !isNaN(cagrOverride) ? cagrOverride / 100 : baseCAGR
  const wacc     = !isNaN(waccOverride) ? waccOverride / 100 : baseWACC
  const terminalG = !isNaN(terminalGOverride) ? terminalGOverride / 100 : baseTerminalG

  // Clamp inputs to safe ranges
  const safeCAGR      = Math.max(0, Math.min(cagr, 0.6))
  const safeWACC      = Math.max(0.04, Math.min(wacc, 0.3))
  const safeTerminalG = Math.max(0, Math.min(terminalG, safeWACC - 0.005))

  // Re-select growth model if CAGR crosses the threshold
  const effectiveGrowthModel = safeCAGR > 0.15 ? 'three-stage' as const : growthModel

  const dcf = projectCashFlows({
    baseFCF,
    cagr: safeCAGR,
    wacc: safeWACC,
    terminalG: safeTerminalG,
    growthModel: effectiveGrowthModel,
  })

  const fv = calculateFairValue(dcf, cashM, debtM, sharesM, currentPrice)

  // Accept actual WACC component inputs from the client when available.
  // These are passed through from the initial /api/financials response so the
  // WACC decomposition shown in scenarios reflects the stock's actual capital structure.
  // Fall back to reasonable approximations only when not provided.
  const rfRate       = parseFloat(p.get('rfRate') ?? '')
  const beta         = parseFloat(p.get('beta') ?? '')
  const crp          = parseFloat(p.get('crp') ?? '0')
  const costOfDebt   = parseFloat(p.get('costOfDebt') ?? '')
  const taxRate      = parseFloat(p.get('taxRate') ?? '')
  const debtToEquity = parseFloat(p.get('debtToEquity') ?? '')

  // Rebuild scenarios using the same overridden WACC/CAGR/terminalG as base.
  // Use actual WACC inputs from the client; fall back gracefully when not supplied.
  const effectiveRfRate  = !isNaN(rfRate) ? rfRate : safeWACC * 0.55   // approx RF component
  const effectiveBeta    = !isNaN(beta) ? beta : 1.0
  const effectiveCrp     = !isNaN(crp) ? crp : 0
  const effectiveCoD     = !isNaN(costOfDebt) ? costOfDebt : effectiveRfRate + effectiveCrp + 0.015
  const effectiveTax     = !isNaN(taxRate) ? taxRate : 0.21
  const effectiveDtE     = !isNaN(debtToEquity) ? debtToEquity : (debtM > 0 && cashM > 0 ? debtM / (currentPrice * sharesM / 1000) : 0.25)
  const effectiveKe      = effectiveRfRate + effectiveBeta * (VALUATION_CONFIG.erp + effectiveCrp)
  const effectiveKd      = effectiveCoD * (1 - effectiveTax)
  const effectiveDebtRatio = effectiveDtE / (1 + effectiveDtE)
  const waccLike = {
    wacc: safeWACC,
    costOfEquity: effectiveKe,
    afterTaxCostOfDebt: effectiveKd,
    weightEquity: 1 - effectiveDebtRatio,
    weightDebt: effectiveDebtRatio,
    inputs: {
      rfRate: effectiveRfRate,
      beta: effectiveBeta,
      erp: VALUATION_CONFIG.erp,
      crp: effectiveCrp,
      costOfDebt: effectiveCoD,
      taxRate: effectiveTax,
      debtToEquity: effectiveDtE,
    },
  }
  const scenarios = buildScenarios(waccLike, safeCAGR, safeTerminalG, baseFCF, cashM, debtM, sharesM, 0, effectiveGrowthModel)

  return NextResponse.json({
    fairValue: fv.fairValuePerShare,
    upsidePct: fv.upsidePct,
    irr: fv.irr,
    appliedCagr: safeCAGR,
    appliedWacc: safeWACC,
    appliedTerminalG: safeTerminalG,
    scenarios: {
      bull: { fairValue: scenarios.bull.fairValue, cagr: scenarios.bull.cagr, wacc: scenarios.bull.wacc, terminalG: scenarios.bull.terminalG },
      base: { fairValue: scenarios.base.fairValue, cagr: scenarios.base.cagr, wacc: scenarios.base.wacc, terminalG: scenarios.base.terminalG },
      bear: { fairValue: scenarios.bear.fairValue, cagr: scenarios.bear.cagr, wacc: scenarios.bear.wacc, terminalG: scenarios.bear.terminalG },
    },
  })
}
