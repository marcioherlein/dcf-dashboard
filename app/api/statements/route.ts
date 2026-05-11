import { NextRequest, NextResponse } from 'next/server'

const PERIOD1 = '493590046'
const PERIOD2 = '9999999999'

const ANNUAL_IS_TYPES = [
  'annualTotalRevenue','annualOperatingRevenue','annualCostOfRevenue','annualGrossProfit',
  'annualOperatingExpense','annualSellingGeneralAndAdministration',
  'annualGeneralAndAdministrativeExpense','annualOtherGandA',
  'annualSellingAndMarketingExpense','annualResearchAndDevelopment',
  'annualOperatingIncome',
  'annualNetNonOperatingInterestIncomeExpense','annualInterestIncomeNonOperating',
  'annualInterestExpenseNonOperating',
  'annualOtherIncomeExpense','annualGainOnSaleOfSecurity',
  'annualSpecialIncomeCharges','annualWriteOff','annualOtherNonOperatingIncomeExpenses',
  'annualPretaxIncome','annualTaxProvision','annualNetIncome',
  'annualNetIncomeCommonStockholders','annualDilutedNIAvailtoComStockholders',
  'annualBasicEPS','annualDilutedEPS','annualBasicAverageShares','annualDilutedAverageShares',
  'annualEBIT','annualEBITDA','annualNormalizedEBITDA','annualTaxRateForCalcs',
  'annualTotalExpenses','annualTotalOperatingIncomeAsReported',
  'annualReconciledDepreciation','annualReconciledCostOfRevenue',
  'annualNormalizedIncome','annualNetInterestIncome',
]

const QUARTERLY_IS_TYPES = ANNUAL_IS_TYPES.map(t => t.replace('annual', 'quarterly'))

const ANNUAL_BS_TYPES = [
  'annualCashAndCashEquivalents','annualOtherShortTermInvestments','annualCashCashEquivalentsAndShortTermInvestments',
  'annualNetReceivables','annualAccountsReceivable','annualOtherReceivables',
  'annualInventory','annualOtherCurrentAssets','annualCurrentAssets',
  'annualNetPPE','annualGoodwill','annualOtherIntangibleAssets','annualGoodwillAndOtherIntangibleAssets',
  'annualInvestmentsAndAdvances','annualLongTermEquityInvestment','annualOtherNonCurrentAssets',
  'annualTotalNonCurrentAssets','annualTotalAssets',
  'annualAccountsPayable','annualTaxesPayable','annualOtherCurrentBorrowings',
  'annualCurrentDebtAndCapitalLeaseObligation','annualCurrentCapitalLeaseObligation',
  'annualOtherCurrentLiabilities','annualCurrentLiabilities',
  'annualLongTermDebtAndCapitalLeaseObligation','annualLongTermCapitalLeaseObligation',
  'annualLongTermDebt','annualOtherNonCurrentLiabilities','annualTotalNonCurrentLiabilitiesNetMinorityInterest',
  'annualTotalLiabilitiesNetMinorityInterest',
  'annualCommonStockEquity','annualStockholdersEquity','annualRetainedEarnings',
  'annualCommonStock','annualAdditionalPaidInCapital','annualTreasuryStock',
  'annualOtherEquityAdjustments','annualTotalEquityGrossMinorityInterest',
  'annualTotalCapitalization','annualNetTangibleAssets','annualTangibleBookValue',
  'annualWorkingCapital','annualInvestedCapital','annualShareIssued','annualOrdinarySharesNumber',
]

const QUARTERLY_BS_TYPES = ANNUAL_BS_TYPES.map(t => t.replace('annual', 'quarterly'))

const ANNUAL_CF_TYPES = [
  'annualOperatingCashFlow','annualCashFlowFromContinuingOperatingActivities',
  'annualNetIncome','annualDepreciationAndAmortization','annualDeferredIncomeTax',
  'annualStockBasedCompensation','annualChangeInWorkingCapital',
  'annualChangeInAccountsReceivable','annualChangeInInventory','annualChangeInOtherWorkingCapital',
  'annualOtherNonCashItems',
  'annualInvestingCashFlow','annualCashFlowFromContinuingInvestingActivities',
  'annualCapitalExpenditure','annualPurchaseOfBusiness','annualPurchaseOfInvestment',
  'annualSaleOfInvestment','annualOtherInvestingCharges',
  'annualFinancingCashFlow','annualCashFlowFromContinuingFinancingActivities',
  'annualIssuanceOfDebt','annualRepaymentOfDebt','annualIssuanceOfCapitalStock',
  'annualRepurchaseOfCapitalStock','annualCashDividendsPaid','annualOtherFinancingCharges',
  'annualEndCashPosition','annualBeginningCashPosition','annualChangesInCash',
  'annualEffectOfExchangeRateChanges','annualFreeCashFlow',
]

