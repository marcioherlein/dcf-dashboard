/**
 * Factor computation engine.
 * All computations operate on daily price arrays (close prices, chronological order).
 *
 * Equity factors (40/20/20/10/10 weighting):
 *   1. Momentum       40% — 6M skip 1M return, 12M return, RS vs benchmark, dist to 52w high
 *   2. Trend Quality  20% — vs 200MA, vs 50MA, slope of 200MA, % days above 50MA
 *   3. Earnings       20% — EPS growth YoY, Revenue growth YoY, EPS surprise
 *   4. Quality        10% — ROE/ROIC, gross margin, debt/EBITDA
 *   5. Risk           10% — ATR/price (inverted), max drawdown (inverted), volatility contraction
 *
 * Futures factors (50/20/20/10 weighting):
 *   1. Momentum       50% — 1M return, 3M return, trend strength
 *   2. Term Structure 20% — Contango/backwardation proxy via momentum sign
 *   3. Volatility     20% — ATR (inverted), volatility expansion
 *   4. Liquidity      10% — Volume rank
 */

export interface PriceBar {
  date: Date
  close: number
  high: number
  low: number
  volume: number
}

// ── Pure math helpers ─────────────────────────────────────────────────────────

export function sma(prices: number[], period: number): number[] {
  const out: number[] = []
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { out.push(NaN); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += prices[j]
    out.push(sum / period)
  }
  return out
}

export function atr(bars: PriceBar[], period = 14): number[] {
  const trs: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const h = bars[i].high, l = bars[i].low, c = i > 0 ? bars[i - 1].close : bars[i].close
    trs.push(Math.max(h - l, Math.abs(h - c), Math.abs(l - c)))
  }
  const out: number[] = [NaN]
  for (let i = 1; i < trs.length; i++) {
    if (i < period) { out.push(NaN); continue }
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += trs[j]
    out.push(sum / period)
  }
  return out
}

function logReturn(p1: number, p2: number): number {
  if (!p1 || !p2 || p1 <= 0 || p2 <= 0) return 0
  return Math.log(p2 / p1)
}

function simpleReturn(p1: number, p2: number): number {
  if (!p1 || p1 <= 0) return 0
  return (p2 - p1) / p1
}

function maxDrawdown(prices: number[]): number {
  let peak = prices[0], maxDD = 0
  for (const p of prices) {
    if (p > peak) peak = p
    const dd = (peak - p) / peak
    if (dd > maxDD) maxDD = dd
  }
  return maxDD
}

function stddev(returns: number[]): number {
  if (returns.length < 2) return 0
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.map((r) => (r - mean) ** 2).reduce((s, v) => s + v, 0) / (returns.length - 1)
  return Math.sqrt(variance)
}

// ── Equity raw metric computation ─────────────────────────────────────────────

export interface EquityRawMetrics {
  // Momentum
  return6MSkip1M: number    // 6-month return excluding last month (t-22 to t-130)
  return12M: number         // 12-month return (t-252 to t-1)
  rsVsBenchmark: number     // stock 12M return / benchmark 12M return
  distTo52wHigh: number     // (price / 52w high) - 1 (negative = below high)

  // Trend
  pctAbove200MA: number     // (price / MA200) - 1
  pctAbove50MA: number      // (price / MA50) - 1
  slope200MA: number        // (MA200[0] / MA200[-20]) - 1
  daysAbove50MApct: number  // fraction of last 60 days where close > MA50

  // Risk (lower raw = better, will be inverted for percentile ranking)
  atrPct: number            // ATR(14) / price
  maxDD6M: number           // max drawdown over last 126 days
  volContraction: number    // recent vol / trailing vol (< 1 = contracting = good)

  // Earnings / fundamental (from Yahoo Finance summary data)
  epsGrowthYoY: number | null
  revenueGrowthYoY: number | null
  epsSurprisePct: number | null

  // Quality (from Yahoo Finance)
  roe: number | null
  grossMarginStability: number | null   // gross margin (proxy for stability)
  debtToEbitda: number | null
}

