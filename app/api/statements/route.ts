import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

const PERIOD1 = '2015-01-01'

// Flow keys to sum for TTM (income statement)
const INCOME_FLOW_KEYS = [
  'totalRevenue','operatingRevenue','costOfRevenue','grossProfit',
  'operatingExpense','sellingGeneralAndAdministration','generalAndAdministrativeExpense',
  'otherGandA','sellingAndMarketingExpense','researchAndDevelopment',
  'operatingIncome','netNonOperatingInterestIncomeExpense','interestIncomeNonOperating',
  'interestExpenseNonOperating','interestExpense','interestIncome','netInterestIncome',
  'otherIncomeExpense','gainOnSaleOfSecurity','specialIncomeCharges','writeOff',
  'otherNonOperatingIncomeExpenses','pretaxIncome','taxProvision',
  'netIncome','netIncomeCommonStockholders','dilutedNIAvailtoComStockholders',
  'netIncomeContinuousOperations','netIncomeIncludingNoncontrollingInterests',
  'basicAverageShares','dilutedAverageShares',
  'EBIT','EBITDA','normalizedEBITDA','normalizedIncome',
  'totalExpenses','totalOperatingIncomeAsReported','reconciledDepreciation',
  'reconciledCostOfRevenue','taxEffectOfUnusualItems','totalUnusualItems',
  'totalUnusualItemsExcludingGoodwill',
]

// For EPS, use weighted average (last 4 quarters average, not sum)
const INCOME_AVG_KEYS = ['basicEPS','dilutedEPS','taxRateForCalcs']

