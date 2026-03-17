import type { CompanyType } from './detectCompanyType'

export type BenchmarkSource = 'live-peers' | 'industry-median' | 'sector-fallback'

export interface PeerQuote {
  ticker: string
  trailingPE: number | null
  priceToBook: number | null
  priceToSales: number | null
  evToEbitda: number | null
  evToRevenue: number | null
}

export interface MultipleEstimate {
  multiple: string
  actualValue: number
  sectorMedian: number          // benchmark value (peer median or industry/sector median)
  benchmarkSource: BenchmarkSource
  peerTickers: string[]         // tickers used for this benchmark (empty if static)
  impliedFairValue: number
  upsidePct: number
  applicable: boolean
  note: string
}

export interface MultiplesResult {
  estimates: MultipleEstimate[]
  blendedFairValue: number | null
  peerTickers: string[]         // union of all peers used across estimates
}

// Damodaran Jan 2025 US industry-level medians — keyed by Yahoo summaryProfile.industry
const INDUSTRY_MEDIANS: Record<string, { pe: number; evEbitda: number; pb: number; ps: number; evRevenue: number }> = {
  // Technology
  'Software—Application':              { pe: 38, evEbitda: 28, pb: 9.0, ps: 7.0, evRevenue: 8.0 },
  'Software—Infrastructure':           { pe: 32, evEbitda: 24, pb: 8.0, ps: 6.5, evRevenue: 7.0 },
  'Semiconductors':                    { pe: 26, evEbitda: 18, pb: 6.5, ps: 6.0, evRevenue: 7.5 },
  'Semiconductor Equipment & Materials': { pe: 22, evEbitda: 16, pb: 5.0, ps: 4.5, evRevenue: 5.0 },
  'Internet Content & Information':    { pe: 24, evEbitda: 16, pb: 6.0, ps: 5.5, evRevenue: 6.0 },
  'Internet Retail':                   { pe: 35, evEbitda: 22, pb: 8.5, ps: 3.5, evRevenue: 3.8 },
  'Consumer Electronics':              { pe: 28, evEbitda: 18, pb: 7.0, ps: 3.5, evRevenue: 3.5 },
  'Electronic Components':             { pe: 20, evEbitda: 14, pb: 4.5, ps: 2.5, evRevenue: 2.8 },
  'IT Services':                       { pe: 22, evEbitda: 14, pb: 5.0, ps: 2.8, evRevenue: 3.0 },
  'Information Technology Services':   { pe: 22, evEbitda: 14, pb: 5.0, ps: 2.8, evRevenue: 3.0 },
  'Computer Hardware':                 { pe: 18, evEbitda: 12, pb: 4.0, ps: 1.8, evRevenue: 2.0 },
  'Communication Equipment':           { pe: 18, evEbitda: 12, pb: 3.5, ps: 2.5, evRevenue: 2.8 },
  'Data Center REITs':                 { pe: 45, evEbitda: 28, pb: 5.0, ps: 9.0, evRevenue: 10.0 },
  // Financial
  'Banks—Diversified':                 { pe: 12, evEbitda: 10, pb: 1.3, ps: 3.2, evRevenue: 3.5 },
  'Banks—Regional':                    { pe: 12, evEbitda: 10, pb: 1.1, ps: 3.0, evRevenue: 3.2 },
  'Insurance—Diversified':             { pe: 13, evEbitda: 11, pb: 1.5, ps: 1.2, evRevenue: 1.3 },
  'Insurance—Life':                    { pe: 11, evEbitda: 9,  pb: 1.2, ps: 1.0, evRevenue: 1.1 },
  'Insurance—Property & Casualty':     { pe: 14, evEbitda: 11, pb: 1.8, ps: 1.4, evRevenue: 1.5 },
  'Capital Markets':                   { pe: 14, evEbitda: 12, pb: 2.2, ps: 3.5, evRevenue: 3.8 },
  'Asset Management':                  { pe: 16, evEbitda: 13, pb: 3.0, ps: 4.0, evRevenue: 4.5 },
  'Financial Data & Stock Exchanges':  { pe: 30, evEbitda: 22, pb: 7.0, ps: 8.0, evRevenue: 9.0 },
  'Credit Services':                   { pe: 18, evEbitda: 14, pb: 4.0, ps: 5.0, evRevenue: 5.5 },
  'Mortgage Finance':                  { pe: 10, evEbitda: 9,  pb: 1.0, ps: 2.5, evRevenue: 2.8 },
  // Healthcare
  'Drug Manufacturers—General':        { pe: 18, evEbitda: 12, pb: 4.5, ps: 4.0, evRevenue: 4.5 },
  'Drug Manufacturers—Specialty & Generic': { pe: 16, evEbitda: 11, pb: 3.5, ps: 3.0, evRevenue: 3.5 },
  'Biotechnology':                     { pe: 35, evEbitda: 25, pb: 5.0, ps: 6.0, evRevenue: 7.0 },
  'Medical Devices':                   { pe: 28, evEbitda: 20, pb: 4.0, ps: 5.0, evRevenue: 5.5 },
  'Medical Instruments & Supplies':    { pe: 26, evEbitda: 18, pb: 4.5, ps: 4.0, evRevenue: 4.5 },
  'Health Care Plans':                 { pe: 16, evEbitda: 10, pb: 3.5, ps: 0.6, evRevenue: 0.7 },
  'Diagnostics & Research':            { pe: 22, evEbitda: 15, pb: 3.5, ps: 3.5, evRevenue: 4.0 },
  'Health Information Services':       { pe: 28, evEbitda: 20, pb: 6.0, ps: 5.0, evRevenue: 5.5 },
  'Medical Care Facilities':           { pe: 18, evEbitda: 12, pb: 3.0, ps: 1.0, evRevenue: 1.1 },
  // Consumer
  'Auto Manufacturers':                { pe: 10, evEbitda: 8,  pb: 1.5, ps: 0.6, evRevenue: 0.7 },
  'Auto Parts':                        { pe: 14, evEbitda: 9,  pb: 2.0, ps: 0.7, evRevenue: 0.8 },
  'Beverages—Non-Alcoholic':           { pe: 24, evEbitda: 18, pb: 8.0, ps: 4.0, evRevenue: 4.5 },
  'Beverages—Alcoholic':               { pe: 18, evEbitda: 14, pb: 3.5, ps: 2.8, evRevenue: 3.2 },
  'Beverages—Brewers':                 { pe: 17, evEbitda: 13, pb: 3.0, ps: 2.5, evRevenue: 2.8 },
  'Restaurants':                       { pe: 25, evEbitda: 16, pb: 8.0, ps: 2.5, evRevenue: 2.8 },
  'Retail—General Merchandise':        { pe: 16, evEbitda: 11, pb: 3.5, ps: 0.5, evRevenue: 0.6 },
  'Grocery Stores':                    { pe: 15, evEbitda: 9,  pb: 3.0, ps: 0.3, evRevenue: 0.4 },
  'Specialty Retail':                  { pe: 18, evEbitda: 12, pb: 5.0, ps: 1.5, evRevenue: 1.8 },
  'Apparel Retail':                    { pe: 16, evEbitda: 11, pb: 4.5, ps: 1.2, evRevenue: 1.4 },
  'Apparel Manufacturing':             { pe: 18, evEbitda: 12, pb: 4.0, ps: 2.0, evRevenue: 2.2 },
  'Household & Personal Products':     { pe: 22, evEbitda: 15, pb: 5.0, ps: 2.8, evRevenue: 3.2 },
  'Packaged Foods':                    { pe: 20, evEbitda: 14, pb: 4.5, ps: 2.0, evRevenue: 2.2 },
  'Personal Services':                 { pe: 20, evEbitda: 13, pb: 5.0, ps: 2.0, evRevenue: 2.2 },
  // Energy
  'Oil & Gas Integrated':              { pe: 11, evEbitda: 7,  pb: 1.5, ps: 1.1, evRevenue: 1.2 },
  'Oil & Gas E&P':                     { pe: 10, evEbitda: 6,  pb: 1.4, ps: 2.5, evRevenue: 2.8 },
  'Oil & Gas Refining & Marketing':    { pe: 9,  evEbitda: 7,  pb: 1.5, ps: 0.3, evRevenue: 0.35 },
  'Oil & Gas Midstream':               { pe: 14, evEbitda: 10, pb: 2.5, ps: 2.0, evRevenue: 2.5 },
  'Oil & Gas Equipment & Services':    { pe: 16, evEbitda: 10, pb: 2.0, ps: 1.5, evRevenue: 1.8 },
  // Industrials
  'Aerospace & Defense':               { pe: 24, evEbitda: 16, pb: 5.5, ps: 2.0, evRevenue: 2.2 },
  'Industrial Conglomerates':          { pe: 21, evEbitda: 14, pb: 3.8, ps: 1.8, evRevenue: 2.0 },
  'Specialty Industrial Machinery':    { pe: 22, evEbitda: 15, pb: 4.5, ps: 2.5, evRevenue: 2.8 },
  'Farm & Heavy Construction Machinery': { pe: 14, evEbitda: 9, pb: 3.0, ps: 1.2, evRevenue: 1.4 },
  'Railroads':                         { pe: 20, evEbitda: 14, pb: 4.5, ps: 4.0, evRevenue: 4.5 },
  'Airlines':                          { pe: 10, evEbitda: 6,  pb: 2.5, ps: 0.5, evRevenue: 0.6 },
  'Trucking':                          { pe: 16, evEbitda: 10, pb: 2.5, ps: 0.8, evRevenue: 0.9 },
  'Waste Management':                  { pe: 30, evEbitda: 20, pb: 7.5, ps: 4.0, evRevenue: 4.5 },
  // Telecom/Media
  'Telecom Services':                  { pe: 14, evEbitda: 8,  pb: 1.8, ps: 1.5, evRevenue: 1.8 },
  'Entertainment':                     { pe: 30, evEbitda: 18, pb: 5.0, ps: 3.0, evRevenue: 3.5 },
  'Broadcasting':                      { pe: 14, evEbitda: 9,  pb: 2.0, ps: 1.5, evRevenue: 1.8 },
  'Electronic Gaming & Multimedia':    { pe: 22, evEbitda: 15, pb: 4.5, ps: 4.0, evRevenue: 4.5 },
  // Utilities
  'Utilities—Regulated Electric':      { pe: 18, evEbitda: 12, pb: 1.8, ps: 2.0, evRevenue: 2.5 },
  'Utilities—Renewable':               { pe: 22, evEbitda: 15, pb: 2.5, ps: 3.5, evRevenue: 4.0 },
  'Utilities—Diversified':             { pe: 17, evEbitda: 11, pb: 1.6, ps: 1.8, evRevenue: 2.0 },
  // Real Estate
  'REIT—Diversified':                  { pe: 35, evEbitda: 20, pb: 2.2, ps: 6.0, evRevenue: 7.0 },
  'REIT—Retail':                       { pe: 30, evEbitda: 18, pb: 2.0, ps: 8.0, evRevenue: 9.0 },
  'REIT—Office':                       { pe: 20, evEbitda: 14, pb: 1.2, ps: 5.0, evRevenue: 5.5 },
  'REIT—Industrial':                   { pe: 40, evEbitda: 25, pb: 3.5, ps: 12.0, evRevenue: 13.0 },
  'Real Estate Services':              { pe: 20, evEbitda: 14, pb: 3.5, ps: 3.0, evRevenue: 3.5 },
  // Materials
  'Basic Materials':                   { pe: 16, evEbitda: 10, pb: 2.0, ps: 1.5, evRevenue: 1.8 },
  'Specialty Chemicals':               { pe: 18, evEbitda: 12, pb: 3.0, ps: 2.0, evRevenue: 2.2 },
  'Steel':                             { pe: 10, evEbitda: 6,  pb: 1.3, ps: 0.6, evRevenue: 0.7 },
  'Aluminum':                          { pe: 12, evEbitda: 7,  pb: 1.5, ps: 0.8, evRevenue: 0.9 },
  'Gold':                              { pe: 18, evEbitda: 10, pb: 2.0, ps: 4.0, evRevenue: 4.5 },
  'default':                           { pe: 20, evEbitda: 14, pb: 3.0, ps: 2.5, evRevenue: 3.0 },
}

