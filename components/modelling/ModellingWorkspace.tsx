'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { normalizeModellingInputs, type ModellingInput, type ModellingRow } from '@/lib/valuation/normalizeInputs'
import { buildAssumptionSet } from '@/lib/valuation/assumptions'
import { computeUFCFRows, computeUFCFEV, type UFCFRow } from '@/lib/valuation/unleveredDcf'
import { computeLFCFRows, type LFCFRow } from '@/lib/valuation/leveredDcf'
import { computeTerminalValues } from '@/lib/valuation/terminalValue'
import ForecastTable, {
  type DisplayRow,
  type WACCData,
  type TerminalData,
} from './ForecastTable'
import DataQualityWarnings from './DataQualityWarnings'
import SensitivityTable from '@/components/valuation/SensitivityTable'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StatementsDataLike = any

interface ModellingWorkspaceProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData: any
  ticker: string
  statementsData?: StatementsDataLike | null
}

// Derive ΔNWC from balance sheet: NWC = (currentAssets - cash) - currentLiabilities
function deriveNWC(row: ModellingRow): number | null {
  if (row.totalCurrentAssets == null || row.cash == null || row.totalCurrentLiabilities == null) return null
  return (row.totalCurrentAssets - row.cash) - row.totalCurrentLiabilities
}

function buildDisplayRows(
  ufcfRows: UFCFRow[],
  lfcfRows: LFCFRow[],
  baseRows: ModellingRow[],
): DisplayRow[] {
  let sumPvUfcf = 0
  let sumPvLfcf = 0

  return ufcfRows.map((ufcf, i) => {
    const lfcf = lfcfRows[i]
    const base = baseRows[i]
    const prevUfcf = i > 0 ? ufcfRows[i - 1] : null
    const prevLfcf = i > 0 ? lfcfRows[i - 1] : null

    if (ufcf.pvUfcf != null) sumPvUfcf += ufcf.pvUfcf
    if (lfcf?.pvLfcf != null) sumPvLfcf += lfcf.pvLfcf

    const rev = ufcf.revenue
    const prevRev = prevUfcf?.revenue ?? null

    const nwcDelta = ufcf.nwcDelta ?? null

    // Net debt repayment for LFCF display
    const netDebtRepayment =
      base?.financingCF != null && base?.dividendsPaid != null
        ? -base.financingCF - Math.abs(base.dividendsPaid ?? 0)
        : null

    // Tax rate: prefer row-level if available, else ModellingInput default
    const taxRatePct = (ufcf as unknown as { taxRateActual?: number }).taxRateActual
      ?? base?.taxRate
      ?? null

    return {
      fiscalDate: base?.fiscalDate ?? ufcf.year,
      year: ufcf.year,
      isProjected: ufcf.isProjected,
      revenue: rev,
      revenueGrowthPct:
        rev != null && prevRev != null && prevRev !== 0
          ? (rev - prevRev) / Math.abs(prevRev)
          : null,
      ebit: ufcf.ebit,
      ebitMarginPct:
        ufcf.ebit != null && rev != null && rev !== 0
          ? ufcf.ebit / rev
          : null,
      taxRatePct,
      nopat: ufcf.nopat,
      nopatMarginPct:
        ufcf.nopat != null && rev != null && rev !== 0
          ? ufcf.nopat / rev
          : null,
      dna: ufcf.dna,
      dnaPct:
        ufcf.dna != null && rev != null && rev !== 0
          ? ufcf.dna / rev
          : null,
      capex: ufcf.capex,
      capexPct:
        ufcf.capex != null && rev != null && rev !== 0
          ? ufcf.capex / rev
          : null,
      nwcDelta,
      nwcDeltaPct:
        nwcDelta != null && rev != null && rev !== 0
          ? nwcDelta / rev
          : null,
      ufcf: ufcf.ufcf,
      ufcfGrowthPct:
        ufcf.ufcf != null && prevUfcf?.ufcf != null && prevUfcf.ufcf !== 0
          ? (ufcf.ufcf - prevUfcf.ufcf) / Math.abs(prevUfcf.ufcf)
          : null,
      pvUfcf: ufcf.pvUfcf,
      sumPvUfcf: ufcf.isProjected ? sumPvUfcf : null,
      netIncome: lfcf?.netIncome ?? null,
      netMarginPct:
        lfcf?.netIncome != null && rev != null && rev !== 0
          ? lfcf.netIncome / rev
          : null,
      netDebtRepayment,
      netDebtRepaymentPct:
        netDebtRepayment != null && rev != null && rev !== 0
          ? netDebtRepayment / rev
          : null,
      lfcf: lfcf?.lfcf ?? null,
      lfcfGrowthPct:
        lfcf?.lfcf != null && prevLfcf?.lfcf != null && prevLfcf.lfcf !== 0
          ? (lfcf.lfcf - prevLfcf.lfcf) / Math.abs(prevLfcf.lfcf)
          : null,
      pvLfcf: lfcf?.pvLfcf ?? null,
      sumPvLfcf: lfcf?.isProjected ? sumPvLfcf : null,
    }
  })
}

