export type Recommendation = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'AVOID' | 'SHORT_CANDIDATE'
export type ConvictionLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type TimeHorizon = '1-2 weeks' | '2-4 weeks' | '1-3 months'
export type FactorDirection = 'bullish' | 'neutral' | 'bearish'

export interface FactorAlignment {
  name: string
  score: number
  direction: FactorDirection
  weight: number
  interpretation: string
}

export interface PriceLevel {
  price: number
  pctFromCurrent: number
}

export interface EntryZone {
  immediate: PriceLevel
  better: PriceLevel | null
  waitForPullback: boolean
  waitReason: string | null
}

export interface ExitLevels {
  primaryTarget: PriceLevel
  aggressiveTarget: PriceLevel
  stopLoss: PriceLevel
  stopLossAtrMultiple: number
}

export interface TradePlan {
  recommendation: Recommendation
  conviction: ConvictionLevel
  entryZone: EntryZone
  exitLevels: ExitLevels
  expectedReturnPct: number
  riskRewardRatio: number
  poorRiskReward: boolean
  timeHorizon: TimeHorizon
  dominantFactor: string
}

export interface FactorExplanation {
  summary: string
  drivers: string[]
  risks: string[]
  watchList: string[]
}

export interface StrategyReport {
  ticker: string
  displayTicker: string
  name: string
  market: string
  assetType: 'equity' | 'future'
  currency: string
  sector?: string
  isCedear: boolean
  cedearTicker?: string
  cedearRatio?: number
  price: number
  change1DPct: number
  finalScore: number
  rank: number
  marketRank: number
  tradePlan: TradePlan
  factorAlignment: FactorAlignment[]
  explanation: FactorExplanation
  keyMetrics: Record<string, number | null>
  peerAvgReturn12M: number
  peerGroupSize: number
}

export interface PeerStats {
  avgReturn12M: number   // decimal (e.g. 0.12 = 12%)
  avgReturn1M: number
  peerGroupSize: number
  market: string
}