// Broad sector fallback (if industry not found)
const SECTOR_MEDIANS: Record<string, { pe: number; evEbitda: number; pb: number; ps: number; evRevenue: number }> = {
  'Technology':              { pe: 28, evEbitda: 20, pb: 7.5, ps: 5.0, evRevenue: 6.0 },
  'Financial Services':      { pe: 14, evEbitda: 12, pb: 1.4, ps: 2.8, evRevenue: 3.5 },
  'Healthcare':              { pe: 24, evEbitda: 16, pb: 4.2, ps: 4.5, evRevenue: 4.5 },
  'Consumer Cyclical':       { pe: 20, evEbitda: 13, pb: 3.5, ps: 1.4, evRevenue: 1.5 },
  'Consumer Defensive':      { pe: 22, evEbitda: 15, pb: 4.0, ps: 1.8, evRevenue: 2.0 },
  'Energy':                  { pe: 12, evEbitda: 8,  pb: 1.6, ps: 1.2, evRevenue: 1.3 },
  'Utilities':               { pe: 18, evEbitda: 12, pb: 1.8, ps: 2.0, evRevenue: 2.5 },
  'Industrials':             { pe: 21, evEbitda: 14, pb: 3.8, ps: 1.8, evRevenue: 2.0 },
  'Basic Materials':         { pe: 16, evEbitda: 10, pb: 2.0, ps: 1.5, evRevenue: 1.8 },
  'Real Estate':             { pe: 35, evEbitda: 20, pb: 2.2, ps: 6.0, evRevenue: 7.0 },
  'Communication Services':  { pe: 22, evEbitda: 14, pb: 4.5, ps: 3.0, evRevenue: 3.5 },
}

