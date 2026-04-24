import { calculateWACC } from '@/lib/dcf/calculateWACC'
import { ValuationMetrics, ValuationAssumptions } from './scoring'

// ─── Constants (April 2026) ───────────────────────────────────────────────────

const RF_RATE       = 0.045   // US 10-year Treasury
const ERP           = 0.055   // Equity risk premium (Damodaran, slightly elevated)
const TAX_RATE      = 0.21
const N             = 5       // years to 2031

// ─── Sector PE at exit (assumes overvaluations compressed by 2031) ────────────

const SECTOR_PE: Record<number, number> = {
  0:  28,   // Edge/CDN — recurring SaaS-like contracts
  1:  25,   // Hyperscalers — large-cap compression
  2:  22,   // GPU Cloud / Neocloud — spec premium reduced
  3:  20,   // DC REITs — REIT yield-driven
  4:  28,   // Chip Design — IP premium
  5:  18,   // Semiconductor Mfg — cyclical
  6:  22,   // Electrical Connectivity
  7:  20,   // Optical Interconnects
  8:  23,   // Networking Hardware
  9:  15,   // Rack/OEM — thin margin
  10: 19,   // Power & Cooling
  11: 21,   // Power Semiconductors — analog premium
  12: 16,   // DC Construction — project-based
  13: 15,   // Logistics
  14: 17,   // Energy
  15: 13,   // Raw Materials — commodity
}

// ─── Sector CAGR defaults (when Yahoo has no revenue growth) ─────────────────

