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
}
