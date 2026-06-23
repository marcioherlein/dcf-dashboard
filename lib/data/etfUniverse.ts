export type ETFGroup = 'sector' | 'geo' | 'style' | 'broad' | 'bond' | 'thematic' | 'dividend' | 'commodity'

export type AssetClass = 'equity' | 'bond' | 'commodity' | 'mixed'

export interface ETFMeta {
  ticker: string
  group: ETFGroup
  label: string
  assetClass: AssetClass
}

// ── Broad market ─────────────────────────────────────────────────────────────
export const BROAD_META: ETFMeta[] = [
  { ticker: 'SPY',  group: 'broad', label: 'S&P 500',         assetClass: 'equity' },
  { ticker: 'QQQ',  group: 'broad', label: 'Nasdaq 100',      assetClass: 'equity' },
  { ticker: 'VTI',  group: 'broad', label: 'US Total Market', assetClass: 'equity' },
  { ticker: 'IVV',  group: 'broad', label: 'iShares S&P 500', assetClass: 'equity' },
  { ticker: 'VOO',  group: 'broad', label: 'Vanguard S&P 500',assetClass: 'equity' },
]

// ── US Sectors ───────────────────────────────────────────────────────────────
export const SECTOR_META: ETFMeta[] = [
  { ticker: 'XLK',  group: 'sector', label: 'Technology',      assetClass: 'equity' },
  { ticker: 'XLV',  group: 'sector', label: 'Healthcare',      assetClass: 'equity' },
  { ticker: 'XLF',  group: 'sector', label: 'Financials',      assetClass: 'equity' },
  { ticker: 'XLY',  group: 'sector', label: 'Cons. Cyclical',  assetClass: 'equity' },
  { ticker: 'XLI',  group: 'sector', label: 'Industrials',     assetClass: 'equity' },
  { ticker: 'XLC',  group: 'sector', label: 'Comm. Services',  assetClass: 'equity' },
  { ticker: 'XLP',  group: 'sector', label: 'Cons. Defensive', assetClass: 'equity' },
  { ticker: 'XLE',  group: 'sector', label: 'Energy',          assetClass: 'equity' },
  { ticker: 'XLRE', group: 'sector', label: 'Real Estate',     assetClass: 'equity' },
  { ticker: 'XLB',  group: 'sector', label: 'Materials',       assetClass: 'equity' },
  { ticker: 'XLU',  group: 'sector', label: 'Utilities',       assetClass: 'equity' },
]

// ── International / Geographic ───────────────────────────────────────────────
export const GEO_META: ETFMeta[] = [
  { ticker: 'EFA',  group: 'geo', label: 'Developed World',  assetClass: 'equity' },
  { ticker: 'EEM',  group: 'geo', label: 'Emerging Markets', assetClass: 'equity' },
  { ticker: 'EWJ',  group: 'geo', label: 'Japan',            assetClass: 'equity' },
  { ticker: 'FXI',  group: 'geo', label: 'China',            assetClass: 'equity' },
  { ticker: 'EWZ',  group: 'geo', label: 'Brazil',           assetClass: 'equity' },
  { ticker: 'EWU',  group: 'geo', label: 'UK',               assetClass: 'equity' },
  { ticker: 'EWG',  group: 'geo', label: 'Germany',          assetClass: 'equity' },
  { ticker: 'INDA', group: 'geo', label: 'India',            assetClass: 'equity' },
  { ticker: 'EWY',  group: 'geo', label: 'South Korea',      assetClass: 'equity' },
  { ticker: 'EWT',  group: 'geo', label: 'Taiwan',           assetClass: 'equity' },
  { ticker: 'EWW',  group: 'geo', label: 'Mexico',           assetClass: 'equity' },
  { ticker: 'EWA',  group: 'geo', label: 'Australia',        assetClass: 'equity' },
]

// ── Style / Factor ───────────────────────────────────────────────────────────
export const STYLE_META: ETFMeta[] = [
  { ticker: 'VTV',  group: 'style', label: 'Value',           assetClass: 'equity' },
  { ticker: 'VUG',  group: 'style', label: 'Growth',          assetClass: 'equity' },
  { ticker: 'VYM',  group: 'style', label: 'High Dividend',   assetClass: 'equity' },
  { ticker: 'USMV', group: 'style', label: 'Low Volatility',  assetClass: 'equity' },
  { ticker: 'QUAL', group: 'style', label: 'Quality',         assetClass: 'equity' },
  { ticker: 'IWM',  group: 'style', label: 'Small Cap',       assetClass: 'equity' },
  { ticker: 'IWB',  group: 'style', label: 'Large Cap',       assetClass: 'equity' },
]

