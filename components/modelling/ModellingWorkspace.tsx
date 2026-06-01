'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { normalizeModellingInputs, type ModellingInput, type ModellingRow } from '@/lib/valuation/normalizeInputs'
import { buildAssumptionSet } from '@/lib/valuation/assumptions'
import { computeUFCFRows, computeUFCFEV, type UFCFRow } from '@/lib/valuation/unleveredDcf'
import { computeLFCFRows, type LFCFRow } from '@/lib/valuation/leveredDcf'
import { computeTerminalValues } from '@/lib/valuation/terminalValue'
import { FOUR_MODEL_DCF_WEIGHTS } from '@/lib/dcf/detectCompanyType'
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
  onDerivedFVChange?: (fv: number | null) => void
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
  priorTtmRevenueM?: number | null,
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
    // For the TTM row, use the prior-TTM revenue as the comparison base so the
    // displayed growth rate is a true rolling YoY (TTM vs TTM-1Y) rather than
    // the short-period step from the last annual period (e.g. FY2025 → Q1 TTM).
    const prevRev = (ufcf.year === 'TTM' && priorTtmRevenueM != null)
      ? priorTtmRevenueM
      : (prevUfcf?.revenue ?? null)

    const nwcDelta = ufcf.nwcDelta ?? null

    // Net debt repayment for LFCF: use long-term debt change (avoids buyback contamination
    // from total financingCF). Positive = net paydown, negative = net new borrowing.
    const prevBase = i > 0 ? baseRows[i - 1] : null
    const netDebtRepayment = (base?.longTermDebt != null && prevBase?.longTermDebt != null)
      ? prevBase.longTermDebt - base.longTermDebt
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