const SECTOR_CAGR: Record<number, number> = {
  0:  0.08,   1:  0.12,   2:  0.25,   3:  0.08,   4:  0.14,
  5:  0.08,   6:  0.12,   7:  0.10,   8:  0.10,   9:  0.06,
  10: 0.08,   11: 0.09,   12: 0.08,   13: 0.05,   14: 0.06,  15: 0.04,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateCAGR(revenueGrowth: number | null, layer: number): { cagr: number; evidence: string } {
  if (revenueGrowth === null) {
    const cagr = SECTOR_CAGR[layer] ?? 0.08
    return { cagr, evidence: `No growth data → sector default ${pct(cagr)}` }
  }

  const raw = revenueGrowth
  let g = revenueGrowth
  let note = ''
  if (g > 0.50) {
    g = g * 0.50 + 0.30 * 0.50
    note = `${pct(raw)} → mean-reverted to ${pct(g)} (blended toward 30%)`
  } else if (g > 0.30) {
    g = g * 0.65 + 0.20 * 0.35
    note = `${pct(raw)} → mean-reverted to ${pct(g)} (blended toward 20%)`
  } else if (g > 0.15) {
    g = g * 0.80 + 0.12 * 0.20
    note = `${pct(raw)} → mean-reverted to ${pct(g)} (blended toward 12%)`
  } else {
    note = `${pct(raw)} → used as-is`
  }

  const cagr = Math.max(-0.05, Math.min(0.45, g))
  return { cagr, evidence: `YoY revenue growth ${note}` }
}

function estimateMargin2031(
  profitMargin: number | null,
  grossMargin: number | null,
  revenueGrowth: number | null,
): { margin: number; evidence: string } {
  if (profitMargin === null || profitMargin <= 0) {
    let margin = 0.02
    let source = 'low gross margin'
    if (grossMargin !== null && grossMargin >= 0.50) { margin = 0.08; source = `gross margin ${pct(grossMargin)} → software model` }
    else if (grossMargin !== null && grossMargin >= 0.30) { margin = 0.05; source = `gross margin ${pct(grossMargin)} → moderate` }
    else if (grossMargin !== null && grossMargin >= 0.15) { margin = 0.03; source = `gross margin ${pct(grossMargin)} → thin` }
    const evidence = `Pre-profit (${profitMargin !== null ? pct(profitMargin) : 'N/A'}) — projected ${pct(margin)} via ${source}`
    return { margin, evidence }
  }

  const isHighGrowth = revenueGrowth !== null && revenueGrowth > 0.15
  const hasMoat      = grossMargin   !== null && grossMargin   > 0.40
  const improvement  = (isHighGrowth && hasMoat) ? 0.03
                     : (isHighGrowth || hasMoat) ? 0.015
                     : 0.005

  const margin = Math.max(0.01, Math.min(0.50, profitMargin + improvement))
  const reason = isHighGrowth && hasMoat ? 'high growth + moat (+3%)'
               : isHighGrowth            ? 'high growth (+1.5%)'
               : hasMoat                 ? 'moat/margin (+1.5%)'
               : 'stable (+0.5%)'
  const evidence = `Current net margin ${pct(profitMargin)} → ${pct(margin)} (${reason})`
  return { margin, evidence }
}

function estimateDilution(layer: number, profitMargin: number | null): { rate: number; evidence: string } {
  const techLayers = new Set([0, 1, 2, 4, 6, 7, 8])
  if (techLayers.has(layer)) {
    if (profitMargin !== null && profitMargin > 0.20) {
      return { rate: 0.010, evidence: 'Tech layer, mature/profitable (likely buybacks) → 1.0%/yr' }
    }
    if (profitMargin !== null && profitMargin > 0.10) {
      return { rate: 0.020, evidence: 'Tech layer, moderate profitability → 2.0%/yr stock comp' }
    }
    return { rate: 0.030, evidence: 'Tech layer, growth stage (heavy stock-based comp) → 3.0%/yr' }
  }
  const rate = profitMargin !== null && profitMargin > 0.15 ? 0.005 : 0.010
  return { rate, evidence: `Industrial/materials layer → ${pct(rate)}/yr` }
}

function estimateCostOfDebt(debtToMarketCap: number): number {
  if (debtToMarketCap < 0.10) return RF_RATE + 0.010
  if (debtToMarketCap < 0.30) return RF_RATE + 0.015
  return RF_RATE + 0.025
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + '%'
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeForwardValuation(
  m: Partial<ValuationMetrics>,
  sharesRaw: number | null,
): ValuationAssumptions | null {
  const { totalRevenue, profitMargin, grossMargin, revenueGrowth, beta,
          totalDebt, marketCap, price, layer, financialCurrency } = m

  if (!totalRevenue || !price || price <= 0 || layer === undefined) return null
  if (!sharesRaw || sharesRaw <= 0) return null

  // Revenue is already in USD (route.ts converts via FX rate before this is called).
  // Flag if it was a non-USD company so the modal can note it.
  const reportingCurrency = (financialCurrency ?? 'USD').toUpperCase()
  const currencyNote: string | null = reportingCurrency !== 'USD'
    ? `Financial statements converted from ${reportingCurrency} to USD using live FX rate.`
    : null

  // ── WACC ──────────────────────────────────────────────────────────────────
  const b = beta != null ? Math.max(0.5, Math.min(3.0, beta)) : 1.2
  const dtomcap = (totalDebt != null && marketCap != null && marketCap > 0)
    ? totalDebt / marketCap
    : 0.25
  const cod = estimateCostOfDebt(dtomcap)

  const waccResult = calculateWACC({
    rfRate:      RF_RATE,
    beta:        b,
    erp:         ERP,
    costOfDebt:  cod,
    taxRate:     TAX_RATE,
    debtToEquity: dtomcap,
  })
  const wacc = Math.min(0.20, Math.max(0.07, waccResult.wacc))

  const betaUsed = beta != null ? beta.toFixed(2) : '1.20 (default)'
  const waccEvidence = `Beta ${betaUsed}, RF ${pct(RF_RATE)}, ERP ${pct(ERP)}, CoD ${pct(cod)}, D/MktCap ${pct(dtomcap)} → WACC ${pct(wacc)}`

  // ── Assumptions ───────────────────────────────────────────────────────────
  const { cagr: revenueCAGR, evidence: cagrEvidence } = estimateCAGR(revenueGrowth ?? null, layer)
  const { margin: profitMargin2031, evidence: marginEvidence } = estimateMargin2031(
    profitMargin ?? null, grossMargin ?? null, revenueGrowth ?? null
  )
  const peRatio2031 = SECTOR_PE[layer] ?? 20
  const currentPe = m.pe ?? m.forwardPe
  const peEvidence = currentPe
    ? `Current trailing PE ${currentPe.toFixed(0)}× → sector normalized target ${peRatio2031}× (layer ${layer})`
    : `No current PE data → sector target ${peRatio2031}× (layer ${layer})`

  const { rate: dilutionRate, evidence: dilutionEvidence } = estimateDilution(layer, profitMargin ?? null)

  // ── Projection formula ───────────────────────────────────────────────────
  const rev2031         = totalRevenue * Math.pow(1 + revenueCAGR, N)
  const ni2031          = rev2031 * profitMargin2031
  const shares2031      = sharesRaw * Math.pow(1 + dilutionRate, N)
  const eps2031         = ni2031 / shares2031
  const targetPrice2031 = eps2031 * peRatio2031

  if (!isFinite(targetPrice2031) || targetPrice2031 <= 0) return null

  const fairValue     = targetPrice2031 / Math.pow(1 + wacc, N)
  const priceTarget1Y = targetPrice2031 / Math.pow(1 + wacc, N - 1)
  const upside        = (fairValue - price) / price

  return {
    ltvRevenue:      totalRevenue,
    sharesOutstanding: sharesRaw,
    revenueCAGR,
    profitMargin2031,
    peRatio2031,
    dilutionRate,
    discountRate:    wacc,
    yearsToTarget:   N,
    targetPrice2031,
    fairValue,
    priceTarget1Y,
    upside,
    cagrEvidence,
    marginEvidence,
    peEvidence,
    dilutionEvidence,
    waccEvidence,
    currencyNote,
  }
}

// ─── Recompute from editable assumptions (modal override) ────────────────────

export interface EditableAssumptions {
  revenueCAGR: number
  profitMargin2031: number
  peRatio2031: number
  dilutionRate: number
  discountRate: number
}

export function recomputeValuation(
  price: number,
  ltvRevenue: number,
  sharesOutstanding: number,
  a: EditableAssumptions,
): { targetPrice2031: number; fairValue: number; priceTarget1Y: number; upside: number } {
  const rev2031         = ltvRevenue * Math.pow(1 + a.revenueCAGR, N)
  const ni2031          = rev2031 * a.profitMargin2031
  const shares2031      = sharesOutstanding * Math.pow(1 + a.dilutionRate, N)
  const eps2031         = ni2031 / shares2031
  const targetPrice2031 = eps2031 * a.peRatio2031

  if (!isFinite(targetPrice2031) || targetPrice2031 <= 0) {
    return { targetPrice2031: 0, fairValue: 0, priceTarget1Y: 0, upside: -1 }
  }

  const fairValue     = targetPrice2031 / Math.pow(1 + a.discountRate, N)
  const priceTarget1Y = targetPrice2031 / Math.pow(1 + a.discountRate, N - 1)
  const upside        = (fairValue - price) / price

  return { targetPrice2031, fairValue, priceTarget1Y, upside }
}
