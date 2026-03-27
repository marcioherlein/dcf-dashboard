import { NextRequest, NextResponse } from 'next/server'
import { getFinancials, getQuote, getHistorical, getSPYHistorical, getFXRate, getPeerQuotes } from '@/lib/data/yahooClient'
import { calculateBeta } from '@/lib/dcf/calculateBeta'
import { calculateWACC, extractWACCInputs } from '@/lib/dcf/calculateWACC'
import { projectCashFlows, extractFCFInputs } from '@/lib/dcf/projectCashFlows'
import { calculateFairValue, buildScenarios } from '@/lib/dcf/calculateFairValue'
import { calculateRatings } from '@/lib/dcf/calculateRatings'
import { getRfRate } from '@/lib/data/fredClient'
import { detectCompanyType, primaryModelLabel, companyTypeLabel, companyTypeRationale, getModelWeights } from '@/lib/dcf/detectCompanyType'
import { calculateDDM } from '@/lib/dcf/calculateDDM'
import { calculateFCFE } from '@/lib/dcf/calculateFCFE'
import { calculateMultiples, PEER_TICKERS } from '@/lib/dcf/calculateMultiples'
import { calculatePiotroski, calculateAltman, calculateBeneish, calculateROIC } from '@/lib/dcf/calculateScores'

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  try {
    const [financials, quote, stockHistory, spyHistory, rfRate] = await Promise.all([
      getFinancials(ticker),
      getQuote(ticker),
      getHistorical(ticker, '5y'),
      getSPYHistorical(),
      getRfRate(),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fin = financials as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quote as any
    const currentPrice = (q.regularMarketPrice ?? 0) as number
    const quoteCurrency: string = q.currency ?? 'USD'

    // --- Currency mismatch detection (e.g. BABA reports in CNY but trades in USD) ---
    const financialCurrency: string = fin.financialData?.financialCurrency ?? quoteCurrency
    let fxRate = 1 // multiplier to convert financial figures → quote currency
    let financialCurrencyNote = ''
    if (financialCurrency !== quoteCurrency) {
      fxRate = await getFXRate(financialCurrency, quoteCurrency)
      financialCurrencyNote = `${financialCurrency}→${quoteCurrency} @ ${fxRate.toFixed(4)}`
    }

    // Beta via regression
    const beta = calculateBeta(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stockHistory as any[]).map((p) => ({ date: new Date(p.date), close: p.close ?? p.adjclose ?? 0 })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (spyHistory as any[]).map((p) => ({ date: new Date(p.date), close: p.close ?? p.adjclose ?? 0 })),
    )

    // WACC (uses percentages/ratios — not currency-sensitive)
    const waccInputs = extractWACCInputs(fin, rfRate, beta)
    const waccResult = calculateWACC(waccInputs)

    // FCF + CAGR — values are in financial currency; convert to quote currency
    const { baseFCF: baseFCFLocal, cagr, cagrAnalysis, historicalRevenues: historicalRevenuesLocal, isNegativeFCF, normalizedNetIncomeM: normalizedNetIncomeMLocal } = extractFCFInputs(fin)
    let baseFCF = baseFCFLocal * fxRate
    const historicalRevenues = historicalRevenuesLocal.map((r) => r * fxRate)
    const normalizedNetIncomeM = normalizedNetIncomeMLocal * fxRate

    // Sanity check: FCF yield > 30% vs market cap is unrealistic — cap to 15%
    const marketCapM = (q.marketCap ?? 0) / 1e6
    if (marketCapM > 0 && baseFCF / marketCapM > 0.30) {
      baseFCF = marketCapM * 0.15
    }

    // DCF (FCFF)
    // Terminal growth aligned with Damodaran: should approximate long-run nominal GDP growth.
    // High-growth companies (>15% CAGR) → 2.5% (emerging/global nominal GDP)
    // Standard companies (5–15% CAGR) → 2.0% (developed market nominal GDP)
    // Mature / low-growth (<5%) → 1.5% (conservative / real GDP)
    const terminalG = cagr > 0.15 ? 0.025 : cagr > 0.05 ? 0.020 : 0.015
    // Growth model selection (Damodaran): three-stage when growth >> stable (CAGR > 15% or pre-profit).
    // companyType is detected later; cagr + isNegativeFCF covers all practical cases before that.
    const growthModel = (cagr > 0.15 || isNegativeFCF) ? 'three-stage' as const : 'two-stage' as const
    const dcfResult = projectCashFlows({ baseFCF, cagr, wacc: waccResult.wacc, terminalG, growthModel })

    // Balance sheet items — convert to quote currency
    const bs = fin.balanceSheetHistory?.balanceSheetStatements?.[0] ?? {}
    const cashM = ((
      bs.cash
      ?? bs.cashAndCashEquivalents
      ?? bs.cashAndShortTermInvestments
      ?? bs.cashCashEquivalentsAndShortTermInvestments
      ?? bs.cashAndCashEquivalentsAtCarryingValue
      ?? 0
    ) as number) / 1e6 * fxRate

    // Detect financial sector here for balance sheet treatment
    const isBankOrInsurer = /bank|insurance|financ|fintech|payment|credit|lending|capital market|asset management|brokerage/i.test(
      ((fin.summaryProfile?.sector ?? '') as string) + ' ' + ((fin.summaryProfile?.industry ?? '') as string)
    )
    // For financial companies: use only long-term issued debt (bonds/notes).
    // fd.totalDebt and bs.totalDebt for banks can include deposit liabilities or
    // interbank borrowings that inflate D/V, collapse WACC, and produce a gigantic
    // EV that is then wiped out by subtracting that same "debt" → negative equity.
    // Yahoo Finance uses inconsistent field names across company types and regions.
    // Extend fallback chains to catch all known variants.
    const rawDebtM = isBankOrInsurer
      ? ((bs.longTermDebt ?? bs.longTermDebtNoncurrent ?? bs.longTermDebtAndCapitalLeaseObligation ?? bs.totalDebt ?? 0) as number) / 1e6 * fxRate
      : ((bs.totalDebt ?? bs.longTermDebt ?? bs.longTermDebtAndCapitalLeaseObligation ?? bs.totalLongTermDebt ?? bs.shortLongTermDebtTotal ?? bs.longTermDebtTotal ?? bs.currentDebt ?? 0) as number) / 1e6 * fxRate
    // Safety cap: debt should not exceed 3× market cap (prevents extreme leverage edge cases)
    const debtM = marketCapM > 0 ? Math.min(rawDebtM, marketCapM * 3) : rawDebtM

    const sharesM = ((fin.defaultKeyStatistics?.sharesOutstanding ?? 0) as number) / 1e6

    // Fair value (FCFF)
    const fvResult = calculateFairValue(dcfResult, cashM, debtM, sharesM, currentPrice)

    // Scenarios
    const scenarios = buildScenarios(waccResult, cagr, terminalG, baseFCF, cashM, debtM, sharesM, 0, growthModel)

    // Business profile
    const fd = fin.financialData ?? {}
    const profile = fin.summaryProfile ?? {}
    const sd = fin.summaryDetail ?? {}
    const ks = fin.defaultKeyStatistics ?? {}
    const rawFCFLocal = ((fd.freeCashflow ?? 0) as number) / 1e6
    const rawRevMLocal = ((fd.totalRevenue ?? 0) as number) / 1e6

    // Compute FCF from most recent annual cash flow statement (more reliable than Yahoo's TTM freeCashflow,
    // which is distorted for fintechs/payments companies where loan originations flow through operating activities)
    const rawCFHistoryEarly: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []
    const recentCF = rawCFHistoryEarly[0] ?? {}
    const recentOpCF = ((recentCF.operatingCashflow ?? recentCF.totalCashFromOperatingActivities ?? fd.operatingCashflow ?? 0) as number)
    const recentCapex = ((recentCF.capitalExpenditures ?? recentCF.capitalExpenditure ?? 0) as number)
    // annualFCFLocal = OCF + CapEx (CapEx is stored negative in Yahoo data, so this is OCF - |CapEx|)
    const annualFCFLocal = recentOpCF !== 0 ? (recentOpCF + recentCapex) / 1e6 : rawFCFLocal

    const businessProfile = {
      description: (profile.longBusinessSummary ?? '') as string,
      industry: (profile.industry ?? '') as string,
      country: (profile.country ?? '') as string,
      employees: (profile.fullTimeEmployees ?? null) as number | null,
      // Treat 0 as null — Yahoo returns 0 for banks/fintechs that don't have COGS
      grossMargin: (fd.grossMargins != null && fd.grossMargins !== 0) ? (fd.grossMargins as number) : null,
      netMargin: (fd.profitMargins ?? null) as number | null,
      fcfMargin: rawRevMLocal > 0 && annualFCFLocal !== 0 ? annualFCFLocal / rawRevMLocal : null,
      revenueM: rawRevMLocal * fxRate,
    }

    // Ratings
    const ratings = calculateRatings({
      grossMargin: (fd.grossMargins ?? null) as number | null,
      netMargin: (fd.profitMargins ?? null) as number | null,
      fcfMargin: rawRevMLocal > 0 ? annualFCFLocal / rawRevMLocal : null,
      operatingMargin: (fd.operatingMargins ?? null) as number | null,
      roe: (fd.returnOnEquity ?? null) as number | null,
      roa: (fd.returnOnAssets ?? null) as number | null,
      currentRatio: (fd.currentRatio ?? null) as number | null,
      quickRatio: (fd.quickRatio ?? null) as number | null,
      cashM,
      debtM,
      historicalCagr3y: cagrAnalysis.historicalCagr3y,
      analystGrowth1y: cagrAnalysis.analystEstimate1y,
      // Suppress TTM earnings growth from the rating SCORE when the company has strong
      // historical revenue CAGR (>15%) but negative TTM EPS — common for high-growth
      // companies hit by FX headwinds, fintech loan-loss provisions, or one-time charges.
      // earningsGrowthDisplay preserves the raw value so the UI still shows the actual number.
      earningsGrowth: (() => {
        const eg = (fd.earningsGrowth ?? null) as number | null
        if (eg !== null && eg < 0 && cagrAnalysis.historicalCagr3y > 0.15) return null
        return eg
      })(),
      earningsGrowthDisplay: (fd.earningsGrowth ?? null) as number | null,
      beta: waccResult.inputs.beta,
      marketCapB: (q.marketCap ?? 0) / 1e9,
      upsidePct: fvResult.upsidePct,
    })

    // ─── Financial Quality Scores ─────────────────────────────────────────────

    const rawBSStmts: any[] = fin.balanceSheetHistory?.balanceSheetStatements ?? []
    const rawISStmts: any[] = fin.incomeStatementHistory?.incomeStatementHistory ?? []
    const rawCFStmts: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []

    // Market cap in financial (reporting) currency for Altman Z-Score comparability
    const marketCapLocal = (q.marketCap ?? 0) / fxRate
    const sharesNow = (ks.sharesOutstanding ?? 0) as number
    // Estimate prior-year shares: check cash flow for net buybacks/issuances as signal
    // If net repurchases > 0 (Yahoo shows buybacks as negative), shares fell → pass dilution check
    const netBuybackM = Math.abs(((rawCFStmts[0]?.repurchaseOfStock ?? 0) as number) / 1e6)
    const netIssuanceM = ((rawCFStmts[0]?.issuanceOfStock ?? 0) as number) / 1e6
    // Approximate prior shares: add back net dilution (positive = more shares, negative = fewer)
    const sharesPrior = sharesNow + (netIssuanceM - netBuybackM) * 1e6

    const piotroski = calculatePiotroski(rawBSStmts, rawISStmts, rawCFStmts, sharesNow, sharesPrior)
    const altman = calculateAltman(rawBSStmts[0] ?? {}, rawISStmts[0] ?? {}, marketCapLocal)
    const beneish = rawBSStmts.length >= 2 && rawISStmts.length >= 2
      ? calculateBeneish(rawBSStmts[0], rawBSStmts[1], rawISStmts[0], rawISStmts[1], rawCFStmts[0] ?? {})
      : null
    const roicResult = calculateROIC(rawBSStmts[0] ?? {}, rawBSStmts[1] ?? {}, rawISStmts[0] ?? {}, waccResult.inputs.taxRate, waccResult.wacc, fxRate)

    const scores = { piotroski, altman, beneish, roic: roicResult }

    // ─── Ownership & Short Interest ───────────────────────────────────────────

    const holders = fin.majorHoldersBreakdown ?? {}
    const ownership = {
      insiderPct: (holders.insidersPercentHeld ?? null) as number | null,
      institutionalPct: (holders.institutionsPercentHeld ?? null) as number | null,
      shortPct: (ks.shortPercentOfFloat ?? null) as number | null,
      shortRatio: (ks.shortRatio ?? null) as number | null,
      sharesShort: (ks.sharesShort ?? null) as number | null,
    }

    // ─── Multi-model valuation ─────────────────────────────────────────────────

    // Dividend data (from summaryDetail)
    const dividendPerShare = ((sd.dividendRate ?? sd.trailingAnnualDividendRate ?? 0) as number)
    const dividendYield = (sd.dividendYield ?? null) as number | null
    const payoutRatio = ((sd.payoutRatio ?? 0) as number)

    // Current multiples (from existing modules)
    const trailingPE = (q.trailingPE ?? null) as number | null
    const priceToBook = (ks.priceToBook ?? null) as number | null
    const priceToSales = (ks.priceToSalesTrailing12Months ?? null) as number | null
    const evToEbitda = (fd.enterpriseToEbitda ?? null) as number | null
    const evToRevenue = (fd.enterpriseToRevenue ?? null) as number | null

    // Net income for FCFE — use normalizedNetIncomeM (2-year avg from income stmt).
    // fd.netIncomeToCommon from financialData is null for many banks (Yahoo doesn't always
    // populate it) and can be 0, causing FCFE to incorrectly report "net income is negative".
    // The income statement history is a more reliable source.
    const netIncomeM = normalizedNetIncomeM > 0
      ? normalizedNetIncomeM
      : Math.max(((fd.netIncomeToCommon ?? 0) as number) / 1e6 * fxRate, 0)

    // Company type detection
    const companyType = detectCompanyType({
      sector: profile.sector ?? q.sector ?? '',
      industry: profile.industry ?? '',
      dividendYield,
      payoutRatio,
      historicalCagr3y: cagrAnalysis.historicalCagr3y,
      analystEstimate1y: cagrAnalysis.analystEstimate1y,
      isNegativeFCF,
      revenueM: rawRevMLocal * fxRate,
    })

    const hasDividend = dividendPerShare > 0

    // DDM
    const roe = (fd.returnOnEquity ?? null) as number | null
    const ddmResult = calculateDDM(dividendPerShare, waccResult.costOfEquity, roe, payoutRatio, currentPrice)

    // FCFE
    const fcfeResult = calculateFCFE(netIncomeM, cagr, waccResult.costOfEquity, terminalG, cashM, debtM, sharesM, currentPrice)

    // Relative multiples — with live peer comparison
    const industry = (profile.industry ?? '') as string
    const candidatePeers = (PEER_TICKERS[industry] ?? []).filter(
      (t) => t !== ticker
    ).slice(0, 6)

    let livePeers: Awaited<ReturnType<typeof getPeerQuotes>> = []
    if (candidatePeers.length >= 3) {
      // Non-blocking: peer fetch failure falls back to static medians
      livePeers = await getPeerQuotes(candidatePeers).catch(() => [])
    }

    const multiplesResult = calculateMultiples({
      sector: (profile.sector ?? q.sector ?? '') as string,
      industry,
      companyType,
      currentPrice,
      trailingPE,
      priceToBook,
      priceToSales,
      evToEbitda,
      evToRevenue,
      livePeers,
    })

    // Triangulation
    const weights = getModelWeights(companyType, hasDividend)
    const modelValues: { weight: number; value: number }[] = []

    // FCFF always applicable
    modelValues.push({ weight: weights.fcff, value: fvResult.fairValuePerShare })

    if (fcfeResult.applicable) {
      modelValues.push({ weight: weights.fcfe, value: fcfeResult.fairValuePerShare })
    }
    if (ddmResult.applicable) {
      modelValues.push({ weight: weights.ddm, value: ddmResult.fairValuePerShare })
    }
    if (multiplesResult.blendedFairValue !== null) {
      modelValues.push({ weight: weights.multiples, value: multiplesResult.blendedFairValue })
    }

    // Normalize weights to what's actually applicable
    const totalWeight = modelValues.reduce((s, m) => s + m.weight, 0)
    const triangulatedFairValue = totalWeight > 0
      ? Math.round(modelValues.reduce((s, m) => s + (m.value * m.weight) / totalWeight, 0) * 100) / 100
      : fvResult.fairValuePerShare
    const triangulatedUpsidePct = currentPrice > 0
      ? Math.round((triangulatedFairValue - currentPrice) / currentPrice * 1000) / 1000
      : 0

    const effectiveWeights = {
      fcff: totalWeight > 0 ? Math.round(weights.fcff / totalWeight * 100) : 100,
      fcfe: fcfeResult.applicable && totalWeight > 0 ? Math.round(weights.fcfe / totalWeight * 100) : 0,
      ddm: ddmResult.applicable && totalWeight > 0 ? Math.round(weights.ddm / totalWeight * 100) : 0,
      multiples: multiplesResult.blendedFairValue !== null && totalWeight > 0
        ? Math.round(weights.multiples / totalWeight * 100) : 0,
    }

    const valuationMethods = {
      companyType,
      companyTypeLabel: companyTypeLabel(companyType),
      primaryModelLabel: primaryModelLabel(companyType, hasDividend),
      rationale: companyTypeRationale(companyType),
      triangulatedFairValue,
      triangulatedUpsidePct,
      effectiveWeights,
      models: {
        fcff: {
          fairValue: fvResult.fairValuePerShare,
          upsidePct: fvResult.upsidePct,
          applicable: true,
          reason: 'FCFF DCF: Free Cash Flow to Firm discounted at WACC',
        },
        fcfe: fcfeResult,
        ddm: ddmResult,
        multiples: multiplesResult,
      },
    }

    // ─── Financial Statements ──────────────────────────────────────────────────

    // --- Income Statement ---
    const rawISHistory: any[] = fin.incomeStatementHistory?.incomeStatementHistory ?? []
    const isHistorical = rawISHistory.slice(-4).reverse()

    // Compute historical average margins for projections
    const avgGrossMarginRatio = isHistorical.length > 0
      ? isHistorical.reduce((s: number, s2: any) => {
          const rev = (s2.totalRevenue ?? 0) as number
          const gp = (s2.grossProfit ?? 0) as number
          return s + (rev > 0 ? gp / rev : 0)
        }, 0) / isHistorical.length
      : 0.4
    const avgOpMarginRatio = isHistorical.length > 0
      ? isHistorical.reduce((s: number, s2: any) => {
          const rev = (s2.totalRevenue ?? 0) as number
          const op = (s2.ebit ?? 0) as number
          return s + (rev > 0 ? op / rev : 0)
        }, 0) / isHistorical.length
      : 0.15
    const avgEbitdaMarginRatio = isHistorical.length > 0
      ? isHistorical.reduce((s: number, s2: any) => {
          const rev = (s2.totalRevenue ?? 0) as number
          const eb = (s2.ebitda ?? 0) as number
          return s + (rev > 0 ? eb / rev : 0)
        }, 0) / isHistorical.length
      : 0.2
    const avgNetMarginRatio = isHistorical.length > 0
      ? isHistorical.reduce((s: number, s2: any) => {
          const rev = (s2.totalRevenue ?? 0) as number
          const ni = (s2.netIncome ?? 0) as number
          return s + (rev > 0 ? ni / rev : 0)
        }, 0) / isHistorical.length
      : 0.1

    const latestRevM = isHistorical.length > 0
      ? ((isHistorical[isHistorical.length - 1].totalRevenue ?? 0) as number) / 1e6 * fxRate
      : historicalRevenues[0] ?? 0

    // Build depreciation lookup from cashflow history for EBITDA = EBIT + D&A
    const rawCFForEbitda: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []
    const depreciationByYear: Record<string, number> = {}
    for (const cf of rawCFForEbitda) {
      const yr = String(new Date(cf.endDate).getFullYear())
      const da = ((cf.depreciation ?? cf.depreciationAndAmortization ?? 0) as number) / 1e6 * fxRate
      if (da > 0) depreciationByYear[yr] = da
    }

    // Helper: treat 0 the same as null for non-revenue income fields.
    // Yahoo returns 0 for banks/fintechs that lack traditional COGS / EBIT structure.
    const nonzero = (v: number | null | undefined) => (v != null && v !== 0) ? v : null

    const isHistoricalRows = isHistorical.map((s: any) => {
      const yr = String(new Date(s.endDate).getFullYear())
      const revRaw = nonzero(s.totalRevenue)
      // Gross profit: use direct field or compute Revenue − COGS
      const gpDirect = nonzero(s.grossProfit)
      const gpComputed = (s.totalRevenue != null && (s.costOfRevenue ?? s.costOfGoodsSold) != null)
        ? s.totalRevenue - (s.costOfRevenue ?? s.costOfGoodsSold ?? 0)
        : null
      const gpRaw = gpDirect ?? nonzero(gpComputed)
      const ebitRaw = nonzero(s.ebit ?? s.operatingIncome)
      // EBITDA: prefer Yahoo's field, else compute EBIT + D&A
      const ebitdaRaw = nonzero(s.ebitda) ?? nonzero(s.normalizedEbitda) ??
        (ebitRaw != null && depreciationByYear[yr] ? ebitRaw + depreciationByYear[yr] * 1e6 : null)
      return {
        year: yr,
        revenue: revRaw != null ? revRaw / 1e6 * fxRate : null,
        grossProfit: gpRaw != null ? gpRaw / 1e6 * fxRate : null,
        operatingIncome: ebitRaw != null ? ebitRaw / 1e6 * fxRate : null,
        ebitda: ebitdaRaw != null ? ebitdaRaw / 1e6 * fxRate : null,
        netIncome: s.netIncome != null ? (s.netIncome as number) / 1e6 * fxRate : null,
        eps: s.dilutedEps != null ? (s.dilutedEps as number) : null,
        isProjected: false,
      }
    })

    const baseYear = isHistorical.length > 0
      ? new Date(isHistorical[isHistorical.length - 1].endDate).getFullYear()
      : new Date().getFullYear()

    const isProjectedRows = Array.from({ length: 5 }, (_, idx) => {
      const t = idx + 1
      const projRevM = latestRevM * Math.pow(1 + cagr, t)
      const projNetIncomeM = projRevM * avgNetMarginRatio
      // Only show margin-derived lines if historical data existed (non-zero avg margin)
      return {
        year: `${baseYear + t}E`,
        revenue: Math.round(projRevM),
        grossProfit: avgGrossMarginRatio > 0 ? Math.round(projRevM * avgGrossMarginRatio) : null,
        operatingIncome: avgOpMarginRatio !== 0 ? Math.round(projRevM * avgOpMarginRatio) : null,
        ebitda: avgEbitdaMarginRatio > 0 ? Math.round(projRevM * avgEbitdaMarginRatio) : null,
        netIncome: Math.round(projNetIncomeM),
        eps: sharesM > 0 ? Math.round((projNetIncomeM / sharesM) * 100) / 100 : null,
        isProjected: true,
      }
    })

    const incomeStatement = [...isHistoricalRows, ...isProjectedRows]

    // --- Balance Sheet ---
    const rawBSHistory: any[] = fin.balanceSheetHistory?.balanceSheetStatements ?? []
    const bsHistorical = rawBSHistory.slice(-4).reverse()

    const bsHistoricalRows = bsHistorical.map((s: any) => ({
      year: String(new Date(s.endDate).getFullYear()),
      cash: (() => {
        const v = s.cash ?? s.cashAndCashEquivalents ?? s.cashAndShortTermInvestments ?? s.cashCashEquivalentsAndShortTermInvestments ?? s.cashAndCashEquivalentsAtCarryingValue
        return v != null ? (v as number) / 1e6 * fxRate : null
      })(),
      totalCurrentAssets: s.totalCurrentAssets != null ? (s.totalCurrentAssets as number) / 1e6 * fxRate : null,
      totalAssets: s.totalAssets != null ? (s.totalAssets as number) / 1e6 * fxRate : null,
      longTermDebt: s.longTermDebt != null ? (s.longTermDebt as number) / 1e6 * fxRate : null,
      totalCurrentLiabilities: s.totalCurrentLiabilities != null ? (s.totalCurrentLiabilities as number) / 1e6 * fxRate : null,
      totalEquity: (s.totalStockholderEquity ?? s.stockholdersEquity) != null ? ((s.totalStockholderEquity ?? s.stockholdersEquity) as number) / 1e6 * fxRate : null,
      isProjected: false,
    }))

    // Projected balance sheet (only if sufficient history)
    let bsProjectedRows: typeof bsHistoricalRows = []
    if (bsHistoricalRows.length >= 2) {
      const lastBS = bsHistoricalRows[bsHistoricalRows.length - 1]
      // Estimate historical avg dividends from cash flow for balance sheet projections
      const rawCFHistForBS: any[] = fin.cashflowStatementHistory?.cashflowStatements ?? []
      const avgDivPaidM = rawCFHistForBS.length > 0
        ? rawCFHistForBS.reduce((s: number, s2: any) => s + Math.abs((s2.dividendsPaid ?? 0) as number) / 1e6 * fxRate, 0) / rawCFHistForBS.length
        : 0

      let prevCash = lastBS.cash ?? 0
      let prevEquity = lastBS.totalEquity ?? 0
      let prevAssets = lastBS.totalAssets ?? 0
      const projDebt = lastBS.longTermDebt

      bsProjectedRows = Array.from({ length: 5 }, (_, idx) => {
        const t = idx + 1
        const projFCF = dcfResult.projections[t - 1]?.cashFlow ?? 0
        const projRevM = latestRevM * Math.pow(1 + cagr, t)
        const projNetIncomeM = projRevM * avgNetMarginRatio

        const newCash = prevCash + projFCF - avgDivPaidM
        const newEquity = prevEquity + projNetIncomeM - avgDivPaidM
        const newAssets = prevAssets + projFCF

        const row = {
          year: `${baseYear + t}E`,
          cash: newCash,
          totalCurrentAssets: null,
          totalAssets: newAssets,
          longTermDebt: projDebt,
          totalCurrentLiabilities: null,
          totalEquity: newEquity,
          isProjected: true,
        }

        prevCash = newCash
        prevEquity = newEquity
        prevAssets = newAssets
        return row
      })
    }

    const balanceSheet = [...bsHistoricalRows, ...bsProjectedRows]

    // --- Cash Flow ---
    const rawCFHistory: any[] = rawCFHistoryEarly
    const cfHistorical = rawCFHistory.slice(-4).reverse()

    const avgCapexM = cfHistorical.length > 0
      ? cfHistorical.reduce((s: number, s2: any) => s + ((s2.capitalExpenditures ?? s2.capitalExpenditure ?? s2.purchaseOfPlantPropertyEquipment ?? 0) as number) / 1e6 * fxRate, 0) / cfHistorical.length
      : 0
    const avgDivPaidM = cfHistorical.length > 0
      ? cfHistorical.reduce((s: number, s2: any) => s + ((s2.dividendsPaid ?? 0) as number) / 1e6 * fxRate, 0) / cfHistorical.length
      : 0

    const cfHistoricalRows = cfHistorical.map((s: any) => {
      // Yahoo Finance / yahoo-finance2 uses varying field names across versions and company types
      const rawOpCF = s.operatingCashflow ?? s.totalCashFromOperatingActivities ?? s.netCashProvidedByOperatingActivities ?? s.cashFromOperations ?? s.cashGeneratedFromOperations
      const rawCapex = s.capitalExpenditures ?? s.capitalExpenditure ?? s.purchaseOfPlantPropertyEquipment ?? s.paymentsToAcquirePropertyPlantAndEquipment
      const rawInvCF = s.totalCashflowsFromInvestingActivities ?? s.totalCashFromInvestingActivities ?? s.netCashUsedForInvestingActivities ?? s.cashUsedForInvestingActivities
      const rawFinCF = s.totalCashFromFinancingActivities ?? s.netCashUsedProvidedByFinancingActivities ?? s.cashUsedProvidedByFinancingActivities
      const rawDivPaid = s.dividendsPaid ?? s.paymentOfDividends ?? s.paymentsForDividends

      const opCF   = rawOpCF  != null ? (rawOpCF  as number) / 1e6 * fxRate : null
      const capex  = rawCapex != null ? (rawCapex as number) / 1e6 * fxRate : null
      return {
        year: String(new Date(s.endDate).getFullYear()),
        operatingCF: opCF,
        capex: capex,
        // FCF = OCF + capex (capex is negative in Yahoo's data)
        freeCashFlow: opCF != null && capex != null ? Math.round(opCF + capex) : opCF,
        investingCF: rawInvCF != null ? (rawInvCF as number) / 1e6 * fxRate : null,
        financingCF: rawFinCF != null ? (rawFinCF as number) / 1e6 * fxRate : null,
        dividendsPaid: rawDivPaid != null ? (rawDivPaid as number) / 1e6 * fxRate : null,
        isProjected: false,
      }
    })

    const cfProjectedRows = Array.from({ length: 5 }, (_, idx) => {
      const t = idx + 1
      const projFCF = dcfResult.projections[t - 1]?.cashFlow ?? 0
      // capex is negative in Yahoo data; avgCapexM is negative (or 0 for fintechs)
      const hasCapex = avgCapexM !== 0
      const projOpCF = hasCapex ? projFCF - avgCapexM : projFCF
      return {
        year: `${baseYear + t}E`,
        operatingCF: Math.round(projOpCF),
        capex: hasCapex ? Math.round(avgCapexM) : null,
        freeCashFlow: Math.round(projFCF),
        investingCF: null,
        financingCF: null,
        dividendsPaid: avgDivPaidM !== 0 ? Math.round(avgDivPaidM) : null,
        isProjected: true,
      }
    })

    const cashFlow = [...cfHistoricalRows, ...cfProjectedRows]

    const financialStatements = { incomeStatement, balanceSheet, cashFlow }

    return NextResponse.json({
      ticker,
      companyName: q.longName ?? q.shortName ?? ticker,
      quote: {
        price: currentPrice,
        change: q.regularMarketChange ?? 0,
        changePct: q.regularMarketChangePercent ?? 0,
        marketCap: q.marketCap ?? 0,
        peRatio: q.trailingPE ?? null,
        fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
        analystTargetMean: fin.financialData?.targetMeanPrice ?? null,
        currency: quoteCurrency,
        sector: q.sector ?? '',
      },
      wacc: waccResult,
      dcf: dcfResult,
      fairValue: fvResult,
      scenarios,
      baseFCF,
      cagr,
      cagrAnalysis,
      isNegativeFCF,
      terminalG,
      historicalRevenues,
      businessProfile,
      analystRecommendation: fin.financialData?.recommendationKey ?? '',
      financialCurrencyNote,
      growthModel,
      ratings,
      scores,
      ownership,
      valuationMethods,
      financialStatements,
    })
  } catch (err) {
    console.error(`Financials error for ${ticker}:`, err)
    return NextResponse.json({ error: 'Failed to fetch data', details: String(err) }, { status: 500 })
  }
}
