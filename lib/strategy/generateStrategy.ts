import type { RankedInstrument } from '@/app/api/factor-ranking/route'
import type {
  StrategyReport, TradePlan, FactorAlignment, FactorExplanation,
  PeerStats, Recommendation, ConvictionLevel, TimeHorizon,
  EntryZone, ExitLevels, FactorDirection,
} from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEquityScores(s: RankedInstrument['factorScores']): s is {
  momentum: number; trend: number; earnings: number; quality: number; risk: number; finalScore: number
} {
  return 'trend' in s
}

function isFuturesScores(s: RankedInstrument['factorScores']): s is {
  momentum: number; termStructure: number; volatility: number; liquidity: number; finalScore: number
} {
  return 'termStructure' in s
}

function m(km: Record<string, number | null>, key: string): number | null {
  const v = km[key]
  return typeof v === 'number' && isFinite(v) ? v : null
}

// ── Recommendation from score ─────────────────────────────────────────────────

export function computeRecommendation(score: number): Recommendation {
  if (score >= 75) return 'STRONG_BUY'
  if (score >= 60) return 'BUY'
  if (score >= 45) return 'HOLD'
  if (score >= 30) return 'AVOID'
  return 'SHORT_CANDIDATE'
}

// ── Conviction from factor alignment ─────────────────────────────────────────

export function computeConviction(
  factorScores: RankedInstrument['factorScores'],
  rec: Recommendation,
): ConvictionLevel {
  const scores: number[] = []
  if (isEquityScores(factorScores)) {
    scores.push(factorScores.momentum, factorScores.trend, factorScores.earnings, factorScores.quality, factorScores.risk)
  } else if (isFuturesScores(factorScores)) {
    scores.push(factorScores.momentum, factorScores.termStructure, factorScores.volatility, factorScores.liquidity)
  }

  const isBullishRec = rec === 'STRONG_BUY' || rec === 'BUY'
  const isBearishRec = rec === 'AVOID' || rec === 'SHORT_CANDIDATE'

  const aligned = scores.filter((s) => {
    if (isBullishRec) return s >= 60
    if (isBearishRec) return s <= 40
    return s >= 45 && s <= 60 // neutral
  }).length

  if (aligned >= 4) return 'HIGH'
  if (aligned >= 2) return 'MEDIUM'
  return 'LOW'
}

// ── Entry zone ────────────────────────────────────────────────────────────────

export function computeEntryZone(price: number, km: Record<string, number | null>): EntryZone {
  const pctAbove50MA = m(km, 'vs 50MA') // already in %, e.g. 18.4 means 18.4% above
  const immediate = { price, pctFromCurrent: 0 }

  if (pctAbove50MA !== null && pctAbove50MA > 20) {
    const ma50Price = price / (1 + pctAbove50MA / 100)
    return {
      immediate,
      better: {
        price: Math.round(ma50Price * 100) / 100,
        pctFromCurrent: Math.round(-pctAbove50MA * 10) / 10,
      },
      waitForPullback: true,
      waitReason: `Price is ${pctAbove50MA.toFixed(1)}% above the 50-day MA. Consider waiting for a pullback toward $${ma50Price.toFixed(2)}.`,
    }
  }

  // Already near or below 50MA — fine to enter now
  const better = pctAbove50MA !== null && pctAbove50MA > 5
    ? {
        price: Math.round((price / (1 + pctAbove50MA / 100)) * 100) / 100,
        pctFromCurrent: Math.round(-pctAbove50MA * 10) / 10,
      }
    : null

  return { immediate, better, waitForPullback: false, waitReason: null }
}

// ── Exit levels ───────────────────────────────────────────────────────────────

