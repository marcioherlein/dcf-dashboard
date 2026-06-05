/**
 * Unlevered Free Cash Flow (UFCF) model.
 *
 * UFCF = NOPAT + D&A − CapEx − ΔNWC
 * NOPAT = EBIT × (1 − taxRate)
 * D&A = ebitda − operatingIncome  (derived; no API change needed)
 * ΔNWC = Δ(currentAssets − cash − currentLiabilities)
 *
 * All monetary values in millions (matching API output).
 */

import { assertTerminalGrowth } from './valuationGuards'

export interface UFCFRow {
  year: string
  isProjected: boolean
  // Inputs (null = data absent)
  revenue: number | null
  ebit: number | null
  ebitda: number | null
  capex: number | null       // stored as negative (e.g. −120M)
  nwc: number | null         // (currentAssets − cash) − currentLiabilities
  // Derived
  dna: number | null         // ebitda − ebit (or dnaFromCF if provided)
  nwcDelta: number | null    // nwc[t] − nwc[t−1]
  nopat: number | null       // ebit × (1 − taxRate)
  ufcf: number | null        // nopat + dna + capex + nwcDelta (capex is negative, nwcDelta may be negative)
  // Output
  pvUfcf: number | null      // ufcf / (1+wacc)^t
  taxRateActual?: number | null  // the per-row tax rate used (not the global WACC tax rate)
}

export interface UFCFResult {
  rows: UFCFRow[]
  sumPvFcf: number          // Σ PV(UFCF) for projection years only
  perpetuityTV: number | null
  exitMultipleTV: number | null
  ev: number | null          // sumPvFcf + terminal value (discounted)
}

export function computeUFCFRows(
  rows: Omit<UFCFRow, 'dna' | 'nwcDelta' | 'nopat' | 'ufcf' | 'pvUfcf' | 'taxRateActual'>[],
  taxRate: number,
  wacc: number,
): UFCFRow[] {
  const result: UFCFRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const prior = i > 0 ? result[i - 1] : null

    const dna = (r as any).dnaFromCF != null
      ? (r as any).dnaFromCF as number
      : (r.ebitda != null && r.ebit != null) ? r.ebitda - r.ebit : null
    const nwcDelta = (r.nwc != null && prior?.nwc != null) ? r.nwc - prior.nwc : null
    const effectiveTaxRate = (r as any).taxRateOverride != null ? (r as any).taxRateOverride as number : taxRate
    const nopat = r.ebit != null ? r.ebit * (1 - effectiveTaxRate) : null

    let ufcf: number | null = null
    if (nopat != null) {
      // D&A: treat as 0 when not separately reported (e.g. financial sector)
      const dnaComponent = dna ?? 0
      // CapEx: treat as 0 for asset-light / financial companies where capex may be absent
      const capexComponent = r.capex ?? 0
      // nwcDelta can be null if prior NWC is missing (first row) — treat as 0
      const dnwcComponent = nwcDelta ?? 0
      ufcf = nopat + dnaComponent + capexComponent - dnwcComponent
    }
    // Fallback for projected rows where build-up components are incomplete (e.g. financial sector):
    // use freeCashFlow if available (set from median historical FCF margin in normalizeInputs).
    //
    // Also applies when UFCF is negative AND freeCashFlow is positive — this handles the
    // SBC-distorted ramp case (ZETA, SNAP): buildProjectedRows sets freeCashFlow = medianFcfMargin
    // × revenue as a positive anchor, and also ramps EBIT from negative toward target. In early
    // ramp years (year 1-2), the NOPAT-based UFCF is negative even though the company has
    // positive FCF today. Use freeCashFlow as the floor: take max(ufcf, freeCashFlow) so the
    // result is at least the positive FCF margin baseline. This prevents the DCF from showing
    // negative projected cash flows for a company that is currently FCF-positive.
    const fcfOverride = r.isProjected ? (r as any).freeCashFlow as number | null : null
    if (ufcf == null && fcfOverride != null) {
      ufcf = fcfOverride
    } else if (ufcf != null && fcfOverride != null && fcfOverride > 0 && ufcf < 0) {
      // UFCF negative but FCF positive: take FCF as the floor (SBC ramp early years)
      ufcf = fcfOverride
    }

    const projectedYearIndex = result.filter(x => x.isProjected).length + (r.isProjected ? 1 : 0)
    const pvUfcf = (ufcf != null && r.isProjected) ? ufcf / Math.pow(1 + wacc, projectedYearIndex) : null

    result.push({ ...r, dna, nwcDelta, nopat, ufcf, pvUfcf, taxRateActual: effectiveTaxRate })
  }

  return result
}

export function computeUFCFTerminalValues(
  rows: UFCFRow[],
  wacc: number,
  terminalG: number,
  exitMultiple: number,
): { perpetuityTV: number | null; exitMultipleTV: number | null; perpetuityTVDiscounted: number | null; exitMultipleTVDiscounted: number | null } {
  const projectedRows = rows.filter(r => r.isProjected)
  if (projectedRows.length === 0) return { perpetuityTV: null, exitMultipleTV: null, perpetuityTVDiscounted: null, exitMultipleTVDiscounted: null }

  const lastRow = projectedRows[projectedRows.length - 1]
  const terminalFCF = lastRow.ufcf

  if (terminalFCF == null) return { perpetuityTV: null, exitMultipleTV: null, perpetuityTVDiscounted: null, exitMultipleTVDiscounted: null }

  let perpetuityTV: number | null = null
  let perpetuityTVDiscounted: number | null = null
  try {
    assertTerminalGrowth(terminalG, wacc)
    perpetuityTV = (terminalFCF * (1 + terminalG)) / (wacc - terminalG)
    perpetuityTVDiscounted = perpetuityTV / Math.pow(1 + wacc, projectedRows.length)
  } catch {
    // terminalG >= wacc — perpetuity formula undefined; caller should show error
  }

  // Exit multiple terminal value: TV = lastProjectedEBITDA × exitMultiple (EV/EBITDA).
  // The multiple is an EV/EBITDA multiple — it must be applied to EBITDA, not to UFCF.
  // Using UFCF (net of taxes, capex, NWC) with an EV/EBITDA multiple understates TV by 2-3×
  // because UFCF ≈ EBITDA × (1-t) − net capex − ΔNWC, which is materially smaller than EBITDA.
  // Fallback: if terminal-year EBITDA is null or non-positive, fall back to UFCF × multiple
  // (last resort — produces a conservative estimate but at least the math is declared).
  const terminalEBITDA = lastRow.ebitda
  const exitMultipleTVBase = (terminalEBITDA != null && terminalEBITDA > 0)
    ? terminalEBITDA
    : (terminalFCF > 0 ? terminalFCF : null)  // fallback: only if UFCF is positive
  const exitMultipleTV = exitMultipleTVBase != null ? exitMultipleTVBase * exitMultiple : null
  const exitMultipleTVDiscounted = exitMultipleTV != null
    ? exitMultipleTV / Math.pow(1 + wacc, projectedRows.length)
    : null

  return { perpetuityTV, exitMultipleTV, perpetuityTVDiscounted, exitMultipleTVDiscounted }
}

export function computeUFCFEV(
  rows: UFCFRow[],
  terminalTVDiscounted: number | null,
): number | null {
  const projectedRows = rows.filter(r => r.isProjected)
  const sumPv = projectedRows.reduce((acc, r) => acc + (r.pvUfcf ?? 0), 0)
  if (terminalTVDiscounted == null) return null
  return sumPv + terminalTVDiscounted
}
