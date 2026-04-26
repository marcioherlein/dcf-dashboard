export type UniverseCategory = 'AI Stack' | 'CEDEAR' | 'BYMA'

export interface UniverseEntry {
  ticker: string
  name: string
  layer: string
  category: UniverseCategory
}

const RAW_UNIVERSE: UniverseEntry[] = [
  // ── AI Stack ────────────────────────────────────────────────────────────────
  { ticker: 'NVDA',  name: 'Nvidia',             layer: 'Chip Design',      category: 'AI Stack' },
  { ticker: 'AMD',   name: 'AMD',                layer: 'Chip Design',      category: 'AI Stack' },
  { ticker: 'AVGO',  name: 'Broadcom',           layer: 'Chip Design',      category: 'AI Stack' },
  { ticker: 'INTC',  name: 'Intel',              layer: 'Chip Design',      category: 'AI Stack' },
  { ticker: 'QCOM',  name: 'Qualcomm',           layer: 'Chip Design',      category: 'AI Stack' },
  { ticker: 'MSFT',  name: 'Microsoft',          layer: 'Hyperscaler',      category: 'AI Stack' },
  { ticker: 'GOOGL', name: 'Alphabet',           layer: 'Hyperscaler',      category: 'AI Stack' },
  { ticker: 'AMZN',  name: 'Amazon',             layer: 'Hyperscaler',      category: 'AI Stack' },
  { ticker: 'META',  name: 'Meta',               layer: 'Hyperscaler',      category: 'AI Stack' },
  { ticker: 'ASML',  name: 'ASML',               layer: 'Semi Equipment',   category: 'AI Stack' },
  { ticker: 'LRCX',  name: 'Lam Research',       layer: 'Semi Equipment',   category: 'AI Stack' },
  { ticker: 'KLAC',  name: 'KLA Corp',           layer: 'Semi Equipment',   category: 'AI Stack' },
  { ticker: 'AMAT',  name: 'Applied Materials',  layer: 'Semi Equipment',   category: 'AI Stack' },
  { ticker: 'NET',   name: 'Cloudflare',         layer: 'Edge / Cloud',     category: 'AI Stack' },
  { ticker: 'ORCL',  name: 'Oracle',             layer: 'Edge / Cloud',     category: 'AI Stack' },
  { ticker: 'EQIX',  name: 'Equinix',            layer: 'DC REIT',          category: 'AI Stack' },
  { ticker: 'TSM',   name: 'TSMC (ADR)',         layer: 'Semi Mfg',         category: 'AI Stack' },

  // ── CEDEARs — Technology ────────────────────────────────────────────────────
  { ticker: 'AAPL',  name: 'Apple',              layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'TSLA',  name: 'Tesla',              layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'NFLX',  name: 'Netflix',            layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'ADBE',  name: 'Adobe',              layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'CRM',   name: 'Salesforce',         layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'IBM',   name: 'IBM',                layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'CSCO',  name: 'Cisco',              layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'TXN',   name: 'Texas Instruments',  layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'MU',    name: 'Micron',             layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'SHOP',  name: 'Shopify',            layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'PYPL',  name: 'PayPal',             layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'UBER',  name: 'Uber',               layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'SPOT',  name: 'Spotify',            layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'SNAP',  name: 'Snap',               layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'BABA',  name: 'Alibaba',            layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'MELI',  name: 'MercadoLibre',       layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'GLOB',  name: 'Globant',            layer: 'Technology',       category: 'CEDEAR' },
  { ticker: 'DESP',  name: 'Despegar',           layer: 'Technology',       category: 'CEDEAR' },

  // ── CEDEARs — Financials ────────────────────────────────────────────────────
  { ticker: 'JPM',   name: 'JPMorgan Chase',     layer: 'Financials',       category: 'CEDEAR' },
  { ticker: 'BAC',   name: 'Bank of America',    layer: 'Financials',       category: 'CEDEAR' },
  { ticker: 'GS',    name: 'Goldman Sachs',      layer: 'Financials',       category: 'CEDEAR' },
  { ticker: 'MS',    name: 'Morgan Stanley',     layer: 'Financials',       category: 'CEDEAR' },
  { ticker: 'V',     name: 'Visa',               layer: 'Financials',       category: 'CEDEAR' },
  { ticker: 'MA',    name: 'Mastercard',         layer: 'Financials',       category: 'CEDEAR' },
  { ticker: 'BRK-B', name: 'Berkshire Hathaway', layer: 'Financials',       category: 'CEDEAR' },

  // ── CEDEARs — Consumer ──────────────────────────────────────────────────────
  { ticker: 'WMT',   name: 'Walmart',            layer: 'Consumer',         category: 'CEDEAR' },
  { ticker: 'HD',    name: 'Home Depot',         layer: 'Consumer',         category: 'CEDEAR' },
  { ticker: 'MCD',   name: "McDonald's",         layer: 'Consumer',         category: 'CEDEAR' },
  { ticker: 'SBUX',  name: 'Starbucks',          layer: 'Consumer',         category: 'CEDEAR' },
  { ticker: 'NKE',   name: 'Nike',               layer: 'Consumer',         category: 'CEDEAR' },
  { ticker: 'DIS',   name: 'Disney',             layer: 'Consumer',         category: 'CEDEAR' },

  // ── CEDEARs — Healthcare ────────────────────────────────────────────────────
  { ticker: 'PFE',   name: 'Pfizer',             layer: 'Healthcare',       category: 'CEDEAR' },
  { ticker: 'MRNA',  name: 'Moderna',            layer: 'Healthcare',       category: 'CEDEAR' },
  { ticker: 'JNJ',   name: 'Johnson & Johnson',  layer: 'Healthcare',       category: 'CEDEAR' },
  { ticker: 'ABBV',  name: 'AbbVie',             layer: 'Healthcare',       category: 'CEDEAR' },
  { ticker: 'LLY',   name: 'Eli Lilly',          layer: 'Healthcare',       category: 'CEDEAR' },

  // ── CEDEARs — Energy ────────────────────────────────────────────────────────
  { ticker: 'XOM',   name: 'ExxonMobil',         layer: 'Energy',           category: 'CEDEAR' },
  { ticker: 'CVX',   name: 'Chevron',            layer: 'Energy',           category: 'CEDEAR' },

  // ── CEDEARs — Industrials ───────────────────────────────────────────────────
  { ticker: 'BA',    name: 'Boeing',             layer: 'Industrials',      category: 'CEDEAR' },
  { ticker: 'CAT',   name: 'Caterpillar',        layer: 'Industrials',      category: 'CEDEAR' },
  { ticker: 'LMT',   name: 'Lockheed Martin',    layer: 'Industrials',      category: 'CEDEAR' },
  { ticker: 'GE',    name: 'GE Aerospace',       layer: 'Industrials',      category: 'CEDEAR' },
  { ticker: 'GM',    name: 'General Motors',     layer: 'Industrials',      category: 'CEDEAR' },
  { ticker: 'F',     name: 'Ford',               layer: 'Industrials',      category: 'CEDEAR' },

  // ── CEDEARs — Staples ───────────────────────────────────────────────────────
  { ticker: 'KO',    name: 'Coca-Cola',          layer: 'Staples',          category: 'CEDEAR' },
  { ticker: 'PEP',   name: 'PepsiCo',            layer: 'Staples',          category: 'CEDEAR' },
  { ticker: 'PG',    name: 'Procter & Gamble',   layer: 'Staples',          category: 'CEDEAR' },

  // ── BYMA — Argentine stocks (US ADR tickers) ─────────────────────────────
  { ticker: 'GGAL',  name: 'Grupo Galicia',      layer: 'Arg. Banks',       category: 'BYMA' },
  { ticker: 'BMA',   name: 'Banco Macro',        layer: 'Arg. Banks',       category: 'BYMA' },
  { ticker: 'SUPV',  name: 'Supervielle',        layer: 'Arg. Banks',       category: 'BYMA' },
  { ticker: 'BBAR',  name: 'BBVA Argentina',     layer: 'Arg. Banks',       category: 'BYMA' },
  { ticker: 'YPF',   name: 'YPF',                layer: 'Arg. Energy',      category: 'BYMA' },
  { ticker: 'PAM',   name: 'Pampa Energía',      layer: 'Arg. Energy',      category: 'BYMA' },
  { ticker: 'CEPU',  name: 'Central Puerto',     layer: 'Arg. Energy',      category: 'BYMA' },
  { ticker: 'EDN',   name: 'Edenor',             layer: 'Arg. Energy',      category: 'BYMA' },
  { ticker: 'TGS',   name: 'Trans. Gas del Sur', layer: 'Arg. Energy',      category: 'BYMA' },
  { ticker: 'LOMA',  name: 'Loma Negra',         layer: 'Arg. Industry',    category: 'BYMA' },
  { ticker: 'TX',    name: 'Ternium',            layer: 'Arg. Industry',    category: 'BYMA' },
  { ticker: 'IRS',   name: 'IRSA',               layer: 'Arg. Real Estate', category: 'BYMA' },
  { ticker: 'ARCO',  name: 'Arcos Dorados',      layer: 'Arg. Consumer',    category: 'BYMA' },
  { ticker: 'TEO',   name: 'Telecom Argentina',  layer: 'Arg. Telecom',     category: 'BYMA' },
  { ticker: 'CRESY', name: 'Cresud',             layer: 'Arg. Agriculture', category: 'BYMA' },
]

// De-duplicate by ticker (keep first occurrence)
const _seen = new Set<string>()
export const STRATEGY_UNIVERSE: UniverseEntry[] = RAW_UNIVERSE.filter(e => {
  if (_seen.has(e.ticker)) return false
  _seen.add(e.ticker)
  return true
})

export interface StrategyRow {
  ticker: string
  name: string
  layer: string
  category: UniverseCategory
  price: number | null
  change1d: number | null

  momentum12_1: number | null
  momentumRank: number | null

  vol252: number | null
  volRank: number | null

  ma50: number | null
  ma200: number | null
  maSpread: number | null
  maSignal: 'golden' | 'death' | null

  return1m: number | null
  mrZscore: number | null

  pe: number | null
  pb: number | null
  ps: number | null
  evEbitda: number | null
  valueRank: number | null
}
