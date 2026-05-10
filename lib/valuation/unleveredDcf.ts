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
  dna: number | null         // ebitda − ebit
  nwcDelta: number | null    // nwc[t] − nwc[t−1]
  nopat: number | null       // ebit × (1 − taxRate)
  ufcf: number | null        // nopat + dna + capex + nwcDelta (capex is negative, nwcDelta may be negative)
  // Output
  pvUfcf: number | null      // ufcf / (1+wacc)^t
}

export interface UFCFResult {
  rows: UFCFRow[]
  sumPvFcf: number          // Σ PV(UFCF) for projection years only
  perpetuityTV: number | null
  exitMultipleTV: number | null
  ev: number | null          // sumPvFcf + terminal value (discounted)
}

export function computeUFCFRows(
  rows: Omit<UFCFRow, 'dna' | 'nwcDelta' | 'nopat' | 'ufcf' | 'pvUfcf'>[],
  taxRate: number,
  wacc: number,
): UFCFRow[] {
  const result: UFCFRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const prior = i > 0 ? result[i - 1] : null

    const dna = (r.ebitda != null && r.ebit != null) ? r.ebitda - r.ebit : null
    const nwcDelta = (r.nwc != null && prior?.nwc != null) ? r.nwc - prior.nwc : null
    const nopat = r.ebit != null ? r.ebit * (1 - taxRate) : null

    let ufcf: number | null = null
    if (nopat != null && dna != null && r.capex != null) {
      // nwcDelta can be null if prior NWC is missing (first row) — treat as 0 only for actuals
      const dnwcComponent = nwcDelta ?? 0
      ufcf = nopat + dna + r.capex - dnwcComponent
    }

    const projectedYearIndex = result.filter(x => x.isProjected).length + (r.isProjected ? 1 : 0)
    const pvUfcf = (ufcf != null && r.isProjected) ? ufcf / Math.pow(1 + wacc, projectedYearIndex) : null

    result.push({ ...r, dna, nwcDelta, nopat, ufcf, pvUfcf })
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

  const exitMultipleTV = terminalFCF * exitMultiple
  const exitMultipleTVDiscounted = exitMultipleTV / Math.pow(1 + wacc, projectedRows.length)

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
