// yahoo-finance2 v3: default export is a class, must instantiate
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

// Module-level caches — survive across requests within the same serverless instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _spyCache: { data: any[]; ts: number } | null = null
const SPY_CACHE_TTL = 60 * 60 * 1000 // 1 hour

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _peerCache = new Map<string, { data: any[]; ts: number }>()
const PEER_CACHE_TTL = 30 * 60 * 1000 // 30 min

// Allowed exchange codes for NYSE and NASDAQ
const NYSE_NASDAQ_CODES = new Set([
  'NMS', 'NGM', 'NCM',           // NASDAQ (Global Select, Global Market, Capital Market)
  'NYQ', 'NYS', 'ASE',           // NYSE, NYSE American (AMEX)
  'PCX', 'BTS',                  // NYSE Arca, Bats (US-listed ETF venues — same securities)
])

export interface TickerSearchResult {
  symbol: string
  longname?: string
  shortname?: string
  exchange?: string
  exchDisp?: string
  quoteType?: string
  supported: boolean
}

export async function searchTicker(query: string): Promise<TickerSearchResult[]> {
  // validateResult: false needed for ETF quoteType which yahoo-finance2 schema doesn't include
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.search(query, { newsCount: 0 }, { validateResult: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function isSupported(q: any): boolean {
    const code = (q.exchange ?? '').toUpperCase()
    const name = (q.exchDisp ?? q.fullExchangeName ?? '').toUpperCase()
    return NYSE_NASDAQ_CODES.has(code) || name.includes('NASDAQ') || name.includes('NYSE')
  }

  // Include both EQUITYs and ETFs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hits: TickerSearchResult[] = (result.quotes ?? [])
    .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((q: any): TickerSearchResult => ({
      symbol: q.symbol as string,
      longname: q.longname as string | undefined,
      shortname: q.shortname as string | undefined,
      exchange: q.exchange as string | undefined,
      exchDisp: (q.exchDisp ?? q.fullExchangeName ?? q.exchange) as string | undefined,
      quoteType: q.quoteType as string | undefined,
      // ETFs on NYSE Arca (PCX) and Bats (BTS) are always supported; equities use exchange check
      supported: q.quoteType === 'ETF' ? true : isSupported(q),
    }))

  // Supported results first, then unsupported; cap total at 8
  const supported = hits.filter(r => r.supported)
  const unsupported = hits.filter(r => !r.supported)
  return [...supported, ...unsupported].slice(0, 8)
}

// ETF-specific search — returns only ETF quote types
export async function searchETF(query: string): Promise<Array<{ symbol: string; name: string; exchange: string }>> {
  // validateResult: false because yahoo-finance2 schema doesn't include ETF quoteType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await yf.search(query, { newsCount: 0 }, { validateResult: false })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result.quotes ?? [])
    .filter((q: any) => q.quoteType === 'ETF')
    .slice(0, 8)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((q: any) => ({
      symbol: q.symbol as string,
      name: (q.longname ?? q.shortname ?? q.symbol) as string,
      exchange: (q.exchDisp ?? q.exchange ?? '') as string,
    }))
}

// Fetch ETF-specific data: holdings, sector weights, fund profile, valuation metrics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getETFData(ticker: string): Promise<any> {
  return yf.quoteSummary(ticker, {
    modules: [
      'topHoldings',
      'fundProfile',
      'defaultKeyStatistics',
      'summaryDetail',
      'price',
    ],
  }, { validateResult: false })
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
      'earningsHistory',
      'recommendationTrend',
      'insiderTransactions',
      'summaryProfile',
      'majorHoldersBreakdown',
    ],
  }, { validateResult: false })
}

export type HistoricalPeriod = '1d' | '5d' | '1mo' | '3mo' | '6mo' | 'ytd' | '1y' | '2y' | '3y' | '5y' | '10y' | 'max'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAnnualBalanceSheet(ticker: string): Promise<any[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await yf.fundamentalsTimeSeries(ticker, {
      type: 'annual',
      module: 'balance-sheet',
      period1: '2015-01-01',
    })
    return rows ?? []
  } catch {
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAnnualIncomeStatement(ticker: string): Promise<any[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await yf.fundamentalsTimeSeries(ticker, {
      type: 'annual',
      module: 'income-statement',
      period1: '2015-01-01',
    })
    return rows ?? []
  } catch {
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAnnualCashFlow(ticker: string): Promise<any[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await yf.fundamentalsTimeSeries(ticker, {
      type: 'annual',
      module: 'cash-flow',
      period1: '2015-01-01',
    })
    return rows ?? []
  } catch {
    return []
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getHistorical(ticker: string, period: HistoricalPeriod = '1y'): Promise<any[]> {
  const period2 = new Date()
  let period1 = new Date()
  switch (period) {
    case '1d':  period1.setDate(period1.getDate() - 1); break
    case '5d':  period1.setDate(period1.getDate() - 5); break
    case '1mo': period1.setMonth(period1.getMonth() - 1); break
    case '3mo': period1.setMonth(period1.getMonth() - 3); break
    case '6mo': period1.setMonth(period1.getMonth() - 6); break
    case 'ytd': period1 = new Date(period2.getFullYear(), 0, 1); break
    case '1y':  period1.setFullYear(period1.getFullYear() - 1); break
    case '2y':  period1.setFullYear(period1.getFullYear() - 2); break
    case '3y':  period1.setFullYear(period1.getFullYear() - 3); break
    case '5y':  period1.setFullYear(period1.getFullYear() - 5); break
    case '10y': period1.setFullYear(period1.getFullYear() - 10); break
    case 'max': period1 = new Date('1970-01-01'); break
  }
  const weekly = ['2y', '3y', '5y', '10y', 'max'].includes(period)
  return yf.historical(ticker, {
    period1: period1.toISOString().split('T')[0],
    period2: period2.toISOString().split('T')[0],
    interval: weekly ? '1wk' : '1d',
  }, { validateResult: false })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSPYHistorical(): Promise<any[]> {
  const now = Date.now()
  if (_spyCache && now - _spyCache.ts < SPY_CACHE_TTL) return _spyCache.data
  const period2 = new Date()
  const period1 = new Date()
  period1.setFullYear(period1.getFullYear() - 5)
  const data = await yf.historical('SPY', {
    period1: period1.toISOString().split('T')[0],
    period2: period2.toISOString().split('T')[0],
    interval: '1wk',
  }, { validateResult: false })
  _spyCache = { data, ts: now }
  return data
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
  const cacheKey = [...tickers].sort().join(',')
  const now = Date.now()
  const cached = _peerCache.get(cacheKey)
  if (cached && now - cached.ts < PEER_CACHE_TTL) return cached.data

  const results = await Promise.allSettled(tickers.map((t) => yf.quote(t)))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = results.flatMap((r): PeerQuoteRaw[] => {
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
  _peerCache.set(cacheKey, { data, ts: now })
  return data
}

// Fetch recommendations ("People also watch") for the peer scatter chart
export async function getRecommendedPeers(ticker: string): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = await yf.recommendationsBySymbol(ticker)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recs: any[] = res?.recommendedSymbols ?? []
    return recs
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .map(r => (r.symbol as string).toUpperCase())
      .slice(0, 8)
  } catch {
    return []
  }
}

// Fetch full quote summary for a ticker (defaultKeyStatistics + earningsTrend + price)
export async function getQuoteSummaryForPeer(ticker: string): Promise<any> {
  try {
    return await yf.quoteSummary(ticker, {
      modules: ['defaultKeyStatistics', 'summaryDetail', 'earningsTrend', 'price'],
    }, { validateResult: false })
  } catch {
    return null
  }
}