// Curated peer groups by Yahoo summaryProfile.industry
export const PEER_TICKERS: Record<string, string[]> = {
  // Technology
  'Software—Application':              ['MSFT', 'ADBE', 'CRM', 'NOW', 'INTU', 'ORCL'],
  'Software—Infrastructure':           ['MSFT', 'CSCO', 'PANW', 'SNPS', 'CDNS', 'FTNT'],
  'Semiconductors':                    ['NVDA', 'AMD', 'AVGO', 'QCOM', 'AMAT', 'INTC'],
  'Semiconductor Equipment & Materials': ['AMAT', 'LRCX', 'KLAC', 'ASML', 'TER', 'ENTG'],
  'Internet Content & Information':    ['GOOGL', 'META', 'SNAP', 'PINS', 'RDDT', 'IAC'],
  'Internet Retail':                   ['AMZN', 'EBAY', 'ETSY', 'CHWY', 'W', 'SHOP'],
  'Consumer Electronics':              ['AAPL', 'SONY', 'HPQ', 'DELL', 'SMCI'],
  'IT Services':                       ['ACN', 'IBM', 'CTSH', 'INFY', 'WIT', 'DXC'],
  'Information Technology Services':   ['ACN', 'IBM', 'CTSH', 'INFY', 'WIT', 'DXC'],
  'Communication Equipment':           ['CSCO', 'JNPR', 'ANET', 'FFIV', 'NTGR'],
  // Financial
  'Banks—Diversified':                 ['JPM', 'BAC', 'C', 'WFC', 'GS', 'MS'],
  'Banks—Regional':                    ['USB', 'PNC', 'RF', 'KEY', 'FITB', 'HBAN'],
  'Insurance—Diversified':             ['MET', 'PRU', 'AFL', 'AIG', 'TRV', 'ALL'],
  'Insurance—Life':                    ['MET', 'PRU', 'LNC', 'UNM', 'PFG', 'VOYA'],
  'Insurance—Property & Casualty':     ['BRK-B', 'TRV', 'ALL', 'PGR', 'CB', 'HIG'],
  'Capital Markets':                   ['GS', 'MS', 'SCHW', 'BX', 'APO', 'KKR'],
  'Asset Management':                  ['BLK', 'TROW', 'IVZ', 'AMG', 'VCTR', 'WDR'],
  'Financial Data & Stock Exchanges':  ['SPGI', 'MCO', 'ICE', 'NDAQ', 'MSCI', 'FDS'],
  'Credit Services':                   ['V', 'MA', 'AXP', 'DFS', 'SYF', 'COF'],
  // Healthcare
  'Drug Manufacturers—General':        ['JNJ', 'PFE', 'MRK', 'ABBV', 'LLY', 'BMY'],
  'Drug Manufacturers—Specialty & Generic': ['TEVA', 'MYL', 'AMRX', 'PRGO', 'ENDP'],
  'Biotechnology':                     ['AMGN', 'GILD', 'REGN', 'VRTX', 'MRNA', 'BIIB'],
  'Medical Devices':                   ['MDT', 'ABT', 'BSX', 'EW', 'ZBH', 'SYK'],
  'Medical Instruments & Supplies':    ['TMO', 'DHR', 'A', 'HOLX', 'NVCR', 'MASI'],
  'Health Care Plans':                 ['UNH', 'CVS', 'CI', 'HUM', 'ELV', 'MOH'],
  'Diagnostics & Research':            ['LH', 'DGX', 'BIO', 'NTRA', 'GH', 'EXAS'],
  'Health Information Services':       ['VEEV', 'HCAT', 'PHR', 'DOCS', 'CERT', 'ONEM'],
  // Consumer Cyclical
  'Auto Manufacturers':                ['TSLA', 'GM', 'F', 'TM', 'RIVN', 'STLA'],
  'Auto Parts':                        ['APTV', 'LEA', 'BWA', 'DAN', 'ALV', 'MGA'],
  'Restaurants':                       ['MCD', 'SBUX', 'CMG', 'YUM', 'QSR', 'DPZ'],
  'Specialty Retail':                  ['HD', 'LOW', 'TJX', 'ROST', 'ULTA', 'NKE'],
  'Apparel Retail':                    ['NKE', 'LULU', 'PVH', 'HBI', 'RL', 'VFC'],
  'Apparel Manufacturing':             ['NKE', 'LULU', 'VFC', 'HBI', 'UA', 'PVH'],
  // Consumer Defensive
  'Beverages—Non-Alcoholic':           ['KO', 'PEP', 'MNST', 'KDP', 'CELH', 'FIZZ'],
  'Beverages—Alcoholic':               ['STZ', 'BUD', 'TAP', 'SAM', 'ABEV'],
  'Beverages—Brewers':                 ['BUD', 'TAP', 'SAM', 'ABEV', 'HEINY'],
  'Retail—General Merchandise':        ['WMT', 'TGT', 'COST', 'DG', 'DLTR', 'BJ'],
  'Grocery Stores':                    ['KR', 'ACI', 'SFM', 'CASY', 'WINN'],
  'Packaged Foods':                    ['GIS', 'CPB', 'K', 'CAG', 'HSY', 'MKC'],
  'Household & Personal Products':     ['PG', 'CL', 'CHD', 'ELF', 'REYN', 'SPB'],
  // Energy
  'Oil & Gas Integrated':              ['XOM', 'CVX', 'BP', 'SHEL', 'TTE', 'COP'],
  'Oil & Gas E&P':                     ['COP', 'EOG', 'DVN', 'FANG', 'MRO', 'APA'],
  'Oil & Gas Refining & Marketing':    ['MPC', 'PSX', 'VLO', 'HFC', 'PBF'],
  'Oil & Gas Midstream':               ['ET', 'EPD', 'WMB', 'OKE', 'KMI', 'MPLX'],
  'Oil & Gas Equipment & Services':    ['SLB', 'HAL', 'BKR', 'NOV', 'FTI'],
  // Industrials
  'Aerospace & Defense':               ['BA', 'RTX', 'LMT', 'NOC', 'GD', 'HII'],
  'Industrial Conglomerates':          ['GE', 'HON', 'MMM', 'EMR', 'ETN', 'ROK'],
  'Specialty Industrial Machinery':    ['ITW', 'PH', 'DOV', 'IR', 'ROP', 'XYL'],
  'Farm & Heavy Construction Machinery': ['CAT', 'DE', 'AGCO', 'CNH', 'OSK'],
  'Railroads':                         ['UNP', 'CSX', 'NSC', 'CP', 'CNI'],
  'Airlines':                          ['DAL', 'UAL', 'AAL', 'LUV', 'JBLU', 'ALK'],
  'Waste Management':                  ['WM', 'RSG', 'CWST', 'SRCL', 'US'],
  // Telecom/Media
  'Telecom Services':                  ['T', 'VZ', 'TMUS', 'LUMN', 'USM'],
  'Entertainment':                     ['NFLX', 'DIS', 'WBD', 'PARA', 'LGF-A'],
  'Broadcasting':                      ['DIS', 'FOX', 'NWSA', 'IPG', 'OMC'],
  'Electronic Gaming & Multimedia':    ['EA', 'TTWO', 'ATVI', 'RBLX', 'PLTK', 'ZNGA'],
  // Utilities
  'Utilities—Regulated Electric':      ['NEE', 'DUK', 'SO', 'D', 'AEP', 'EXC'],
  'Utilities—Renewable':               ['NEE', 'BEP', 'CWEN', 'RUN', 'NOVA', 'ARRY'],
  'Utilities—Diversified':             ['SRE', 'AEE', 'WEC', 'ES', 'CNP', 'NI'],
  // Real Estate
  'REIT—Diversified':                  ['AMT', 'PLD', 'EQIX', 'SPG', 'O', 'PSA'],
  'REIT—Retail':                       ['SPG', 'O', 'NNN', 'MAC', 'SKT', 'BRX'],
  'REIT—Office':                       ['BXP', 'VNO', 'SLG', 'HIW', 'PDM', 'CXP'],
  'REIT—Industrial':                   ['PLD', 'STAG', 'EGP', 'REXR', 'FR', 'LPT'],
  'Real Estate Services':              ['CBRE', 'JLL', 'CWK', 'MMI', 'NMRK', 'RMR'],
  // Materials
  'Specialty Chemicals':               ['APD', 'LIN', 'PPG', 'SHW', 'ECL', 'IFF'],
  'Steel':                             ['NUE', 'STLD', 'X', 'CLF', 'RS', 'CMC'],
  'Aluminum':                          ['AA', 'CENX', 'KALU', 'ARNC'],
  'Gold':                              ['NEM', 'AEM', 'GOLD', 'KGC', 'AU', 'AGI'],
}

