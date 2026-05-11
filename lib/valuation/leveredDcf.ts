/**
 * Levered Free Cash Flow (LFCF) model.
 *
 * LFCF = Net Income + D&A − CapEx − ΔNWC − Net Debt Repayment
 * Discounted at costOfEquity (Ke), not WACC.
 *
 * All monetary values in millions (matching API output).
 */

import { assertTerminalGrowth } from './valuationGuards'

export interface LFCFRow {
  year: string
  isProjected: boolean
  // Inputs (null = data absent)
  revenue: number | null
  netIncome: number | null
  ebitda: number | null
  ebit: number | null
  capex: number | null          // stored as negative
  nwc: number | null
  netDebtRepayment: number | null
  // Derived
  dna: number | null
  nwcDelta: number | null
  lfcf: number | null           // netIncome + dna + capex − nwcDelta − netDebtRepayment
  // Output
  pvLfcf: number | null         // lfcf / (1+ke)^t
}

export interface LFCFResult {
  rows: LFCFRow[]
  sumPvFcf: number
  perpetuityTV: number | null
  exitMultipleTV: number | null
  equityValue: number | null
}

export function computeLFCFRows(
  rows: Omit<LFCFRow, 'dna' | 'nwcDelta' | 'lfcf' | 'pvLfcf'>[],
  costOfEquity: number,
): LFCFRow[] {
  const result: LFCFRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const prior = i > 0 ? result[i - 1] : null

    const dna = (r as any).dnaFromCF != null
      ? (r as any).dnaFromCF as number
      : (r.ebitda != null && r.ebit != null) ? r.ebitda - r.ebit : null
    const nwcDelta = (r.nwc != null && prior?.nwc != null) ? r.nwc - prior.nwc : null

    let lfcf: number | null = null
    if (r.netIncome != null && dna != null && r.capex != null) {
      const dnwcComponent = nwcDelta ?? 0
      const debtComponent = r.netDebtRepayment ?? 0
      lfcf = r.netIncome + dna + r.capex - dnwcComponent - debtComponent
    }

    const projectedYearIndex = result.filter(x => x.isProjected).length + (r.isProjected ? 1 : 0)
    const pvLfcf = (lfcf != null && r.isProjected) ? lfcf / Math.pow(1 + costOfEquity, projectedYearIndex) : null

    result.push({ ...r, dna, nwcDelta, lfcf, pvLfcf })
  }

  return result
}

export function computeLFCFTerminalValues(
  rows: LFCFRow[],
  costOfEquity: number,
  terminalG: number,
  exitMultiple: number,
): { perpetuityTV: number | null; exitMultipleTV: number | null; perpetuityTVDiscounted: number | null; exitMultipleTVDiscounted: number | null } {
  const projectedRows = rows.filter(r => r.isProjected)
  if (projectedRows.length === 0) return { perpetuityTV: null, exitMultipleTV: null, perpetuityTVDiscounted: null, exitMultipleTVDiscounted: null }

  const lastRow = projectedRows[projectedRows.length - 1]
  const terminalFCF = lastRow.lfcf

  if (terminalFCF == null) return { perpetuityTV: null, exitMultipleTV: null, perpetuityTVDiscounted: null, exitMultipleTVDiscounted: null }

  let perpetuityTV: number | null = null
  let perpetuityTVDiscounted: number | null = null
  try {
    assertTerminalGrowth(terminalG, costOfEquity)
    perpetuityTV = (terminalFCF * (1 + terminalG)) / (costOfEquity - terminalG)
    perpetuityTVDiscounted = perpetuityTV / Math.pow(1 + costOfEquity, projectedRows.length)
  } catch {
    // terminalG >= ke — perpetuity formula undefined
  }

  const exitMultipleTV = terminalFCF * exitMultiple
  const exitMultipleTVDiscounted = exitMultipleTV / Math.pow(1 + costOfEquity, projectedRows.length)

  return { perpetuityTV, exitMultipleTV, perpetuityTVDiscounted, exitMultipleTVDiscounted }
}

export function computeLFCFEquityValue(
  rows: LFCFRow[],
  terminalTVDiscounted: number | null,
): number | null {
  const projectedRows = rows.filter(r => r.isProjected)
  const sumPv = projectedRows.reduce((acc, r) => acc + (r.pvLfcf ?? 0), 0)
  if (terminalTVDiscounted == null) return null
  return sumPv + terminalTVDiscounted
}
