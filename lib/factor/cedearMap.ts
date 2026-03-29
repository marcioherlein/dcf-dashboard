/**
 * CEDEAR (Certificado de Depósito Argentino) mapping.
 * CEDEARs are Argentine depositary receipts that track foreign stocks, traded in ARS on BYMA.
 * The "ratio" is how many CEDEAR units represent 1 underlying share.
 * The BCBA ticker is the symbol used on the Buenos Aires stock exchange.
 */
export interface CedearEntry {
  usTicker: string      // US/foreign ticker (e.g. AAPL)
  bcbaTicker: string    // CEDEAR ticker on BYMA (e.g. AAPL)
  ratio: number         // CEDEARs per 1 underlying share (e.g. 10 means 10 CEDEARs = 1 AAPL)
  name: string
}

export const CEDEAR_MAP: CedearEntry[] = [
  { usTicker: 'AAPL',   bcbaTicker: 'AAPL',  ratio: 10,  name: 'Apple' },
  { usTicker: 'MSFT',   bcbaTicker: 'MSFT',  ratio: 10,  name: 'Microsoft' },
  { usTicker: 'GOOGL',  bcbaTicker: 'GOOGL', ratio: 25,  name: 'Alphabet Class A' },
  { usTicker: 'AMZN',   bcbaTicker: 'AMZN',  ratio: 15,  name: 'Amazon' },
  { usTicker: 'META',   bcbaTicker: 'META',  ratio: 10,  name: 'Meta Platforms' },
  { usTicker: 'NVDA',   bcbaTicker: 'NVDA',  ratio: 10,  name: 'NVIDIA' },
  { usTicker: 'TSLA',   bcbaTicker: 'TSLA',  ratio: 10,  name: 'Tesla' },
  { usTicker: 'NFLX',   bcbaTicker: 'NFLX',  ratio: 10,  name: 'Netflix' },
  { usTicker: 'JPM',    bcbaTicker: 'JPM',   ratio: 5,   name: 'JPMorgan Chase' },
  { usTicker: 'BAC',    bcbaTicker: 'BAC',   ratio: 2,   name: 'Bank of America' },
  { usTicker: 'GS',     bcbaTicker: 'GS',    ratio: 10,  name: 'Goldman Sachs' },
  { usTicker: 'MS',     bcbaTicker: 'MS',    ratio: 5,   name: 'Morgan Stanley' },
  { usTicker: 'C',      bcbaTicker: 'C',     ratio: 5,   name: 'Citigroup' },
  { usTicker: 'V',      bcbaTicker: 'V',     ratio: 10,  name: 'Visa' },
  { usTicker: 'MA',     bcbaTicker: 'MA',    ratio: 10,  name: 'Mastercard' },
  { usTicker: 'PYPL',   bcbaTicker: 'PYPL',  ratio: 5,   name: 'PayPal' },
  { usTicker: 'WMT',    bcbaTicker: 'WMT',   ratio: 10,  name: 'Walmart' },
  { usTicker: 'KO',     bcbaTicker: 'KO',    ratio: 2,   name: 'Coca-Cola' },
  { usTicker: 'PEP',    bcbaTicker: 'PEP',   ratio: 5,   name: 'PepsiCo' },
  { usTicker: 'MCD',    bcbaTicker: 'MCD',   ratio: 10,  name: "McDonald's" },
  { usTicker: 'NKE',    bcbaTicker: 'NKE',   ratio: 5,   name: 'Nike' },
  { usTicker: 'DIS',    bcbaTicker: 'DIS',   ratio: 5,   name: 'Walt Disney' },
  { usTicker: 'SBUX',   bcbaTicker: 'SBUX',  ratio: 5,   name: 'Starbucks' },
  { usTicker: 'JNJ',    bcbaTicker: 'JNJ',   ratio: 10,  name: 'Johnson & Johnson' },
  { usTicker: 'PFE',    bcbaTicker: 'PFE',   ratio: 2,   name: 'Pfizer' },
  { usTicker: 'ABBV',   bcbaTicker: 'ABBV',  ratio: 5,   name: 'AbbVie' },
  { usTicker: 'MRK',    bcbaTicker: 'MRK',   ratio: 5,   name: 'Merck' },
  { usTicker: 'XOM',    bcbaTicker: 'XOM',   ratio: 3,   name: 'ExxonMobil' },
  { usTicker: 'CVX',    bcbaTicker: 'CVX',   ratio: 5,   name: 'Chevron' },
  { usTicker: 'INTC',   bcbaTicker: 'INTC',  ratio: 2,   name: 'Intel' },
  { usTicker: 'AMD',    bcbaTicker: 'AMD',   ratio: 5,   name: 'AMD' },
  { usTicker: 'QCOM',   bcbaTicker: 'QCOM',  ratio: 5,   name: 'Qualcomm' },
  { usTicker: 'AVGO',   bcbaTicker: 'AVGO',  ratio: 25,  name: 'Broadcom' },
  { usTicker: 'CRM',    bcbaTicker: 'CRM',   ratio: 10,  name: 'Salesforce' },
  { usTicker: 'ORCL',   bcbaTicker: 'ORCL',  ratio: 5,   name: 'Oracle' },
  { usTicker: 'ADBE',   bcbaTicker: 'ADBE',  ratio: 10,  name: 'Adobe' },
  { usTicker: 'MELI',   bcbaTicker: 'MELI',  ratio: 50,  name: 'MercadoLibre' },
  { usTicker: 'BABA',   bcbaTicker: 'BABA',  ratio: 10,  name: 'Alibaba' },
  { usTicker: 'SHOP',   bcbaTicker: 'SHOP',  ratio: 10,  name: 'Shopify' },
  { usTicker: 'SPOT',   bcbaTicker: 'SPOT',  ratio: 10,  name: 'Spotify' },
  { usTicker: 'UBER',   bcbaTicker: 'UBER',  ratio: 2,   name: 'Uber' },
  { usTicker: 'ABNB',   bcbaTicker: 'ABNB',  ratio: 10,  name: 'Airbnb' },
  { usTicker: 'BA',     bcbaTicker: 'BA',    ratio: 10,  name: 'Boeing' },
  { usTicker: 'CAT',    bcbaTicker: 'CAT',   ratio: 10,  name: 'Caterpillar' },
  { usTicker: 'T',      bcbaTicker: 'T',     ratio: 1,   name: 'AT&T' },
  { usTicker: 'VZ',     bcbaTicker: 'VZ',    ratio: 2,   name: 'Verizon' },
  { usTicker: 'BRK-B',  bcbaTicker: 'BRKB',  ratio: 5,   name: 'Berkshire Hathaway B' },
  { usTicker: 'UNH',    bcbaTicker: 'UNH',   ratio: 10,  name: 'UnitedHealth' },
  { usTicker: 'LLY',    bcbaTicker: 'LLY',   ratio: 10,  name: 'Eli Lilly' },
  { usTicker: 'COIN',   bcbaTicker: 'COIN',  ratio: 10,  name: 'Coinbase' },
]

// Lookup set for O(1) check
export const CEDEAR_US_TICKERS = new Set(CEDEAR_MAP.map((c) => c.usTicker))

export function getCedear(usTicker: string): CedearEntry | undefined {
  return CEDEAR_MAP.find((c) => c.usTicker === usTicker)
}
