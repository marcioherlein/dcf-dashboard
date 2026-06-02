export type ETFGroup = 'sector' | 'geo' | 'style'

export interface ETFMeta {
  ticker: string
  group: ETFGroup
  label: string
}

export const SECTOR_META: ETFMeta[] = [
  { ticker: 'XLK',  group: 'sector', label: 'Technology' },
  { ticker: 'XLV',  group: 'sector', label: 'Healthcare' },
  { ticker: 'XLF',  group: 'sector', label: 'Financials' },
  { ticker: 'XLY',  group: 'sector', label: 'Cons. Cyclical' },
  { ticker: 'XLI',  group: 'sector', label: 'Industrials' },
  { ticker: 'XLC',  group: 'sector', label: 'Comm. Services' },
  { ticker: 'XLP',  group: 'sector', label: 'Cons. Defensive' },
  { ticker: 'XLE',  group: 'sector', label: 'Energy' },
  { ticker: 'XLRE', group: 'sector', label: 'Real Estate' },
  { ticker: 'XLB',  group: 'sector', label: 'Materials' },
  { ticker: 'XLU',  group: 'sector', label: 'Utilities' },
]

export const GEO_META: ETFMeta[] = [
  { ticker: 'SPY',  group: 'geo', label: 'US Large Cap' },
  { ticker: 'EFA',  group: 'geo', label: 'Developed World' },
  { ticker: 'EEM',  group: 'geo', label: 'Emerging Markets' },
  { ticker: 'EWJ',  group: 'geo', label: 'Japan' },
  { ticker: 'FXI',  group: 'geo', label: 'China' },
  { ticker: 'EWZ',  group: 'geo', label: 'Brazil' },
  { ticker: 'EWU',  group: 'geo', label: 'UK' },
  { ticker: 'EWG',  group: 'geo', label: 'Germany' },
  { ticker: 'INDA', group: 'geo', label: 'India' },
]

export const STYLE_META: ETFMeta[] = [
  { ticker: 'VTV',  group: 'style', label: 'Value' },
  { ticker: 'VUG',  group: 'style', label: 'Growth' },
  { ticker: 'VYM',  group: 'style', label: 'High Dividend' },
  { ticker: 'USMV', group: 'style', label: 'Low Volatility' },
  { ticker: 'QUAL', group: 'style', label: 'Quality' },
  { ticker: 'IWM',  group: 'style', label: 'Small Cap' },
  { ticker: 'IWB',  group: 'style', label: 'Large Cap' },
]

export const ALL_META: ETFMeta[] = [...SECTOR_META, ...GEO_META, ...STYLE_META]
export const ALL_TICKERS: string[] = ALL_META.map((m) => m.ticker)
