import { CEDEAR_US_TICKERS } from './cedearMap'

export type Market = 'MERVAL' | 'NYSE' | 'NASDAQ' | 'ROFEX'
export type AssetType = 'equity' | 'future'
export type Currency = 'ARS' | 'USD'

export interface Instrument {
  ticker: string        // Yahoo Finance ticker (e.g. GGAL.BA, AAPL, ZC=F)
  displayTicker: string // Clean display name
  name: string
  market: Market
  assetType: AssetType
  currency: Currency
  sector?: string
  isCedear?: boolean    // Tagged at runtime for US stocks
  cedearTicker?: string
  cedearRatio?: number
  benchmarkTicker: string // Market benchmark for relative strength
}

// ── MERVAL Equities ───────────────────────────────────────────────────────────
// Traded on BYMA, denominated in ARS; suffix .BA for Yahoo Finance
const MERVAL_BENCHMARK = '^MERV'

const MERVAL_STOCKS: Omit<Instrument, 'isCedear' | 'cedearTicker' | 'cedearRatio'>[] = [
  { ticker: 'GGAL.BA',  displayTicker: 'GGAL',  name: 'Grupo Financiero Galicia', market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',  benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'YPF.BA',   displayTicker: 'YPF',   name: 'YPF',                      market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Energy',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'BMA.BA',   displayTicker: 'BMA',   name: 'Banco Macro',              market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',  benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'PAMP.BA',  displayTicker: 'PAMP',  name: 'Pampa Energía',            market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Energy',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'TXAR.BA',  displayTicker: 'TXAR',  name: 'Ternium Argentina',        market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Materials',   benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'ALUA.BA',  displayTicker: 'ALUA',  name: 'Aluar',                    market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Materials',   benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'CRES.BA',  displayTicker: 'CRES',  name: 'Cresud',                   market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Real Estate', benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'SUPV.BA',  displayTicker: 'SUPV',  name: 'Banco Supervielle',        market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',  benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'LOMA.BA',  displayTicker: 'LOMA',  name: 'Loma Negra',              market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Materials',   benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'TECO2.BA', displayTicker: 'TECO2', name: 'Telecom Argentina',        market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Telecom',     benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'CEPU.BA',  displayTicker: 'CEPU',  name: 'Central Puerto',           market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Utilities',   benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'TGSU2.BA', displayTicker: 'TGSU2', name: 'Transportadora Gas del Sur', market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Energy',   benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'TGNO4.BA', displayTicker: 'TGNO4', name: 'Transportadora Gas del Norte', market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Energy', benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'COME.BA',  displayTicker: 'COME',  name: 'Sociedad Comercial del Plata', market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Conglomerates', benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'IRSA.BA',  displayTicker: 'IRSA',  name: 'IRSA Inversiones',         market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Real Estate', benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'BYMA.BA',  displayTicker: 'BYMA',  name: 'Bolsas y Mercados Argentinos', market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials', benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'MIRG.BA',  displayTicker: 'MIRG',  name: 'Mirgor',                   market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Consumer',    benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'HAVA.BA',  displayTicker: 'HAVA',  name: 'Havanna Holding',          market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Consumer',    benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'CVH.BA',   displayTicker: 'CVH',   name: 'Cablevision Holding',      market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Telecom',     benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'VALO.BA',  displayTicker: 'VALO',  name: 'Grupo Financiero Valores', market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',  benchmarkTicker: MERVAL_BENCHMARK },
]

// ── NYSE Equities ─────────────────────────────────────────────────────────────
const NYSE_BENCHMARK = 'SPY'

