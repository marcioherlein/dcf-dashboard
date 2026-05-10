'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { normalizeModellingInputs, type ModellingInput, type ModellingRow } from '@/lib/valuation/normalizeInputs'
import { buildAssumptionSet, type AssumptionSet } from '@/lib/valuation/assumptions'
import { computeUFCFRows, computeUFCFEV } from '@/lib/valuation/unleveredDcf'
import { computeLFCFRows, computeLFCFEquityValue } from '@/lib/valuation/leveredDcf'
import { computeTerminalValues } from '@/lib/valuation/terminalValue'
import AssumptionPanel from './AssumptionPanel'
import TerminalValuePanel from './TerminalValuePanel'
import ValuationOutputTable from './ValuationOutputTable'
import ForecastTable from './ForecastTable'
import DataQualityWarnings from './DataQualityWarnings'

interface ModellingWorkspaceProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData: any
  ticker: string
}

// Derive ΔNWC from balance sheet: NWC = (currentAssets - cash) - currentLiabilities
function deriveNWC(row: ModellingRow): number | null {
  if (row.totalCurrentAssets == null || row.cash == null || row.totalCurrentLiabilities == null) return null
  return (row.totalCurrentAssets - row.cash) - row.totalCurrentLiabilities
}

export default function ModellingWorkspace({ apiData, ticker }: ModellingWorkspaceProps) {
  const baseInput: ModellingInput = useMemo(() => normalizeModellingInputs(ticker, apiData), [ticker, apiData])

  // Overridable assumptions
  const [waccOverride, setWaccOverride] = useState<number | null>(null)
  const [cagrOverride, setCagrOverride] = useState<number | null>(null)
  const [terminalGOverride, setTerminalGOverride] = useState<number | null>(null)
  const [exitMultipleOverride, setExitMultipleOverride] = useState<number | null>(null)

  // Scenario presets
  type Preset = 'conservative' | 'base' | 'optimistic'
  const [preset, setPreset] = useState<Preset>('base')
  const PRESET_OFFSETS: Record<Preset, { cagr: number; wacc: number; terminalG: number }> = {
    conservative: { cagr: -0.02, wacc: 0.01, terminalG: -0.005 },
    base:         { cagr: 0,     wacc: 0,     terminalG: 0 },
    optimistic:   { cagr: 0.02,  wacc: -0.01, terminalG: 0.005 },
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

  // Build assumption set for AssumptionPanel
  const assumptions: AssumptionSet = useMemo(() => {
    const historicalRows = baseInput.rows.filter(r => !r.isProjected)
    const revenues = historicalRows.map(r => r.revenue).filter((v): v is number => v != null)
    const ebitMargins = historicalRows.map(r => r.ebit != null && r.revenue != null && r.revenue > 0 ? r.ebit / r.revenue : null)
    const capexPct = historicalRows.map(r => r.capex != null && r.revenue != null && r.revenue > 0 ? r.capex / r.revenue : null)
    const dnaPct = historicalRows.map(r => {
      const dna = (r.ebitda != null && r.ebit != null) ? r.ebitda - r.ebit : null
      return dna != null && r.revenue != null && r.revenue > 0 ? dna / r.revenue : null
    })
    const nwcPct = historicalRows.map((r, i) => {
      if (i === 0) return null
      const nwcCurr = deriveNWC(r)
      const nwcPrior = deriveNWC(historicalRows[i - 1])
      const revDelta = r.revenue != null && historicalRows[i-1].revenue != null
        ? r.revenue - historicalRows[i-1].revenue! : null
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

  // Build UFCF + LFCF rows
  const ufcfInputRows = useMemo(() => baseInput.rows.map(r => {
    const ov = rowOverrides[r.year] ?? {}
    return {
      year: r.year, isProjected: r.isProjected,
      revenue: ov.revenue != null ? ov.revenue : r.revenue,
      ebit:    ov.ebit    != null ? ov.ebit    : r.ebit,
      ebitda:  ov.ebitda  != null ? ov.ebitda  : r.ebitda,
      capex:   ov.capex   != null ? ov.capex   : r.capex,
      nwc:     ov.nwc     != null ? ov.nwc     : deriveNWC(r),
    }
  }), [baseInput, rowOverrides])

  const ufcfRows = useMemo(() => computeUFCFRows(ufcfInputRows, taxRate, wacc), [ufcfInputRows, taxRate, wacc])

  const lfcfInputRows = useMemo(() => baseInput.rows.map(r => {
    const ov = rowOverrides[r.year] ?? {}
    const baseNetDebtRepayment = r.financingCF != null && r.dividendsPaid != null
      ? -r.financingCF - Math.abs(r.dividendsPaid ?? 0)
      : null
    return {
      year: r.year, isProjected: r.isProjected,
      revenue:          ov.revenue          != null ? ov.revenue          : r.revenue,
      netIncome:        ov.netIncome        != null ? ov.netIncome        : r.netIncome,
      ebit:             ov.ebit             != null ? ov.ebit             : r.ebit,
      ebitda:           ov.ebitda           != null ? ov.ebitda           : r.ebitda,
      capex:            ov.capex            != null ? ov.capex            : r.capex,
      nwc:              ov.nwc              != null ? ov.nwc              : deriveNWC(r),
      netDebtRepayment: ov.netDebtRepayment != null ? ov.netDebtRepayment : baseNetDebtRepayment,
    }
  }), [baseInput, rowOverrides])

  const lfcfRows = useMemo(() => computeLFCFRows(lfcfInputRows, baseInput.costOfEquity), [lfcfInputRows, baseInput.costOfEquity])

  // Terminal values
  const numProjectionYears = baseInput.rows.filter(r => r.isProjected).length
  const projUFCF = ufcfRows.filter(r => r.isProjected)
  const projLFCF = lfcfRows.filter(r => r.isProjected)
  const sumPvUFCF = projUFCF.reduce((s, r) => s + (r.pvUfcf ?? 0), 0)
  const sumPvLFCF = projLFCF.reduce((s, r) => s + (r.pvLfcf ?? 0), 0)
  const lastUFCF = projUFCF[projUFCF.length - 1]?.ufcf ?? null
  const lastLFCF = projLFCF[projLFCF.length - 1]?.lfcf ?? null

  const tvUFCF = useMemo(() => computeTerminalValues(lastUFCF, wacc, terminalG, exitMultiple, numProjectionYears, sumPvUFCF, baseInput.companyType),
    [lastUFCF, wacc, terminalG, exitMultiple, numProjectionYears, sumPvUFCF, baseInput.companyType])

  const tvLFCF = useMemo(() => computeTerminalValues(lastLFCF, baseInput.costOfEquity, terminalG, exitMultiple, numProjectionYears, sumPvLFCF, baseInput.companyType),
    [lastLFCF, baseInput.costOfEquity, terminalG, exitMultiple, numProjectionYears, sumPvLFCF, baseInput.companyType])

  // EV and fair values — use primary TV method
  const ufcfTVDiscounted = tvUFCF.primaryMethod === 'perpetuity' ? tvUFCF.perpetuityTVDiscounted : tvUFCF.exitMultipleTVDiscounted
  const lfcfTVDiscounted = tvLFCF.primaryMethod === 'perpetuity' ? tvLFCF.perpetuityTVDiscounted : tvLFCF.exitMultipleTVDiscounted
  const ufcfEV = computeUFCFEV(ufcfRows, ufcfTVDiscounted)
  const ufcfEquityValue = ufcfEV != null && baseInput.cashM != null && baseInput.debtM != null
    ? ufcfEV + baseInput.cashM - baseInput.debtM : null
  const lfcfEquityValue = computeLFCFEquityValue(lfcfRows, lfcfTVDiscounted)

  const shares = baseInput.sharesOutstanding
  const ufcfFairValue = ufcfEquityValue != null && shares ? ufcfEquityValue / shares * 1000 : null
  const lfcfFairValue = lfcfEquityValue != null && shares ? lfcfEquityValue / shares * 1000 : null
  const ufcfUpside = ufcfFairValue != null && baseInput.currentPrice > 0 ? (ufcfFairValue - baseInput.currentPrice) / baseInput.currentPrice : null
  const lfcfUpside = lfcfFairValue != null && baseInput.currentPrice > 0 ? (lfcfFairValue - baseInput.currentPrice) / baseInput.currentPrice : null

  const handleAssumptionChange = useCallback((field: string, value: number) => {
    if (field === 'cagr') setCagrOverride(value)
    else if (field === 'wacc') setWaccOverride(value)
    else if (field === 'terminalG') setTerminalGOverride(value)
    else if (field === 'exitMultiple') setExitMultipleOverride(value)
  }, [])

  const handleCellEdit = useCallback((year: string, field: string, value: number) => {
    setRowOverrides(prev => ({ ...prev, [year]: { ...prev[year], [field]: value } }))
  }, [])

  const tvError = tvUFCF.guardError

  return (
    <div className="space-y-4">
      <DataQualityWarnings
        terminalGError={tvError}
        financialCurrencyNote={baseInput.financialCurrencyNote}
        isFinancialSector={baseInput.isFinancialSector}
        isNegativeFCF={baseInput.baseFCF != null && baseInput.baseFCF < 0}
        altmanZone={baseInput.altmanZone}
        beneishFlag={baseInput.beneishFlag}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left sidebar: assumptions */}
        <div className="lg:col-span-1">
          <AssumptionPanel
            assumptions={assumptions}
            onChange={handleAssumptionChange}
          />
        </div>

        {/* Main area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Scenario preset selector */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-slate-500">Scenario:</span>
            {(['conservative', 'base', 'optimistic'] as Preset[]).map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1 text-xs rounded-full border font-medium capitalize transition-colors ${
                  preset === p ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
                }`}
              >
                {p}
              </button>
            ))}
            {Object.keys(rowOverrides).length > 0 && (
              <button
                onClick={() => setRowOverrides({})}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Reset
              </button>
            )}
          </div>
          <ForecastTable
            ufcfRows={ufcfRows}
            lfcfRows={lfcfRows}
            currency={baseInput.currency}
            onCellEdit={handleCellEdit}
          />

          <TerminalValuePanel
            perpetuityTV={tvUFCF.perpetuityTV}
            perpetuityTVDiscounted={tvUFCF.perpetuityTVDiscounted}
            exitMultipleTV={tvUFCF.exitMultipleTV}
            exitMultipleTVDiscounted={tvUFCF.exitMultipleTVDiscounted}
            primaryMethod={tvUFCF.primaryMethod}
            perpetuityResidualPct={tvUFCF.perpetuityResidualPct}
            exitMultipleResidualPct={tvUFCF.exitMultipleResidualPct}
            guardError={tvUFCF.guardError}
            terminalG={terminalG}
            wacc={wacc}
            exitMultiple={exitMultiple}
            currency={baseInput.currency}
          />

          <ValuationOutputTable
            ufcfEV={ufcfEV}
            ufcfEquityValue={ufcfEquityValue}
            ufcfFairValue={!baseInput.financialCurrencyNote ? ufcfFairValue : null}
            ufcfUpside={!baseInput.financialCurrencyNote ? ufcfUpside : null}
            lfcfEquityValue={lfcfEquityValue}
            lfcfFairValue={!baseInput.financialCurrencyNote ? lfcfFairValue : null}
            lfcfUpside={!baseInput.financialCurrencyNote ? lfcfUpside : null}
            cashM={baseInput.cashM}
            debtM={baseInput.debtM}
            sharesM={baseInput.sharesOutstanding}
            currentPrice={baseInput.currentPrice}
            currency={baseInput.currency}
            isFinancialSector={baseInput.isFinancialSector}
            financialCurrencyNote={baseInput.financialCurrencyNote}
          />
        </div>
      </div>
    </div>
  )
}