export function computeExitLevels(
  price: number,
  km: Record<string, number | null>,
  peerStats: PeerStats,
  finalScore: number,
  rec: Recommendation,
): ExitLevels {
  const ATR_MULTIPLE = 2.5
  const atrPct = m(km, 'ATR%') ?? 2.0  // fallback 2% if missing
  const atrAbsolute = price * (atrPct / 100)

  const isShort = rec === 'SHORT_CANDIDATE'

  // Stop loss: 2.5× ATR from entry
  const stopPrice = isShort
    ? price + ATR_MULTIPLE * atrAbsolute
    : price - ATR_MULTIPLE * atrAbsolute

  const stopPct = ((stopPrice - price) / price) * 100

  // Target: peer avg return × (score/100), capped at 3× peer avg
  const baseReturn = Math.max(peerStats.avgReturn12M, 0.05)  // floor 5% to avoid degenerate calcs
  const scoreFraction = finalScore / 100
  const rawReturn = baseReturn * scoreFraction * (isShort ? -1 : 1)
  const cappedReturn = isShort
    ? Math.min(rawReturn, -baseReturn * 0.5)
    : Math.min(rawReturn, baseReturn * 3)

  const targetPrice = price * (1 + cappedReturn)
  const targetPct = cappedReturn * 100

  // Aggressive: 50% more upside (or downside for shorts)
  const aggressiveReturn = cappedReturn * 1.5
  const aggressivePrice = price * (1 + aggressiveReturn)

  const riskDollar = Math.abs(price - stopPrice)
  const rewardDollar = Math.abs(targetPrice - price)

  const riskRewardRatio = riskDollar > 0 ? Math.round((rewardDollar / riskDollar) * 100) / 100 : 0

  return {
    primaryTarget: {
      price: Math.round(targetPrice * 100) / 100,
      pctFromCurrent: Math.round(targetPct * 10) / 10,
    },
    aggressiveTarget: {
      price: Math.round(aggressivePrice * 100) / 100,
      pctFromCurrent: Math.round(aggressiveReturn * 1000) / 10,
    },
    stopLoss: {
      price: Math.round(stopPrice * 100) / 100,
      pctFromCurrent: Math.round(stopPct * 10) / 10,
    },
    stopLossAtrMultiple: ATR_MULTIPLE,
  }
}

// ── Factor alignment ──────────────────────────────────────────────────────────

function factorDirection(score: number): FactorDirection {
  if (score >= 60) return 'bullish'
  if (score <= 40) return 'bearish'
  return 'neutral'
}

function equityInterpretation(name: string, score: number, km: Record<string, number | null>): string {
  const dir = factorDirection(score)
  switch (name) {
    case 'Momentum': {
      const ret12 = m(km, 'Ret 12M')
      const rs = m(km, 'RS vs Bench')
      if (dir === 'bullish') return `Strong price momentum — ${ret12 !== null ? `+${ret12.toFixed(1)}% over 12M` : 'above-average returns'}${rs !== null ? `, ${rs > 0 ? 'outperforming' : 'underperforming'} benchmark by ${Math.abs(rs).toFixed(1)}%` : ''}`
      if (dir === 'bearish') return `Weak momentum — ${ret12 !== null ? `${ret12.toFixed(1)}% over 12M` : 'below-average returns'}, lagging peer group`
      return 'Moderate momentum — returns in line with peer group average'
    }
    case 'Trend': {
      const ma200 = m(km, 'vs 200MA')
      const ma50 = m(km, 'vs 50MA')
      if (dir === 'bullish') return `Trending well — ${ma200 !== null ? `${ma200 > 0 ? '+' : ''}${ma200.toFixed(1)}% vs 200-day MA` : 'above major MAs'}${ma50 !== null ? `, ${ma50 > 0 ? '+' : ''}${ma50.toFixed(1)}% vs 50-day MA` : ''}`
      if (dir === 'bearish') return `Downtrend — ${ma200 !== null ? `${ma200.toFixed(1)}% vs 200-day MA` : 'below major moving averages'}`
      return 'Mixed trend signals — price oscillating around key moving averages'
    }
    case 'Earnings': {
      const epsGr = m(km, 'EPS Gr YoY')
      const epsSurp = m(km, 'EPS Surprise')
      if (dir === 'bullish') return `Earnings accelerating — ${epsGr !== null ? `EPS growth ${epsGr > 0 ? '+' : ''}${epsGr.toFixed(1)}% YoY` : 'above-peer earnings growth'}${epsSurp !== null && epsSurp > 0 ? `, positive earnings surprise (+${epsSurp.toFixed(1)}%)` : ''}`
      if (dir === 'bearish') return `Earnings weakness — ${epsGr !== null ? `EPS ${epsGr.toFixed(1)}% YoY` : 'below-peer earnings trend'}${epsSurp !== null && epsSurp < 0 ? `, negative earnings surprise (${epsSurp.toFixed(1)}%)` : ''}`
      return 'Earnings in line with peer group — no strong positive or negative signal'
    }
    case 'Quality': {
      const roe = m(km, 'ROE')
      const de = m(km, 'Debt/EBITDA')
      if (dir === 'bullish') return `High quality — ${roe !== null ? `ROE ${roe.toFixed(1)}%` : 'strong returns on capital'}${de !== null ? `, Debt/EBITDA ${de.toFixed(1)}×` : ''}`
      if (dir === 'bearish') return `Quality concerns — ${roe !== null ? `ROE ${roe.toFixed(1)}%` : 'below-average profitability'}${de !== null && de > 3 ? `, elevated leverage (${de.toFixed(1)}× Debt/EBITDA)` : ''}`
      return 'Average quality profile — ROE and leverage in line with peers'
    }
    case 'Risk': {
      const atr = m(km, 'ATR%')
      const dd = m(km, 'Max DD 6M')
      if (dir === 'bullish') return `Low risk — ${atr !== null ? `ATR ${atr.toFixed(1)}% (contained volatility)` : 'below-average volatility'}${dd !== null ? `, max drawdown ${dd.toFixed(1)}% over 6M` : ''}`
      if (dir === 'bearish') return `Elevated risk — ${atr !== null ? `ATR ${atr.toFixed(1)}% (high daily volatility)` : 'high volatility'}${dd !== null ? `, max drawdown ${dd.toFixed(1)}% over 6M` : ''}`
      return 'Moderate risk profile — volatility and drawdown in line with peers'
    }
    default: return `Score: ${score.toFixed(0)}`
  }
}

