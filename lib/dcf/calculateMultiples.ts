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
const INDUSTRY_MEDIANS: Record<string, { pe: number; evEbitda: number; pb: number; ps: number; evRevenue: number; pFfo?: number }> = {
  // Technology
  'Software—Application':              { pe: 38, evEbitda: 28, pb: 9.0, ps: 7.0, evRevenue: 8.0 },
  'Software—Infrastructure':           { pe: 32, evEbitda: 24, pb: 8.0, ps: 6.5, evRevenue: 7.0 },
  'Semiconductors':                    { pe: 28, evEbitda: 20, pb: 6.0, ps: 8.0, evRevenue: 9.0 },
  'Semiconductor Equipment & Materials': { pe: 26, evEbitda: 18, pb: 5.0, ps: 7.0, evRevenue: 8.0 },
  'AI Semiconductors':                 { pe: 40, evEbitda: 30, pb: 15.0, ps: 14.0, evRevenue: 15.0 },
  'Internet Content & Information':    { pe: 24, evEbitda: 16, pb: 6.0, ps: 5.5, evRevenue: 6.0 },
  // Internet Retail: elevated multiples reflect the blended cloud/advertising/marketplace model
  // (AMZN trades at ~3–4× EV/Revenue; SHOP at ~10×; MELI at ~5–6×). Pure e-commerce like EBAY
  // trades at 1–2×. The median of this peer set has shifted up as AWS and advertising dominate.
  'Internet Retail':                   { pe: 35, evEbitda: 25, pb: 8.5, ps: 3.5, evRevenue: 4.5 },
  'Internet Commerce':                 { pe: 35, evEbitda: 25, pb: 8.5, ps: 3.5, evRevenue: 4.5 },
  // Chinese internet: ~40% structural discount vs US peers (China regulatory + VIE + geopolitical risk)
  'Internet Retail—China':             { pe: 15, evEbitda: 10, pb: 2.0, ps: 1.5, evRevenue: 1.5 },
  'Internet Content—China':            { pe: 18, evEbitda: 12, pb: 2.5, ps: 3.5, evRevenue: 4.0 },
  'Consumer Electronics':              { pe: 28, evEbitda: 18, pb: 7.0, ps: 3.5, evRevenue: 3.5 },
  'Electronic Components':             { pe: 20, evEbitda: 14, pb: 4.5, ps: 2.5, evRevenue: 2.8 },
  'IT Services':                       { pe: 22, evEbitda: 14, pb: 5.0, ps: 2.8, evRevenue: 3.0 },
  'Information Technology Services':   { pe: 22, evEbitda: 14, pb: 5.0, ps: 2.8, evRevenue: 3.0 },
  // Computer Hardware: DELL, HPQ, HPE trade at 0.5–1.0× EV/Revenue (low-margin assembled hardware).
  // Apple (at 8×) is an outlier that inflates the sector. Using 1.2× better represents the median.
  'Computer Hardware':                 { pe: 18, evEbitda: 12, pb: 4.0, ps: 1.8, evRevenue: 1.2 },
  'Communication Equipment':           { pe: 18, evEbitda: 12, pb: 3.5, ps: 2.5, evRevenue: 2.8 },
  'Data Center REITs':                 { pe: 30, evEbitda: 28, pb: 5.0, ps: 9.0, evRevenue: 10.0, pFfo: 28 },
  // Financial
  'Banks—Diversified':                 { pe: 12, evEbitda: 10, pb: 1.3, ps: 3.2, evRevenue: 3.5 },
  'Banks—Regional':                    { pe: 12, evEbitda: 10, pb: 1.1, ps: 3.0, evRevenue: 3.2 },
  'Insurance—Diversified':             { pe: 13, evEbitda: 11, pb: 1.5, ps: 1.2, evRevenue: 1.3 },
  'Insurance—Life':                    { pe: 11, evEbitda: 9,  pb: 1.2, ps: 1.0, evRevenue: 1.1 },
  'Insurance—Property & Casualty':     { pe: 14, evEbitda: 11, pb: 1.8, ps: 1.4, evRevenue: 1.5 },
  'Capital Markets':                   { pe: 20, evEbitda: 14, pb: 3.0, ps: 4.5, evRevenue: 5.0 },
  'Asset Management':                  { pe: 20, evEbitda: 14, pb: 3.5, ps: 5.0, evRevenue: 5.5 },
  'Financial Data & Stock Exchanges':  { pe: 30, evEbitda: 22, pb: 7.0, ps: 8.0, evRevenue: 9.0 },
  'Credit Services':                   { pe: 18, evEbitda: 14, pb: 4.0, ps: 5.0, evRevenue: 5.5 },
  'Mortgage Finance':                  { pe: 10, evEbitda: 9,  pb: 1.0, ps: 2.5, evRevenue: 2.8 },
  // Mortgage REITs: interest-rate spread vehicles — P/B and NII multiple; P/FFO not applicable
  'REIT—Mortgage':                     { pe: 10, evEbitda: 9,  pb: 1.1, ps: 3.0, evRevenue: 3.5 },
  // Fintech / Digital Finance (growth-stage neobanks, payments, digital lending)
  'Consumer Finance':                  { pe: 28, evEbitda: 18, pb: 4.5, ps: 6.0, evRevenue: 6.5 },
  'Financial Technology':              { pe: 35, evEbitda: 25, pb: 7.0, ps: 8.0, evRevenue: 9.0 },
  'Fintech':                           { pe: 35, evEbitda: 25, pb: 7.0, ps: 8.0, evRevenue: 9.0 },
  'Digital Payments':                  { pe: 32, evEbitda: 22, pb: 8.0, ps: 8.0, evRevenue: 9.0 },
  'Neobank':                           { pe: 30, evEbitda: 20, pb: 5.0, ps: 7.0, evRevenue: 8.0 },
  'Payments Processing & Specialized': { pe: 30, evEbitda: 22, pb: 6.0, ps: 7.5, evRevenue: 8.5 },
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
  // Luxury Goods: sector median ~22-25× P/E (Chinese demand slowdown 2024-2026 compressed multiples).
  // Hermès trades at 50-55× (outlier); LVMH ~18-20×; Kering ~12×; Tapestry ~12×.
  // evRevenue: sector median ~3-4×; Hermès is 15×+ but is an extreme outlier.
  // Previously used pe:42 and evRevenue:8 which reflected Hermès, not the peer median.
  'Luxury Goods':                      { pe: 25, evEbitda: 18, pb: 6.0, ps: 4.0, evRevenue: 4.0 },
  'Luxury':                            { pe: 25, evEbitda: 18, pb: 6.0, ps: 4.0, evRevenue: 4.0 },
  'Household & Personal Products':     { pe: 22, evEbitda: 15, pb: 5.0, ps: 2.8, evRevenue: 3.2 },
  'Packaged Foods':                    { pe: 20, evEbitda: 14, pb: 4.5, ps: 2.0, evRevenue: 2.2 },
  'Personal Services':                 { pe: 20, evEbitda: 13, pb: 5.0, ps: 2.0, evRevenue: 2.2 },
  // Energy
  'Oil & Gas Integrated':              { pe: 11, evEbitda: 7,  pb: 1.5, ps: 1.1, evRevenue: 1.2 },
  'Oil & Gas E&P':                     { pe: 10, evEbitda: 6,  pb: 1.4, ps: 2.5, evRevenue: 2.8 },
  'Oil & Gas Refining & Marketing':    { pe: 9,  evEbitda: 7,  pb: 1.5, ps: 0.3, evRevenue: 0.35 },
  'Oil & Gas Midstream':               { pe: 14, evEbitda: 10, pb: 2.5, ps: 2.0, evRevenue: 2.5 },
  'Oil & Gas Equipment & Services':    { pe: 16, evEbitda: 10, pb: 2.0, ps: 1.5, evRevenue: 1.8 },
  // Crypto/Bitcoin Mining — commodity-like revenue (BTC price × hash rate), capital-intensive.
  // P/E multiples are volatile and cycle-driven; EV/Revenue and EV/EBITDA anchor on production economics.
  // Peers: MARA, RIOT, CLSK, BTBT, IRIS Energy (IREN). EV/Revenue ~3-5× in bull cycles, 1-2× in bear.
  'Bitcoin Mining':                    { pe: 12, evEbitda: 8,  pb: 2.0, ps: 2.5, evRevenue: 3.0 },
  'Crypto Mining':                     { pe: 12, evEbitda: 8,  pb: 2.0, ps: 2.5, evRevenue: 3.0 },
  'Digital Mining':                    { pe: 12, evEbitda: 8,  pb: 2.0, ps: 2.5, evRevenue: 3.0 },
  'Blockchain Infrastructure':         { pe: 14, evEbitda: 10, pb: 2.5, ps: 3.0, evRevenue: 3.5 },
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
  // Real Estate (REIT industry names use em-dash as Yahoo Finance returns them)
  'REIT—Diversified':                  { pe: 35, evEbitda: 20, pb: 2.2, ps: 6.0, evRevenue: 7.0, pFfo: 16 },
  'REIT—Retail':                       { pe: 30, evEbitda: 18, pb: 2.0, ps: 8.0, evRevenue: 9.0, pFfo: 15 },
  'REIT—Office':                       { pe: 20, evEbitda: 14, pb: 1.2, ps: 5.0, evRevenue: 5.5, pFfo: 12 },
  'REIT—Industrial':                   { pe: 40, evEbitda: 25, pb: 3.5, ps: 12.0, evRevenue: 13.0, pFfo: 20 },
  'REIT—Residential':                  { pe: 35, evEbitda: 20, pb: 2.0, ps: 8.0, evRevenue: 9.0, pFfo: 18 },
  'REIT—Healthcare Facilities':        { pe: 42, evEbitda: 20, pb: 2.0, ps: 9.0, evRevenue: 10.0, pFfo: 17 },
  'REIT—Specialty':                    { pe: 38, evEbitda: 22, pb: 2.5, ps: 10.0, evRevenue: 11.0, pFfo: 22 },
  'REIT—Tower':                        { pe: 55, evEbitda: 28, pb: 6.0, ps: 14.0, evRevenue: 15.0, pFfo: 25 },
  'Real Estate Services':              { pe: 20, evEbitda: 14, pb: 3.5, ps: 3.0, evRevenue: 3.5 },
  // Materials
  'Basic Materials':                   { pe: 16, evEbitda: 10, pb: 2.0, ps: 1.5, evRevenue: 1.8 },
  'Specialty Chemicals':               { pe: 18, evEbitda: 12, pb: 3.0, ps: 2.0, evRevenue: 2.2 },
  'Steel':                             { pe: 10, evEbitda: 6,  pb: 1.3, ps: 0.6, evRevenue: 0.7 },
  'Aluminum':                          { pe: 12, evEbitda: 7,  pb: 1.5, ps: 0.8, evRevenue: 0.9 },
  'Gold':                              { pe: 18, evEbitda: 10, pb: 2.0, ps: 4.0, evRevenue: 4.5 },
  // Gold/silver streaming & royalty companies trade at premium to physical miners
  'Gold Royalty':                      { pe: 35, evEbitda: 25, pb: 3.5, ps: 12.0, evRevenue: 13.0 },
  'Silver Royalty':                    { pe: 32, evEbitda: 22, pb: 3.0, ps: 10.0, evRevenue: 11.0 },
  'Copper':                            { pe: 14, evEbitda: 8,  pb: 1.8, ps: 3.0, evRevenue: 3.5 },
  'Silver':                            { pe: 20, evEbitda: 11, pb: 2.2, ps: 4.5, evRevenue: 5.0 },
  // Critical minerals — formerly routed to 'default' (pe:20, evEbitda:14) which was wrong
  // Uranium: supply-constrained; Cameco/Kazatomprom trade at 40-60× P/E
  'Uranium':                           { pe: 45, evEbitda: 25, pb: 2.5, ps: 8.0, evRevenue: 8.0 },
  // Coal: structurally declining; ARCH/BTU trade at 5-8× P/E
  'Coal':                              { pe: 6,  evEbitda: 4,  pb: 1.0, ps: 0.5, evRevenue: 0.8 },
  // Lithium: high-growth battery materials; ALB/SQM/Arcadium trade at 12-20× through cycle
  'Lithium':                           { pe: 16, evEbitda: 10, pb: 2.0, ps: 3.0, evRevenue: 3.5 },
  // Rare earths and other industrial metals
  'Rare Earth Metals':                 { pe: 20, evEbitda: 12, pb: 2.0, ps: 4.0, evRevenue: 4.5 },
  'Other Industrial Metals & Mining':  { pe: 14, evEbitda: 8,  pb: 1.5, ps: 2.0, evRevenue: 2.5 },
  'Nickel':                            { pe: 12, evEbitda: 7,  pb: 1.4, ps: 2.0, evRevenue: 2.2 },
  'Potash':                            { pe: 13, evEbitda: 8,  pb: 1.6, ps: 1.5, evRevenue: 1.8 },
  'Agricultural Inputs':               { pe: 13, evEbitda: 8,  pb: 1.6, ps: 1.5, evRevenue: 1.8 },
  'default':                           { pe: 20, evEbitda: 14, pb: 3.0, ps: 2.5, evRevenue: 3.0 },
}

