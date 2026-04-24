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

function estimateCAGR(revenueGrowth: number | null, layer: number): number {
  if (revenueGrowth === null) return SECTOR_CAGR[layer] ?? 0.08

  // Mean-reversion: high-growth inevitably slows
  let g = revenueGrowth
  if (g > 0.50)      g = g * 0.50 + 0.30 * 0.50
  else if (g > 0.30) g = g * 0.65 + 0.20 * 0.35
  else if (g > 0.15) g = g * 0.80 + 0.12 * 0.20

  return Math.max(-0.05, Math.min(0.45, g))
}

function estimateMargin2031(
  profitMargin: number | null,
  grossMargin: number | null,
  revenueGrowth: number | null,
): number {
  // Pre-profit: project toward profitability based on business model quality
  if (profitMargin === null || profitMargin <= 0) {
    if (grossMargin !== null && grossMargin >= 0.50) return 0.08   // high-margin software model
    if (grossMargin !== null && grossMargin >= 0.30) return 0.05
    if (grossMargin !== null && grossMargin >= 0.15) return 0.03
    return 0.02
  }

  // For profitable companies: apply operating leverage improvement
  const isHighGrowth  = revenueGrowth !== null && revenueGrowth > 0.15
  const hasMoat       = grossMargin   !== null && grossMargin   > 0.40
  const improvement   = (isHighGrowth && hasMoat) ? 0.03
                      : (isHighGrowth || hasMoat) ? 0.015
                      : 0.005

  return Math.max(0.01, Math.min(0.50, profitMargin + improvement))
}

function estimateDilution(layer: number, profitMargin: number | null): number {
  // Tech/growth layers: stock-based compensation is meaningful
  const techLayers = new Set([0, 1, 2, 4, 6, 7, 8])
  if (techLayers.has(layer)) {
    if (profitMargin !== null && profitMargin > 0.20) return 0.010  // mature, likely doing buybacks
    if (profitMargin !== null && profitMargin > 0.10) return 0.020
    return 0.030   // growth stage, heavy stock comp
  }
  // Industrial / materials / energy: much lower dilution
  return profitMargin !== null && profitMargin > 0.15 ? 0.005 : 0.010
}

function estimateCostOfDebt(debtToMarketCap: number): number {
  // Estimate pre-tax cost of debt based on leverage
  if (debtToMarketCap < 0.10) return RF_RATE + 0.010   // investment grade
  if (debtToMarketCap < 0.30) return RF_RATE + 0.015   // BBB
  return RF_RATE + 0.025                                // high yield
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeForwardValuation(
  m: Partial<ValuationMetrics>,
  sharesRaw: number | null,
): ValuationAssumptions | null {
  const { totalRevenue, profitMargin, grossMargin, revenueGrowth, beta,
          totalDebt, marketCap, price, layer } = m

  if (!totalRevenue || !price || price <= 0 || layer === undefined) return null
  if (!sharesRaw || sharesRaw <= 0) return null

  // ── WACC via existing engine ──────────────────────────────────────────────
  const b = beta != null ? Math.max(0.5, Math.min(3.0, beta)) : 1.2
  const dtomcap = (totalDebt != null && marketCap != null && marketCap > 0)
    ? totalDebt / marketCap
    : 0.25   // conservative default when unknown
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

  // ── Assumptions ───────────────────────────────────────────────────────────
  const revenueCAGR      = estimateCAGR(revenueGrowth ?? null, layer)
  const profitMargin2031 = estimateMargin2031(profitMargin ?? null, grossMargin ?? null, revenueGrowth ?? null)
  const peRatio2031      = SECTOR_PE[layer] ?? 20
  const dilutionRate     = estimateDilution(layer, profitMargin ?? null)

  // ── Projection formula (matches screenshot) ───────────────────────────────
  //   2031 Target = Revenue × (1+CAGR)^N × NetMargin × PE
  //                 ─────────────────────────────────────────
  //                 Shares × (1 + Dilution)^N
  const rev2031        = totalRevenue * Math.pow(1 + revenueCAGR, N)
  const ni2031         = rev2031 * profitMargin2031
  const shares2031     = sharesRaw * Math.pow(1 + dilutionRate, N)
  const eps2031        = ni2031 / shares2031
  const targetPrice2031 = eps2031 * peRatio2031

  if (!isFinite(targetPrice2031) || targetPrice2031 <= 0) return null

  const fairValue    = targetPrice2031 / Math.pow(1 + wacc, N)
  const priceTarget1Y = targetPrice2031 / Math.pow(1 + wacc, N - 1)
  const upside       = (fairValue - price) / price

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
  }
}
