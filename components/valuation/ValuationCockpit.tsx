'use client'

import { useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  computeCockpitOutput,
  computeBlendedFV,
  type ValuationAssumptions,
} from '@/lib/valuation/cockpit'
import { buildSnapshot, seedAssumptions } from '@/lib/valuation/cockpitBuilders'
import SummaryCards from './cockpit/SummaryCards'
import GuidanceStrip from './cockpit/GuidanceStrip'
import FairValueChart from './cockpit/FairValueChart'
import AssumptionsPanel, { type SparkPoint } from './cockpit/AssumptionsPanel'
import ScenarioCards from './cockpit/ScenarioCards'
import ValuationMethodCards from './cockpit/ValuationMethodCards'
import ModelDivergencePanel from './cockpit/ModelDivergencePanel'
import RightSidebar from './cockpit/RightSidebar'
import SaveToWatchlistDialog from '@/components/watchlist/SaveToWatchlistDialog'
import type { WatchlistSavePayload } from '@/components/watchlist/SaveToWatchlistDialog'

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
  onNavigateToFinancials?: (rowKey: string, statement: 'income' | 'balance' | 'cashflow') => void
  onNavigateToRisks?: () => void
}

// Re-export so callers that import from this file continue to work
export { buildSnapshot, seedAssumptions } from '@/lib/valuation/cockpitBuilders'

type HistoricalData = Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>

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

  const netMarginPoints: SparkPoint[] = actuals
    .filter(r => r.revenue != null && r.revenue > 0 && r.netIncome != null)
    .map(r => ({ label: String(r.year), value: r.netIncome! / r.revenue! }))

  // Year-by-year multiples from FMP key metrics (last 5 fiscal years)
  const histMult: Array<{ fiscalYear: string; pe: number | null; evEbitda: number | null; evRevenue: number | null }> =
    apiData.historicalMultiples ?? []

  const peCurrent       = apiData.quote?.peRatio ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const multEst: Array<{ multiple: string; actualValue: number }> =
    apiData.valuationMethods?.models?.multiples?.estimates ?? []
  const evEbitdaCurrent = multEst.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
  const evRevCurrent    = multEst.find(e => e.multiple === 'EV/Revenue')?.actualValue ?? null

  const peSeries     = histMult.filter(h => h.pe != null).slice(-5).map(h => ({ label: String(h.fiscalYear), value: h.pe! }))
  const ebitdaSeries = histMult.filter(h => h.evEbitda != null).slice(-5).map(h => ({ label: String(h.fiscalYear), value: h.evEbitda! }))
  const revSeries    = histMult.filter(h => h.evRevenue != null).slice(-5).map(h => ({ label: String(h.fiscalYear), value: h.evRevenue! }))

  // Append current TTM value as 'curr' point (blue dot to the right of the historical line)
  if (peCurrent != null && peCurrent > 0 && peCurrent < 300) peSeries.push({ label: 'curr', value: peCurrent })
  if (evEbitdaCurrent != null && evEbitdaCurrent > 0) ebitdaSeries.push({ label: 'curr', value: evEbitdaCurrent })
  if (evRevCurrent != null && evRevCurrent > 0) revSeries.push({ label: 'curr', value: evRevCurrent })

  return {
    cagr:            cagrPoints.length >= 2 ? cagrPoints.slice(-5) : undefined,
    netMargin:       netMarginPoints.length >= 2 ? netMarginPoints.slice(-5) : undefined,
    exitPE:          peSeries.length >= 1 ? peSeries : undefined,
    exitMultiple:    ebitdaSeries.length >= 1 ? ebitdaSeries : undefined,
    revenueMultiple: revSeries.length >= 1 ? revSeries : undefined,
  }
}