export default function ModellingWorkspace({ apiData, ticker, statementsData, onDerivedFVChange }: ModellingWorkspaceProps) {
  // Overridable assumptions
  const [waccOverride, setWaccOverride] = useState<number | null>(null)
  const [terminalGOverride, setTerminalGOverride] = useState<number | null>(null)
  const [exitMultipleOverride, setExitMultipleOverride] = useState<number | null>(null)

  // Terminal method toggle
  const [terminalMethod, setTerminalMethod] = useState<'perpetuity' | 'multiple'>('multiple')

  // Levered/Unlevered toggle (mirrors ForecastTable mode)
  const [isLfcf, setIsLfcf] = useState(false)

  const baseInput: ModellingInput = useMemo(
    () => normalizeModellingInputs(ticker, apiData, statementsData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker, apiData, statementsData]
  )

  // Row-level cell overrides (keyed by year string then field name)
  const [rowOverrides, setRowOverrides] = useState<Record<string, Record<string, number>>>({})

  const wacc = Math.max(0.01, waccOverride ?? baseInput.wacc)
  const cagr = Math.max(0, baseInput.cagr)
  const terminalG = Math.max(0, terminalGOverride ?? baseInput.terminalG)
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

  // Build UFCF rows — projected revenues chain from the previous row so that
  // overriding one year's growth doesn't silently distort subsequent years' displayed %.
  const ufcfInputRows = useMemo(() => {
    const result: Array<{
      year: string; isProjected: boolean; revenue: number | null
      ebit: number | null; ebitda: number | null; capex: number | null
      nwc: number | null; dnaFromCF: number | null; freeCashFlow: number | null
    }> = []
    for (let i = 0; i < baseInput.rows.length; i++) {
      const r  = baseInput.rows[i]
      const ov = rowOverrides[r.year] ?? {}
      let revenue: number | null
      if (!r.isProjected || ov.revenue != null) {
        revenue = ov.revenue ?? r.revenue
      } else {
        const prevBuilt   = result[i - 1]?.revenue ?? null
        const prevBase    = baseInput.rows[i - 1]?.revenue ?? null
        const thisBase    = r.revenue
        if (prevBuilt != null && prevBase != null && prevBase !== 0 && thisBase != null) {
          const baseGrowth = (thisBase - prevBase) / Math.abs(prevBase)
          revenue = prevBuilt * (1 + baseGrowth)
        } else {
          revenue = r.revenue
        }
      }
      result.push({
        year: r.year, isProjected: r.isProjected, revenue,
        ebit:    ov.ebit    != null ? ov.ebit    : r.ebit,
        ebitda:  ov.ebitda  != null ? ov.ebitda  : r.ebitda,
        capex:   ov.capex   != null ? ov.capex   : (r.capex ?? (r.freeCashFlow != null && r.operatingCF != null ? r.freeCashFlow - r.operatingCF : null)),
        nwc:     ov.nwc     != null ? ov.nwc     : deriveNWC(r),
        dnaFromCF: r.dna,
        freeCashFlow: r.freeCashFlow,
      })
    }
    return result
  }, [baseInput, rowOverrides])

  const ufcfRows = useMemo(
    () => computeUFCFRows(ufcfInputRows, taxRate, wacc),
    [ufcfInputRows, taxRate, wacc]
  )

  // Build LFCF rows — same chaining logic as ufcfInputRows
  const lfcfInputRows = useMemo(() => {
    const result: Array<{
      year: string; isProjected: boolean; revenue: number | null
      netIncome: number | null; ebit: number | null; ebitda: number | null
      capex: number | null; nwc: number | null; netDebtRepayment: number | null
      dnaFromCF: number | null
    }> = []
    for (let i = 0; i < baseInput.rows.length; i++) {
      const r  = baseInput.rows[i]
      const ov = rowOverrides[r.year] ?? {}
      const prevR = i > 0 ? baseInput.rows[i - 1] : null
      // Use long-term debt change as net debt repayment to avoid buyback contamination.
      const baseNetDebtRepayment = (r.longTermDebt != null && prevR?.longTermDebt != null)
        ? prevR.longTermDebt - r.longTermDebt
        : null
      let revenue: number | null
      if (!r.isProjected || ov.revenue != null) {
        revenue = ov.revenue ?? r.revenue
      } else {
        const prevBuilt   = result[i - 1]?.revenue ?? null
        const prevBase    = baseInput.rows[i - 1]?.revenue ?? null
        const thisBase    = r.revenue
        if (prevBuilt != null && prevBase != null && prevBase !== 0 && thisBase != null) {
          const baseGrowth = (thisBase - prevBase) / Math.abs(prevBase)
          revenue = prevBuilt * (1 + baseGrowth)
        } else {
          revenue = r.revenue
        }
      }
      result.push({
        year: r.year, isProjected: r.isProjected, revenue,
        netIncome:        ov.netIncome        != null ? ov.netIncome        : r.netIncome,
        ebit:             ov.ebit             != null ? ov.ebit             : r.ebit,
        ebitda:           ov.ebitda           != null ? ov.ebitda           : r.ebitda,
        capex:            ov.capex            != null ? ov.capex            : (r.capex ?? (r.freeCashFlow != null && r.operatingCF != null ? r.freeCashFlow - r.operatingCF : null)),
        nwc:              ov.nwc              != null ? ov.nwc              : deriveNWC(r),
        netDebtRepayment: ov.netDebtRepayment != null ? ov.netDebtRepayment : baseNetDebtRepayment,
        dnaFromCF: r.dna,
      })
    }
    return result
  }, [baseInput, rowOverrides])

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

  // Sensitivity table: live base FCF (last historical) and effective CAGR derived from projections
  const histUFCF = [...ufcfRows].reverse().find(r => !r.isProjected)?.ufcf ?? null
  const histLFCF = [...lfcfRows].reverse().find(r => !r.isProjected)?.lfcf ?? null
  const sensitivityBaseFCF = isLfcf ? (histLFCF ?? baseInput.baseFCF) : (histUFCF ?? baseInput.baseFCF)
  const sensitivityLastFCF = isLfcf ? lastLFCF : lastUFCF
  // sensitivityCagr derived from FCF projections is intentionally unused —
  // the matrix always uses the user's input cagr for consistency.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _sensitivityCagr = useMemo(() => {
    if (sensitivityBaseFCF != null && sensitivityBaseFCF > 0 &&
        sensitivityLastFCF != null && sensitivityLastFCF > 0 &&
        numProjectionYears > 0) {
      return Math.pow(sensitivityLastFCF / sensitivityBaseFCF, 1 / numProjectionYears) - 1
    }
    return cagr
  }, [sensitivityBaseFCF, sensitivityLastFCF, numProjectionYears, cagr])

  const tvUFCF = useMemo(
    () => computeTerminalValues(lastUFCF, wacc, terminalG, exitMultiple, numProjectionYears, sumPvUFCF, baseInput.companyType),
    [lastUFCF, wacc, terminalG, exitMultiple, numProjectionYears, sumPvUFCF, baseInput.companyType]
  )

  const tvLFCF = useMemo(
    () => computeTerminalValues(lastLFCF, baseInput.costOfEquity, terminalG, exitMultiple, numProjectionYears, sumPvLFCF, baseInput.companyType),
    [lastLFCF, baseInput.costOfEquity, terminalG, exitMultiple, numProjectionYears, sumPvLFCF, baseInput.companyType]
  )

  // EV and fair values
  const ufcfTVDiscounted = tvUFCF.primaryMethod === 'perpetuity' ? tvUFCF.perpetuityTVDiscounted : tvUFCF.exitMultipleTVDiscounted
  const ufcfEV = computeUFCFEV(ufcfRows, ufcfTVDiscounted)

  // Suppress unused-variable warning
  void ufcfEV

  // Build display rows
  const displayRows: DisplayRow[] = useMemo(
    () => buildDisplayRows(ufcfRows, lfcfRows, baseInput.rows, baseInput.priorTtmRevenueM),
    [ufcfRows, lfcfRows, baseInput.rows, baseInput.priorTtmRevenueM]
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
    // LFCF terminal values
    lfcfPerpetualTV: tvLFCF.perpetuityTV,
    lfcfPerpetualTVDiscounted: tvLFCF.perpetuityTVDiscounted,
    lfcfExitMultipleTV: tvLFCF.exitMultipleTV,
    lfcfExitMultipleTVDiscounted: tvLFCF.exitMultipleTVDiscounted,
    lfcfGuardError: tvLFCF.guardError ?? null,
    sumPvLfcf: sumPvLFCF,
  }), [tvUFCF, tvLFCF, terminalMethod, exitMultiple, terminalG, sumPvUFCF, sumPvLFCF, baseInput, sharesM])

  const handleCellEdit = useCallback((year: string, field: string, value: number) => {
    setRowOverrides(prev => ({ ...prev, [year]: { ...prev[year], [field]: value } }))
  }, [])

  // Fair value: Damodaran four-model blend of UFCF and LFCF × both terminal methods.
  // This replaces the previous single-method snapshot so the Core DCF Result reflects
  // the average across all four variants, weighted by company type.
  const derivedFV: number | null = useMemo(() => {
    if (sharesM == null || sharesM <= 0) return null
    const cash = baseInput.cashM ?? 0
    const debt = baseInput.debtM ?? 0

    // UFCF variants — EV model: equity = (ΣPV(UFCF) + terminal TV) + cash − debt
    // Floor at $0: if net debt > enterprise value the equity value is $0, not negative.
    const ufcfPGM = tvUFCF.perpetuityTVDiscounted != null
      ? Math.max(0, (sumPvUFCF + tvUFCF.perpetuityTVDiscounted + cash - debt) / sharesM)
      : null
    const ufcfEM = tvUFCF.exitMultipleTVDiscounted != null
      ? Math.max(0, (sumPvUFCF + tvUFCF.exitMultipleTVDiscounted + cash - debt) / sharesM)
      : null
    // LFCF variants — equity model: no cash/debt bridge (cash flows are already post-financing)
    const lfcfPGM = tvLFCF.perpetuityTVDiscounted != null
      ? (sumPvLFCF + tvLFCF.perpetuityTVDiscounted) / sharesM
      : null
    const lfcfEM = tvLFCF.exitMultipleTVDiscounted != null
      ? (sumPvLFCF + tvLFCF.exitMultipleTVDiscounted) / sharesM
      : null

    const w = FOUR_MODEL_DCF_WEIGHTS[baseInput.companyType ?? 'standard'] ?? FOUR_MODEL_DCF_WEIGHTS.standard
    const parts: { w: number; v: number }[] = [
      ufcfPGM != null ? { w: w.ufcfPGM, v: ufcfPGM } : null,
      ufcfEM  != null ? { w: w.ufcfEM,  v: ufcfEM  } : null,
      lfcfPGM != null ? { w: w.lfcfPGM, v: lfcfPGM } : null,
      lfcfEM  != null ? { w: w.lfcfEM,  v: lfcfEM  } : null,
    ].filter((x): x is { w: number; v: number } => x != null)

    if (parts.length === 0) return null
    const totalW = parts.reduce((s, p) => s + p.w, 0)
    if (totalW === 0) return null
    return parts.reduce((s, p) => s + p.v * p.w / totalW, 0)
  }, [tvUFCF, tvLFCF, sumPvUFCF, sumPvLFCF, sharesM, baseInput.cashM, baseInput.debtM, baseInput.companyType])

  // Track whether net debt exceeded the UFCF-derived EV (debt overhang) so the
  // DataQualityWarnings component can show a captive-finance explanation.
  const hasDebtOverhang = useMemo(() => {
    const cash = baseInput.cashM ?? 0
    const debt = baseInput.debtM ?? 0
    if (debt - cash <= 0) return false
    const netDebt = debt - cash
    const pvPGM = tvUFCF.perpetuityTVDiscounted != null ? sumPvUFCF + tvUFCF.perpetuityTVDiscounted : null
    const pvEM  = tvUFCF.exitMultipleTVDiscounted != null ? sumPvUFCF + tvUFCF.exitMultipleTVDiscounted : null
    return (pvPGM != null && pvPGM < netDebt) || (pvEM != null && pvEM < netDebt)
  }, [tvUFCF, sumPvUFCF, baseInput.cashM, baseInput.debtM])

  const prevFV = useRef<number | null>(null)
  const [delta, setDelta] = useState<{ amount: number; pct: number } | null>(null)
  const deltaTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { onDerivedFVChange?.(derivedFV) }, [derivedFV, onDerivedFVChange])

  useEffect(() => {
    if (prevFV.current == null) { prevFV.current = derivedFV; return }
    if (derivedFV == null) return
    const diff = derivedFV - prevFV.current
    if (Math.abs(diff) > 0.05) {
      clearTimeout(deltaTimer.current)
      setDelta({ amount: diff, pct: diff / Math.abs(prevFV.current) })
      deltaTimer.current = setTimeout(() => setDelta(null), 2000)
    }
    prevFV.current = derivedFV
  }, [derivedFV])

  return (
    <div className="bg-[#080F1E] rounded-xl overflow-hidden border border-white/10">
      <DataQualityWarnings
        terminalGError={tvUFCF.guardError}
        financialCurrencyNote={baseInput.financialCurrencyNote}
        isFinancialSector={baseInput.isFinancialSector}
        isNegativeFCF={baseInput.baseFCF != null && baseInput.baseFCF < 0}
        altmanZone={baseInput.altmanZone}
        beneishFlag={baseInput.beneishFlag}
        crp={waccRaw.crp ?? 0}
        financialCurrency={waccRaw.financialCurrency ?? undefined}
        fcfCapApplied={baseInput.fcfCapApplied ?? false}
        debtOverhang={hasDebtOverhang}
        netDebtM={(baseInput.debtM ?? 0) - (baseInput.cashM ?? 0)}
      />

      {/* Assumption-change delta badge */}
      {delta && (
        <div className={[
          'flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold tabular-nums transition-opacity',
          delta.amount >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10',
        ].join(' ')}>
          <span>{delta.amount >= 0 ? '▲' : '▼'}</span>
          <span>Fair Value {delta.amount >= 0 ? '+' : ''}{delta.amount.toFixed(2)}</span>
          <span className="opacity-60">({delta.amount >= 0 ? '+' : ''}{(delta.pct * 100).toFixed(1)}%)</span>
        </div>
      )}
      <ForecastTable
        rows={displayRows}
        waccData={waccData}
        terminalData={terminalData}
        currency={baseInput.currency}
        onCellEdit={handleCellEdit}
        onTerminalMethodChange={setTerminalMethod}
        onExitMultipleChange={(v) => setExitMultipleOverride(v)}
        onTerminalGChange={setTerminalGOverride}
        currentWacc={+(wacc * 100).toFixed(1)}
        onWaccChange={(v) => setWaccOverride(v / 100)}
        onModeChange={setIsLfcf}
        cagrAnalysis={apiData?.cagrAnalysis}
        blendedImpliedPrice={derivedFV}
        companyType={baseInput.companyType}
      />

      {/* Sensitivity heatmap */}
      {sensitivityBaseFCF != null && sensitivityBaseFCF !== 0 && sharesM != null && sharesM > 0 && (
        <div className="mt-0">
          <SensitivityTable
            baseFCF={sensitivityBaseFCF}
            baseWacc={isLfcf ? baseInput.costOfEquity : wacc}
            baseCagr={cagr}
            terminalG={terminalG}
            cashM={isLfcf ? 0 : (baseInput.cashM ?? 0)}
            debtM={isLfcf ? 0 : (baseInput.debtM ?? 0)}
            sharesM={sharesM}
            currentPrice={baseInput.currentPrice ?? 0}
            numYears={numProjectionYears}
            currency={baseInput.currency}
            terminalMethod={terminalMethod}
            exitMultiple={exitMultiple}
            isLevered={isLfcf}
          />
        </div>
      )}
    </div>
  )
}