const NYSE_STOCKS: Omit<Instrument, 'isCedear' | 'cedearTicker' | 'cedearRatio'>[] = [
  { ticker: 'JPM',  displayTicker: 'JPM',  name: 'JPMorgan Chase',    market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'BAC',  displayTicker: 'BAC',  name: 'Bank of America',   market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'GS',   displayTicker: 'GS',   name: 'Goldman Sachs',     market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'V',    displayTicker: 'V',    name: 'Visa',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'MA',   displayTicker: 'MA',   name: 'Mastercard',        market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'WMT',  displayTicker: 'WMT',  name: 'Walmart',           market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'KO',   displayTicker: 'KO',   name: 'Coca-Cola',         market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'PEP',  displayTicker: 'PEP',  name: 'PepsiCo',           market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'MCD',  displayTicker: 'MCD',  name: "McDonald's",        market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'NKE',  displayTicker: 'NKE',  name: 'Nike',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'XOM',  displayTicker: 'XOM',  name: 'ExxonMobil',        market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Energy',       benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'CVX',  displayTicker: 'CVX',  name: 'Chevron',           market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Energy',       benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'JNJ',  displayTicker: 'JNJ',  name: 'Johnson & Johnson', market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'PFE',  displayTicker: 'PFE',  name: 'Pfizer',            market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'UNH',  displayTicker: 'UNH',  name: 'UnitedHealth',      market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'LLY',  displayTicker: 'LLY',  name: 'Eli Lilly',         market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'CAT',  displayTicker: 'CAT',  name: 'Caterpillar',       market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'BA',   displayTicker: 'BA',   name: 'Boeing',            market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'T',    displayTicker: 'T',    name: 'AT&T',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Telecom',      benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'BRK-B',displayTicker: 'BRK-B',name: 'Berkshire B',      market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
]

// ── NASDAQ Equities ───────────────────────────────────────────────────────────
const NASDAQ_BENCHMARK = 'QQQ'

const NASDAQ_STOCKS: Omit<Instrument, 'isCedear' | 'cedearTicker' | 'cedearRatio'>[] = [
  { ticker: 'AAPL',  displayTicker: 'AAPL',  name: 'Apple',           market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'MSFT',  displayTicker: 'MSFT',  name: 'Microsoft',       market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'GOOGL', displayTicker: 'GOOGL', name: 'Alphabet A',      market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'AMZN',  displayTicker: 'AMZN',  name: 'Amazon',          market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'META',  displayTicker: 'META',  name: 'Meta Platforms',  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'NVDA',  displayTicker: 'NVDA',  name: 'NVIDIA',          market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'TSLA',  displayTicker: 'TSLA',  name: 'Tesla',           market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'NFLX',  displayTicker: 'NFLX',  name: 'Netflix',         market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'INTC',  displayTicker: 'INTC',  name: 'Intel',           market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'AMD',   displayTicker: 'AMD',   name: 'AMD',             market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'AVGO',  displayTicker: 'AVGO',  name: 'Broadcom',        market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'QCOM',  displayTicker: 'QCOM',  name: 'Qualcomm',        market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'ADBE',  displayTicker: 'ADBE',  name: 'Adobe',           market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'CRM',   displayTicker: 'CRM',   name: 'Salesforce',      market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'ORCL',  displayTicker: 'ORCL',  name: 'Oracle',          market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'MELI',  displayTicker: 'MELI',  name: 'MercadoLibre',    market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'BABA',  displayTicker: 'BABA',  name: 'Alibaba',         market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'PYPL',  displayTicker: 'PYPL',  name: 'PayPal',          market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'SHOP',  displayTicker: 'SHOP',  name: 'Shopify',         market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'ABNB',  displayTicker: 'ABNB',  name: 'Airbnb',          market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
]

// ── ROFEX Futures ─────────────────────────────────────────────────────────────
// ROFEX is Argentina's futures exchange. Most contracts are agricultural
// commodities and dollar forwards. We use CBOT/CME proxies via Yahoo Finance
// since direct ROFEX data is not available in Yahoo Finance.
// Label: ROFEX (CBOT proxy) — true ROFEX integration is a future enhancement.
const ROFEX_FUTURES: Omit<Instrument, 'isCedear' | 'cedearTicker' | 'cedearRatio'>[] = [
  { ticker: 'ZS=F',  displayTicker: 'ZS',  name: 'Soybeans (CBOT/ROFEX proxy)',       market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZS=F'  },
  { ticker: 'ZC=F',  displayTicker: 'ZC',  name: 'Corn (CBOT/ROFEX proxy)',            market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZC=F'  },
  { ticker: 'ZW=F',  displayTicker: 'ZW',  name: 'Wheat (CBOT/ROFEX proxy)',           market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZW=F'  },
  { ticker: 'ZL=F',  displayTicker: 'ZL',  name: 'Soybean Oil (CBOT/ROFEX proxy)',     market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZL=F'  },
  { ticker: 'ZM=F',  displayTicker: 'ZM',  name: 'Soybean Meal (CBOT/ROFEX proxy)',    market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZM=F'  },
  { ticker: 'GC=F',  displayTicker: 'GC',  name: 'Gold (COMEX)',                        market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'GC=F'  },
  { ticker: 'CL=F',  displayTicker: 'CL',  name: 'Crude Oil WTI (NYMEX)',              market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'CL=F'  },
  { ticker: 'NG=F',  displayTicker: 'NG',  name: 'Natural Gas (NYMEX)',                market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'NG=F'  },
]

// ── Full universe ─────────────────────────────────────────────────────────────
export const ALL_INSTRUMENTS: Instrument[] = [
  ...MERVAL_STOCKS.map((s) => ({ ...s, isCedear: false })),
  ...NYSE_STOCKS.map((s) => ({
    ...s,
    isCedear: CEDEAR_US_TICKERS.has(s.ticker),
    cedearTicker: CEDEAR_US_TICKERS.has(s.ticker) ? s.ticker : undefined,
  })),
  ...NASDAQ_STOCKS.map((s) => ({
    ...s,
    isCedear: CEDEAR_US_TICKERS.has(s.ticker),
    cedearTicker: CEDEAR_US_TICKERS.has(s.ticker) ? s.ticker : undefined,
  })),
  ...ROFEX_FUTURES.map((s) => ({ ...s, isCedear: false })),
]

export const EQUITY_INSTRUMENTS = ALL_INSTRUMENTS.filter((i) => i.assetType === 'equity')
export const FUTURES_INSTRUMENTS = ALL_INSTRUMENTS.filter((i) => i.assetType === 'future')

export const US_EQUITY_TICKERS = [...NYSE_STOCKS, ...NASDAQ_STOCKS].map((s) => s.ticker)
export const MERVAL_TICKERS = MERVAL_STOCKS.map((s) => s.ticker)
export const ROFEX_TICKERS = ROFEX_FUTURES.map((s) => s.ticker)

// All unique benchmark tickers needed
export const BENCHMARK_TICKERS = Array.from(new Set(ALL_INSTRUMENTS.map((i) => i.benchmarkTicker)))