export default function ValuationCockpit({ apiData, ticker, statementsData, onNavigateToFinancials: _onNavigateToFinancials, onNavigateToRisks: _onNavigateToRisks }: Props) {
  const snapshot       = useMemo(() => buildSnapshot(apiData, statementsData), [apiData, statementsData])
  const defaults       = useMemo(() => seedAssumptions(apiData), [apiData])
  const historicalData = useMemo(() => buildHistoricalData(apiData), [apiData])

  const [assumptions, setAssumptions] = useState<ValuationAssumptions>(() => seedAssumptions(apiData))
  const [history, setHistory] = useState<ValuationAssumptions[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [liveDcfFV, setLiveDcfFV] = useState<number | null>(null)

  // When ModellingWorkspace computes its derivedFV, override snapshot.fullDcfFairValue so
  // the Core DCF card always matches the Full DCF Table's 4-model blended result exactly.
  const effectiveSnapshot = useMemo(
    () => liveDcfFV != null ? { ...snapshot, fullDcfFairValue: liveDcfFV } : snapshot,
    [snapshot, liveDcfFV]
  )

  const output = useMemo(
    () => computeCockpitOutput(assumptions, effectiveSnapshot),
    [assumptions, effectiveSnapshot]
  )

  const defaultOutput = useMemo(
    () => computeCockpitOutput(defaults, effectiveSnapshot),
    [defaults, effectiveSnapshot]
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

  const currency     = apiData.quote?.currency ?? 'USD'
  const currentPrice = apiData.quote?.price ?? 0
  const changePct    = apiData.quote?.changePct ?? null

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
    setHistory(h => [...h.slice(-9), assumptions])
    setAssumptions(clamped)
  }

  function handleUndo() {
    if (history.length === 0) return
    setAssumptions(history[history.length - 1])
    setHistory(h => h.slice(0, -1))
  }

  function handleReset() {
    setHistory([])
    setAssumptions(defaults)
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
      {/* 5-item summary strip */}
      <SummaryCards
        output={output}
        currentPrice={currentPrice}
        changePct={changePct}
        currency={currency}
      />

      {/* Collapsible guidance at top */}
      <GuidanceStrip />

      {/* Workbench: assumptions (left, cause) + live output (right, effect) */}
      <div className="mt-2 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div ref={assumptionsPanelRef} className="min-w-0">
          <AssumptionsPanel
            assumptions={assumptions}
            defaults={defaults}
            onChange={handleAssumptionChange}
            onReset={handleReset}
            onUndo={handleUndo}
            canUndo={history.length > 0}
            historicalData={historicalData}
            blendedFairValue={output.blendedFairValue}
            defaultBlendedFairValue={defaultOutput.blendedFairValue}
            sensitivity={sensitivity}
            currency={currency}
          />
        </div>

        <div className="flex flex-col gap-4">
          <ScenarioCards
            scenarios={output.scenarios}
            currentPrice={currentPrice}
            currency={currency}
          />
          <RightSidebar
            output={output}
            currentPrice={currentPrice}
            currency={currency}
            ticker={ticker}
            onViewFullDCF={scrollToFullDCF}
            onSave={() => setSaveOpen(true)}
          />
        </div>
      </div>

      {/* Evidence: method chart + divergence + method cards */}
      <FairValueChart
        methods={output.methods}
        blendedFairValue={output.blendedFairValue}
        currentPrice={currentPrice}
        currency={currency}
      />
      <ModelDivergencePanel divergence={output.divergence} />
      <ValuationMethodCards
        methods={output.methods}
        currentPrice={currentPrice}
        currency={currency}
        cagr={assumptions.cagr}
        fcfMargin={snapshot.fcfMargin}
        ttmEbitdaDollars={snapshot.ttmEbitdaDollars}
      />

      {/* Full DCF Model — blue header, more visible */}
      <details ref={fullDcfRef} className="group" id="full_dcf">
        <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-xl border border-blue-100 shadow-sm px-4 sm:px-5 py-3.5 hover:bg-blue-50 transition-colors select-none">
          <span className="text-blue-400 text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Full DCF Model — Year-by-Year Projections
          </span>
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
