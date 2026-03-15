interface PricePoint { date: Date; close: number }

function weeklyReturns(prices: PricePoint[]): number[] {
  const sorted = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime())
  const returns: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].close > 0) {
      returns.push((sorted[i].close - sorted[i - 1].close) / sorted[i - 1].close)
    }
  }
  return returns
}

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function covariance(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  const mx = mean(x.slice(0, n))
  const my = mean(y.slice(0, n))
  return x.slice(0, n).reduce((sum, xi, i) => sum + (xi - mx) * (y[i] - my), 0) / (n - 1)
}

function variance(arr: number[]): number {
  const m = mean(arr)
  return arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - 1)
}

export function calculateBeta(stockPrices: PricePoint[], spyPrices: PricePoint[]): number {
  const stockRet = weeklyReturns(stockPrices)
  const spyRet = weeklyReturns(spyPrices)
  const n = Math.min(stockRet.length, spyRet.length)
  if (n < 20) return 1.0 // not enough data

  const cov = covariance(stockRet.slice(0, n), spyRet.slice(0, n))
  const varSpy = variance(spyRet.slice(0, n))
  if (varSpy === 0) return 1.0

  return Math.round((cov / varSpy) * 100) / 100
}
