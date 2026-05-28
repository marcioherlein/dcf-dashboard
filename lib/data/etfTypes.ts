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