// Flow keys to sum for TTM (cash flow)
const CF_FLOW_KEYS = [
  'operatingCashFlow','cashFlowFromContinuingOperatingActivities',
  'netIncomeFromContinuingOperations','depreciationAndAmortization',
  'depreciationAmortizationDepletion','stockBasedCompensation','deferredIncomeTax',
  'changeInWorkingCapital','changesInAccountReceivables','changeInInventory',
  'changeInReceivables','changeInPayablesAndAccruedExpense','changeInOtherWorkingCapital',
  'otherNonCashItems','incomeTaxPaidSupplementalData',
  'investingCashFlow','cashFlowFromContinuingInvestingActivities',
  'capitalExpenditure','purchaseOfPPE','netPPEPurchaseAndSale',
  'purchaseOfInvestment','saleOfInvestment','netInvestmentPurchaseAndSale',
  'netOtherInvestingChanges',
  'financingCashFlow','cashFlowFromContinuingFinancingActivities',
  'issuanceOfDebt','repaymentOfDebt','netIssuancePaymentsOfDebt',
  'netLongTermDebtIssuance','longTermDebtIssuance','longTermDebtPayments',
  'netShortTermDebtIssuance','netCommonStockIssuance',
  'repurchaseOfCapitalStock','commonStockPayments','commonStockDividendPaid',
  'cashDividendsPaid','netOtherFinancingCharges','changesInCash',
  'freeCashFlow',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsToTable(rows: any[]): any[] {
  return rows.map(r => {
    const d = r.date instanceof Date ? r.date : new Date(String(r.date))
    const endDate = isNaN(d.getTime()) ? String(r.date) : d.toISOString().split('T')[0]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { TYPE, date, periodType, ...rest } = r
    return { endDate, ...rest }
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumQuarters(quarters: any[], sumKeys: string[], avgKeys: string[]): Record<string, number | null> {
  if (quarters.length === 0) return {}
  const result: Record<string, number | null> = {}
  for (const key of sumKeys) {
    const vals = quarters.map(q => q[key]).filter((v): v is number => typeof v === 'number')
    result[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null
  }
  for (const key of avgKeys) {
    const vals = quarters.map(q => q[key]).filter((v): v is number => typeof v === 'number')
    result[key] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  return result
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  try {
    const [annualIS, quarterlyIS, annualBS, quarterlyBS, annualCF, quarterlyCF, quoteData] = await Promise.all([
      yf.fundamentalsTimeSeries(ticker, { type: 'annual',    module: 'financials',    period1: PERIOD1 }),
      yf.fundamentalsTimeSeries(ticker, { type: 'quarterly', module: 'financials',    period1: PERIOD1 }),
      yf.fundamentalsTimeSeries(ticker, { type: 'annual',    module: 'balance-sheet', period1: PERIOD1 }),
      yf.fundamentalsTimeSeries(ticker, { type: 'quarterly', module: 'balance-sheet', period1: PERIOD1 }),
      yf.fundamentalsTimeSeries(ticker, { type: 'annual',    module: 'cash-flow',     period1: PERIOD1 }),
      yf.fundamentalsTimeSeries(ticker, { type: 'quarterly', module: 'cash-flow',     period1: PERIOD1 }),
      yf.quote(ticker, ['financialCurrency', 'currency']).catch(() => null),
    ])

    const annualISRows    = rowsToTable(annualIS)
    const quarterlyISRows = rowsToTable(quarterlyIS)
    const annualBSRows    = rowsToTable(annualBS)
    const quarterlyBSRows = rowsToTable(quarterlyBS)
    const annualCFRows    = rowsToTable(annualCF)
    const quarterlyCFRows = rowsToTable(quarterlyCF)

    // TTM = sum of last 4 quarterly flow periods; balance sheet = most recent quarter
    const reversedIS = [...quarterlyISRows].reverse()
    const reversedCF = [...quarterlyCFRows].reverse()
    const last4IS = reversedIS.slice(0, 4)
    const last4CF = reversedCF.slice(0, 4)
    const ttmIS = last4IS.length > 0 ? { ...sumQuarters(last4IS, INCOME_FLOW_KEYS, INCOME_AVG_KEYS), endDate: 'TTM' } : null
    const ttmCF = last4CF.length > 0 ? { ...sumQuarters(last4CF, CF_FLOW_KEYS, []), endDate: 'TTM' } : null
    const ttmBS = quarterlyBSRows.length > 0 ? { ...quarterlyBSRows[quarterlyBSRows.length - 1] } : null

    // Prior TTM = quarters 5-8 (the 4 quarters ending ~1 year before current TTM).
    // Enables true rolling YoY growth: (currentTTM / priorTTM) - 1, regardless of
    // where a stock is in its reporting cycle (FY-only, FY+Q1, FY+Q2, etc.).
    const prior4IS = reversedIS.slice(4, 8)
    const prior4CF = reversedCF.slice(4, 8)
    const priorTtmIS = prior4IS.length >= 2
      ? { ...sumQuarters(prior4IS, INCOME_FLOW_KEYS, INCOME_AVG_KEYS), endDate: 'PRIOR_TTM' }
      : null
    const priorTtmCF = prior4CF.length >= 2
      ? { ...sumQuarters(prior4CF, CF_FLOW_KEYS, []), endDate: 'PRIOR_TTM' }
      : null

    const ttmMeta = {
      latestQuarterEndDate: last4IS[0]?.endDate ?? null,
      quarterCount: last4IS.length,
      hasPriorTtm: prior4IS.length >= 2,
    }

    // Detect reporting currency (may differ from trading currency for ADRs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quoteData as any
    const financialCurrency: string = q?.financialCurrency ?? q?.currency ?? 'USD'
    const tradingCurrency: string   = q?.currency ?? 'USD'

    return NextResponse.json({
      financialCurrency,
      tradingCurrency,
      annual:    { incomeStatement: annualISRows,    balanceSheet: annualBSRows,    cashFlow: annualCFRows    },
      quarterly: { incomeStatement: quarterlyISRows, balanceSheet: quarterlyBSRows, cashFlow: quarterlyCFRows },
      ttm:       { incomeStatement: ttmIS,           balanceSheet: ttmBS,           cashFlow: ttmCF           },
      priorTtm:  { incomeStatement: priorTtmIS,      cashFlow: priorTtmCF          },
      ttmMeta,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
