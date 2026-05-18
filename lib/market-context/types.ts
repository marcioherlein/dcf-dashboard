export type SentimentLabel = 'Risk-Off' | 'Cautious' | 'Neutral' | 'Constructive' | 'Risk-On'

export type MacroSignalTile = {
  id: string
  label: string
  value: string
  sub?: string
  regimeLabel: string
  equityImplication: string
  tone: 'positive' | 'negative' | 'neutral' | 'warning'
}

export type SectorBar = {
  sector: string
  ticker: string
  momentum: number
  tone: 'positive' | 'negative' | 'neutral'
}

export type ModelAlert = {
  ticker: string
  company: string
  alertType: 'ALERT_WACC_LOW' | 'ALERT_CAGR_HIGH' | 'ALERT_GORDON_VIOLATION'
  message: string
  severity: 'high' | 'medium'
}

export type ValuationContextBand = {
  label: string
  min: number
  max: number
  current?: boolean
}

export type MarketContextPayload = {
  pulse: {
    spxChange1d: number
    vix: number
    tnxYield: number
    sentimentLabel: SentimentLabel
    sentimentScore: number
  }
  signals: MacroSignalTile[]
  sectors: SectorBar[]
  valuation: {
    spyForwardPE: number | null
    erp: number | null
    forwardPEBands: ValuationContextBand[]
    erpBands: ValuationContextBand[]
  }
  rateContext: {
    dgs2: number | null
    hySpread: number | null
    fedFundsTarget: number
  }
  modelAlerts: ModelAlert[]
  portfolioExposure: { sector: string; count: number; pct: number }[]
  macroBrief: string | null
  briefCachedAt: string | null
  fetchedAt: string
}