// Broad sector fallback (if industry not found)
const SECTOR_MEDIANS: Record<string, { pe: number; evEbitda: number; pb: number; ps: number; evRevenue: number; pFfo?: number }> = {
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
  // Internet Retail: US-based peers only. Chinese ADRs (BABA, JD, PDD, SE) are
  // excluded because their multiples carry a structural China discount (~30-50%)
  // that would compress implied FVs for US companies and vice versa.
  'Internet Retail':                   ['AMZN', 'EBAY', 'ETSY', 'CHWY', 'W', 'SHOP'],
  // Chinese Internet Retail: separate peer group for BABA, JD, SE, PDD.
  // All trade at a structural discount to US peers; using US medians overstates FV by 2-4×.
  'Internet Retail—China':             ['JD', 'PDD', 'SE', 'TEMU', 'VIPS'],
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
  // Yahoo Finance returns industry names with regular hyphens ("Banks - Regional")
  // but Damodaran table uses em-dashes ("Banks—Regional"). Normalize both directions.
  const normalizeKey = (s: string) => s.replace(/\s*[-—]\s*/g, '—')
  const normalizedIndustry = normalizeKey(industry)

  if (INDUSTRY_MEDIANS[industry]) {
    return { medians: INDUSTRY_MEDIANS[industry], source: 'industry-median' as BenchmarkSource }
  }
  if (normalizedIndustry !== industry && INDUSTRY_MEDIANS[normalizedIndustry]) {
    return { medians: INDUSTRY_MEDIANS[normalizedIndustry], source: 'industry-median' as BenchmarkSource }
  }
  if (SECTOR_MEDIANS[sector]) {
    return { medians: SECTOR_MEDIANS[sector], source: 'sector-fallback' as BenchmarkSource }
  }
  return { medians: INDUSTRY_MEDIANS['default'], source: 'sector-fallback' as BenchmarkSource }
}

