// Shared helpers extracted from ValuationCockpit so they can be used in API routes
// (ValuationCockpit is 'use client' and cannot be imported server-side)
import {
  type ValuationAssumptions,
  type CockpitSnapshot,
} from '@/lib/valuation/cockpit'
import { deriveForwardPEAssumptions, deriveRevenueMultipleAssumptions } from '@/lib/valuation/assumptions/deriveAssumptions'
import { blendEVEBITDAMultiple } from '@/lib/valuation/methods/evEbitda'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiData = Record<string, any>

export function buildSnapshot(apiData: ApiData, statementsData?: ApiData | null): CockpitSnapshot {
  const sharesM = apiData.fairValue?.sharesOutstanding ?? 0
  let cashM     = apiData.fairValue?.cash ?? 0
  let debtM     = apiData.fairValue?.debt ?? 0
  const sharesRaw = sharesM > 0 ? sharesM * 1e6 : null

  // Detect banks/insurers to avoid TTM balance sheet debt inflation.
  // Banks' totalDebt includes customer deposits and interbank liabilities — route.ts already
  // applies a guard using only longTermDebt for these companies. We must not undo that here.
  const industry = (apiData.quote?.industry ?? '') as string
  const sector   = (apiData.quote?.sector   ?? '') as string
  const isBankLike = /bank|insurance|financ|fintech|payment|credit|lending|capital market|asset management|brokerage/i.test(sector + ' ' + industry)

  const incomeRows: Array<{ isProjected: boolean; revenue: number | null; ebitda?: number | null }> =
    apiData.financialStatements?.incomeStatement ?? []
  const actuals = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
  const lastRow = actuals[actuals.length - 1] ?? null
  const ltvRevenueDollars = lastRow?.revenue != null ? lastRow.revenue * 1e6 : null

  const ebitdaRows = incomeRows.filter(r => !r.isProjected && r.ebitda != null && r.ebitda > 0)
  const lastEbitda = ebitdaRows[ebitdaRows.length - 1]?.ebitda ?? null
  let ttmEbitdaDollars: number | null = lastEbitda != null ? lastEbitda * 1e6 : null

  if (ttmEbitdaDollars == null) {
    const multEstimates: Array<{ multiple: string; actualValue: number }> =
      (apiData.valuationMethods?.models?.multiples?.estimates ?? []) as Array<{ multiple: string; actualValue: number }>
    const evEbitdaActual = multEstimates.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
    const marketCapRawDollars: number = apiData.quote?.marketCap ?? 0
    const netDebtM = (apiData.fairValue?.debt ?? 0) - (apiData.fairValue?.cash ?? 0)
    if (evEbitdaActual != null && evEbitdaActual >= 3 && evEbitdaActual <= 80 && marketCapRawDollars > 0) {
      const evRawDollars = marketCapRawDollars + netDebtM * 1e6
      const implied = evRawDollars / evEbitdaActual
      if (implied > 0) ttmEbitdaDollars = implied
    }
  }

  // Fallback 3: TTM EBITDA from Yahoo quarterly sum (statementsData)
  if (ttmEbitdaDollars == null && statementsData?.ttm) {
    const ttmIS = statementsData.ttm.incomeStatement as ApiData | null
    const ttmCF = statementsData.ttm.cashFlow as ApiData | null
    if (ttmIS) {
      const rawEbitda = ttmIS['EBITDA'] ?? ttmIS['normalizedEBITDA'] ?? null
      if (typeof rawEbitda === 'number' && isFinite(rawEbitda) && rawEbitda > 0) {
        ttmEbitdaDollars = rawEbitda
      } else {
        const ebit = ttmIS['EBIT'] ?? ttmIS['ebit'] ?? null
        const dna = ttmCF?.['depreciationAndAmortization'] ?? ttmCF?.['depreciationAmortizationDepletion'] ?? ttmIS['reconciledDepreciation'] ?? null
        if (typeof ebit === 'number' && isFinite(ebit) && typeof dna === 'number' && isFinite(dna)) {
          const computed = ebit + Math.abs(dna)
          if (computed > 0) ttmEbitdaDollars = computed
        }
      }
    }
  }

  const fcfMargin = apiData.businessProfile?.fcfMargin ?? null
  const historicalCAGR = apiData.cagrAnalysis?.historicalCagr3y ?? null
  const analystTargetMean = apiData.quote?.analystTargetMean ?? null
  const analystRating = apiData.analystRecommendation ?? null

  const ttmFCFRaw = statementsData?.ttm?.cashFlow?.freeCashFlow
  const baseFCF = (typeof ttmFCFRaw === 'number' && isFinite(ttmFCFRaw) && ttmFCFRaw > 0)
    ? ttmFCFRaw / 1e6
    : (apiData.baseFCF ?? 0)

  const ttmBS = statementsData?.ttm?.balanceSheet
  if (ttmBS) {
    const stmtCash = (ttmBS as ApiData).cashCashEquivalentsAndShortTermInvestments ?? (ttmBS as ApiData).cash
    if (typeof stmtCash === 'number' && isFinite(stmtCash)) cashM = stmtCash / 1e6
    // For banks, totalDebt on the balance sheet includes customer deposits and interbank
    // liabilities — use fairValue.debt (already guarded in route.ts to longTermDebt only).
    if (!isBankLike) {
      const stmtDebt = (ttmBS as ApiData).totalDebt ?? (ttmBS as ApiData).longTermDebt
      if (typeof stmtDebt === 'number' && isFinite(stmtDebt)) debtM = stmtDebt / 1e6
    }
  }

  // TTM revenue from Yahoo (consistent with SummaryTab path for reverse DCF)
  const ttmRevenueDollars = apiData.businessProfile?.revenueM != null
    ? (apiData.businessProfile.revenueM as number) * 1e6
    : null

  const growthModel = (apiData.growthModel as 'two-stage' | 'three-stage') ?? 'two-stage'

  return {
    currentPrice: apiData.quote?.price ?? 0,
    currency: apiData.quote?.currency ?? 'USD',
    ltvRevenueDollars,
    ttmRevenueDollars,
    sharesRaw,
    ttmEbitdaDollars,
    netDebtDollars: (debtM - cashM) * 1e6,
    dividendYield: null,
    baseFCF,
    cashM,
    debtM,
    sharesM,
    growthModel,
    fcfMargin,
    historicalCAGR,
    analystTargetMean,
    analystRating,
    companyType: apiData.valuationMethods?.companyType ?? 'standard',
    fullDcfFairValue: apiData.scenarios?.base?.fairValue ?? null,
  }
}

export function seedAssumptions(apiData: ApiData): ValuationAssumptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fwdPEBase = deriveForwardPEAssumptions(apiData as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revMultBase = deriveRevenueMultipleAssumptions(apiData as any)

  const sector   = apiData.quote?.sector   ?? null
  const industry = apiData.quote?.industry ?? null
  const crp      = apiData.wacc?.crp ?? 0
  const multEstimates: Array<{ multiple: string; actualValue: number }> =
    apiData.valuationMethods?.models?.multiples?.estimates ?? []
  const currentEVEBITDA = multEstimates.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
  const { multiple: exitMultiple } = blendEVEBITDAMultiple(sector, industry, currentEVEBITDA, crp)

  return {
    wacc:            apiData.wacc?.wacc ?? 0.10,
    cagr:            apiData.cagr ?? fwdPEBase.revenueCAGR,
    terminalG:       apiData.terminalG ?? 0.03,
    netMargin:       fwdPEBase.netMargin,
    dilutionRate:    fwdPEBase.dilutionRate,
    exitPE:          fwdPEBase.exitPE,
    exitMultiple,
    revenueMultiple: revMultBase.exitEVRevenue,
  }
}
