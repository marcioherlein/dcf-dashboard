export const STRATEGY_UNIVERSE = [
  { ticker: 'NVDA',  name: 'Nvidia',            layer: 'Chip Design' },
  { ticker: 'AMD',   name: 'AMD',               layer: 'Chip Design' },
  { ticker: 'AVGO',  name: 'Broadcom',          layer: 'Chip Design' },
  { ticker: 'INTC',  name: 'Intel',             layer: 'Chip Design' },
  { ticker: 'QCOM',  name: 'Qualcomm',          layer: 'Chip Design' },
  { ticker: 'MSFT',  name: 'Microsoft',         layer: 'Hyperscaler' },
  { ticker: 'GOOGL', name: 'Alphabet',          layer: 'Hyperscaler' },
  { ticker: 'AMZN',  name: 'Amazon',            layer: 'Hyperscaler' },
  { ticker: 'META',  name: 'Meta',              layer: 'Hyperscaler' },
  { ticker: 'ASML',  name: 'ASML',              layer: 'Semi Equipment' },
  { ticker: 'LRCX',  name: 'Lam Research',      layer: 'Semi Equipment' },
  { ticker: 'KLAC',  name: 'KLA Corp',          layer: 'Semi Equipment' },
  { ticker: 'AMAT',  name: 'Applied Materials', layer: 'Semi Equipment' },
  { ticker: 'NET',   name: 'Cloudflare',        layer: 'Edge / Cloud' },
  { ticker: 'ORCL',  name: 'Oracle',            layer: 'Edge / Cloud' },
  { ticker: 'EQIX',  name: 'Equinix',           layer: 'DC REIT' },
  { ticker: 'TSM',   name: 'TSMC (ADR)',        layer: 'Semi Mfg' },
]

export interface StrategyRow {
  ticker: string
  name: string
  layer: string
  price: number | null
  change1d: number | null

  momentum12_1: number | null
  momentumRank: number | null

  vol252: number | null
  volRank: number | null

  ma50: number | null
  ma200: number | null
  maSpread: number | null
  maSignal: 'golden' | 'death' | null

  return1m: number | null
  mrZscore: number | null

  pe: number | null
  pb: number | null
  ps: number | null
  evEbitda: number | null
  valueRank: number | null
}