export default function ModellingWorkspace({ apiData, ticker, statementsData }: ModellingWorkspaceProps) {
  const baseInput: ModellingInput = useMemo(() => normalizeModellingInputs(ticker, apiData, statementsData), [ticker, apiData, statementsData])

  // Overridable assumptions
  const [waccOverride, setWaccOverride] = useState<number | null>(null)
  const [cagrOverride, setCagrOverride] = useState<number | null>(null)
  const [terminalGOverride, setTerminalGOverride] = useState<number | null>(null)
  const [exitMultipleOverride, setExitMultipleOverride] = useState<number | null>(null)

  // Terminal method toggle
  const [terminalMethod, setTerminalMethod] = useState<'perpetuity' | 'multiple'>('multiple')

  // Scenario presets
  type Preset = 'conservative' | 'base' | 'optimistic'
  const [preset, setPreset] = useState<Preset>('base')
  const PRESET_OFFSETS: Record<Preset, { cagr: number; wacc: number; terminalG: number }> = {
    conservative: { cagr: -0.02, wacc: 0.01,  terminalG: -0.005 },
    base:         { cagr: 0,     wacc: 0,      terminalG: 0 },
    optimistic:   { cagr: 0.02,  wacc: -0.01,  terminalG: 0.005 },
  }

  // Row-level cell overrides (keyed by year string then field name)
  const [rowOverrides, setRowOverrides] = useState<Record<string, Record<string, number>>>({})

  // Reset row overrides whenever the preset changes
  useEffect(() => {
    setRowOverrides({})
  }, [preset])

  const wacc = Math.max(0.01, (waccOverride ?? baseInput.wacc) + PRESET_OFFSETS[preset].wacc)
  const cagr = Math.max(0, (cagrOverride ?? baseInput.cagr) + PRESET_OFFSETS[preset].cagr)
  const terminalG = Math.max(0, (terminalGOverride ?? baseInput.terminalG) + PRESET_OFFSETS[preset].terminalG)
  const taxRate = baseInput.taxRate

  // Build assumption set (for exitMultiple default)
  const assumptions = useMemo(() => {
    const historicalRows = baseInput.rows.filter(r => !r.isProjected)
    const revenues = historicalRows.map(r => r.revenue).filter((v): v is number => v != null)
    const ebitMargins = historicalRows.map(r =>
      r.ebit != null && r.revenue != null && r.revenue > 0 ? r.ebit / r.revenue : null)
    const capexPct = historicalRows.map(r =>
      r.capex != null && r.revenue != null && r.revenue > 0 ? r.capex / r.revenue : null)
    const dnaPct = historicalRows.map(r => {
      const dna = (r.ebitda != null && r.ebit != null) ? r.ebitda - r.ebit : null
      return dna != null && r.revenue != null && r.revenue > 0 ? dna / r.revenue : null
    })
    const nwcPct = historicalRows.map((r, i) => {
      if (i === 0) return null
      const nwcCurr = deriveNWC(r)
      const nwcPrior = deriveNWC(historicalRows[i - 1])
      const revDelta =
        r.revenue != null && historicalRows[i - 1].revenue != null
          ? r.revenue - historicalRows[i - 1].revenue!
          : null
      if (nwcCurr == null || nwcPrior == null || revDelta == null || revDelta === 0) return null
      return (nwcCurr - nwcPrior) / Math.abs(revDelta)
    })
    const cagrAnalysis = apiData?.cagrAnalysis ?? {}
    return buildAssumptionSet({
      cagr,
      terminalG,
      wacc,
      taxRate,
      analystEstimate1y: cagrAnalysis.analystEstimate1y ?? null,
      analystEstimate2y: cagrAnalysis.analystEstimate2y ?? null,
      historicalCagr3y: cagrAnalysis.historicalCagr3y ?? null,
      fundamentalGrowth: cagrAnalysis.fundamentalGrowth ?? null,
      numProjectionYears: baseInput.rows.filter(r => r.isProjected).length,
      historicalRevenues: revenues,
      historicalEbitMargins: ebitMargins,
      historicalCapexPctRev: capexPct,
      historicalDnaPctRev: dnaPct,
      historicalNwcPctRevChg: nwcPct,
      companyType: baseInput.companyType,
    })
  }, [baseInput, cagr, terminalG, wacc, taxRate, apiData])

  const exitMultiple = exitMultipleOverride ?? assumptions.exitMultiple.value

  // Build UFCF rows
  const ufcfInputRows = useMemo(() => baseInput.rows.map(r => {
    const ov = rowOverrides[r.year] ?? {}
    return {
      year: r.year, isProjected: r.isProjected,
      revenue: ov.revenue != null ? ov.revenue : r.revenue,
      ebit:    ov.ebit    != null ? ov.ebit    : r.ebit,
      ebitda:  ov.ebitda  != null ? ov.ebitda  : r.ebitda,
      capex:   ov.capex   != null ? ov.capex   : (r.capex ?? (r.freeCashFlow != null && r.operatingCF != null ? r.freeCashFlow - r.operatingCF : null)),
      nwc:     ov.nwc     != null ? ov.nwc     : deriveNWC(r),
      dnaFromCF: r.dna,
      freeCashFlow: r.freeCashFlow,
    }
  }), [baseInput, rowOverrides])

  const ufcfRows = useMemo(
    () => computeUFCFRows(ufcfInputRows, taxRate, wacc),
    [ufcfInputRows, taxRate, wacc]
  )

  // Build LFCF rows
  const lfcfInputRows = useMemo(() => baseInput.rows.map(r => {
    const ov = rowOverrides[r.year] ?? {}
    const baseNetDebtRepayment =
      r.financingCF != null && r.dividendsPaid != null
        ? -r.financingCF - Math.abs(r.dividendsPaid ?? 0)
        : null
    return {
      year: r.year, isProjected: r.isProjected,
      revenue:          ov.revenue          != null ? ov.revenue          : r.revenue,
      netIncome:        ov.netIncome        != null ? ov.netIncome        : r.netIncome,
      ebit:             ov.ebit             != null ? ov.ebit             : r.ebit,
      ebitda:           ov.ebitda           != null ? ov.ebitda           : r.ebitda,
      capex:            ov.capex            != null ? ov.capex            : (r.capex ?? (r.freeCashFlow != null && r.operatingCF != null ? r.freeCashFlow - r.operatingCF : null)),
      nwc:              ov.nwc              != null ? ov.nwc              : deriveNWC(r),
      netDebtRepayment: ov.netDebtRepayment != null ? ov.netDebtRepayment : baseNetDebtRepayment,
      dnaFromCF: r.dna,
    }
  }), [baseInput, rowOverrides])

  const lfcfRows = useMemo(
    () => computeLFCFRows(lfcfInputRows, baseInput.costOfEquity),
    [lfcfInputRows, baseInput.costOfEquity]
  )

  // Terminal values
  const numProjectionYears = baseInput.rows.filter(r => r.isProjected).length
  const projUFCF = ufcfRows.filter(r => r.isProjected)
  const projLFCF = lfcfRows.filter(r => r.isProjected)
  const sumPvUFCF = projUFCF.reduce((s, r) => s + (r.pvUfcf ?? 0), 0)
  const sumPvLFCF = projLFCF.reduce((s, r) => s + (r.pvLfcf ?? 0), 0)
  const lastUFCF = projUFCF[projUFCF.length - 1]?.ufcf ?? null
  const lastLFCF = projLFCF[projLFCF.length - 1]?.lfcf ?? null

  const tvUFCF = useMemo(
    () => computeTerminalValues(lastUFCF, wacc, terminalG, exitMultiple, numProjectionYears, sumPvUFCF, baseInput.companyType),
    [lastUFCF, wacc, terminalG, exitMultiple, numProjectionYears, sumPvUFCF, baseInput.companyType]
  )

  const tvLFCF = useMemo(
    () => computeTerminalValues(lastLFCF, baseInput.costOfEquity, terminalG, exitMultiple, numProjectionYears, sumPvLFCF, baseInput.companyType),
    [lastLFCF, baseInput.costOfEquity, terminalG, exitMultiple, numProjectionYears, sumPvLFCF, baseInput.companyType]
  )

  // EV and fair values (kept for potential future use)
  const ufcfTVDiscounted = tvUFCF.primaryMethod === 'perpetuity' ? tvUFCF.perpetuityTVDiscounted : tvUFCF.exitMultipleTVDiscounted
  const ufcfEV = computeUFCFEV(ufcfRows, ufcfTVDiscounted)

  // Suppress unused-variable warnings
  void tvLFCF
  void ufcfEV

  // Build display rows
  const displayRows: DisplayRow[] = useMemo(
    () => buildDisplayRows(ufcfRows, lfcfRows, baseInput.rows),
    [ufcfRows, lfcfRows, baseInput.rows]
  )

  // WACC data
  const waccRaw = apiData?.wacc ?? {}
  const waccData: WACCData = useMemo(() => ({
    costOfDebt:
      waccRaw.inputs?.costOfDebt ??
      (baseInput.afterTaxCostOfDebt / Math.max(0.01, 1 - baseInput.taxRate)),
    taxRate: baseInput.taxRate,
    afterTaxCostOfDebt: baseInput.afterTaxCostOfDebt,
    rfRate: baseInput.rfRate,
    erp: baseInput.erp,
    crp: waccRaw.crp ?? 0,
    financialCurrency: waccRaw.financialCurrency ?? undefined,
    beta: baseInput.beta,
    costOfEquity: baseInput.costOfEquity,
    totalDebtM: baseInput.debtM,
    marketCapM:
      baseInput.currentPrice && baseInput.sharesOutstanding
        ? baseInput.currentPrice * baseInput.sharesOutstanding
        : null,
    debtWeighting: waccRaw.weightDebt ?? null,
    equityWeighting: waccRaw.weightEquity ?? null,
    wacc: wacc,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [baseInput, waccRaw, wacc])

  // Normalize sharesOutstanding → millions for equity bridge
  // normalizeInputs may store either millions (from fairValue) or absolute count (from TTM BS)
  const sharesM = baseInput.sharesOutstanding != null
    ? (baseInput.sharesOutstanding > 1_000_000 ? baseInput.sharesOutstanding / 1e6 : baseInput.sharesOutstanding)
    : null

  // Terminal data
  const terminalData: TerminalData = useMemo(() => ({
    method: terminalMethod,
    perpetuityTV: tvUFCF.perpetuityTV,
    perpetuityTVDiscounted: tvUFCF.perpetuityTVDiscounted,
    exitMultipleTV: tvUFCF.exitMultipleTV,
    exitMultipleTVDiscounted: tvUFCF.exitMultipleTVDiscounted,
    exitMultiple,
    terminalG,
    guardError: tvUFCF.guardError ?? null,
    sumPvUfcf: sumPvUFCF,
    cashM: baseInput.cashM,
    debtM: baseInput.debtM,
    sharesM,
    currentPrice: baseInput.currentPrice,
  }), [tvUFCF, terminalMethod, exitMultiple, terminalG, sumPvUFCF, baseInput, sharesM])

  const handleCellEdit = useCallback((year: string, field: string, value: number) => {
    setRowOverrides(prev => ({ ...prev, [year]: { ...prev[year], [field]: value } }))
  }, [])

  // Global assumption changes (cagr, wacc) now exposed in ForecastTable toolbar

  return (
    <div className="bg-[#111111] rounded-xl overflow-hidden border border-[#222]">
      <DataQualityWarnings
        terminalGError={tvUFCF.guardError}
        financialCurrencyNote={baseInput.financialCurrencyNote}
        isFinancialSector={baseInput.isFinancialSector}
        isNegativeFCF={baseInput.baseFCF != null && baseInput.baseFCF < 0}
        altmanZone={baseInput.altmanZone}
        beneishFlag={baseInput.beneishFlag}
        crp={waccRaw.crp ?? 0}
        financialCurrency={waccRaw.financialCurrency ?? undefined}
      />
      <ForecastTable
        rows={displayRows}
        waccData={waccData}
        terminalData={terminalData}
        currency={baseInput.currency}
        preset={preset}
        onPresetChange={setPreset}
        onCellEdit={handleCellEdit}
        onTerminalMethodChange={setTerminalMethod}
        onExitMultipleChange={(v) => setExitMultipleOverride(v)}
        onTerminalGChange={setTerminalGOverride}
        currentCagr={+(cagr * 100).toFixed(1)}
        onCagrChange={(v) => setCagrOverride(v / 100)}
        currentWacc={+(wacc * 100).toFixed(1)}
        onWaccChange={(v) => setWaccOverride(v / 100)}
      />

      {/* Sensitivity heatmap: shown below the forecast table */}
      {baseInput.baseFCF != null && baseInput.baseFCF !== 0 && sharesM != null && sharesM > 0 && (
        <div className="mt-0">
          <SensitivityTable
            baseFCF={baseInput.baseFCF}
            baseWacc={wacc}
            baseCagr={cagr}
            terminalG={terminalG}
            cashM={baseInput.cashM ?? 0}
            debtM={baseInput.debtM ?? 0}
            sharesM={sharesM}
            currentPrice={baseInput.currentPrice ?? 0}
            numYears={numProjectionYears}
            currency={baseInput.currency}
          />
        </div>
      )}
    </div>
  )
}
