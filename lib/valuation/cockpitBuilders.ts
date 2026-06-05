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
  let baseFCF = (typeof ttmFCFRaw === 'number' && isFinite(ttmFCFRaw) && ttmFCFRaw > 0)
    ? ttmFCFRaw / 1e6
    : (apiData.baseFCF ?? 0)

  // Financial company FCF guard: operating CF for banks/fintechs includes customer deposit
  // inflows and credit portfolio expansion — funding flows that inflate FCF 5-8× vs true
  // earnings power. When companyType is financial/fintech, correct to net-income-based FCFE.
  const companyTypeForFCF = apiData.valuationMethods?.companyType ?? 'standard'
  const FINANCIAL_CT = new Set(['financial', 'fintech', 'bdc', 'mreeit'])
  const FINANCIAL_SECT_RE = /financ|bank|insur/i
  const isFinancialForFCF = FINANCIAL_CT.has(companyTypeForFCF) ||
    FINANCIAL_SECT_RE.test(apiData.quote?.sector ?? '')
  if (isFinancialForFCF && baseFCF > 0) {
    // TTM net income from quarterly data (already in $M via normalizedNetIncomeM if available)
    const normalizedNIM: number = (apiData.normalizedNetIncomeM as number | undefined) ?? 0
    const qIncomeFCF: Array<{ netIncome?: number | null }> = apiData.incomeStatementQuarterly ?? []
    const last4FCF = qIncomeFCF.slice(0, 4)
    const qNISum = last4FCF.length === 4 && last4FCF.every(q => typeof q.netIncome === 'number')
      ? last4FCF.reduce((s, q) => s + (q.netIncome as number), 0)
      : null
    const niM = normalizedNIM > 0 ? normalizedNIM : (qNISum != null ? qNISum : null)
    if (niM != null && niM > 0) {
      // Dynamic reinvestment rate: fast-growing lending platforms need to retain more earnings
      // to fund regulatory capital requirements for their expanding loan books.
      // Fixed 20% was causing SOFI FCFE to be overstated ~100% and NU ~65%.
      //
      // Scaling rule: at 25%+ CAGR (aggressive loan book growth), retain ~50% of earnings.
      // At 15% CAGR, retain ~30%. At baseline, retain ~20%.
      // Formula: reinvestRate = min(0.55, max(0.20, cagr × 2.0))
      // where cagr is sourced from cagrAnalysis.blended (already USD-adjusted).
      const blendedCagr: number = (apiData.cagrAnalysis?.blended as number | undefined) ?? 0
      const reinvestRate = companyTypeForFCF === 'fintech' || companyTypeForFCF === 'financial'
        ? Math.min(0.55, Math.max(0.20, blendedCagr * 2.0))
        : 0.20  // standard: financial companies with modest growth retain 20%
      const earningsBasedFCF = niM * (1 - reinvestRate)
      // Only override if the raw FCF is more than 3× the earnings-based estimate
      // (catches the NU case without affecting companies where Yahoo correctly reports FCF)
      if (baseFCF > earningsBasedFCF * 3) {
        baseFCF = earningsBasedFCF
      }
    }
  }

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
  let bookValuePerShare: number | null = lastBSEquity != null && lastBSEquity > 0 && sharesRaw != null && sharesRaw > 0
    ? (lastBSEquity * 1e6) / sharesRaw
    : null

  // Sanity cap: bookValuePerShare must be ≤ currentPrice × 4.
  // For some ADR / foreign-listed financial companies (e.g. NU), Yahoo's
  // totalStockholdersEquity field can map to total assets or consolidated equity
  // including minority interests, inflating book value 3–8× vs tangible common equity.
  // When the implied P/B at current price would be < 0.25, the book value is almost
  // certainly wrong. Cap at price × 2 as a conservative bound.
  const currentPriceForBVCheck = apiData.quote?.price ?? 0
  if (bookValuePerShare != null && currentPriceForBVCheck > 0) {
    const impliedPBAtCurrentPrice = currentPriceForBVCheck / bookValuePerShare
    if (impliedPBAtCurrentPrice < 0.25) {
      // Book value looks inflated — likely asset-side data instead of equity.
      // Use market-cap-based estimate: assume P/B = 1.5× for a financial and back-solve.
      // This gives a conservative book value that at least produces a sensible P/B range.
      bookValuePerShare = currentPriceForBVCheck / 1.5
    }
  }

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

  // P/B target for financial companies.
  // Priority: industry-level lookup (Banks—Diversified → 1.2×) before broad sector fallback
  // (Financial Services → 1.8×). Without this, BAC/JPM get 1.8× anchor even though they
  // are pure banks that trade at 1.0–1.4× book. The broad Financial Services default of 1.8×
  // is correct for fintech and diversified financial platforms, not commercial banks.
  const INDUSTRY_PB: Record<string, number> = {
    'Banks—Diversified':  1.2,
    'Banks—Regional':     1.1,
    'Banks - Diversified': 1.2,
    'Banks - Regional':   1.1,
    'Mortgage Finance':   1.1,
  }
  const FINANCIAL_SECTORS_PB: Record<string, number> = {
    'Financial Services': 1.8,
    'Banks': 1.2,
    'Insurance': 1.4,
    'Financial': 1.5,
  }
  // Industry takes priority over sector for bank-specific lookups
  const sectorDefaultPB = INDUSTRY_PB[industry ?? ''] ?? FINANCIAL_SECTORS_PB[sector ?? ''] ?? null
  let priceToBookMultiple: number | undefined = sectorDefaultPB ?? undefined
  if (sectorDefaultPB != null) {
    const bsRows2: Array<{ isProjected?: boolean; totalEquity?: number | null }> =
      apiData.financialStatements?.balanceSheet ?? []
    const actualBSRows2 = bsRows2.filter((r: { isProjected?: boolean }) => !r.isProjected)
    const lastEquity = actualBSRows2[actualBSRows2.length - 1]?.totalEquity ?? null
    const sharesRaw2 = ((apiData.businessProfile?.sharesOutstanding ?? 0) as number) * 1e6
    const bookPerShare2 = lastEquity != null && lastEquity > 0 && sharesRaw2 > 0
      ? (lastEquity as number) * 1e6 / sharesRaw2
      : null
    const currentPrice2 = apiData.quote?.price ?? null

    // Apply the same sanity cap as in buildSnapshot
    let effectiveBookPerShare = bookPerShare2
    if (effectiveBookPerShare != null && currentPrice2 != null && currentPrice2 > 0) {
      const impliedPB = currentPrice2 / effectiveBookPerShare
      if (impliedPB < 0.25) effectiveBookPerShare = currentPrice2 / 1.5
    }

    const currentPB = currentPrice2 != null && effectiveBookPerShare != null && effectiveBookPerShare > 0
      ? currentPrice2 / effectiveBookPerShare
      : null

    if (currentPB != null && currentPB > 0) {
      // For high-ROE fintechs (>25%), justified P/B dominates (70%) over market P/B
      // because the current market may misprice an early-stage high-ROE compounder
      const incomeForRoe: Array<{ isProjected?: boolean; netIncome?: number | null }> =
        apiData.financialStatements?.incomeStatement ?? []
      const lastNIM = incomeForRoe.filter((r: { isProjected?: boolean }) => !r.isProjected).slice(-1)[0]?.netIncome ?? null
      const roeEst = lastNIM != null && lastEquity != null && lastEquity > 0
        ? lastNIM / lastEquity
        : null
      const isHighROE = roeEst != null && roeEst > 0.25
      priceToBookMultiple = isHighROE
        ? currentPB * 0.35 + sectorDefaultPB * 0.65  // sector anchor dominates — we trust sector more than inflated current P/B
        : currentPB * 0.55 + sectorDefaultPB * 0.45
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
