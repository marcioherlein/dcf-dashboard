'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import {
  computeCockpitOutput,
  computeBlendedFV,
  type ValuationAssumptions,
} from '@/lib/valuation/cockpit'
import { buildSnapshot, seedAssumptions } from '@/lib/valuation/cockpitBuilders'
import { buildValueInvestingData, computeStarRating, computeUncertainty } from '@/lib/valuation/valueInvestingAnalysis'
import { getIndustryMultiples } from '@/lib/dcf/calculateMultiples'
import GuidanceStrip from './cockpit/GuidanceStrip'
import BusinessChecks from './cockpit/BusinessChecks'
import ValueInvestingPanel from './cockpit/ValueInvestingPanel'
import FairValueChart from './cockpit/FairValueChart'
import { type SparkPoint } from './cockpit/AssumptionsPanel'
import ValuationMethodCards from './cockpit/ValuationMethodCards'
import ModelDivergencePanel from './cockpit/ModelDivergencePanel'
import RightSidebar from './cockpit/RightSidebar'
import VerdictHero from './cockpit/VerdictHero'
import SensitivityMatrix from './SensitivityMatrix'
import MonteCarloPanel from './cockpit/MonteCarloPanel'
import SaveToWatchlistDialog from '@/components/watchlist/SaveToWatchlistDialog'
import type { WatchlistSavePayload } from '@/components/watchlist/SaveToWatchlistDialog'
import { fmtPrice } from '@/lib/formatters'
import AssumptionHealthPanel from './cockpit/AssumptionHealthPanel'
import type { AssumptionAudit } from '@/lib/valuation/assumptionAuditor'

const ModellingWorkspace = dynamic(
  () => import('@/components/modelling/ModellingWorkspace'),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-slate-100" /> }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiData = Record<string, any>

interface Props {
  apiData: ApiData
  ticker: string
  statementsData?: ApiData | null
  limitedHistory?: boolean
  historyYears?: number
  onNavigateToFinancials?: (rowKey: string, statement: 'income' | 'balance' | 'cashflow') => void
  onNavigateToRisks?: () => void
  onLiveDcfFVChange?: (fv: number | null) => void
}

// Re-export so callers that import from this file continue to work
export { buildSnapshot, seedAssumptions } from '@/lib/valuation/cockpitBuilders'

type HistoricalData = Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>

function quarterLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const m = d.getUTCMonth() // 0-indexed
  const yr = String(d.getUTCFullYear()).slice(2)
  const q = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4'
  return `${q} '${yr}`
}