const QUARTERLY_CF_TYPES = ANNUAL_CF_TYPES.map(t => t.replace('annual', 'quarterly'))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTimeseries(result: any, prefix: 'annual' | 'quarterly'): Record<string, Record<string, number | null>> {
  // Returns { [asOfDate]: { fieldKey: value } }
  const byDate: Record<string, Record<string, number | null>> = {}
  const ts = result?.timeseries?.result ?? []
  for (const item of ts) {
    const rawType: string = item.meta?.type?.[0] ?? ''
    const fieldKey = rawType.replace(prefix, '')  // e.g. "TotalRevenue"
    const periods: unknown[] = item[rawType] ?? []
    for (const period of periods) {
      if (!period || typeof period !== 'object') continue
      const p = period as { asOfDate?: string; reportedValue?: { raw?: number } }
      const date = p.asOfDate
      if (!date) continue
      if (!byDate[date]) byDate[date] = {}
      const raw = p.reportedValue?.raw
      byDate[date][fieldKey] = raw != null ? raw : null
    }
  }
  return byDate
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRows(byDate: Record<string, Record<string, number | null>>): any[] {
  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, fields]) => ({ endDate: date, ...fields }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sumQuartersTS(quarters: any[], keys: string[]): Record<string, number | null> {
  if (quarters.length === 0) return {}
  const result: Record<string, number | null> = {}
  for (const key of keys) {
    const values = quarters.map(q => q[key]).filter((v): v is number => typeof v === 'number')
    result[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) : null
  }
  return result
}

async function fetchTimeseries(ticker: string, types: string[]): Promise<unknown> {
  const typeParam = types.join(',')
  const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${ticker}?type=${typeParam}&period1=${PERIOD1}&period2=${PERIOD2}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Yahoo Finance timeseries responded ${res.status}`)
  return res.json()
}

const INCOME_FLOW_KEYS = [
  'TotalRevenue','OperatingRevenue','CostOfRevenue','GrossProfit',
  'OperatingExpense','SellingGeneralAndAdministration','GeneralAndAdministrativeExpense',
  'OtherGandA','SellingAndMarketingExpense','ResearchAndDevelopment',
  'OperatingIncome','NetNonOperatingInterestIncomeExpense','InterestIncomeNonOperating',
  'InterestExpenseNonOperating','OtherIncomeExpense','GainOnSaleOfSecurity',
  'SpecialIncomeCharges','WriteOff','OtherNonOperatingIncomeExpenses',
  'PretaxIncome','TaxProvision','NetIncome','NetIncomeCommonStockholders',
  'DilutedNIAvailtoComStockholders','BasicEPS','DilutedEPS',
  'BasicAverageShares','DilutedAverageShares',
  'EBIT','EBITDA','NormalizedEBITDA','TaxRateForCalcs',
  'TotalExpenses','TotalOperatingIncomeAsReported','ReconciledDepreciation',
  'ReconciledCostOfRevenue','NormalizedIncome','NetInterestIncome',
]

const CF_FLOW_KEYS = [
  'OperatingCashFlow','CashFlowFromContinuingOperatingActivities',
  'NetIncome','DepreciationAndAmortization','DeferredIncomeTax',
  'StockBasedCompensation','ChangeInWorkingCapital',
  'ChangeInAccountsReceivable','ChangeInInventory','ChangeInOtherWorkingCapital',
  'OtherNonCashItems','InvestingCashFlow','CashFlowFromContinuingInvestingActivities',
  'CapitalExpenditure','PurchaseOfBusiness','PurchaseOfInvestment',
  'SaleOfInvestment','OtherInvestingCharges','FinancingCashFlow',
  'CashFlowFromContinuingFinancingActivities','IssuanceOfDebt','RepaymentOfDebt',
  'IssuanceOfCapitalStock','RepurchaseOfCapitalStock','CashDividendsPaid',
  'OtherFinancingCharges','EndCashPosition','BeginningCashPosition',
  'ChangesInCash','EffectOfExchangeRateChanges','FreeCashFlow',
]

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  try {
    const [annualISRaw, quarterlyISRaw, annualBSRaw, quarterlyBSRaw, annualCFRaw, quarterlyCFRaw] =
      await Promise.all([
        fetchTimeseries(ticker, ANNUAL_IS_TYPES),
        fetchTimeseries(ticker, QUARTERLY_IS_TYPES),
        fetchTimeseries(ticker, ANNUAL_BS_TYPES),
        fetchTimeseries(ticker, QUARTERLY_BS_TYPES),
        fetchTimeseries(ticker, ANNUAL_CF_TYPES),
        fetchTimeseries(ticker, QUARTERLY_CF_TYPES),
      ])

    const annualIS    = toRows(parseTimeseries(annualISRaw,    'annual'))
    const quarterlyIS = toRows(parseTimeseries(quarterlyISRaw, 'quarterly'))
    const annualBS    = toRows(parseTimeseries(annualBSRaw,    'annual'))
    const quarterlyBS = toRows(parseTimeseries(quarterlyBSRaw, 'quarterly'))
    const annualCF    = toRows(parseTimeseries(annualCFRaw,    'annual'))
    const quarterlyCF = toRows(parseTimeseries(quarterlyCFRaw, 'quarterly'))

    // TTM = sum of last 4 quarterly flow periods; balance sheet = most recent quarter
    const last4IS = [...quarterlyIS].reverse().slice(0, 4)
    const last4CF = [...quarterlyCF].reverse().slice(0, 4)
    const ttmIS = last4IS.length > 0 ? { ...sumQuartersTS(last4IS, INCOME_FLOW_KEYS), endDate: 'TTM' } : null
    const ttmCF = last4CF.length > 0 ? { ...sumQuartersTS(last4CF, CF_FLOW_KEYS), endDate: 'TTM' } : null
    const ttmBS = quarterlyBS.length > 0 ? { ...quarterlyBS[quarterlyBS.length - 1] } : null

    return NextResponse.json({
      annual:    { incomeStatement: annualIS,    balanceSheet: annualBS,    cashFlow: annualCF    },
      quarterly: { incomeStatement: quarterlyIS, balanceSheet: quarterlyBS, cashFlow: quarterlyCF },
      ttm:       { incomeStatement: ttmIS,       balanceSheet: ttmBS,       cashFlow: ttmCF       },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
