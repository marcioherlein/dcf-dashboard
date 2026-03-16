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
// Uses Yahoo Finance FX pairs (e.g. "CNYUSD=X")
export async function getFXRate(fromCurrency: string, toCurrency: string): Promise<number> {
  if (fromCurrency === toCurrency) return 1
  try {
    const pair = `${fromCurrency}${toCurrency}=X`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = await yf.quote(pair)
    const rate = q?.regularMarketPrice ?? null
    return typeof rate === 'number' && rate > 0 ? rate : 1
  } catch {
    return 1
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getNews(ticker: string): Promise<any[]> {
  const result: any = await yf.search(ticker, { newsCount: 10, quotesCount: 0 })
  return result.news ?? []
}
