// Shared helpers extracted from ValuationCockpit so they can be used in API routes
// (ValuationCockpit is 'use client' and cannot be imported server-side)
import {
  type ValuationAssumptions,
  type CockpitSnapshot,
} from '@/lib/valuation/cockpit'
import { deriveForwardPEAssumptions, deriveRevenueMultipleAssumptions } from '@/lib/valuation/assumptions/deriveAssumptions'
import { blendEVEBITDAMultiple } from '@/lib/valuation/methods/evEbitda'
import { getIndustryMultiples } from '@/lib/dcf/calculateMultiples'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiData = Record<string, any>

export function buildSnapshot(apiData: ApiData, statementsData?: ApiData | null): CockpitSnapshot {
  const sharesM   = apiData.fairValue?.sharesOutstanding ?? 0
  const cashM     = apiData.fairValue?.cash ?? 0
  const debtM     = apiData.fairValue?.debt ?? 0
  const sharesRaw = sharesM > 0 ? sharesM * 1e6 : null

  const incomeRows: Array<{ isProjected: boolean; revenue: number | null; ebitda?: number | null }> =
    apiData.financialStatements?.incomeStatement ?? []
  const actuals = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
  const lastRow = actuals[actuals.length - 1] ?? null
  const ltvRevenueDollars = lastRow?.revenue != null ? lastRow.revenue * 1e6 : null

  const ebitdaRows = incomeRows.filter(r => !r.isProjected && r.ebitda != null && r.ebitda > 0)
  const lastEbitda = ebitdaRows[ebitdaRows.length - 1]?.ebitda ?? null
  let ttmEbitdaDollars: number | null = lastEbitda != null ? lastEbitda * 1e6 : null

  // Step 0 (highest priority): TTM EBITDA from quarterly income statements — 4-quarter rolling sum
  if (ttmEbitdaDollars == null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qIncome: any[] = apiData.incomeStatementQuarterly ?? []
    const last4 = qIncome.slice(0, 4)
    if (last4.length === 4) {
      const allHaveEbitda = last4.every((q: { ebitda?: number | null }) => typeof q.ebitda === 'number' && (q.ebitda as number) > 0)
      if (allHaveEbitda) {
        const sum = last4.reduce((s: number, q: { ebitda: number }) => s + q.ebitda, 0)
        if (sum > 0) ttmEbitdaDollars = sum * 1e6
      }
      if (ttmEbitdaDollars == null) {
        const allHaveComponents = last4.every(
          (q: { operatingIncome?: number | null; depreciationAndAmortization?: number | null }) =>
            typeof q.operatingIncome === 'number' && typeof q.depreciationAndAmortization === 'number'
        )
        if (allHaveComponents) {
          const sum = last4.reduce(
            (s: number, q: { operatingIncome: number; depreciationAndAmortization: number }) =>
              s + q.operatingIncome + Math.abs(q.depreciationAndAmortization),
            0
          )
          if (sum > 0) ttmEbitdaDollars = sum * 1e6
        }
      }
    }
  }

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

  // TTM revenue from Yahoo — used for reverse DCF to match the SummaryTab path.
  // fairValue.cash/debt are used directly (already bank-guarded in route.ts).
  const ttmRevenueDollars = apiData.businessProfile?.revenueM != null
    ? (apiData.businessProfile.revenueM as number) * 1e6
    : null

  const growthModel = (apiData.growthModel as 'two-stage' | 'three-stage') ?? 'two-stage'

  // Book value per share — for P/B valuation method (financial companies)
  const bsRows: Array<{ isProjected?: boolean; totalEquity?: number | null }> =
    apiData.financialStatements?.balanceSheet ?? []
  const actualBSRows = bsRows.filter(r => !r.isProjected)
  const lastBSEquity = actualBSRows[actualBSRows.length - 1]?.totalEquity ?? null
  const bookValuePerShare = lastBSEquity != null && lastBSEquity > 0 && sharesRaw != null && sharesRaw > 0
    ? (lastBSEquity * 1e6) / sharesRaw
    : null

  const sector: string | null = apiData.quote?.sector ?? null
  const industry: string | null = apiData.quote?.industry ?? null

  // Phase 1: ROE for justified P/B formula
  const incomeRowsForROE: Array<{ isProjected?: boolean; netIncome?: number | null }> =
    apiData.financialStatements?.incomeStatement ?? []
  const lastNetIncomeM = incomeRowsForROE.filter(r => !r.isProjected).slice(-1)[0]?.netIncome ?? null
  const roe = lastNetIncomeM != null && lastNetIncomeM > 0 && lastBSEquity != null && lastBSEquity > 0
    ? lastNetIncomeM / lastBSEquity
    : null

  // Phase 2: TTM net income and D&A in dollars — for P/FFO method (REITs)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qIncome: any[] = apiData.incomeStatementQuarterly ?? []
  const last4Q = qIncome.slice(0, 4)
  let netIncomeDollars: number | null = null
  let dnaDollars: number | null = null
  if (last4Q.length === 4) {
    const allHaveNI = last4Q.every((q: { netIncome?: number | null }) => typeof q.netIncome === 'number')
    if (allHaveNI) {
      const niSum = last4Q.reduce((s: number, q: { netIncome: number }) => s + q.netIncome, 0)
      if (isFinite(niSum)) netIncomeDollars = niSum * 1e6
    }
    const allHaveDNA = last4Q.every((q: { depreciationAndAmortization?: number | null }) => typeof q.depreciationAndAmortization === 'number')
    if (allHaveDNA) {
      const dnaSum = last4Q.reduce((s: number, q: { depreciationAndAmortization: number }) => s + Math.abs(q.depreciationAndAmortization), 0)
      if (isFinite(dnaSum)) dnaDollars = dnaSum * 1e6
    }
  }

  // Phase 2: dividend per share and payout ratio — for DDM method (utilities, dividends)
  const dividendPerShare: number | null = apiData.quote?.dividendRate ?? apiData.quote?.trailingAnnualDividendRate ?? null
  const payoutRatio: number | null = apiData.quote?.payoutRatio ?? null

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
    sector,
    industry,
    bookValuePerShare,
    roe,
    netIncomeDollars,
    dnaDollars,
    dividendPerShare,
    payoutRatio,
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

  // Phase 1: Ke (cost of equity) — used to discount equity-level P/E estimates.
  // Ke = Rf + β×ERP + CRP. Always higher than WACC because equity is a residual claim.
  const waccInputs = apiData.wacc?.inputs ?? {}
  const keComputed = (waccInputs.rfRate ?? 0.045) + (waccInputs.beta ?? 1.0) * (waccInputs.erp ?? 0.055) + crp
  const ke: number = apiData.wacc?.costOfEquity ?? keComputed

  // Phase 2: P/FFO multiple from industry medians (REITs only; benign default for other types)
  const industryMeds = getIndustryMultiples(industry ?? '', sector ?? '')
  const exitPFFOMultiple: number = industryMeds.pFfo ?? 16

  // P/B target for financial companies: blend current market P/B (55%) with sector default (45%).
  const FINANCIAL_SECTORS_PB: Record<string, number> = {
    'Financial Services': 1.8,
    'Banks': 1.2,
    'Insurance': 1.4,
    'Financial': 1.5,
  }
  const sectorDefaultPB = FINANCIAL_SECTORS_PB[sector ?? ''] ?? null
  let priceToBookMultiple: number | undefined = sectorDefaultPB ?? undefined
  if (sectorDefaultPB != null) {
    const bsRows: Array<{ isProjected?: boolean; totalEquity?: number | null }> =
      apiData.financialStatements?.balanceSheet ?? []
    const actualBSRows = bsRows.filter((r: { isProjected?: boolean }) => !r.isProjected)
    const lastEquity = actualBSRows[actualBSRows.length - 1]?.totalEquity ?? null
    const sharesRaw = ((apiData.businessProfile?.sharesOutstanding ?? 0) as number) * 1e6
    const bookPerShare = lastEquity != null && lastEquity > 0 && sharesRaw > 0
      ? (lastEquity as number) * 1e6 / sharesRaw
      : null
    const currentPrice = apiData.quote?.price ?? null
    const currentPB = currentPrice != null && bookPerShare != null && bookPerShare > 0
      ? currentPrice / bookPerShare
      : null
    if (currentPB != null && currentPB > 0) {
      priceToBookMultiple = currentPB * 0.55 + sectorDefaultPB * 0.45
    }
  }

  return {
    wacc:            apiData.wacc?.wacc ?? 0.10,
    ke,
    cagr:            apiData.cagr ?? fwdPEBase.revenueCAGR,
    terminalG:       apiData.terminalG ?? 0.03,
    netMargin:       fwdPEBase.netMargin,
    dilutionRate:    fwdPEBase.dilutionRate,
    exitPE:          fwdPEBase.exitPE,
    exitMultiple,
    revenueMultiple: revMultBase.exitEVRevenue,
    priceToBookMultiple,
    exitPFFOMultiple,
  }
}
