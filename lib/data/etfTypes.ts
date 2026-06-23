export interface ETFBatchItem {
  ticker: string
  name: string
  category: string | null
  peRatio: number | null
  pbRatio: number | null
  expenseRatio: number | null
  yield: number | null
  aum: number | null
  valueScore: number
  price: number | null
  priceChangePct: number | null
  /** Trailing returns from fundPerformance module */
  return1M: number | null
  return3M: number | null
  return1Y: number | null
  return3Y: number | null
  return5Y: number | null
  /** Risk metrics from fundPerformance.riskOverview */
  sharpeRatio: number | null
  beta3Y: number | null
}

export interface ETFEntry {
  ticker: string
  name: string | null
  valueScore: number | null
  expenseRatio: number | null
  yield: number | null
  peRatio: number | null
  pbRatio: number | null
  totalAssets: number | null
  addedAt: string
  /** Live price — refreshed from batch on page load, not persisted */
  price: number | null
  /** Live % change — refreshed from batch on page load, not persisted */
  priceChangePct: number | null
  /** ISO date when metrics were last refreshed from live data */
  metricsUpdatedAt: string | null
}

export interface ETFProfileResponse {
  ticker: string
  name: string
  price: number | null
  priceChange: number | null
  priceChangePct: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  aum: number | null
  navPrice: number | null
  expenseRatio: number | null
  yield: number | null
  dividendRate: number | null
  beta3Year: number | null
  inceptionDate: string | null
  issuer: string | null
  category: string | null
  managementStyle: string | null
  peRatio: number | null
  pbRatio: number | null
  psRatio: number | null
  pcfRatio: number | null
  medianMarketCap: number | null
  valueScore: number
  valueScoreLabel: string
  scoreBreakdown: { pe: number; pb: number; yieldPts: number; expensePenalty: number }
  holdings: Array<{ rank: number; symbol: string; name: string; weight: number | null }>
  sectorWeights: Array<{ sector: string; weight: number }>
}
