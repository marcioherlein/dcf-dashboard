// yahoo-finance2 v3: default export is a class, must instantiate
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

export async function searchTicker(query: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.search(query, { newsCount: 0 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.quotes ?? []).filter((q: any) => q.quoteType === 'EQUITY').slice(0, 8)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getQuote(ticker: string): Promise<any> {
  return yf.quote(ticker)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getFinancials(ticker: string): Promise<any> {
  return yf.quoteSummary(ticker, {
    modules: [
      'incomeStatementHistory',
      'balanceSheetHistory',
      'cashflowStatementHistory',
      'financialData',
      'defaultKeyStatistics',
      'summaryDetail',
      'earningsTrend',
      'recommendationTrend',
      'insiderTransactions',
      'summaryProfile',
      'summaryDetail',
      'majorHoldersBreakdown',
    ],
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getHistorical(ticker: string, period: '1mo' | '3mo' | '1y' | '5y' = '5y'): Promise<any[]> {
  const period2 = new Date()
  const period1 = new Date()
  if (period === '1mo') period1.setMonth(period1.getMonth() - 1)
  else if (period === '3mo') period1.setMonth(period1.getMonth() - 3)
  else if (period === '1y') period1.setFullYear(period1.getFullYear() - 1)
  else period1.setFullYear(period1.getFullYear() - 5)

  return yf.historical(ticker, {
    period1: period1.toISOString().split('T')[0],
    period2: period2.toISOString().split('T')[0],
    interval: period === '5y' ? '1wk' : '1d',
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSPYHistorical(): Promise<any[]> {
  const period2 = new Date()
  const period1 = new Date()
  period1.setFullYear(period1.getFullYear() - 5)
  return yf.historical('SPY', {
    period1: period1.toISOString().split('T')[0],
    period2: period2.toISOString().split('T')[0],
    interval: '1wk',
  })
}

// Returns the spot FX rate to convert fromCurrency → toCurrency (e.g. CNY → USD = 0.138)
// Tries direct pair, then inverse pair, then legacy single-currency format
export async function getFXRate(fromCurrency: string, toCurrency: string): Promise<number> {
  if (fromCurrency === toCurrency) return 1

  // Helper: fetch a Yahoo FX quote and return the price, or null on failure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function tryPair(symbol: string): Promise<number | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q: any = await yf.quote(symbol)
      const rate = q?.regularMarketPrice ?? null
      return typeof rate === 'number' && rate > 0 ? rate : null
    } catch {
      return null
    }
  }

  // 1. Direct: e.g. BRLУSD=X
  const direct = await tryPair(`${fromCurrency}${toCurrency}=X`)
  if (direct !== null) return direct

  // 2. Inverse: e.g. USDBRL=X → return 1/rate
  const inverse = await tryPair(`${toCurrency}${fromCurrency}=X`)
  if (inverse !== null && inverse > 0) return 1 / inverse

  // 3. Legacy single-currency format: e.g. BRL=X (price is already in terms of USD)
  const legacy = await tryPair(`${fromCurrency}=X`)
  if (legacy !== null) return legacy

  return 1  // fallback: assume parity (will be wrong but won't crash)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getNews(ticker: string): Promise<any[]> {
  const result: any = await yf.search(ticker, { newsCount: 10, quotesCount: 0 })
  return result.news ?? []
}

export interface PeerQuoteRaw {
  ticker: string
  trailingPE: number | null
  priceToBook: number | null
  priceToSales: number | null
  evToEbitda: number | null
  evToRevenue: number | null
}

// Fetch live multiples for a list of peer tickers in parallel; silently drops failures
export async function getPeerQuotes(tickers: string[]): Promise<PeerQuoteRaw[]> {
  const results = await Promise.allSettled(tickers.map((t) => yf.quote(t)))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results.flatMap((r): PeerQuoteRaw[] => {
    if (r.status !== 'fulfilled') return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = r.value as any
    if (!q || !q.symbol) return []
    return [{
      ticker: q.symbol as string,
      trailingPE: typeof q.trailingPE === 'number' ? q.trailingPE : null,
      priceToBook: typeof q.priceToBook === 'number' ? q.priceToBook : null,
      priceToSales: typeof q.priceToSalesTrailing12Months === 'number' ? q.priceToSalesTrailing12Months : null,
      evToEbitda: typeof q.enterpriseToEbitda === 'number' ? q.enterpriseToEbitda : null,
      evToRevenue: typeof q.enterpriseToRevenue === 'number' ? q.enterpriseToRevenue : null,
    }]
  })
}
