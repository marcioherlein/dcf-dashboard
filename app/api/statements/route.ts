import { NextRequest, NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// Flow-statement fields that should be summed for TTM (not averaged)
const INCOME_FLOW_KEYS = [
  'totalRevenue','costOfRevenue','grossProfit','researchDevelopment',
  'sellingGeneralAdministrative','nonRecurring','otherOperatingExpenses',
  'totalOperatingExpenses','operatingIncome','totalOtherIncomeExpenseNet',
  'ebit','interestExpense','incomeBeforeTax','incomeTaxExpense',
  'minorityInterest','netIncomeFromContinuingOps','discontinuedOperations',
  'extraordinaryItems','effectOfAccountingCharges','otherItems',
  'netIncome','netIncomeApplicableToCommonShares',
]
const CF_FLOW_KEYS = [
  'netIncome','depreciation','changeToNetincome','changeToAccountReceivables',
  'changeToLiabilities','changeToInventory','changeToOperatingActivities',
  'totalCashFromOperatingActivities','capitalExpenditures','investments',
  'otherCashflowsFromInvestingActivities','totalCashflowsFromInvestingActivities',
  'dividendsPaid','salePurchaseOfStock','netBorrowings',
  'otherCashflowsFromFinancingActivities','totalCashFromFinancingActivities',
  'changeInCash','repurchaseOfStock','issuanceOfStock',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumQuarters(quarters: any[], keys: string[]): Record<string, number | null> {
  if (quarters.length === 0) return {}
  const result: Record<string, number | null> = {}
  for (const key of keys) {
    const values = quarters.map(q => q[key]).filter((v): v is number => typeof v === 'number')
    result[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) : null
  }
  return result
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await yf.quoteSummary(ticker, {
      modules: [
        'incomeStatementHistory',
        'incomeStatementHistoryQuarterly',
        'balanceSheetHistory',
        'balanceSheetHistoryQuarterly',
        'cashflowStatementHistory',
        'cashflowStatementHistoryQuarterly',
      ],
    })

    const annualIS   = (data.incomeStatementHistory?.incomeStatementHistory ?? []).slice().reverse()
    const annualBS   = (data.balanceSheetHistory?.balanceSheetStatements ?? []).slice().reverse()
    const annualCF   = (data.cashflowStatementHistory?.cashflowStatements ?? []).slice().reverse()

    const quarterlyIS = (data.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? []).slice().reverse()
    const quarterlyBS = (data.balanceSheetHistoryQuarterly?.balanceSheetStatements ?? []).slice().reverse()
    const quarterlyCF = (data.cashflowStatementHistoryQuarterly?.cashflowStatements ?? []).slice().reverse()

    // TTM = sum of last 4 quarters (flow items); balance sheet = most recent quarter
    const last4IS = [...quarterlyIS].reverse().slice(0, 4)
    const last4CF = [...quarterlyCF].reverse().slice(0, 4)
    const ttmIS   = last4IS.length > 0 ? sumQuarters(last4IS, INCOME_FLOW_KEYS) : null
    const ttmCF   = last4CF.length > 0 ? sumQuarters(last4CF, CF_FLOW_KEYS)     : null
    const ttmBS   = quarterlyBS.length > 0 ? { ...quarterlyBS[quarterlyBS.length - 1] } : null

    return NextResponse.json({
      annual:    { incomeStatement: annualIS,   balanceSheet: annualBS,   cashFlow: annualCF   },
      quarterly: { incomeStatement: quarterlyIS, balanceSheet: quarterlyBS, cashFlow: quarterlyCF },
      ttm:       { incomeStatement: ttmIS,       balanceSheet: ttmBS,       cashFlow: ttmCF      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
