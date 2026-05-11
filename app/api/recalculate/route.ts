import { NextRequest, NextResponse } from 'next/server'
import { projectCashFlows } from '@/lib/dcf/projectCashFlows'
import { calculateFairValue, buildScenarios } from '@/lib/dcf/calculateFairValue'

// Stateless recalculation endpoint.
// The client passes all base DCF inputs plus any overrides (CAGR, WACC, terminal g).
// We run the DCF math server-side and return updated fair value + scenarios.
// No Yahoo Finance calls — all inputs come from the client's already-loaded data.
export async function GET(req: NextRequest) {
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

  if ([baseFCF, baseCAGR, baseWACC, baseTerminalG, sharesM, currentPrice].some(isNaN)) {
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

  // Rebuild scenarios using the same overridden WACC/CAGR/terminalG as base
  const waccLike = {
    wacc: safeWACC,
    costOfEquity: safeWACC * 1.1,
    afterTaxCostOfDebt: safeWACC * 0.6,
    weightEquity: 0.8,
    weightDebt: 0.2,
    inputs: {
      rfRate: 0.045,
      beta: 1.0,
      erp: 0.055,
      crp: 0,
      costOfDebt: 0.04,
      taxRate: 0.21,
      debtToEquity: 0.25,
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
