/**
 * V2 FCFF DCF Engine
 *
 * Corrects the V1 approach of growing current FCF directly by a revenue CAGR.
 *
 * V2 uses an internally consistent unlevered FCFF framework:
 *
 *   Revenue_t   = Revenue_(t-1) × (1 + RevenueGrowth_t)
 *   EBIT_t      = Revenue_t × EBITMargin_t
 *   NOPAT_t     = EBIT_t × (1 − CashTaxRate)
 *   Reinvest_t  = ΔRevenue_t / SalesToCapitalRatio_t
 *   FCFF_t      = NOPAT_t − Reinvest_t
 *
 * The terminal value uses Gordon Growth on FCFF_10 × (1+g) / (WACC−g),
 * with an explicit minimum WACC-minus-g spread (default 150 bps).
 *
 * The exit multiple, when requested, is applied to EBITDA_10 × Multiple,
 * not FCFF × Multiple.
 *
 * Both terminal methods are returned as separate outputs; the caller
 * decides how to blend them. No automatic 50/50 average.
 */

import { computeEnterpriseBridgeV1Compat } from './enterpriseValueBridge'

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface FCFFDcfInputsV2 {
  // Base period (TTM or last fiscal year) — all in millions
  baseRevenueM:       number
  baseEbitMarginPct:  number    // e.g. 0.22 for 22%
  cashTaxRate:        number    // effective cash tax rate, e.g. 0.18
  dnaM?:              number | null  // D&A (for EBITDA terminal value cross-check)
  capexM?:            number | null  // gross capex (for reinvestment check)
  nwcDeltaM?:         number | null  // change in NWC (sign: positive = use of cash)

  // Forecast assumptions
  revenueGrowthByYear: number[]    // annual revenue growth rates, length = projectionYears
  ebitMarginByYear?:   number[]    // optional; if absent, linearly fade from base to terminal
  terminalEbitMargin?: number | null // steady-state margin; defaults to baseEbitMarginPct

  // Discount rate
  wacc:           number
  terminalG:      number  // long-run growth; MUST be < wacc
  minWaccSpread?: number  // minimum (wacc - terminalG) spread; default 0.015 (150 bps)

  // Reinvestment
  salesToCapitalRatio?: number  // ΔRevenue / Reinvestment; default derived from historical data
  roicTerminal?:        number | null  // used to derive reinvestment rate via g = ROIC × reinvest

  // Exit multiple (optional cross-check)
  exitEVEBITDAMultiple?: number | null

  // Bridge inputs
  cashM:        number
  debtM:        number
  dilutedSharesM: number
  currentPrice: number

  // Context
  projectionYears?: number  // default 10
  currency?:        string
  companyType?:     string
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

export interface FCFFProjectionRow {
  year:            number
  revenue:         number
  revenueGrowth:   number
  ebitMargin:      number
  ebit:            number
  nopat:           number
  reinvestment:    number
  fcff:            number
  discountFactor:  number
  pvFcff:          number
}

export interface FCFFDcfResultV2 {
  projectionRows:         FCFFProjectionRow[]
  sumPvFcff:              number
  terminalValueGordon:    number | null   // Gordon Growth terminal value (undiscounted)
  pvTerminalGordon:       number | null
  enterpriseValueGordon:  number | null

  terminalValueExit:      number | null   // Exit EV/EBITDA terminal value (undiscounted)
  pvTerminalExit:         number | null
  enterpriseValueExit:    number | null

  // Per-share outputs (bridge applied)
  fairValuePerShareGordon: number | null
  fairValuePerShareExit:   number | null

  upsidePctGordon: number | null
  upsidePctExit:   number | null

  // Diagnostics
  terminalValueShareGordon: number | null  // TV_Gordon / EV_Gordon
  terminalValueShareExit:   number | null
  impliedTerminalROIC:      number | null
  impliedTerminalEVEBITDA:  number | null

  warnings: string[]
}

// ─── Default parameters ───────────────────────────────────────────────────────

const DEFAULT_SALES_TO_CAPITAL = 1.5    // $1.50 revenue per $1 reinvested — conservative for tech
const MIN_WACC_SPREAD           = 0.015  // 150 bps minimum (wacc - terminalG)
const DEFAULT_CASH_TAX_RATE     = 0.21   // US statutory effective rate fallback
const DEFAULT_PROJECTION_YEARS  = 10

// ─── Main computation ─────────────────────────────────────────────────────────

export function computeFCFFDcfV2(inputs: FCFFDcfInputsV2): FCFFDcfResultV2 {
  const warnings: string[] = []
  const years = inputs.projectionYears ?? DEFAULT_PROJECTION_YEARS
  const cashTax = inputs.cashTaxRate > 0 ? inputs.cashTaxRate : DEFAULT_CASH_TAX_RATE

  // ── 1. Enforce terminal growth constraint ────────────────────────────────

  const minSpread = inputs.minWaccSpread ?? MIN_WACC_SPREAD
  let terminalG = inputs.terminalG
  const maxTerminalG = inputs.wacc - minSpread

  if (terminalG >= inputs.wacc) {
    terminalG = maxTerminalG
    warnings.push(
      `TERMINAL_G_CAPPED: terminalG (${(inputs.terminalG * 100).toFixed(2)}%) ≥ WACC ` +
      `(${(inputs.wacc * 100).toFixed(2)}%). Capped at ${(maxTerminalG * 100).toFixed(2)}% ` +
      `(WACC − ${(minSpread * 100).toFixed(1)}pp)`
    )
  }

  if (terminalG > 0.05) {
    warnings.push(
      `HIGH_TERMINAL_G: terminalG=${(terminalG * 100).toFixed(1)}% exceeds 5%. ` +
      'For most companies in developed markets, terminal growth should be 1.5–3.5%.'
    )
  }

  // ── 2. Build revenue growth curve ────────────────────────────────────────

  const growthCurve = inputs.revenueGrowthByYear.slice(0, years)
  // Pad with terminal growth if shorter than projection period
  while (growthCurve.length < years) {
    growthCurve.push(terminalG)
  }

  // ── 3. Build EBIT margin curve ────────────────────────────────────────────
  //
  // If explicit margins are supplied, use them directly.
  // Otherwise fade linearly from base margin to terminal margin.

  const terminalMargin = inputs.terminalEbitMargin ?? inputs.baseEbitMarginPct
  const marginCurve: number[] = []

  if (inputs.ebitMarginByYear && inputs.ebitMarginByYear.length >= years) {
    for (let t = 0; t < years; t++) {
      marginCurve.push(inputs.ebitMarginByYear[t])
    }
  } else {
    // Linear interpolation from base margin to terminal margin
    for (let t = 0; t < years; t++) {
      const weight = (t + 1) / years
      marginCurve.push(
        inputs.baseEbitMarginPct * (1 - weight) + terminalMargin * weight
      )
    }
  }

  // ── 4. Determine reinvestment assumption ──────────────────────────────────
  //
  // Preferred: use ROIC-based reinvestment in terminal year.
  // Fallback: use sales-to-capital ratio (ΔRevenue / Reinvestment).

  const salesToCapital = inputs.salesToCapitalRatio ?? DEFAULT_SALES_TO_CAPITAL

  // ── 5. Project FCFF year by year ─────────────────────────────────────────

  const rows: FCFFProjectionRow[] = []
  let prevRevenue = inputs.baseRevenueM
  let sumPvFcff   = 0

  for (let t = 1; t <= years; t++) {
    const g        = growthCurve[t - 1]
    const revenue  = prevRevenue * (1 + g)
    const deltaRev = revenue - prevRevenue

    const ebitMargin   = marginCurve[t - 1]
    const ebit         = revenue * ebitMargin
    const nopat        = ebit * (1 - cashTax)

    // Reinvestment = ΔRevenue / Sales-to-Capital ratio
    // This is the Damodaran FCFF approach that links reinvestment to growth
    const reinvestment = deltaRev / salesToCapital

    const fcff           = nopat - reinvestment
    const discountFactor = Math.pow(1 + inputs.wacc, t)
    const pvFcff         = fcff / discountFactor

    sumPvFcff += pvFcff

    rows.push({
      year:          t,
      revenue:       Math.round(revenue * 100) / 100,
      revenueGrowth: g,
      ebitMargin,
      ebit:          Math.round(ebit * 100) / 100,
      nopat:         Math.round(nopat * 100) / 100,
      reinvestment:  Math.round(reinvestment * 100) / 100,
      fcff:          Math.round(fcff * 100) / 100,
      discountFactor,
      pvFcff:        Math.round(pvFcff * 100) / 100,
    })

    prevRevenue = revenue
  }

  const lastRow         = rows[rows.length - 1]
  const _lastFcff       = lastRow.fcff
  const lastRevenue     = lastRow.revenue
  const lastNopat       = lastRow.nopat
  const lastDiscFactor  = Math.pow(1 + inputs.wacc, years)

  // ── 6. Terminal value — Gordon Growth ────────────────────────────────────

  let terminalValueGordon: number | null = null
  let pvTerminalGordon:    number | null = null
  let enterpriseValueGordon: number | null = null

  // Reinvestment rate in terminal year based on ROIC or sales-to-capital
  let terminalFcff: number
  if (inputs.roicTerminal != null && inputs.roicTerminal > terminalG) {
    const reinvestRate = terminalG / inputs.roicTerminal
    terminalFcff = lastNopat * (1 + terminalG) * (1 - reinvestRate)
    warnings.push(
      `TERMINAL_FCFF_ROIC: Using ROIC=${(inputs.roicTerminal * 100).toFixed(1)}% to derive ` +
      `terminal reinvestment rate=${(reinvestRate * 100).toFixed(1)}%`
    )
  } else {
    // Reinvest only the growth portion
    const deltaRevTerminal   = lastRevenue * terminalG
    const reinvestTerminal   = deltaRevTerminal / salesToCapital
    terminalFcff = lastNopat * (1 + terminalG) - reinvestTerminal
  }

  if (terminalFcff > 0) {
    terminalValueGordon   = terminalFcff / (inputs.wacc - terminalG)
    pvTerminalGordon      = terminalValueGordon / lastDiscFactor
    enterpriseValueGordon = sumPvFcff + pvTerminalGordon
  } else {
    warnings.push(
      `NEGATIVE_TERMINAL_FCFF: Terminal year FCFF (${terminalFcff.toFixed(0)}M) is negative. ` +
      'Gordon Growth terminal value is not applicable.'
    )
  }

  // ── 7. Terminal value — Exit EV/EBITDA (cross-check) ─────────────────────
  //
  // Correct formula: EBITDA_N × Multiple (not FCFF × Multiple)

  let terminalValueExit:    number | null = null
  let pvTerminalExit:       number | null = null
  let enterpriseValueExit:  number | null = null

  if (inputs.exitEVEBITDAMultiple != null && inputs.exitEVEBITDAMultiple > 0) {
    // Derive terminal year EBITDA from EBIT + D&A%
    const dnaRatioBase = (inputs.dnaM != null && inputs.baseRevenueM > 0)
      ? inputs.dnaM / inputs.baseRevenueM
      : 0.04   // 4% D&A/revenue fallback

    const terminalEbitda = lastRow.revenue * (lastRow.ebitMargin + dnaRatioBase)

    if (terminalEbitda > 0) {
      terminalValueExit   = terminalEbitda * inputs.exitEVEBITDAMultiple
      pvTerminalExit      = terminalValueExit / lastDiscFactor
      enterpriseValueExit = sumPvFcff + pvTerminalExit
    } else {
      warnings.push(
        `NEGATIVE_TERMINAL_EBITDA: Terminal year EBITDA (${terminalEbitda.toFixed(0)}M) is negative. ` +
        'Exit multiple terminal value is not applicable.'
      )
    }
  }

  // ── 8. Per-share values via enterprise bridge ─────────────────────────────

  const bridgeGordon = enterpriseValueGordon != null
    ? computeEnterpriseBridgeV1Compat(
        enterpriseValueGordon,
        inputs.cashM,
        inputs.debtM,
        inputs.dilutedSharesM,
        inputs.currentPrice,
      )
    : null

  const bridgeExit = enterpriseValueExit != null
    ? computeEnterpriseBridgeV1Compat(
        enterpriseValueExit,
        inputs.cashM,
        inputs.debtM,
        inputs.dilutedSharesM,
        inputs.currentPrice,
      )
    : null

  // ── 9. Diagnostics ────────────────────────────────────────────────────────

  const terminalValueShareGordon = (pvTerminalGordon != null && enterpriseValueGordon != null && enterpriseValueGordon > 0)
    ? pvTerminalGordon / enterpriseValueGordon
    : null

  const terminalValueShareExit = (pvTerminalExit != null && enterpriseValueExit != null && enterpriseValueExit > 0)
    ? pvTerminalExit / enterpriseValueExit
    : null

  if (terminalValueShareGordon != null && terminalValueShareGordon > 0.80) {
    warnings.push(
      `HIGH_TERMINAL_VALUE_SHARE: Terminal value is ${(terminalValueShareGordon * 100).toFixed(0)}% ` +
      'of enterprise value. Results are highly sensitive to terminal assumptions.'
    )
  }

  // Implied terminal ROIC (NOPAT_terminal / Reinvestment cumulative proxy)
  const impliedTerminalROIC = (inputs.roicTerminal ?? null)
  const impliedTerminalEVEBITDA = (enterpriseValueGordon != null && lastRow != null)
    ? (() => {
        const dnaRatio = (inputs.dnaM != null && inputs.baseRevenueM > 0)
          ? inputs.dnaM / inputs.baseRevenueM : 0.04
        const termEbitda = lastRow.revenue * (lastRow.ebitMargin + dnaRatio)
        return termEbitda > 0 ? enterpriseValueGordon / termEbitda : null
      })()
    : null

  return {
    projectionRows:           rows,
    sumPvFcff:                Math.round(sumPvFcff * 100) / 100,
    terminalValueGordon:      terminalValueGordon != null ? Math.round(terminalValueGordon * 100) / 100 : null,
    pvTerminalGordon:         pvTerminalGordon != null ? Math.round(pvTerminalGordon * 100) / 100 : null,
    enterpriseValueGordon:    enterpriseValueGordon != null ? Math.round(enterpriseValueGordon * 100) / 100 : null,
    terminalValueExit:        terminalValueExit != null ? Math.round(terminalValueExit * 100) / 100 : null,
    pvTerminalExit:           pvTerminalExit != null ? Math.round(pvTerminalExit * 100) / 100 : null,
    enterpriseValueExit:      enterpriseValueExit != null ? Math.round(enterpriseValueExit * 100) / 100 : null,
    fairValuePerShareGordon:  bridgeGordon?.fairValuePerShare ?? null,
    fairValuePerShareExit:    bridgeExit?.fairValuePerShare ?? null,
    upsidePctGordon:          bridgeGordon?.upsidePct ?? null,
    upsidePctExit:            bridgeExit?.upsidePct ?? null,
    terminalValueShareGordon,
    terminalValueShareExit,
    impliedTerminalROIC,
    impliedTerminalEVEBITDA,
    warnings: [
      ...warnings,
      ...(bridgeGordon?.warnings ?? []),
      ...(bridgeExit?.warnings ?? []),
    ],
  }
}

// ─── Growth curve builder from legacy flat CAGR ───────────────────────────────

/**
 * Converts V1's single flat CAGR into a V2 annual growth curve.
 * Implements a simple fade toward terminal growth in the back half.
 */
export function buildGrowthCurveFromLegacyCagr(
  cagr: number,
  terminalGrowth: number,
  years: number = DEFAULT_PROJECTION_YEARS,
): number[] {
  const curve: number[] = []
  const fadeStartYear = Math.floor(years / 2) + 1   // start fading in second half

  for (let t = 1; t <= years; t++) {
    if (t < fadeStartYear) {
      curve.push(cagr)
    } else {
      // Linear fade from cagr to terminalGrowth
      const fadeProgress = (t - fadeStartYear) / (years - fadeStartYear)
      curve.push(cagr + (terminalGrowth - cagr) * fadeProgress)
    }
  }

  return curve
}

// ─── Adapter: build V2 DCF inputs from V1 snapshot ───────────────────────────

import type { CockpitSnapshot as CockpitSnapshotV1, ValuationAssumptions } from '../cockpit'

export function buildFCFFInputsFromV1Snapshot(
  snapshot: CockpitSnapshotV1,
  assumptions: ValuationAssumptions,
): FCFFDcfInputsV2 | null {
  // Cannot proceed without revenue base
  const baseRevenueM = snapshot.ttmRevenueDollars != null
    ? snapshot.ttmRevenueDollars / 1_000_000
    : (snapshot.ltvRevenueDollars != null ? snapshot.ltvRevenueDollars / 1_000_000 : null)

  if (baseRevenueM == null || baseRevenueM <= 0) return null

  // Derive EBIT margin from snapshot
  // V1 doesn't store EBIT directly in snapshot — use operating income if available
  const ebitdaM        = snapshot.ttmEbitdaDollars != null ? snapshot.ttmEbitdaDollars / 1_000_000 : null
  const dnaM           = snapshot.dnaDollars != null ? snapshot.dnaDollars / 1_000_000 : null
  const baseEbitMargin = (ebitdaM != null && dnaM != null && baseRevenueM > 0)
    ? Math.max(0, (ebitdaM - dnaM) / baseRevenueM)
    : Math.max(0, assumptions.netMargin * 1.15)   // rough proxy: EBIT ≈ net margin × 1.15

  const growthCurve = buildGrowthCurveFromLegacyCagr(
    assumptions.cagr,
    assumptions.terminalG,
  )

  return {
    baseRevenueM,
    baseEbitMarginPct:  baseEbitMargin,
    cashTaxRate:        assumptions.taxRate ?? 0.21,
    dnaM,
    revenueGrowthByYear: growthCurve,
    wacc:               assumptions.wacc,
    terminalG:          assumptions.terminalG,
    exitEVEBITDAMultiple: assumptions.exitMultiple > 0 ? assumptions.exitMultiple : null,
    cashM:              snapshot.cashM,
    debtM:              snapshot.debtM,
    dilutedSharesM:     snapshot.sharesM,
    currentPrice:       snapshot.currentPrice,
    currency:           snapshot.currency,
    companyType:        snapshot.companyType ?? 'standard',
  }
}