function futuresInterpretation(name: string, score: number, km: Record<string, number | null>): string {
  const dir = factorDirection(score)
  switch (name) {
    case 'Momentum': {
      const ret1 = m(km, 'Ret 1M')
      const ret3 = m(km, 'Ret 3M')
      if (dir === 'bullish') return `Strong price momentum — ${ret1 !== null ? `${ret1 > 0 ? '+' : ''}${ret1.toFixed(1)}% (1M)` : ''}${ret3 !== null ? `, ${ret3 > 0 ? '+' : ''}${ret3.toFixed(1)}% (3M)` : ''}`
      if (dir === 'bearish') return `Weak momentum — declining prices across 1M and 3M windows`
      return 'Neutral momentum — price changes near peer group median'
    }
    case 'Term Structure': {
      const contango = m(km, 'Contango')
      if (dir === 'bullish') return `Bullish term structure — ${contango !== null && contango < 1 ? 'market in backwardation (spot > futures, roll yield positive)' : 'favorable carry'}`
      if (dir === 'bearish') return `Bearish term structure — ${contango !== null && contango > 1 ? 'market in contango (futures > spot, negative roll yield)' : 'unfavorable carry'}`
      return 'Neutral term structure — near flat curve, minimal roll impact'
    }
    case 'Volatility': {
      const atr = m(km, 'ATR%')
      if (dir === 'bullish') return `High volatility — ${atr !== null ? `ATR ${atr.toFixed(1)}%, active price swings` : 'above-average volatility'} (favorable for trend strategies)`
      if (dir === 'bearish') return `Low volatility — ${atr !== null ? `ATR ${atr.toFixed(1)}%` : 'contracting volatility'}, low momentum opportunity`
      return 'Average volatility environment'
    }
    case 'Liquidity': {
      const volTrend = m(km, 'Vol Trend')
      if (dir === 'bullish') return `Good liquidity — ${volTrend !== null && volTrend > 1 ? `volume trending up (${volTrend.toFixed(2)}× recent average)` : 'above-average trading volume'}`
      if (dir === 'bearish') return `Weak liquidity — ${volTrend !== null && volTrend < 1 ? `volume declining (${volTrend.toFixed(2)}× recent average)` : 'below-average trading volume'}`
      return 'Adequate liquidity — volume in line with historical norms'
    }
    default: return `Score: ${score.toFixed(0)}`
  }
}

