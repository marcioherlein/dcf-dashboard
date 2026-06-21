import type { MetadataRoute } from 'next'

const BASE = 'https://insic.app'

// Top 100 S&P 500 tickers — enough to seed search indexing without hammering build
const TOP_TICKERS = [
  'AAPL','MSFT','NVDA','AMZN','META','GOOGL','GOOG','BRK.B','LLY','AVGO',
  'JPM','TSLA','UNH','XOM','V','MA','JNJ','PG','COST','HD',
  'MRK','ABBV','CVX','NFLX','KO','BAC','AMD','PEP','TMO','ACN',
  'CRM','WMT','LIN','MCD','ABT','ORCL','CSCO','NOW','PM','IBM',
  'TXN','NEE','AMGN','DHR','RTX','HON','UNP','AMAT','CAT','BKNG',
  'INTU','ISRG','QCOM','PFE','SPGI','GS','SBUX','BLK','MDLZ','T',
  'AXP','SYK','GILD','VRTX','ADI','MMC','DE','ELV','C','ETN',
  'BSX','PLD','REGN','ZTS','CB','CI','SO','CME','NOC','MCO',
  'AON','MO','PANW','DUK','WM','SHW','ITW','EMR','APD','FI',
  'MELI','NU','SHOP','DDOG','SNOW','CRWD','PLTR','APP','HOOD','COIN',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE,           lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/analyze`, lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE}/screener`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/markets`,  lastModified: now, changeFrequency: 'daily',  priority: 0.5 },
    { url: `${BASE}/compare`,  lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/ai-stack`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/strategies`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${BASE}/factor-ranking`, lastModified: now, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${BASE}/terms`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ]

  const stockRoutes: MetadataRoute.Sitemap = TOP_TICKERS.map(ticker => ({
    url: `${BASE}/stock/${ticker}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }))

  return [...staticRoutes, ...stockRoutes]
}