// ── Bonds / Fixed Income ─────────────────────────────────────────────────────
export const BOND_META: ETFMeta[] = [
  { ticker: 'AGG',  group: 'bond', label: 'US Agg Bond',       assetClass: 'bond' },
  { ticker: 'BND',  group: 'bond', label: 'Vanguard Bond',     assetClass: 'bond' },
  { ticker: 'TLT',  group: 'bond', label: '20+ Yr Treasuries', assetClass: 'bond' },
  { ticker: 'IEF',  group: 'bond', label: '7–10 Yr Treasuries',assetClass: 'bond' },
  { ticker: 'SHY',  group: 'bond', label: '1–3 Yr Treasuries', assetClass: 'bond' },
  { ticker: 'LQD',  group: 'bond', label: 'Corp Bonds (IG)',   assetClass: 'bond' },
  { ticker: 'HYG',  group: 'bond', label: 'High Yield Corp',   assetClass: 'bond' },
  { ticker: 'TIP',  group: 'bond', label: 'TIPS',              assetClass: 'bond' },
]

// ── Dividend / Income ────────────────────────────────────────────────────────
export const DIVIDEND_META: ETFMeta[] = [
  { ticker: 'SCHD', group: 'dividend', label: 'Schwab Dividend',  assetClass: 'equity' },
  { ticker: 'DGRO', group: 'dividend', label: 'Div Growth',       assetClass: 'equity' },
  { ticker: 'NOBL', group: 'dividend', label: 'Div Aristocrats',  assetClass: 'equity' },
  { ticker: 'HDV',  group: 'dividend', label: 'iSh High Div',     assetClass: 'equity' },
]

// ── Thematic ─────────────────────────────────────────────────────────────────
export const THEMATIC_META: ETFMeta[] = [
  { ticker: 'SMH',  group: 'thematic', label: 'Semiconductors',  assetClass: 'equity' },
  { ticker: 'SOXX', group: 'thematic', label: 'Semi Industry',   assetClass: 'equity' },
  { ticker: 'XBI',  group: 'thematic', label: 'Biotech',         assetClass: 'equity' },
  { ticker: 'ICLN', group: 'thematic', label: 'Clean Energy',    assetClass: 'equity' },
  { ticker: 'SCHG', group: 'thematic', label: 'US Large Growth', assetClass: 'equity' },
  { ticker: 'MTUM', group: 'thematic', label: 'Momentum',        assetClass: 'equity' },
  { ticker: 'ARKK', group: 'thematic', label: 'ARK Innovation',  assetClass: 'equity' },
]

// ── Commodities / Alternatives ───────────────────────────────────────────────
export const COMMODITY_META: ETFMeta[] = [
  { ticker: 'GLD',  group: 'commodity', label: 'Gold',         assetClass: 'commodity' },
  { ticker: 'SLV',  group: 'commodity', label: 'Silver',       assetClass: 'commodity' },
  { ticker: 'DBC',  group: 'commodity', label: 'Commodities',  assetClass: 'commodity' },
  { ticker: 'VNQ',  group: 'commodity', label: 'US REIT',      assetClass: 'mixed' },
  { ticker: 'IAU',  group: 'commodity', label: 'iSh Gold',     assetClass: 'commodity' },
]

export const ALL_META: ETFMeta[] = [
  ...BROAD_META,
  ...SECTOR_META,
  ...GEO_META,
  ...STYLE_META,
  ...BOND_META,
  ...DIVIDEND_META,
  ...THEMATIC_META,
  ...COMMODITY_META,
]

export const ALL_TICKERS: string[] = ALL_META.map((m) => m.ticker)

// ── Centralized category-average expense ratios ───────────────────────────────
// Used by ETFHeatmapGrid to show a "vs category avg" expense bar.
export const CATEGORY_AVG_EXPENSE: Record<ETFGroup, number> = {
  broad:     0.0004,  // index funds, ~0.04%
  sector:    0.0013,  // SPDR sectors, ~0.13%
  geo:       0.0035,  // international ETFs, ~0.35%
  style:     0.0015,  // factor/style ETFs, ~0.15%
  bond:      0.0006,  // bond ETFs, ~0.06%
  dividend:  0.0010,  // dividend ETFs, ~0.10%
  thematic:  0.0050,  // thematic/active ETFs, ~0.50%
  commodity: 0.0025,  // commodity ETFs, ~0.25%
}

/** Returns the display name for a group. */
export function groupLabel(group: ETFGroup): string {
  switch (group) {
    case 'broad':     return 'Broad Market'
    case 'sector':    return 'US Sectors'
    case 'geo':       return 'International'
    case 'style':     return 'Style / Factor'
    case 'bond':      return 'Fixed Income'
    case 'dividend':  return 'Dividend'
    case 'thematic':  return 'Thematic'
    case 'commodity': return 'Commodities'
  }
}

/** Returns a short asset class badge label. */
export function assetClassLabel(ac: AssetClass): string {
  switch (ac) {
    case 'equity':    return 'Equity'
    case 'bond':      return 'Bond'
    case 'commodity': return 'Commodity'
    case 'mixed':     return 'Mixed'
  }
}