function getMedians(industry: string, sector: string) {
  if (INDUSTRY_MEDIANS[industry]) {
    return { medians: INDUSTRY_MEDIANS[industry], source: 'industry-median' as BenchmarkSource }
  }
  if (SECTOR_MEDIANS[sector]) {
    return { medians: SECTOR_MEDIANS[sector], source: 'sector-fallback' as BenchmarkSource }
  }
  return { medians: INDUSTRY_MEDIANS['default'], source: 'sector-fallback' as BenchmarkSource }
}

function peerMedian(
  metricKey: keyof Omit<PeerQuote, 'ticker'>,
  peers: PeerQuote[],
): { value: number; tickers: string[] } | null {
  const hits = peers
    .filter((p) => {
      const v = p[metricKey]
      return v !== null && v > 0 && isFinite(v) && v < 10000
    })
    .map((p) => ({ v: p[metricKey] as number, t: p.ticker }))
    .sort((a, b) => a.v - b.v)

  if (hits.length < 3) return null

  const mid = Math.floor(hits.length / 2)
  const median =
    hits.length % 2 === 0
      ? (hits[mid - 1].v + hits[mid].v) / 2
      : hits[mid].v

  return { value: median, tickers: hits.map((h) => h.t) }
}

export function calculateMultiples(input: {
  sector: string
  industry: string
  companyType: CompanyType
  currentPrice: number
  trailingPE: number | null
  priceToBook: number | null
  priceToSales: number | null
  evToEbitda: number | null
  evToRevenue: number | null
  livePeers?: PeerQuote[]
}): MultiplesResult {
  const { sector, industry, companyType, currentPrice, livePeers = [] } = input
  const { medians: staticMed, source: staticSource } = getMedians(industry, sector)
  const estimates: MultipleEstimate[] = []
  const allPeerTickers = new Set<string>()

  function getBenchmark(
    metricKey: keyof Omit<PeerQuote, 'ticker'>,
    staticValue: number,
  ): { value: number; source: BenchmarkSource; tickers: string[] } {
    const live = peerMedian(metricKey, livePeers)
    if (live) {
      live.tickers.forEach((t) => allPeerTickers.add(t))
      return { value: live.value, source: 'live-peers', tickers: live.tickers }
    }
    return { value: staticValue, source: staticSource, tickers: [] }
  }

  function makeEstimate(
    multiple: string,
    actual: number | null,
    metricKey: keyof Omit<PeerQuote, 'ticker'>,
    staticMedian: number,
    applyFor: CompanyType[],
    note: string,
  ): MultipleEstimate {
    const bench = getBenchmark(metricKey, staticMedian)
    const applicable =
      applyFor.includes(companyType) &&
      actual !== null &&
      actual > 0 &&
      isFinite(actual) &&
      actual < 10000
    const fv = applicable ? (currentPrice * bench.value) / actual! : 0
    const upside = applicable && currentPrice > 0 ? (fv - currentPrice) / currentPrice : 0

    const sourceLabel =
      bench.source === 'live-peers'
        ? `${bench.tickers.length} peers median`
        : bench.source === 'industry-median'
        ? 'industry median'
        : 'sector median'

    return {
      multiple,
      actualValue: actual ?? 0,
      sectorMedian: Math.round(bench.value * 100) / 100,
      benchmarkSource: bench.source,
      peerTickers: bench.tickers,
      impliedFairValue: Math.round(fv * 100) / 100,
      upsidePct: Math.round(upside * 1000) / 1000,
      applicable,
      note: applicable
        ? `${note} (${sourceLabel}: ${bench.value.toFixed(1)}x)`
        : actual === null
        ? 'N/A — data unavailable'
        : 'Not applicable for this company type',
    }
  }

  estimates.push(makeEstimate(
    'P/E', input.trailingPE, 'trailingPE', staticMed.pe,
    ['standard', 'dividend', 'financial', 'growth'],
    'Trailing P/E',
  ))

  estimates.push(makeEstimate(
    'EV/EBITDA', input.evToEbitda, 'evToEbitda', staticMed.evEbitda,
    ['standard', 'dividend', 'growth'],
    'EV/EBITDA',
  ))

  estimates.push(makeEstimate(
    'P/Book', input.priceToBook, 'priceToBook', staticMed.pb,
    ['financial', 'standard'],
    'Price-to-Book',
  ))

  estimates.push(makeEstimate(
    'P/Sales', input.priceToSales, 'priceToSales', staticMed.ps,
    ['growth', 'startup', 'financial'],
    'Price-to-Sales',
  ))

  estimates.push(makeEstimate(
    'EV/Revenue', input.evToRevenue, 'evToRevenue', staticMed.evRevenue,
    ['startup', 'growth'],
    'EV/Revenue',
  ))

  const applicable = estimates.filter((e) => e.applicable && e.impliedFairValue > 0)
  const blendedFairValue =
    applicable.length > 0
      ? Math.round(
          (applicable.reduce((s, e) => s + e.impliedFairValue, 0) / applicable.length) * 100,
        ) / 100
      : null

  return {
    estimates,
    blendedFairValue,
    peerTickers: Array.from(allPeerTickers),
  }
}
