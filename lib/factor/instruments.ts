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
// Complete panel of stocks traded on BYMA (Bolsas y Mercados Argentinos)
const MERVAL_BENCHMARK = '^MERV'

const MERVAL_STOCKS: Omit<Instrument, 'isCedear' | 'cedearTicker' | 'cedearRatio'>[] = [
  // Banks & Financials
  { ticker: 'GGAL.BA',  displayTicker: 'GGAL',  name: 'Grupo Financiero Galicia',         market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',     benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'BMA.BA',   displayTicker: 'BMA',   name: 'Banco Macro',                      market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',     benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'SUPV.BA',  displayTicker: 'SUPV',  name: 'Banco Supervielle',                market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',     benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'BBAR.BA',  displayTicker: 'BBAR',  name: 'BBVA Argentina',                   market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',     benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'BHIP.BA',  displayTicker: 'BHIP',  name: 'Banco Hipotecario',                market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',     benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'BYMA.BA',  displayTicker: 'BYMA',  name: 'Bolsas y Mercados Argentinos',     market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',     benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'VALO.BA',  displayTicker: 'VALO',  name: 'Grupo Financiero Valores',         market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',     benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'GCDI.BA',  displayTicker: 'GCDI',  name: 'Grupo Consultatio',                market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Financials',     benchmarkTicker: MERVAL_BENCHMARK },
  // Energy & Utilities
  { ticker: 'YPF.BA',   displayTicker: 'YPF',   name: 'YPF',                              market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Energy',         benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'PAMP.BA',  displayTicker: 'PAMP',  name: 'Pampa Energía',                    market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Energy',         benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'CEPU.BA',  displayTicker: 'CEPU',  name: 'Central Puerto',                   market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Utilities',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'TGSU2.BA', displayTicker: 'TGSU2', name: 'Transportadora Gas del Sur',       market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Energy',         benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'TGNO4.BA', displayTicker: 'TGNO4', name: 'Transportadora Gas del Norte',     market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Energy',         benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'METR.BA',  displayTicker: 'METR',  name: 'MetroGAS',                         market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Utilities',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'DGCU2.BA', displayTicker: 'DGCU2', name: 'Distribuidora Gas Cuyana',         market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Utilities',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'PATA.BA',  displayTicker: 'PATA',  name: 'Patagonia Gold',                   market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Materials',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'EDNS.BA',  displayTicker: 'EDNS',  name: 'Empresa Distribuidora Norte',      market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Utilities',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'EDENOR.BA',displayTicker: 'EDN',   name: 'Edenor',                           market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Utilities',      benchmarkTicker: MERVAL_BENCHMARK },
  // Materials & Industrials
  { ticker: 'TXAR.BA',  displayTicker: 'TXAR',  name: 'Ternium Argentina',                market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Materials',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'ALUA.BA',  displayTicker: 'ALUA',  name: 'Aluar',                            market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Materials',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'LOMA.BA',  displayTicker: 'LOMA',  name: 'Loma Negra',                       market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Materials',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'MTLV.BA',  displayTicker: 'MTLV',  name: 'Metalúrgica Villa del Parque',     market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Industrials',    benchmarkTicker: MERVAL_BENCHMARK },
  // Real Estate
  { ticker: 'IRSA.BA',  displayTicker: 'IRSA',  name: 'IRSA Inversiones',                 market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Real Estate',    benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'CRES.BA',  displayTicker: 'CRES',  name: 'Cresud',                           market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Real Estate',    benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'INTR.BA',  displayTicker: 'INTR',  name: 'Intermédica',                      market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Real Estate',    benchmarkTicker: MERVAL_BENCHMARK },
  // Telecom & Media
  { ticker: 'TECO2.BA', displayTicker: 'TECO2', name: 'Telecom Argentina',                market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Telecom',        benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'CVH.BA',   displayTicker: 'CVH',   name: 'Cablevision Holding',              market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Telecom',        benchmarkTicker: MERVAL_BENCHMARK },
  // Consumer & Retail
  { ticker: 'COME.BA',  displayTicker: 'COME',  name: 'Sociedad Comercial del Plata',     market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Consumer',       benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'MIRG.BA',  displayTicker: 'MIRG',  name: 'Mirgor',                           market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Consumer',       benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'HAVA.BA',  displayTicker: 'HAVA',  name: 'Havanna Holding',                  market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Consumer',       benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'AGRO.BA',  displayTicker: 'AGRO',  name: 'Agrometal',                        market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Industrials',    benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'RICH.BA',  displayTicker: 'RICH',  name: 'Rigolleau',                        market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Materials',      benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'RIGO.BA',  displayTicker: 'RIGO',  name: 'Grupo Inversor Petroquímica',      market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Energy',         benchmarkTicker: MERVAL_BENCHMARK },
  { ticker: 'SEMI.BA',  displayTicker: 'SEMI',  name: 'Instituto Rosenbusch',             market: 'MERVAL', assetType: 'equity', currency: 'ARS', sector: 'Healthcare',     benchmarkTicker: MERVAL_BENCHMARK },
]

// ── NYSE Equities — S&P 500 large caps ───────────────────────────────────────
const NYSE_BENCHMARK = 'SPY'

const NYSE_STOCKS: Omit<Instrument, 'isCedear' | 'cedearTicker' | 'cedearRatio'>[] = [
  // Financials
  { ticker: 'JPM',   displayTicker: 'JPM',   name: 'JPMorgan Chase',          market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'BAC',   displayTicker: 'BAC',   name: 'Bank of America',         market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'WFC',   displayTicker: 'WFC',   name: 'Wells Fargo',             market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'GS',    displayTicker: 'GS',    name: 'Goldman Sachs',           market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'MS',    displayTicker: 'MS',    name: 'Morgan Stanley',          market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'C',     displayTicker: 'C',     name: 'Citigroup',               market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'BLK',   displayTicker: 'BLK',   name: 'BlackRock',               market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'AXP',   displayTicker: 'AXP',   name: 'American Express',        market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'USB',   displayTicker: 'USB',   name: 'US Bancorp',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'BRK-B', displayTicker: 'BRK-B', name: 'Berkshire Hathaway B',   market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'V',     displayTicker: 'V',     name: 'Visa',                    market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'MA',    displayTicker: 'MA',    name: 'Mastercard',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'SPGI',  displayTicker: 'SPGI',  name: 'S&P Global',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'ICE',   displayTicker: 'ICE',   name: 'Intercontinental Exchange',market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Financials',  benchmarkTicker: NYSE_BENCHMARK },
  // Consumer Staples & Discretionary
  { ticker: 'WMT',   displayTicker: 'WMT',   name: 'Walmart',                 market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'KO',    displayTicker: 'KO',    name: 'Coca-Cola',               market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'PEP',   displayTicker: 'PEP',   name: 'PepsiCo',                 market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'MCD',   displayTicker: 'MCD',   name: "McDonald's",              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'NKE',   displayTicker: 'NKE',   name: 'Nike',                    market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'PG',    displayTicker: 'PG',    name: 'Procter & Gamble',        market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'PM',    displayTicker: 'PM',    name: 'Philip Morris',           market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'MO',    displayTicker: 'MO',    name: 'Altria',                  market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'CL',    displayTicker: 'CL',    name: 'Colgate-Palmolive',       market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'KHC',   displayTicker: 'KHC',   name: 'Kraft Heinz',             market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'TGT',   displayTicker: 'TGT',   name: 'Target',                  market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'HD',    displayTicker: 'HD',    name: 'Home Depot',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'LOW',   displayTicker: 'LOW',   name: "Lowe's",                  market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'F',     displayTicker: 'F',     name: 'Ford Motor',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'GM',    displayTicker: 'GM',    name: 'General Motors',          market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NYSE_BENCHMARK },
  // Healthcare
  { ticker: 'JNJ',   displayTicker: 'JNJ',   name: 'Johnson & Johnson',       market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'PFE',   displayTicker: 'PFE',   name: 'Pfizer',                  market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'UNH',   displayTicker: 'UNH',   name: 'UnitedHealth',            market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'LLY',   displayTicker: 'LLY',   name: 'Eli Lilly',               market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'ABT',   displayTicker: 'ABT',   name: 'Abbott Laboratories',     market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'TMO',   displayTicker: 'TMO',   name: 'Thermo Fisher Scientific',market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'DHR',   displayTicker: 'DHR',   name: 'Danaher',                 market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'MDT',   displayTicker: 'MDT',   name: 'Medtronic',               market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'CVS',   displayTicker: 'CVS',   name: 'CVS Health',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'ELV',   displayTicker: 'ELV',   name: 'Elevance Health',         market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'CI',    displayTicker: 'CI',    name: 'Cigna',                   market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'HCA',   displayTicker: 'HCA',   name: 'HCA Healthcare',          market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NYSE_BENCHMARK },
  // Energy
  { ticker: 'XOM',   displayTicker: 'XOM',   name: 'ExxonMobil',              market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Energy',       benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'CVX',   displayTicker: 'CVX',   name: 'Chevron',                 market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Energy',       benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'COP',   displayTicker: 'COP',   name: 'ConocoPhillips',          market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Energy',       benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'SLB',   displayTicker: 'SLB',   name: 'SLB (Schlumberger)',       market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Energy',       benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'EOG',   displayTicker: 'EOG',   name: 'EOG Resources',           market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Energy',       benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'PXD',   displayTicker: 'PXD',   name: 'Pioneer Natural Resources',market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Energy',      benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'OXY',   displayTicker: 'OXY',   name: 'Occidental Petroleum',    market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Energy',       benchmarkTicker: NYSE_BENCHMARK },
  // Industrials
  { ticker: 'CAT',   displayTicker: 'CAT',   name: 'Caterpillar',             market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'BA',    displayTicker: 'BA',    name: 'Boeing',                  market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'HON',   displayTicker: 'HON',   name: 'Honeywell',               market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'GE',    displayTicker: 'GE',    name: 'GE Aerospace',            market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'RTX',   displayTicker: 'RTX',   name: 'RTX (Raytheon)',          market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'LMT',   displayTicker: 'LMT',   name: 'Lockheed Martin',         market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'DE',    displayTicker: 'DE',    name: 'Deere & Company',         market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'UPS',   displayTicker: 'UPS',   name: 'UPS',                     market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'FDX',   displayTicker: 'FDX',   name: 'FedEx',                   market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'MMM',   displayTicker: 'MMM',   name: '3M',                      market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'EMR',   displayTicker: 'EMR',   name: 'Emerson Electric',        market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Industrials',  benchmarkTicker: NYSE_BENCHMARK },
  // Materials
  { ticker: 'LIN',   displayTicker: 'LIN',   name: 'Linde',                   market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Materials',    benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'SHW',   displayTicker: 'SHW',   name: 'Sherwin-Williams',        market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Materials',    benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'FCX',   displayTicker: 'FCX',   name: 'Freeport-McMoRan',        market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Materials',    benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'NEM',   displayTicker: 'NEM',   name: 'Newmont',                 market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Materials',    benchmarkTicker: NYSE_BENCHMARK },
  // Utilities & Telecom
  { ticker: 'T',     displayTicker: 'T',     name: 'AT&T',                    market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Telecom',      benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'VZ',    displayTicker: 'VZ',    name: 'Verizon',                 market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Telecom',      benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'NEE',   displayTicker: 'NEE',   name: 'NextEra Energy',          market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Utilities',    benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'DUK',   displayTicker: 'DUK',   name: 'Duke Energy',             market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Utilities',    benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'SO',    displayTicker: 'SO',    name: 'Southern Company',        market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Utilities',    benchmarkTicker: NYSE_BENCHMARK },
  // Real Estate
  { ticker: 'AMT',   displayTicker: 'AMT',   name: 'American Tower',          market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Real Estate',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'PLD',   displayTicker: 'PLD',   name: 'Prologis',                market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Real Estate',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'CCI',   displayTicker: 'CCI',   name: 'Crown Castle',            market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Real Estate',  benchmarkTicker: NYSE_BENCHMARK },
  { ticker: 'SPG',   displayTicker: 'SPG',   name: 'Simon Property Group',    market: 'NYSE', assetType: 'equity', currency: 'USD', sector: 'Real Estate',  benchmarkTicker: NYSE_BENCHMARK },
]

// ── NASDAQ Equities — large cap tech + growth ─────────────────────────────────
const NASDAQ_BENCHMARK = 'QQQ'

const NASDAQ_STOCKS: Omit<Instrument, 'isCedear' | 'cedearTicker' | 'cedearRatio'>[] = [
  // Mega-cap tech
  { ticker: 'AAPL',  displayTicker: 'AAPL',  name: 'Apple',                   market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'MSFT',  displayTicker: 'MSFT',  name: 'Microsoft',               market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'GOOGL', displayTicker: 'GOOGL', name: 'Alphabet A',              market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'GOOG',  displayTicker: 'GOOG',  name: 'Alphabet C',              market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'AMZN',  displayTicker: 'AMZN',  name: 'Amazon',                  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'META',  displayTicker: 'META',  name: 'Meta Platforms',          market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'NVDA',  displayTicker: 'NVDA',  name: 'NVIDIA',                  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'TSLA',  displayTicker: 'TSLA',  name: 'Tesla',                   market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'NFLX',  displayTicker: 'NFLX',  name: 'Netflix',                 market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  // Semiconductors
  { ticker: 'INTC',  displayTicker: 'INTC',  name: 'Intel',                   market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'AMD',   displayTicker: 'AMD',   name: 'AMD',                     market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'AVGO',  displayTicker: 'AVGO',  name: 'Broadcom',                market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'QCOM',  displayTicker: 'QCOM',  name: 'Qualcomm',                market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'TXN',   displayTicker: 'TXN',   name: 'Texas Instruments',       market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'MU',    displayTicker: 'MU',    name: 'Micron Technology',       market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'AMAT',  displayTicker: 'AMAT',  name: 'Applied Materials',       market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'LRCX',  displayTicker: 'LRCX',  name: 'Lam Research',            market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'KLAC',  displayTicker: 'KLAC',  name: 'KLA Corporation',         market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'ASML',  displayTicker: 'ASML',  name: 'ASML',                    market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'ARM',   displayTicker: 'ARM',   name: 'Arm Holdings',            market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  // Software / Cloud
  { ticker: 'ADBE',  displayTicker: 'ADBE',  name: 'Adobe',                   market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'CRM',   displayTicker: 'CRM',   name: 'Salesforce',              market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'ORCL',  displayTicker: 'ORCL',  name: 'Oracle',                  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'NOW',   displayTicker: 'NOW',   name: 'ServiceNow',              market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'INTU',  displayTicker: 'INTU',  name: 'Intuit',                  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'PANW',  displayTicker: 'PANW',  name: 'Palo Alto Networks',      market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'CRWD',  displayTicker: 'CRWD',  name: 'CrowdStrike',             market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'SNOW',  displayTicker: 'SNOW',  name: 'Snowflake',               market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'DDOG',  displayTicker: 'DDOG',  name: 'Datadog',                 market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'ZS',    displayTicker: 'ZS',    name: 'Zscaler',                 market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'FTNT',  displayTicker: 'FTNT',  name: 'Fortinet',                market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'WDAY',  displayTicker: 'WDAY',  name: 'Workday',                 market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'TEAM',  displayTicker: 'TEAM',  name: 'Atlassian',               market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'OKTA',  displayTicker: 'OKTA',  name: 'Okta',                    market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  // Internet / E-commerce
  { ticker: 'MELI',  displayTicker: 'MELI',  name: 'MercadoLibre',            market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'BABA',  displayTicker: 'BABA',  name: 'Alibaba',                 market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'PDD',   displayTicker: 'PDD',   name: 'PDD Holdings (Temu)',     market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'JD',    displayTicker: 'JD',    name: 'JD.com',                  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'EBAY',  displayTicker: 'EBAY',  name: 'eBay',                    market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'PYPL',  displayTicker: 'PYPL',  name: 'PayPal',                  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'SQ',    displayTicker: 'SQ',    name: 'Block (Square)',          market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'SHOP',  displayTicker: 'SHOP',  name: 'Shopify',                 market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'ABNB',  displayTicker: 'ABNB',  name: 'Airbnb',                  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'UBER',  displayTicker: 'UBER',  name: 'Uber',                    market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'LYFT',  displayTicker: 'LYFT',  name: 'Lyft',                    market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'DASH',  displayTicker: 'DASH',  name: 'DoorDash',                market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  // Biotech & Healthcare
  { ticker: 'AMGN',  displayTicker: 'AMGN',  name: 'Amgen',                   market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'GILD',  displayTicker: 'GILD',  name: 'Gilead Sciences',         market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'REGN',  displayTicker: 'REGN',  name: 'Regeneron',               market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'VRTX',  displayTicker: 'VRTX',  name: 'Vertex Pharmaceuticals',  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'BIIB',  displayTicker: 'BIIB',  name: 'Biogen',                  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'MRNA',  displayTicker: 'MRNA',  name: 'Moderna',                 market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'ILMN',  displayTicker: 'ILMN',  name: 'Illumina',                market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Healthcare',   benchmarkTicker: NASDAQ_BENCHMARK },
  // Media & Entertainment
  { ticker: 'CMCSA', displayTicker: 'CMCSA', name: 'Comcast',                 market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Telecom',      benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'CHTR',  displayTicker: 'CHTR',  name: 'Charter Communications',  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Telecom',      benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'WBD',   displayTicker: 'WBD',   name: 'Warner Bros. Discovery',  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'PARA',  displayTicker: 'PARA',  name: 'Paramount Global',        market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NASDAQ_BENCHMARK },
  // EV / Clean Energy
  { ticker: 'RIVN',  displayTicker: 'RIVN',  name: 'Rivian',                  market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'LCID',  displayTicker: 'LCID',  name: 'Lucid Motors',            market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Consumer',     benchmarkTicker: NASDAQ_BENCHMARK },
  // AI / Other notable
  { ticker: 'PLTR',  displayTicker: 'PLTR',  name: 'Palantir',                market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'AI',    displayTicker: 'AI',    name: 'C3.ai',                   market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'SOUN',  displayTicker: 'SOUN',  name: 'SoundHound AI',           market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Technology',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'COIN',  displayTicker: 'COIN',  name: 'Coinbase',                market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NASDAQ_BENCHMARK },
  { ticker: 'HOOD',  displayTicker: 'HOOD',  name: 'Robinhood',               market: 'NASDAQ', assetType: 'equity', currency: 'USD', sector: 'Financials',   benchmarkTicker: NASDAQ_BENCHMARK },
]

// ── ROFEX Futures ─────────────────────────────────────────────────────────────
const ROFEX_FUTURES: Omit<Instrument, 'isCedear' | 'cedearTicker' | 'cedearRatio'>[] = [
  { ticker: 'ZS=F',  displayTicker: 'ZS',  name: 'Soybeans (CBOT/ROFEX proxy)',       market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZS=F'  },
  { ticker: 'ZC=F',  displayTicker: 'ZC',  name: 'Corn (CBOT/ROFEX proxy)',            market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZC=F'  },
  { ticker: 'ZW=F',  displayTicker: 'ZW',  name: 'Wheat (CBOT/ROFEX proxy)',           market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZW=F'  },
  { ticker: 'ZL=F',  displayTicker: 'ZL',  name: 'Soybean Oil (CBOT/ROFEX proxy)',     market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZL=F'  },
  { ticker: 'ZM=F',  displayTicker: 'ZM',  name: 'Soybean Meal (CBOT/ROFEX proxy)',    market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'ZM=F'  },
  { ticker: 'GC=F',  displayTicker: 'GC',  name: 'Gold (COMEX)',                       market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'GC=F'  },
  { ticker: 'SI=F',  displayTicker: 'SI',  name: 'Silver (COMEX)',                     market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'SI=F'  },
  { ticker: 'CL=F',  displayTicker: 'CL',  name: 'Crude Oil WTI (NYMEX)',              market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'CL=F'  },
  { ticker: 'BZ=F',  displayTicker: 'BZ',  name: 'Brent Crude (ICE)',                  market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'BZ=F'  },
  { ticker: 'NG=F',  displayTicker: 'NG',  name: 'Natural Gas (NYMEX)',                market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'NG=F'  },
  { ticker: 'HG=F',  displayTicker: 'HG',  name: 'Copper (COMEX)',                     market: 'ROFEX', assetType: 'future', currency: 'USD', benchmarkTicker: 'HG=F'  },
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