export function buildFactorAlignment(
  factorScores: RankedInstrument['factorScores'],
  km: Record<string, number | null>,
  assetType: 'equity' | 'future',
): FactorAlignment[] {
  if (assetType === 'equity' && isEquityScores(factorScores)) {
    return [
      { name: 'Momentum', score: factorScores.momentum, weight: 0.40, direction: factorDirection(factorScores.momentum), interpretation: equityInterpretation('Momentum', factorScores.momentum, km) },
      { name: 'Trend',    score: factorScores.trend,    weight: 0.20, direction: factorDirection(factorScores.trend),    interpretation: equityInterpretation('Trend',    factorScores.trend,    km) },
      { name: 'Earnings', score: factorScores.earnings, weight: 0.20, direction: factorDirection(factorScores.earnings), interpretation: equityInterpretation('Earnings', factorScores.earnings, km) },
      { name: 'Quality',  score: factorScores.quality,  weight: 0.10, direction: factorDirection(factorScores.quality),  interpretation: equityInterpretation('Quality',  factorScores.quality,  km) },
      { name: 'Risk',     score: factorScores.risk,     weight: 0.10, direction: factorDirection(factorScores.risk),     interpretation: equityInterpretation('Risk',     factorScores.risk,     km) },
    ]
  }
  if (assetType === 'future' && isFuturesScores(factorScores)) {
    return [
      { name: 'Momentum',       score: factorScores.momentum,       weight: 0.50, direction: factorDirection(factorScores.momentum),       interpretation: futuresInterpretation('Momentum',       factorScores.momentum,       km) },
      { name: 'Term Structure', score: factorScores.termStructure,  weight: 0.20, direction: factorDirection(factorScores.termStructure),  interpretation: futuresInterpretation('Term Structure', factorScores.termStructure,  km) },
      { name: 'Volatility',     score: factorScores.volatility,     weight: 0.20, direction: factorDirection(factorScores.volatility),     interpretation: futuresInterpretation('Volatility',     factorScores.volatility,     km) },
      { name: 'Liquidity',      score: factorScores.liquidity,      weight: 0.10, direction: factorDirection(factorScores.liquidity),      interpretation: futuresInterpretation('Liquidity',      factorScores.liquidity,      km) },
    ]
  }
  return []
}

// ── Explanation ───────────────────────────────────────────────────────────────

export function buildExplanation(
  instrument: RankedInstrument,
  alignment: FactorAlignment[],
  tradePlan: TradePlan,
  peerStats: PeerStats,
): FactorExplanation {
  const topPct = 100 - Math.round((instrument.rank / peerStats.peerGroupSize) * 100)
  const assetLabel = instrument.assetType === 'equity' ? 'stock' : 'futures contract'
  const mktLabel = `${instrument.market} ${instrument.assetType === 'equity' ? 'stocks' : 'contracts'}`

  const summary = `This ${assetLabel} ranks in the top ${Math.max(1, topPct)}% of ${peerStats.peerGroupSize} ${mktLabel} on the multi-factor model, with a composite score of ${instrument.finalScore.toFixed(1)}/100 (#${instrument.marketRank} in ${instrument.market}).`

  const bullish = alignment.filter((a) => a.direction === 'bullish').sort((a, b) => b.score - a.score)
  const bearish = alignment.filter((a) => a.direction === 'bearish').sort((a, b) => a.score - b.score)

  const drivers = bullish.slice(0, 3).map((a) => a.interpretation)
  const risks = bearish.slice(0, 2).map((a) => a.interpretation)

  if (risks.length === 0 && tradePlan.recommendation === 'STRONG_BUY') {
    risks.push('All factors aligned — monitor for reversion risk if score declines below 65')
  }

  const km = instrument.keyMetrics
  const watchList: string[] = []

  if (instrument.assetType === 'equity') {
    const dominantFactor = alignment.reduce((a, b) => (b.score > a.score ? b : a)).name
    if (dominantFactor === 'Earnings' || dominantFactor === 'Momentum') {
      watchList.push('Monitor earnings estimate revisions — earnings quality is a key driver of this score')
    }
    const atr = m(km, 'ATR%')
    const stop = tradePlan.exitLevels.stopLoss
    if (atr !== null) {
      watchList.push(`Track price vs $${stop.price.toFixed(2)} stop-loss level (${stop.pctFromCurrent.toFixed(1)}% below entry) — based on ${atr.toFixed(1)}% ATR`)
    }
    const ma50pct = m(km, 'vs 50MA')
    if (ma50pct !== null) {
      const ma50 = instrument.price / (1 + ma50pct / 100)
      watchList.push(`Watch for a break below the 50-day MA (~$${ma50.toFixed(2)}) as a trend deterioration signal`)
    }
  } else {
    const contango = m(km, 'Contango')
    if (contango !== null) {
      watchList.push(`Monitor term structure — contango ratio ${contango.toFixed(2)}× (< 1.0 = backwardation is bullish)`)
    }
    const volTrend = m(km, 'Vol Trend')
    if (volTrend !== null) {
      watchList.push(`Track volume trend (currently ${volTrend.toFixed(2)}×) — declining volume weakens momentum signals`)
    }
    watchList.push('Watch for roll dates — futures exposure requires active management near contract expiry')
  }

  return { summary, drivers, risks, watchList }
}