/**
 * Canonical multiple lookup — single source of truth for PE, EV/EBITDA and EV/Revenue
 * benchmarks. All valuation methods that need static multiples must call this instead
 * of maintaining their own sector/industry tables.
 */
export function getIndustryMultiples(
  industry: string,
  sector: string,
): { pe: number; evEbitda: number; evRevenue: number; pFfo: number | undefined; source: BenchmarkSource } {
  const { medians, source } = getMedians(industry, sector)
  return { pe: medians.pe, evEbitda: medians.evEbitda, evRevenue: medians.evRevenue, pFfo: medians.pFfo, source }
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

    // Sanity gate: detect mixed-units or distorted multiples.
    // A common failure for Chinese ADRs (BABA, JD, PDD): Yahoo computes EV/EBITDA
    // as EV_USD / EBITDA_CNY_billions, yielding a ratio like 1.4 instead of ~9.6.
    // When this contaminated actual is used as the denominator in (price * sector) / actual,
    // the implied FV explodes by ~7× (the CNY billions → USD millions unit factor).
    // Guard: EV/EBITDA < 3 for a non-distressed company is almost certainly contaminated.
    // P/E < 1 is similarly impossible for a profitable company.
    // P/Book < 0.1 signals balance-sheet data issues.
    let sanitizedActual = actual
    if (actual !== null) {
      if (multiple === 'EV/EBITDA' && actual < 3 && actual > 0) {
        // EV/EBITDA below 3× for a non-distressed company = mixed-units contamination.
        // Mark as not applicable rather than inflating the implied FV 7-10×.
        sanitizedActual = null
      }
      if (multiple === 'P/E' && actual < 1 && actual > 0) {
        sanitizedActual = null
      }
      if (multiple === 'P/Book' && actual < 0.1 && actual > 0) {
        sanitizedActual = null
      }
    }

    const applicable =
      applyFor.includes(companyType) &&
      sanitizedActual !== null &&
      sanitizedActual > 0 &&
      isFinite(sanitizedActual) &&
      sanitizedActual < 10000
    const fv = applicable ? (currentPrice * bench.value) / sanitizedActual! : 0
    const _upside = applicable && currentPrice > 0 ? (fv - currentPrice) / currentPrice : 0

    // Secondary sanity gate: cap impliedFairValue at 20× current price.
    // When fv > 20× price, a data-quality issue is almost certainly the cause
    // (e.g. sector median applied to a near-zero distorted actual). Mark not applicable.
    const fvCapped = applicable && fv > currentPrice * 20 ? 0 : fv
    const applicableFinal = applicable && fvCapped > 0

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
      impliedFairValue: Math.round(fvCapped * 100) / 100,
      upsidePct: applicableFinal && currentPrice > 0 ? Math.round((fvCapped - currentPrice) / currentPrice * 1000) / 1000 : 0,
      applicable: applicableFinal,
      note: applicableFinal
        ? `${note} (${sourceLabel}: ${bench.value.toFixed(1)}x)`
        : sanitizedActual === null && actual !== null && actual < 3 && multiple === 'EV/EBITDA'
        ? 'Excluded — EV/EBITDA < 3× signals mixed-currency units (e.g. EV in USD vs EBITDA in CNY)'
        : actual === null
        ? 'N/A — data unavailable'
        : fvCapped === 0 && applicable
        ? 'Excluded — implied FV > 20× current price (data quality issue)'
        : 'Not applicable for this company type',
    }
  }

  estimates.push(makeEstimate(
    'P/E', input.trailingPE, 'trailingPE', staticMed.pe,
    ['standard', 'dividend', 'financial', 'fintech', 'alt_asset', 'growth'],
    'Trailing P/E',
  ))

  estimates.push(makeEstimate(
    'EV/EBITDA', input.evToEbitda, 'evToEbitda', staticMed.evEbitda,
    ['standard', 'dividend', 'growth', 'energy', 'mining'],
    'EV/EBITDA',
  ))

  estimates.push(makeEstimate(
    'P/Book', input.priceToBook, 'priceToBook', staticMed.pb,
    ['financial', 'fintech', 'mreeit', 'bdc'],
    'Price-to-Book',
  ))

  estimates.push(makeEstimate(
    'P/Sales', input.priceToSales, 'priceToSales', staticMed.ps,
    ['growth', 'startup', 'financial', 'fintech'],
    'Price-to-Sales',
  ))

  estimates.push(makeEstimate(
    'EV/Revenue', input.evToRevenue, 'evToRevenue', staticMed.evRevenue,
    ['startup', 'growth', 'standard', 'dividend', 'financial', 'fintech', 'alt_asset', 'energy', 'mining'],
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
