import type { SentimentLabel, MacroSignalTile, ModelAlert } from './types'

export function computeSentimentScore(
  vix: number,
  spxChange: number,
  hySpread: number | null,
): number {
  let score = 50
  if (vix < 15)       score += 15
  else if (vix < 20)  score += 5
  else if (vix > 30)  score -= 20
  else if (vix > 25)  score -= 10

  if (spxChange > 1)       score += 8
  else if (spxChange > 0)  score += 3
  else if (spxChange < -1) score -= 8
  else if (spxChange < 0)  score -= 3

  if (hySpread != null) {
    if (hySpread < 300)      score += 10
    else if (hySpread < 400) score += 3
    else if (hySpread > 600) score -= 15
    else if (hySpread > 500) score -= 8
  }
  return Math.max(0, Math.min(100, score))
}

export function scoreToLabel(score: number): SentimentLabel {
  if (score >= 75) return 'Risk-On'
  if (score >= 60) return 'Constructive'
  if (score >= 40) return 'Neutral'
  if (score >= 25) return 'Cautious'
  return 'Risk-Off'
}

export function computeModelAlerts(
  valuations: { ticker: string; company: string; wacc: number | null; cagr: number | null; terminal_g: number | null }[],
  dgs2: number | null,
  tnxYield: number,
): ModelAlert[] {
  const alerts: ModelAlert[] = []
  const currentRfRate = dgs2 ?? tnxYield
  for (const v of valuations) {
    if (v.wacc != null && v.wacc < currentRfRate / 100 - 0.015) {
      alerts.push({
        ticker: v.ticker,
        company: v.company,
        alertType: 'ALERT_WACC_LOW',
        message: `WACC ${(v.wacc * 100).toFixed(1)}% looks low vs current 2Y yield ${currentRfRate.toFixed(2)}%`,
        severity: 'high',
      })
    }
    if (v.cagr != null && v.cagr > 0.25) {
      alerts.push({
        ticker: v.ticker,
        company: v.company,
        alertType: 'ALERT_CAGR_HIGH',
        message: `Revenue CAGR ${(v.cagr * 100).toFixed(0)}% is aggressive for current regime`,
        severity: 'medium',
      })
    }
    if (v.terminal_g != null && v.terminal_g >= tnxYield / 100) {
      alerts.push({
        ticker: v.ticker,
        company: v.company,
        alertType: 'ALERT_GORDON_VIOLATION',
        message: `Terminal growth ${(v.terminal_g * 100).toFixed(1)}% ≥ 10Y yield ${tnxYield.toFixed(2)}% — Gordon Growth violation`,
        severity: 'high',
      })
    }
  }
  return alerts
}

export function vixRegime(vix: number): { label: string; tone: MacroSignalTile['tone']; implication: string } {
  if (vix < 15) return { label: 'Complacency', tone: 'warning', implication: 'Low fear; potential for surprise vol' }
  if (vix < 20) return { label: 'Calm', tone: 'positive', implication: 'Supportive for risk assets' }
  if (vix < 25) return { label: 'Elevated', tone: 'neutral', implication: 'Monitor — above average uncertainty' }
  if (vix < 35) return { label: 'Fear', tone: 'negative', implication: 'Headwind for multiples expansion' }
  return { label: 'Panic', tone: 'negative', implication: 'Risk-off; discount rates repricing' }
}

export function yieldCurveRegime(dgs2: number | null, tnxYield: number): { label: string; tone: MacroSignalTile['tone']; implication: string } {
  if (dgs2 == null) return { label: 'Data Unavailable', tone: 'neutral', implication: '' }
  const spread = tnxYield - dgs2
  if (spread > 0.5)  return { label: 'Normal Curve',     tone: 'positive', implication: 'Supportive for bank lending and growth' }
  if (spread > 0)    return { label: 'Flat Curve',        tone: 'neutral',  implication: 'Growth concerns emerging' }
  if (spread > -0.5) return { label: 'Mildly Inverted',  tone: 'warning',  implication: 'Recession signal; watch credit' }
  return { label: 'Inverted Curve', tone: 'negative', implication: 'Historical recession precursor — caution' }
}

export function hySpreadRegime(spread: number | null): { label: string; tone: MacroSignalTile['tone']; implication: string } {
  if (spread == null) return { label: 'Data Unavailable', tone: 'neutral', implication: '' }
  if (spread < 300)   return { label: 'Tight Spreads', tone: 'positive', implication: 'Credit markets calm; risk appetite high' }
  if (spread < 450)   return { label: 'Normal',         tone: 'neutral',  implication: 'Moderate default risk priced in' }
  if (spread < 600)   return { label: 'Widening',       tone: 'warning',  implication: 'Credit stress building; ERP rising' }
  return { label: 'Credit Stress', tone: 'negative', implication: 'Risk-off; avoid high-leverage names' }
}

export function dxyRegime(dxy: number | null): { label: string; tone: MacroSignalTile['tone']; implication: string } {
  if (dxy == null)  return { label: 'Data Unavailable', tone: 'neutral', implication: '' }
  if (dxy > 106)    return { label: 'Strong Dollar',    tone: 'warning',  implication: 'Headwind for multinationals and commodities' }
  if (dxy > 100)    return { label: 'Firm Dollar',      tone: 'neutral',  implication: 'Neutral for equities broadly' }
  if (dxy > 94)     return { label: 'Moderate',         tone: 'positive', implication: 'Supportive for EM and commodities' }
  return { label: 'Weak Dollar', tone: 'positive', implication: 'Tailwind for commodity and EM earnings' }
}

export function tenYearRegime(yield10y: number): { label: string; tone: MacroSignalTile['tone']; implication: string } {
  if (yield10y > 5.5) return { label: 'Very Tight',  tone: 'negative', implication: 'High discount rate; headwind for growth stocks' }
  if (yield10y > 4.5) return { label: 'Restrictive', tone: 'warning',  implication: 'Elevated cost of capital; watch duration' }
  if (yield10y > 3.5) return { label: 'Elevated',    tone: 'neutral',  implication: 'Moderate discount rates — manageable for equities' }
  if (yield10y > 2.5) return { label: 'Neutral',     tone: 'positive', implication: 'Supportive for equity multiples' }
  return { label: 'Low Rates', tone: 'positive', implication: 'Easy financial conditions; supportive for growth' }
}
