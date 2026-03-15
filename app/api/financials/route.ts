import { NextRequest, NextResponse } from 'next/server'
import { getFinancials, getQuote, getHistorical, getSPYHistorical } from '@/lib/data/yahooClient'
import { calculateBeta } from '@/lib/dcf/calculateBeta'
import { calculateWACC, extractWACCInputs } from '@/lib/dcf/calculateWACC'
import { projectCashFlows, extractFCFInputs } from '@/lib/dcf/projectCashFlows'
import { calculateFairValue, buildScenarios } from '@/lib/dcf/calculateFairValue'
import { getRfRate } from '@/lib/data/fredClient'

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

    // Beta via regression
    const beta = calculateBeta(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stockHistory as any[]).map((p) => ({ date: new Date(p.date), close: p.close ?? p.adjclose ?? 0 })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (spyHistory as any[]).map((p) => ({ date: new Date(p.date), close: p.close ?? p.adjclose ?? 0 })),
    )

    // WACC
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const waccInputs = extractWACCInputs(financials as any, rfRate, beta)
    const waccResult = calculateWACC(waccInputs)

    // FCF + CAGR (enhanced with negative FCF handling and analysis)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { baseFCF, cagr, cagrAnalysis, historicalRevenues, isNegativeFCF } = extractFCFInputs(financials as any)

    // DCF
    const terminalG = 0.01
    const dcfResult = projectCashFlows({ baseFCF, cagr, wacc: waccResult.wacc, terminalG })

    // Balance sheet items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fin = financials as any
    const bs = fin.balanceSheetHistory?.balanceSheetStatements?.[0] ?? {}
    const cashM = ((bs.cash ?? bs.cashAndCashEquivalents ?? 0) as number) / 1e6
    const debtM = ((bs.totalDebt ?? bs.longTermDebt ?? 0) as number) / 1e6
    const sharesM = ((fin.defaultKeyStatistics?.sharesOutstanding ?? 0) as number) / 1e6
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quote as any
    const currentPrice = (q.regularMarketPrice ?? 0) as number

    // Fair value
    const fvResult = calculateFairValue(dcfResult, cashM, debtM, sharesM, currentPrice)

    // Scenarios
    const scenarios = buildScenarios(waccResult, cagr, terminalG, baseFCF, cashM, debtM, sharesM, 0)

    // Business profile from summaryProfile module
    const fd = fin.financialData ?? {}
    const profile = fin.summaryProfile ?? {}
    const rawFCF = ((fd.freeCashflow ?? 0) as number) / 1e6
    const rawRevM = ((fd.totalRevenue ?? 0) as number) / 1e6
    const businessProfile = {
      description: (profile.longBusinessSummary ?? '') as string,
      industry: (profile.industry ?? '') as string,
      country: (profile.country ?? '') as string,
      employees: (profile.fullTimeEmployees ?? null) as number | null,
      grossMargin: (fd.grossMargins ?? null) as number | null,
      netMargin: (fd.profitMargins ?? null) as number | null,
      fcfMargin: rawRevM > 0 ? rawFCF / rawRevM : null,
      revenueM: rawRevM,
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
        currency: q.currency ?? 'USD',
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
    })
  } catch (err) {
    console.error(`Financials error for ${ticker}:`, err)
    return NextResponse.json({ error: 'Failed to fetch data', details: String(err) }, { status: 500 })
  }
}