export function computeEquityMetrics(
  bars: PriceBar[],
  benchmarkBars: PriceBar[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fundamentals: any,
): EquityRawMetrics | null {
  if (bars.length < 60) return null

  const closes = bars.map((b) => b.close)
  const n = closes.length
  const price = closes[n - 1]

  // ── Momentum ─────────────────────────────────────────────────────────────────
  const idx6M  = Math.max(0, n - 130)
  const idx1M  = Math.max(0, n - 22)
  const idx12M = Math.max(0, n - 252)

  const return6MSkip1M = simpleReturn(closes[idx6M], closes[idx1M])
  const return12M      = simpleReturn(closes[idx12M], closes[n - 1])

  // RS vs benchmark (12M)
  const bCloses = benchmarkBars.map((b) => b.close)
  const bn = bCloses.length
  const benchReturn12M = bn >= 252
    ? simpleReturn(bCloses[Math.max(0, bn - 252)], bCloses[bn - 1])
    : 0
  const rsVsBenchmark = benchReturn12M !== 0 ? return12M / Math.abs(benchReturn12M) : return12M

  // 52-week high
  const window52w = closes.slice(Math.max(0, n - 252))
  const high52w = Math.max(...window52w)
  const distTo52wHigh = (price / high52w) - 1  // 0 = at high, -0.3 = 30% below

  // ── Trend ────────────────────────────────────────────────────────────────────
  const ma200arr = sma(closes, 200)
  const ma50arr  = sma(closes, 50)
  const ma200    = ma200arr[n - 1]
  const ma50     = ma50arr[n - 1]

  const pctAbove200MA = isNaN(ma200) || ma200 === 0 ? 0 : (price / ma200) - 1
  const pctAbove50MA  = isNaN(ma50)  || ma50  === 0 ? 0 : (price / ma50)  - 1

  // MA200 slope: compare MA200 today vs 20 days ago
  const ma200_20 = ma200arr[n - 21]
  const slope200MA = (!isNaN(ma200_20) && ma200_20 > 0) ? (ma200 / ma200_20) - 1 : 0

  // % of last 60 days where close > MA50
  const last60 = closes.slice(Math.max(0, n - 60))
  const ma50_60 = ma50arr.slice(Math.max(0, n - 60))
  let aboveDays = 0
  for (let i = 0; i < last60.length; i++) {
    if (!isNaN(ma50_60[i]) && last60[i] > ma50_60[i]) aboveDays++
  }
  const daysAbove50MApct = aboveDays / last60.length

  // ── Risk ──────────────────────────────────────────────────────────────────────
  const atrArr  = atr(bars, 14)
  const lastATR = atrArr[n - 1]
  const atrPct  = (!isNaN(lastATR) && price > 0) ? lastATR / price : 0.02

  const bars6M     = bars.slice(Math.max(0, n - 126))
  const maxDD6M    = maxDrawdown(bars6M.map((b) => b.close))

  // Volatility contraction: std dev of last 10 returns vs last 60
  const dailyReturns = closes.slice(1).map((c, i) => logReturn(closes[i], c))
  const recentVol  = stddev(dailyReturns.slice(-10)) * Math.sqrt(252)
  const trailingVol = stddev(dailyReturns.slice(-60)) * Math.sqrt(252)
  const volContraction = trailingVol > 0 ? recentVol / trailingVol : 1

  // ── Fundamentals ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fin = fundamentals as any
  const fd  = fin?.financialData
  const sd  = fin?.summaryDetail

  const roe = typeof fd?.returnOnEquity === 'number' ? fd.returnOnEquity : null
  const grossMarginStability = typeof fd?.grossMargins === 'number' ? fd.grossMargins : null
  const debtToEbitda = typeof fd?.totalDebtToEquity === 'number' ? fd.totalDebtToEquity / 10 : null // rough proxy

  // EPS growth via earningsTrend
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trend = fin?.earningsTrend?.trend as any[]
  const annualTrend = trend?.find((t: any) => t.period === '0y')
  const prevTrend   = trend?.find((t: any) => t.period === '-1y')

  let epsGrowthYoY: number | null = null
  if (annualTrend?.earningsEstimate?.avg?.raw && prevTrend?.earningsEstimate?.avg?.raw) {
    const cur  = annualTrend.earningsEstimate.avg.raw as number
    const prev = prevTrend.earningsEstimate.avg.raw as number
    if (prev !== 0) epsGrowthYoY = (cur - prev) / Math.abs(prev)
  }
  // Fallback: use earningsGrowth from financialData
  if (epsGrowthYoY === null && typeof fd?.earningsGrowth === 'number') {
    epsGrowthYoY = fd.earningsGrowth
  }

  const revenueGrowthYoY = typeof fd?.revenueGrowth === 'number' ? fd.revenueGrowth : null

  // EPS surprise from most recent quarterly trend
  const qtTrend = trend?.find((t: any) => t.period === '0q')
  let epsSurprisePct: number | null = null
  if (qtTrend?.epsTrendDetails?.current?.raw && qtTrend?.earningsEstimate?.avg?.raw) {
    const act = qtTrend.epsTrendDetails.current.raw as number
    const est = qtTrend.earningsEstimate.avg.raw as number
    if (est !== 0) epsSurprisePct = (act - est) / Math.abs(est)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void sd

  return {
    return6MSkip1M, return12M, rsVsBenchmark, distTo52wHigh,
    pctAbove200MA, pctAbove50MA, slope200MA, daysAbove50MApct,
    atrPct, maxDD6M, volContraction,
    epsGrowthYoY, revenueGrowthYoY, epsSurprisePct,
    roe, grossMarginStability, debtToEbitda,
  }
}

// ── Futures raw metric computation ────────────────────────────────────────────

export interface FuturesRawMetrics {
  return1M: number
  return3M: number
  trendStrength: number   // price / MA20 - 1
  // Term structure proxy: for single-contract data, use return sign + momentum divergence
  contangoProxy: number   // 1M return / 3M return; < 1 → backwardation (bullish for commodity)
  // Volatility
  atrPct: number
  volExpansion: number    // recent vol / trailing vol (> 1 = expanding)
  // Liquidity
  avgVolume: number
  volumeTrend: number     // recent vol / trailing avg vol
}

export function computeFuturesMetrics(bars: PriceBar[]): FuturesRawMetrics | null {
  if (bars.length < 30) return null

  const closes = bars.map((b) => b.close)
  const volumes = bars.map((b) => b.volume)
  const n = closes.length
  const price = closes[n - 1]

  const idx1M = Math.max(0, n - 22)
  const idx3M = Math.max(0, n - 66)

  const return1M = simpleReturn(closes[idx1M], price)
  const return3M = simpleReturn(closes[idx3M], price)

  const ma20arr = sma(closes, 20)
  const ma20 = ma20arr[n - 1]
  const trendStrength = (!isNaN(ma20) && ma20 > 0) ? (price / ma20) - 1 : 0

  // Contango/backwardation proxy using return ratio
  const contangoProxy = Math.abs(return3M) > 0.001
    ? (1 + return1M) / (1 + return3M)
    : 1

  const atrArr  = atr(bars, 14)
  const lastATR = atrArr[n - 1]
  const atrPct  = (!isNaN(lastATR) && price > 0) ? lastATR / price : 0.02

  const dailyReturns = closes.slice(1).map((c, i) => logReturn(closes[i], c))
  const recentVol   = stddev(dailyReturns.slice(-10)) * Math.sqrt(252)
  const trailingVol = stddev(dailyReturns.slice(-60)) * Math.sqrt(252)
  const volExpansion = trailingVol > 0 ? recentVol / trailingVol : 1

  const recentVols   = volumes.slice(-10)
  const trailingVols = volumes.slice(-60)
  const avgVolume    = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20
  const recentVolAvg  = recentVols.reduce((s, v) => s + v, 0) / Math.max(recentVols.length, 1)
  const trailingVolAvg = trailingVols.reduce((s, v) => s + v, 0) / Math.max(trailingVols.length, 1)
  const volumeTrend  = trailingVolAvg > 0 ? recentVolAvg / trailingVolAvg : 1

  return { return1M, return3M, trendStrength, contangoProxy, atrPct, volExpansion, avgVolume, volumeTrend }
}

// ── Percentile ranking (within group) ─────────────────────────────────────────

export function percentileRank(values: (number | null)[], index: number, invert = false): number {
  const val = values[index]
  if (val === null || !isFinite(val)) return 50  // neutral for missing data

  const valid = values.filter((v): v is number => v !== null && isFinite(v))
  if (valid.length === 0) return 50

  const sortedAsc = [...valid].sort((a, b) => a - b)
  const rank = sortedAsc.filter((v) => v < val).length
  const pct = valid.length > 1 ? (rank / (valid.length - 1)) * 100 : 50

  return invert ? 100 - pct : pct
}

// ── Equity factor scores (0–100) ──────────────────────────────────────────────

export interface EquityFactorScores {
  momentum: number    // 40%
  trend: number       // 20%
  earnings: number    // 20%
  quality: number     // 10%
  risk: number        // 10%
  finalScore: number
}

export function computeEquityFactorScores(
  metrics: EquityRawMetrics[],
  idx: number,
): EquityFactorScores {
  const p = (field: keyof EquityRawMetrics, invert = false): number => {
    const vals = metrics.map((m) => m[field] as number | null)
    return percentileRank(vals, idx, invert)
  }

  // ── Momentum (40%) — 4 sub-metrics, equal weight
  const mom6M   = p('return6MSkip1M')
  const mom12M  = p('return12M')
  const rs      = p('rsVsBenchmark')
  const dist52  = p('distTo52wHigh')      // closer to high = better
  const momentum = (mom6M + mom12M + rs + dist52) / 4

  // ── Trend (20%) — 4 sub-metrics
  const t200   = p('pctAbove200MA')
  const t50    = p('pctAbove50MA')
  const slope  = p('slope200MA')
  const days50 = p('daysAbove50MApct')
  const trend  = (t200 + t50 + slope + days50) / 4

  // ── Earnings (20%) — 3 sub-metrics (handle missing gracefully)
  const epsG   = metrics[idx].epsGrowthYoY   !== null ? p('epsGrowthYoY')   : 50
  const revG   = metrics[idx].revenueGrowthYoY !== null ? p('revenueGrowthYoY') : 50
  const surp   = metrics[idx].epsSurprisePct  !== null ? p('epsSurprisePct')  : 50
  const earnings = (epsG + revG + surp) / 3

  // ── Quality (10%) — 3 sub-metrics
  const roeS    = metrics[idx].roe !== null ? p('roe') : 50
  const gmS     = metrics[idx].grossMarginStability !== null ? p('grossMarginStability') : 50
  const debtS   = metrics[idx].debtToEbitda !== null ? p('debtToEbitda', true) : 50  // lower debt = better
  const quality = (roeS + gmS + debtS) / 3

  // ── Risk (10%) — lower risk = better, invert ATR and drawdown
  const atrS  = p('atrPct',   true)   // lower ATR% = better
  const ddS   = p('maxDD6M',  true)   // lower drawdown = better
  const vcS   = p('volContraction', true) // contracting vol = better
  const risk  = (atrS + ddS + vcS) / 3

  // Final score: weighted composite
  const finalScore = momentum * 0.40 + trend * 0.20 + earnings * 0.20 + quality * 0.10 + risk * 0.10

  return { momentum, trend, earnings, quality, risk, finalScore }
}

// ── Futures factor scores (0–100) ─────────────────────────────────────────────

export interface FuturesFactorScores {
  momentum: number      // 50%
  termStructure: number // 20%
  volatility: number    // 20%
  liquidity: number     // 10%
  finalScore: number
}

export function computeFuturesFactorScores(
  metrics: FuturesRawMetrics[],
  idx: number,
): FuturesFactorScores {
  const p = (field: keyof FuturesRawMetrics, invert = false): number => {
    const vals = metrics.map((m) => m[field] as number | null)
    return percentileRank(vals, idx, invert)
  }

  // Momentum (50%) — 3 sub-metrics
  const m1M   = p('return1M')
  const m3M   = p('return3M')
  const trend = p('trendStrength')
  const momentum = (m1M + m3M + trend) / 3

  // Term structure (20%) — backwardation (contangoProxy < 1) is bullish
  const termStructure = p('contangoProxy', true)  // lower proxy = more backwardation = better

  // Volatility (20%) — higher ATR and expanding vol = active market
  const atrS = p('atrPct')          // higher ATR = more opportunity (not inverted for futures)
  const volE = p('volExpansion')
  const volatility = (atrS + volE) / 2

  // Liquidity (10%)
  const volRank = p('avgVolume')
  const volTrd  = p('volumeTrend')
  const liquidity = (volRank + volTrd) / 2

  const finalScore = momentum * 0.50 + termStructure * 0.20 + volatility * 0.20 + liquidity * 0.10

  return { momentum, termStructure, volatility, liquidity, finalScore }
}
