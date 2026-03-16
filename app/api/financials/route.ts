import { NextRequest, NextResponse } from 'next/server'
import { getFinancials, getQuote, getHistorical, getSPYHistorical, getFXRate } from '@/lib/data/yahooClient'
import { calculateBeta } from '@/lib/dcf/calculateBeta'
import { calculateWACC, extractWACCInputs } from '@/lib/dcf/calculateWACC'
import { projectCashFlows, extractFCFInputs } from '@/lib/dcf/projectCashFlows'
import { calculateFairValue, buildScenarios } from '@/lib/dcf/calculateFairValue'
import { calculateRatings } from '@/lib/dcf/calculateRatings'
import { getRfRate } from '@/lib/data/fredClient'
import { detectCompanyType, primaryModelLabel, companyTypeLabel, companyTypeRationale, getModelWeights } from '@/lib/dcf/detectCompanyType'
import { calculateDDM } from '@/lib/dcf/calculateDDM'
import { calculateFCFE } from '@/lib/dcf/calculateFCFE'
import { calculateMultiples } from '@/lib/dcf/calculateMultiples'

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
    const terminalG = 0.01
    const dcfResult = projectCashFlows({ baseFCF, cagr, wacc: waccResult.wacc, terminalG })

    // Balance sheet items — convert to quote currency
    const bs = fin.balanceSheetHistory?.balanceSheetStatements?.[0] ?? {}
    const cashM = ((bs.cash ?? bs.cashAndCashEquivalents ?? 0) as number) / 1e6 * fxRate

    // Detect financial sector here for balance sheet treatment
    const isBankOrInsurer = /bank|insurance|financ|fintech|payment|credit|lending|capital market|asset management|brokerage/i.test(
      ((fin.summaryProfile?.sector ?? '') as string) + ' ' + ((fin.summaryProfile?.industry ?? '') as string)
    )
    // For financial companies: use only long-term issued debt (bonds/notes).
    // fd.totalDebt and bs.totalDebt for banks can include deposit liabilities or
    // interbank borrowings that inflate D/V, collapse WACC, and produce a gigantic
    // EV that is then wiped out by subtracting that same "debt" → negative equity.
    const rawDebtM = isBankOrInsurer
      ? ((bs.longTermDebt ?? bs.longTermDebtNoncurrent ?? bs.totalDebt ?? 0) as number) / 1e6 * fxRate
      : ((bs.totalDebt ?? bs.longTermDebt ?? 0) as number) / 1e6 * fxRate
    // Safety cap: debt should not exceed 3× market cap (prevents extreme leverage edge cases)
    const debtM = marketCapM > 0 ? Math.min(rawDebtM, marketCapM * 3) : rawDebtM

    const sharesM = ((fin.defaultKeyStatistics?.sharesOutstanding ?? 0) as number) / 1e6

    // Fair value (FCFF)
    const fvResult = calculateFairValue(dcfResult, cashM, debtM, sharesM, currentPrice)

    // Scenarios
    const scenarios = buildScenarios(waccResult, cagr, terminalG, baseFCF, cashM, debtM, sharesM, 0)

    // Business profile
    const fd = fin.financialData ?? {}
    const profile = fin.summaryProfile ?? {}
    const sd = fin.summaryDetail ?? {}
    const ks = fin.defaultKeyStatistics ?? {}
    const rawFCFLocal = ((fd.freeCashflow ?? 0) as number) / 1e6
    const rawRevMLocal = ((fd.totalRevenue ?? 0) as number) / 1e6
    const businessProfile = {
      description: (profile.longBusinessSummary ?? '') as string,
      industry: (profile.industry ?? '') as string,
      country: (profile.country ?? '') as string,
      employees: (profile.fullTimeEmployees ?? null) as number | null,
      grossMargin: (fd.grossMargins ?? null) as number | null,
      netMargin: (fd.profitMargins ?? null) as number | null,
      fcfMargin: rawRevMLocal > 0 ? rawFCFLocal / rawRevMLocal : null,
      revenueM: rawRevMLocal * fxRate,
    }

    // Ratings
    const ratings = calculateRatings({
      grossMargin: (fd.grossMargins ?? null) as number | null,
      netMargin: (fd.profitMargins ?? null) as number | null,
      fcfMargin: rawRevMLocal > 0 ? rawFCFLocal / rawRevMLocal : null,
      operatingMargin: (fd.operatingMargins ?? null) as number | null,
      roe: (fd.returnOnEquity ?? null) as number | null,
      roa: (fd.returnOnAssets ?? null) as number | null,
      currentRatio: (fd.currentRatio ?? null) as number | null,
      quickRatio: (fd.quickRatio ?? null) as number | null,
      cashM,
      debtM,
      historicalCagr3y: cagrAnalysis.historicalCagr3y,
      analystGrowth1y: cagrAnalysis.analystEstimate1y,
      earningsGrowth: (fd.earningsGrowth ?? null) as number | null,
      beta: waccResult.inputs.beta,
      marketCapB: (q.marketCap ?? 0) / 1e9,
      upsidePct: fvResult.upsidePct,
    })

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

    // Relative multiples
    const multiplesResult = calculateMultiples({
      sector: profile.sector ?? q.sector ?? '',
      companyType,
      currentPrice,
      trailingPE,
      priceToBook,
      priceToSales,
      evToEbitda,
      evToRevenue,
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
      ratings,
      valuationMethods,
    })
  } catch (err) {
    console.error(`Financials error for ${ticker}:`, err)
    return NextResponse.json({ error: 'Failed to fetch data', details: String(err) }, { status: 500 })
  }
}