function buildHistoricalData(apiData: ApiData): HistoricalData {
  const incomeRows: Array<{
    year: string; isProjected: boolean
    revenue: number | null; netIncome: number | null; ebitda: number | null
  }> = apiData.financialStatements?.incomeStatement ?? []
  const actuals = incomeRows.filter(r => !r.isProjected).slice(-6)

  const cagrPoints: SparkPoint[] = []
  for (let i = 1; i < actuals.length; i++) {
    const prev = actuals[i - 1].revenue
    const curr = actuals[i].revenue
    if (prev && prev > 0 && curr != null) {
      cagrPoints.push({ label: String(actuals[i].year), value: (curr - prev) / prev })
    }
  }

  // Net margin: prefer quarterly rolling data for more data points
  const ratiosQ: Array<{ date: string; priceEarningsRatio: number | null; enterpriseValueMultiple: number | null; evToSales: number | null; priceToBookRatio: number | null }> =
    (apiData.ratiosQuarterly ?? []).slice().reverse() // reverse to oldest-first for chart

  const isQ: Array<{ date: string; revenue: number; netIncome: number }> =
    (apiData.incomeStatementQuarterly ?? []).slice().reverse() // oldest-first

  const netMarginPoints: SparkPoint[] = isQ.length >= 4
    ? isQ
        .filter(q => q.revenue > 0 && q.netIncome != null)
        .slice(-12)
        .map(q => ({ label: quarterLabel(q.date), value: q.netIncome / q.revenue }))
    : actuals
        .filter(r => r.revenue != null && r.revenue > 0 && r.netIncome != null)
        .map(r => ({ label: String(r.year), value: r.netIncome! / r.revenue! }))

  const clamp = (v: number | null | undefined, lo: number, hi: number): number | null => {
    if (v == null || !isFinite(v) || v <= 0) return null
    return v < lo || v > hi ? null : v
  }

  // Build quarterly series for P/E, EV/EBITDA, EV/Revenue, P/B
  const peSeries: SparkPoint[] = ratiosQ
    .map(r => ({ label: quarterLabel(r.date), v: clamp(r.priceEarningsRatio, 1, 500) }))
    .filter((p): p is { label: string; v: number } => p.v != null)
    .slice(-12)
    .map(p => ({ label: p.label, value: p.v }))

  const ebitdaSeries: SparkPoint[] = ratiosQ
    .map(r => ({ label: quarterLabel(r.date), v: clamp(r.enterpriseValueMultiple, 1, 80) }))
    .filter((p): p is { label: string; v: number } => p.v != null)
    .slice(-12)
    .map(p => ({ label: p.label, value: p.v }))

  const revSeries: SparkPoint[] = ratiosQ
    .map(r => ({ label: quarterLabel(r.date), v: clamp(r.evToSales, 0.1, 50) }))
    .filter((p): p is { label: string; v: number } => p.v != null)
    .slice(-12)
    .map(p => ({ label: p.label, value: p.v }))

  const pbSeries: SparkPoint[] = ratiosQ
    .map(r => ({ label: quarterLabel(r.date), v: clamp(r.priceToBookRatio, 0.1, 20) }))
    .filter((p): p is { label: string; v: number } => p.v != null)
    .slice(-12)
    .map(p => ({ label: p.label, value: p.v }))

  // Fall back to annual data if quarterly is empty
  const histMult: Array<{ fiscalYear: string; pe: number | null; evEbitda: number | null; evRevenue: number | null }> =
    apiData.historicalMultiples ?? []

  const peFinal = peSeries.length >= 2 ? peSeries : histMult.filter(h => h.pe != null).slice(-5).map(h => ({ label: String(h.fiscalYear), value: h.pe! }))
  const ebitdaFinal = ebitdaSeries.length >= 2 ? ebitdaSeries : histMult.filter(h => h.evEbitda != null).slice(-5).map(h => ({ label: String(h.fiscalYear), value: h.evEbitda! }))
  const revFinal = revSeries.length >= 2 ? revSeries : histMult.filter(h => h.evRevenue != null).slice(-5).map(h => ({ label: String(h.fiscalYear), value: h.evRevenue! }))

  // Append current TTM value as 'curr' point
  const peCurrent       = apiData.quote?.peRatio ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const multEst: Array<{ multiple: string; actualValue: number }> =
    apiData.valuationMethods?.models?.multiples?.estimates ?? []
  const evEbitdaCurrent = multEst.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
  const evRevCurrent    = multEst.find(e => e.multiple === 'EV/Revenue')?.actualValue ?? null
  const pbCurrent       = multEst.find(e => e.multiple === 'P/Book')?.actualValue ?? null

  if (peCurrent != null && peCurrent > 0 && peCurrent < 1000) peFinal.push({ label: 'curr', value: peCurrent })
  if (evEbitdaCurrent != null && evEbitdaCurrent > 0) ebitdaFinal.push({ label: 'curr', value: evEbitdaCurrent })
  if (evRevCurrent != null && evRevCurrent > 0) revFinal.push({ label: 'curr', value: evRevCurrent })
  if (pbCurrent != null && pbCurrent > 0) pbSeries.push({ label: 'curr', value: pbCurrent })

  return {
    cagr:               cagrPoints.length >= 2 ? cagrPoints.slice(-5) : undefined,
    netMargin:          netMarginPoints.length >= 2 ? netMarginPoints : undefined,
    exitPE:             peFinal.length >= 1 ? peFinal : undefined,
    exitMultiple:       ebitdaFinal.length >= 1 ? ebitdaFinal : undefined,
    revenueMultiple:    revFinal.length >= 1 ? revFinal : undefined,
    priceToBookMultiple: pbSeries.length >= 1 ? pbSeries : undefined,
  }
}

