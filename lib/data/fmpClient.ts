/**
 * Financial Modeling Prep (FMP) client.
 * Uses the stable API (post-Aug 2025).
 * Base URL: https://financialmodelingprep.com/stable
 *
 * All requests are server-side only (API key is not public).
 */

const BASE = 'https://financialmodelingprep.com/stable'

function apiKey(): string {
  return process.env.FMP_API_KEY ?? ''
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const key = apiKey()
  if (!key) throw new Error('FMP_API_KEY not set')

  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('apikey', key)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`FMP ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FmpIncomeStatement {
  date: string
  fiscalYear: string
  period: string
  revenue: number
  grossProfit: number
  operatingIncome: number
  ebitda: number
  ebit: number
  netIncome: number
  eps: number
  epsDiluted: number
  depreciationAndAmortization: number
  reportedCurrency: string
}

export interface FmpCashFlowStatement {
  date: string
  fiscalYear: string
  period: string
  netCashProvidedByOperatingActivities: number
  investmentsInPropertyPlantAndEquipment: number
  freeCashFlow: number
  commonDividendsPaid: number
  commonStockRepurchased: number
  netCashUsedForInvestingActivites: number
  netCashUsedProvidedByFinancingActivities: number
  reportedCurrency: string
}

export interface FmpBalanceSheet {
  date: string
  fiscalYear: string
  period: string
  cashAndShortTermInvestments: number
  cashAndCashEquivalents: number
  totalCurrentAssets: number
  totalAssets: number
  longTermDebt: number
  totalCurrentLiabilities: number
  totalStockholdersEquity: number
  totalEquity: number
  reportedCurrency: string
}

export interface FmpKeyMetrics {
  date: string
  fiscalYear: string
  returnOnInvestedCapital: number
  returnOnEquity: number
  investedCapital: number
  freeCashFlowToFirm: number
}

export interface FmpProfile {
  symbol: string
  companyName: string
  price: number
  marketCap: number
  beta: number
  lastDividend: number
  industry: string
  exchangeFullName: string
  exchange: string
  description: string
  currency: string
  isin: string | null
}

export interface FmpRatios {
  date: string
  fiscalYear: string
  grossProfitMargin: number
  netProfitMargin: number
  operatingProfitMargin: number
  ebitdaMargin: number
  returnOnEquity: number
  returnOnAssets: number
  currentRatio: number
  debtEquityRatio: number
  freeCashFlowPerShare: number
}

export interface FmpAnalystEstimate {
  date: string
  symbol: string
  estimatedRevenueAvg: number
  estimatedEpsAvg: number
  estimatedNetIncomeAvg: number
  numberAnalystEstimatedRevenue: number
}

// ── Fetch functions ───────────────────────────────────────────────────────────

export async function getFmpIncomeStatements(ticker: string, limit = 5): Promise<FmpIncomeStatement[]> {
  return get<FmpIncomeStatement[]>('/income-statement', { symbol: ticker, limit })
}

export async function getFmpCashFlowStatements(ticker: string, limit = 5): Promise<FmpCashFlowStatement[]> {
  return get<FmpCashFlowStatement[]>('/cash-flow-statement', { symbol: ticker, limit })
}

export async function getFmpBalanceSheets(ticker: string, limit = 5): Promise<FmpBalanceSheet[]> {
  return get<FmpBalanceSheet[]>('/balance-sheet-statement', { symbol: ticker, limit })
}

export async function getFmpKeyMetrics(ticker: string, limit = 5): Promise<FmpKeyMetrics[]> {
  return get<FmpKeyMetrics[]>('/key-metrics', { symbol: ticker, limit })
}

export async function getFmpProfile(ticker: string): Promise<FmpProfile | null> {
  const data = await get<FmpProfile[]>('/profile', { symbol: ticker })
  return data[0] ?? null
}

export async function getFmpRatios(ticker: string, limit = 5): Promise<FmpRatios[]> {
  return get<FmpRatios[]>('/ratios', { symbol: ticker, limit })
}

export async function getFmpAnalystEstimates(ticker: string): Promise<FmpAnalystEstimate[]> {
  try {
    return await get<FmpAnalystEstimate[]>('/analyst-estimates-annual', { symbol: ticker, limit: 3 })
  } catch {
    return []
  }
}

/**
 * Fetch all FMP data for a ticker in parallel.
 * Falls back gracefully — if FMP is unavailable, all fields are null/empty.
 */
export async function getFmpBundle(ticker: string) {
  const [is, cf, bs, km, ratios] = await Promise.allSettled([
    getFmpIncomeStatements(ticker, 5),
    getFmpCashFlowStatements(ticker, 5),
    getFmpBalanceSheets(ticker, 5),
    getFmpKeyMetrics(ticker, 5),
    getFmpRatios(ticker, 1),
  ])

  return {
    incomeStatements: is.status === 'fulfilled' ? is.value : [] as FmpIncomeStatement[],
    cashFlowStatements: cf.status === 'fulfilled' ? cf.value : [] as FmpCashFlowStatement[],
    balanceSheets: bs.status === 'fulfilled' ? bs.value : [] as FmpBalanceSheet[],
    keyMetrics: km.status === 'fulfilled' ? km.value : [] as FmpKeyMetrics[],
    ratios: ratios.status === 'fulfilled' ? ratios.value : [] as FmpRatios[],
  }
}