// ── Time horizon ──────────────────────────────────────────────────────────────

function computeTimeHorizon(dominantFactor: string): TimeHorizon {
  switch (dominantFactor) {
    case 'Momentum':       return '3-6 months'
    case 'Trend':          return '6-12 months'
    case 'Earnings':       return '3-6 months'
    case 'Quality':        return '6-12 months'
    case 'Risk':           return '1-3 months'
    case 'Term Structure': return '1-3 months'
    case 'Volatility':     return '1-3 months'
    case 'Liquidity':      return '3-6 months'
    default:               return '3-6 months'
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function generateStrategy(
  instrument: RankedInstrument,
  peerStats: PeerStats,
): StrategyReport {
  const rec = computeRecommendation(instrument.finalScore)
  const conviction = computeConviction(instrument.factorScores, rec)
  const km = instrument.keyMetrics

  const entryZone = computeEntryZone(instrument.price, km)
  const exitLevels = computeExitLevels(instrument.price, km, peerStats, instrument.finalScore, rec)

  const alignment = buildFactorAlignment(instrument.factorScores, km, instrument.assetType)
  const dominantFactor = alignment.length > 0
    ? alignment.reduce((a, b) => (b.score > a.score ? b : a)).name
    : 'Momentum'

  const tradePlan: TradePlan = {
    recommendation: rec,
    conviction,
    entryZone,
    exitLevels,
    expectedReturnPct: Math.round(exitLevels.primaryTarget.pctFromCurrent * 10) / 10,
    riskRewardRatio: (() => {
      const rewardPct = Math.abs(exitLevels.primaryTarget.pctFromCurrent)
      const riskPct = Math.abs(exitLevels.stopLoss.pctFromCurrent)
      return riskPct > 0 ? Math.round((rewardPct / riskPct) * 100) / 100 : 0
    })(),
    poorRiskReward: false,
    timeHorizon: computeTimeHorizon(dominantFactor),
    dominantFactor,
  }
  tradePlan.poorRiskReward = tradePlan.riskRewardRatio < 1.5

  const explanation = buildExplanation(instrument, alignment, tradePlan, peerStats)

  return {
    ticker: instrument.ticker,
    displayTicker: instrument.displayTicker,
    name: instrument.name,
    market: instrument.market,
    assetType: instrument.assetType,
    currency: instrument.currency,
    sector: instrument.sector,
    isCedear: instrument.isCedear,
    cedearTicker: instrument.cedearTicker,
    cedearRatio: instrument.cedearRatio,
    price: instrument.price,
    change1DPct: instrument.change1DPct,
    finalScore: instrument.finalScore,
    rank: instrument.rank,
    marketRank: instrument.marketRank,
    tradePlan,
    factorAlignment: alignment,
    explanation,
    keyMetrics: instrument.keyMetrics,
    peerAvgReturn12M: peerStats.avgReturn12M,
    peerGroupSize: peerStats.peerGroupSize,
  }
}

// ── Peer stats helper (call this in the page before generateStrategy) ─────────

export function computePeerStats(
  all: RankedInstrument[],
  forInstrument: RankedInstrument,
): PeerStats {
  const peers = all.filter((r) =>
    r.market === forInstrument.market &&
    r.assetType === forInstrument.assetType
  )

  const isFutures = forInstrument.assetType === 'future'
  const returnKey = isFutures ? 'Ret 1M' : 'Ret 12M'

  const returns = peers
    .map((r) => {
      const v = r.keyMetrics[returnKey]
      return typeof v === 'number' && isFinite(v) ? v : null
    })
    .filter((v): v is number => v !== null)

  // Market-specific fallback returns (% annualized)
  const fallback: Record<string, number> = {
    MERVAL: 40,   // high nominal returns due to ARS inflation
    NYSE:   12,
    NASDAQ: 15,
    ROFEX:  8,
  }

  const avgReturn = returns.length >= 3
    ? returns.reduce((s, v) => s + v, 0) / returns.length
    : fallback[forInstrument.market] ?? 12

  return {
    avgReturn12M: avgReturn / 100,
    avgReturn1M: isFutures ? avgReturn / 100 : 0.01,
    peerGroupSize: peers.length,
    market: forInstrument.market,
  }
}