export default function ValuationCockpit({ apiData, ticker, statementsData, limitedHistory, historyYears, onNavigateToFinancials: _onNavigateToFinancials, onNavigateToRisks: _onNavigateToRisks, onLiveDcfFVChange }: Props) {
  const snapshot       = useMemo(() => buildSnapshot(apiData, statementsData), [apiData, statementsData])
  const defaults       = useMemo(() => seedAssumptions(apiData), [apiData])
  const historicalData = useMemo(() => buildHistoricalData(apiData), [apiData])

  const [assumptions, setAssumptions] = useState<ValuationAssumptions>(() => seedAssumptions(apiData))
  const [history, setHistory] = useState<ValuationAssumptions[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [liveDcfFV, setLiveDcfFV] = useState<number | null>(null)
  const [lastChange, setLastChange] = useState<{
    label: string; delta: number; unit: '%' | 'x'; fvImpact: number | null
  } | null>(null)
  const [clampNote, setClampNote] = useState<string | null>(null)

  // When ModellingWorkspace computes its derivedFV, override snapshot.fullDcfFairValue so
  // the Core DCF card always matches the Full DCF Table's 4-model blended result exactly.
  // Also bubble the value up via onLiveDcfFVChange so the Overview tab stays in sync.
  const effectiveSnapshot = useMemo(
    () => liveDcfFV != null ? { ...snapshot, fullDcfFairValue: liveDcfFV } : snapshot,
    [snapshot, liveDcfFV]
  )
  useEffect(() => { onLiveDcfFVChange?.(liveDcfFV) }, [liveDcfFV, onLiveDcfFVChange])

  const output = useMemo(
    () => computeCockpitOutput(assumptions, effectiveSnapshot),
    [assumptions, effectiveSnapshot]
  )


  // Sensitivity: % change in blended FV per 1pp (% fields) or 1× (multiple fields)
  const sensitivity = useMemo<Partial<Record<keyof ValuationAssumptions, number>>>(() => {
    const base = output.blendedFairValue
    if (base == null || base <= 0) return {}
    const deltas: Array<[keyof ValuationAssumptions, number]> = [
      ['wacc', 0.01], ['cagr', 0.01], ['netMargin', 0.01],
      ['exitPE', 1],  ['exitMultiple', 1], ['revenueMultiple', 1],
    ]
    const result: Partial<Record<keyof ValuationAssumptions, number>> = {}
    for (const [key, delta] of deltas) {
      const val = assumptions[key] as number
      const fvP = computeBlendedFV({ ...assumptions, [key]: val + delta }, snapshot)
      const fvM = computeBlendedFV({ ...assumptions, [key]: val - delta }, snapshot)
      if (fvP != null && fvM != null) result[key] = (fvP - fvM) / (2 * base)
    }
    return result
  }, [assumptions, snapshot, output.blendedFairValue])

  // Auto-select top-2 sensitivity drivers for SensitivityMatrix default axes
  const [defaultAxisY, defaultAxisX] = useMemo(() => {
    const AXIS_KEYS = ['cagr', 'wacc', 'netMargin', 'exitPE', 'exitMultiple', 'revenueMultiple'] as const
    const ranked = AXIS_KEYS
      .map(k => ({ k, abs: Math.abs(sensitivity[k] ?? 0) }))
      .sort((a, b) => b.abs - a.abs)
    return [ranked[0]?.k ?? 'cagr', ranked[1]?.k ?? 'wacc'] as [keyof ValuationAssumptions, keyof ValuationAssumptions]
  }, [sensitivity])

  const currency     = apiData.quote?.currency ?? 'USD'
  const currentPrice = apiData.quote?.price ?? 0
  const changePct    = apiData.quote?.changePct ?? null
  const sector       = apiData.quote?.sector ?? null
  const industry     = apiData.quote?.industry ?? null

  const sectorBenchmarks = useMemo(() => {
    if (!industry && !sector) return null
    const m = getIndustryMultiples(industry ?? '', sector ?? '')
    return { exitPE: m.pe, exitMultiple: m.evEbitda, revenueMultiple: m.evRevenue }
  }, [industry, sector])

  const valueInvestingData = useMemo(
    () => buildValueInvestingData(apiData, assumptions.wacc, assumptions.terminalG),
    [apiData, assumptions.wacc, assumptions.terminalG]
  )

  const starRating = useMemo(
    () => computeStarRating(currentPrice, output.blendedFairValue),
    [currentPrice, output.blendedFairValue]
  )

  const uncertainty = useMemo(() => {
    if (output.blendedFairValue == null || output.blendedFairValue <= 0) return null
    return computeUncertainty(
      output.methods.map(m => m.fairValue),
      output.blendedFairValue
    )
  }, [output.methods, output.blendedFairValue])

  const fcfYield = useMemo(() => {
    const marketCapRaw: number = apiData.quote?.marketCap ?? 0
    if (marketCapRaw <= 0 || snapshot.baseFCF == null) return null
    return (snapshot.baseFCF * 1e6) / marketCapRaw
  }, [apiData.quote?.marketCap, snapshot.baseFCF])

  const rfRate: number = apiData.wacc?.inputs?.rfRate ?? 0.045

  const savePayload: WatchlistSavePayload = useMemo(() => ({
    ticker,
    name: apiData.quote?.longName ?? apiData.quote?.shortName ?? ticker,
    assetType: 'stock',
    fairValue: output.blendedFairValue,
    upsidePct: output.upsidePct,
    valuationSnapshot: output.blendedFairValue != null ? {
      price_at_save: currentPrice,
      fair_value: output.blendedFairValue,
      wacc: assumptions.wacc,
      beta: apiData.quote?.beta ?? 1,
      terminal_g: assumptions.terminalG,
      cagr: assumptions.cagr,
      upside_pct: output.upsidePct ?? 0,
      inputs: {
        wacc: assumptions.wacc,
        cagr: assumptions.cagr,
        terminalG: assumptions.terminalG,
        netMargin: assumptions.netMargin,
        exitPE: assumptions.exitPE,
        exitMultiple: assumptions.exitMultiple,
        revenueMultiple: assumptions.revenueMultiple,
      },
      scenarios: {
        bull: output.scenarios.bull.fairValue ?? 0,
        base: output.scenarios.base.fairValue ?? 0,
        bear: output.scenarios.bear.fairValue ?? 0,
      },
    } : null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ticker, output, assumptions, currentPrice, apiData.quote])

  const fullDcfRef        = useRef<HTMLDetailsElement>(null)
  const assumptionsPanelRef = useRef<HTMLDivElement>(null)

  function handleAssumptionChange(next: ValuationAssumptions) {
    const clampedG = Math.min(next.terminalG, Math.max(0.005, next.wacc - 0.02))
    const clamped  = clampedG !== next.terminalG ? { ...next, terminalG: clampedG } : next

    if (clampedG !== next.terminalG) {
      setClampNote(`Terminal G clamped to WACC − 200bps (${(clampedG * 100).toFixed(1)}%)`)
    } else {
      setClampNote(null)
    }

    const PCT_KEYS: (keyof ValuationAssumptions)[] = ['wacc', 'cagr', 'netMargin', 'terminalG']
    const LABELS: Partial<Record<keyof ValuationAssumptions, string>> = {
      wacc: 'WACC', cagr: 'CAGR', netMargin: 'Net margin',
      terminalG: 'Terminal G', exitPE: 'Exit P/E',
      exitMultiple: 'EV/EBITDA', revenueMultiple: 'EV/Revenue',
    }
    for (const k of Object.keys(clamped) as (keyof ValuationAssumptions)[]) {
      const delta = (clamped[k] as number) - (assumptions[k] as number)
      if (Math.abs(delta) > 0.00001) {
        const sens = sensitivity[k]
        const fvImpact = sens != null && output.blendedFairValue != null
          ? sens * delta * output.blendedFairValue
          : null
        setLastChange({ label: LABELS[k] ?? String(k), delta, unit: PCT_KEYS.includes(k) ? '%' : 'x', fvImpact })
        break
      }
    }

    setHistory(h => [...h.slice(-9), assumptions])
    setAssumptions(clamped)
  }

  function handleUndo() {
    if (history.length === 0) return
    setAssumptions(history[history.length - 1])
    setHistory(h => h.slice(0, -1))
    setLastChange(null)
    setClampNote(null)
  }

  function handleReset() {
    setHistory([])
    setAssumptions(defaults)
    setLastChange(null)
    setClampNote(null)
  }

  function scrollToFullDCF() {
    fullDcfRef.current?.setAttribute('open', '')
    fullDcfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-3">
      <SaveToWatchlistDialog
        open={saveOpen}
        payload={savePayload}
        onClose={() => setSaveOpen(false)}
        onReviewAssumptions={() => {
          setSaveOpen(false)
          assumptionsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />
      {/* Verdict hero — editorial headline, key numbers, scenario slider */}
      <VerdictHero
        output={output}
        currentPrice={currentPrice}
        changePct={changePct}
        currency={currency}
        ticker={ticker}
        companyName={apiData.quote?.longName ?? apiData.quote?.shortName ?? ''}
        starRating={starRating}
      />

      {limitedHistory && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-amber-500 shrink-0 text-xs mt-0.5">⚠</span>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <span className="font-[700]">Limited history ({historyYears} year{historyYears !== 1 ? 's' : ''} of data).</span>{' '}
            Projections draw on pre-IPO S-1 financials and analyst consensus. Exit multiple models are more reliable than growth-stage DCF here — treat them as primary.
          </p>
        </div>
      )}

      {/* Collapsible guidance at top */}
      <GuidanceStrip />

      {/* Assumption Health Panel — cross-validates model assumptions against independent signals */}
      {apiData.assumptionAudit && (
        <AssumptionHealthPanel
          audit={apiData.assumptionAudit as AssumptionAudit}
          assumptions={assumptions}
          onChange={handleAssumptionChange}
          analystForwardPE={apiData.analystForwardPE ?? null}
        />
      )}

      {/* Valuation Models — inline assumption editing + mini historical charts */}
      <div ref={assumptionsPanelRef} id="assumptions-panel">
        {clampNote && (
          <p className="mb-2 text-[11px] text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">
            ⚠ {clampNote}
          </p>
        )}
        <ValuationMethodCards
          methods={output.methods}
          currentPrice={currentPrice}
          currency={currency}
          fcfMargin={snapshot.fcfMargin}
          ttmEbitdaDollars={snapshot.ttmEbitdaDollars}
          assumptions={assumptions}
          historicalData={historicalData}
          onChange={handleAssumptionChange}
          onReset={handleReset}
          onUndo={handleUndo}
          canUndo={history.length > 0}
          sensitivity={sensitivity}
          sectorBenchmarks={sectorBenchmarks}
          onScrollToFullDCF={scrollToFullDCF}
        />
      </div>

      {/* Business fundamentals — what the market is pricing in vs what the business actually delivers */}
      <BusinessChecks
        roic={valueInvestingData.roic}
        roicSpread={valueInvestingData.roicSpread}
        wacc={valueInvestingData.wacc}
        epvGrowthPremiumPct={valueInvestingData.epv.growthPremiumPct}
        epvPerShare={valueInvestingData.epv.epvPerShare}
        currentPrice={currentPrice}
        currency={currency}
        fcfYield={fcfYield}
        rfRate={rfRate}
        marketImpliedGrowth={output.marketImpliedGrowth}
        marketImpliedText={output.marketImpliedText}
        priceToBook={
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (apiData.valuationMethods?.models?.multiples?.estimates ?? []).find((e: any) => e.multiple === 'P/Book')?.actualValue ?? null
        }
        pbSectorMedian={
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (apiData.valuationMethods?.models?.multiples?.estimates ?? []).find((e: any) => e.multiple === 'P/Book')?.sectorMedian ?? null
        }
        sector={sector}
        starRating={starRating}
        uncertainty={uncertainty}
        structuralRisk={valueInvestingData.structuralRiskDisclaimer}
        countryRisk={valueInvestingData.countryRiskDisclaimer}
      />

      {/* Sensitivity matrix — always visible, updates live with assumption changes */}
      <SensitivityMatrix
        assumptions={assumptions}
        snapshot={effectiveSnapshot}
        currentPrice={currentPrice}
        currency={currency}
        epvPerShare={valueInvestingData.epv.epvPerShare}
        historicalData={historicalData}
        defaultAxisY={defaultAxisY}
        defaultAxisX={defaultAxisX}
      />

      {/* Monte Carlo DCF [BETA] — Markov-chain regime simulation + LS real options */}
      <MonteCarloPanel
        assumptions={assumptions}
        snapshot={effectiveSnapshot}
        apiData={apiData}
        sensitivity={sensitivity}
        currentPrice={currentPrice}
        currency={currency}
      />

      <RightSidebar
        output={output}
        currentPrice={currentPrice}
        currency={currency}
        ticker={ticker}
        companyType={snapshot.companyType}
        onViewFullDCF={scrollToFullDCF}
        onSave={() => setSaveOpen(true)}
        lastChange={lastChange}
      />

      {/* Evidence tier — collapsed by default; decision surface above this fold */}
      <details className="group" id="model_evidence">
        <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-xl border border-[#E6ECF5] shadow-sm px-4 sm:px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors select-none">
          <span className="text-slate-400 text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
          <span className="text-sm font-[650] text-slate-700">Model Evidence</span>
          <span className="ml-auto text-xs text-slate-400 hidden sm:inline">Fair value chart · divergence analysis · value investing metrics</span>
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <ValueInvestingPanel
            data={valueInvestingData}
            currency={currency}
            currentPrice={currentPrice}
          />
          <FairValueChart
            methods={output.methods}
            blendedFairValue={output.blendedFairValue}
            currentPrice={currentPrice}
            currency={currency}
          />
          <ModelDivergencePanel divergence={output.divergence} />
        </div>
      </details>

      {/* Full DCF Model — blue header, more visible */}
      <details ref={fullDcfRef} className="group" id="full_dcf">
        <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-xl border border-blue-100 shadow-sm px-4 sm:px-5 py-3.5 hover:bg-blue-50 transition-colors select-none">
          <span className="text-blue-400 text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
          <span className="text-sm font-[650] text-blue-600">
            Full DCF Model — Year-by-Year Projections
          </span>
          {liveDcfFV != null && (
            <span className="ml-1 text-[12px] font-[700] tabular-nums text-blue-500">
              {fmtPrice(liveDcfFV, currency)}
            </span>
          )}
          <span className="ml-auto text-xs text-slate-400 hidden sm:inline">DCF-only estimate · distinct from top blended value</span>
        </summary>
        <div className="mt-2">
          {/* Best-viewed-on-desktop note for mobile */}
          <p className="sm:hidden text-[11px] text-slate-400 text-center py-2 px-4">
            Best experienced on a wider screen — scroll horizontally to view all columns.
          </p>
          <ModellingWorkspace
            apiData={apiData}
            ticker={ticker}
            statementsData={statementsData}
            onDerivedFVChange={setLiveDcfFV}
            cockpitWacc={assumptions.wacc}
          />
        </div>
      </details>

      {/* End-of-page CTA — removed; tab nav handles navigation */}
      {/* Mobile sticky CTA — hidden on desktop where assumptions are always visible */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-2" style={{ background: 'linear-gradient(to top, rgba(248,250,252,0.98) 0%, rgba(248,250,252,0) 100%)' }}>
        <button
          onClick={() => assumptionsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-95"
          style={{ background: '#2563EB', boxShadow: '0 4px 16px rgba(37,99,235,0.35)' }}
        >
          Edit assumptions
        </button>
      </div>
    </div>
  )
}
