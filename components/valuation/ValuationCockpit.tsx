'use client'

import { useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  computeCockpitOutput,
  computeBlendedFV,
  type ValuationAssumptions,
  type CockpitSnapshot,
} from '@/lib/valuation/cockpit'
import { deriveForwardPEAssumptions, deriveRevenueMultipleAssumptions } from '@/lib/valuation/assumptions/deriveAssumptions'
import { blendEVEBITDAMultiple } from '@/lib/valuation/methods/evEbitda'
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
}

function buildSnapshot(apiData: ApiData, statementsData?: ApiData | null): CockpitSnapshot {
  const sharesM = apiData.fairValue?.sharesOutstanding ?? 0
  const cashM   = apiData.fairValue?.cash ?? 0
  const debtM   = apiData.fairValue?.debt ?? 0
  const sharesRaw = sharesM > 0 ? sharesM * 1e6 : null

  const incomeRows: Array<{ isProjected: boolean; revenue: number | null; ebitda?: number | null }> =
    apiData.financialStatements?.incomeStatement ?? []
  const actuals = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
  const lastRow = actuals[actuals.length - 1] ?? null
  const ltvRevenueDollars = lastRow?.revenue != null ? lastRow.revenue * 1e6 : null

  const ebitdaRows = incomeRows.filter(r => !r.isProjected && r.ebitda != null && r.ebitda > 0)
  const lastEbitda = ebitdaRows[ebitdaRows.length - 1]?.ebitda ?? null
  let ttmEbitdaDollars: number | null = lastEbitda != null ? lastEbitda * 1e6 : null

  // Fallback: back-compute TTM EBITDA from current EV/EBITDA multiple × enterprise value.
  // Covers mature companies (e.g. HD) where FMP ebitda field is null or zero in recent rows.
  // Note: marketCap is raw dollars from Yahoo; fairValue.cash/debt are in millions.
  if (ttmEbitdaDollars == null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const multEstimates: Array<{ multiple: string; actualValue: number }> =
      (apiData.valuationMethods?.models?.multiples?.estimates ?? []) as Array<{ multiple: string; actualValue: number }>
    const evEbitdaActual = multEstimates.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
    const marketCapRawDollars: number = apiData.quote?.marketCap ?? 0
    const netDebtM = (apiData.fairValue?.debt ?? 0) - (apiData.fairValue?.cash ?? 0)  // millions
    // Only use this fallback when the multiple is in a sensible range (3–80×)
    // — avoids circular bias from extreme multiples on loss-making or highly-distressed companies.
    if (evEbitdaActual != null && evEbitdaActual >= 3 && evEbitdaActual <= 80 && marketCapRawDollars > 0) {
      const evRawDollars = marketCapRawDollars + netDebtM * 1e6
      const implied = evRawDollars / evEbitdaActual
      if (implied > 0) ttmEbitdaDollars = implied
    }
  }

  const netDebtDollars = (debtM - cashM) * 1e6
  const fcfMargin = apiData.businessProfile?.fcfMargin ?? null
  const historicalCAGR = apiData.cagrAnalysis?.historicalCagr3y ?? null
  const analystTargetMean = apiData.quote?.analystTargetMean ?? null
  const analystRating = apiData.analystRecommendation ?? null

  // Prefer TTM FCF from statementsData (matches normalizeInputs behavior in ModellingWorkspace)
  const ttmFCFRaw = statementsData?.ttm?.cashFlow?.freeCashFlow
  const baseFCF = (typeof ttmFCFRaw === 'number' && isFinite(ttmFCFRaw) && ttmFCFRaw > 0)
    ? ttmFCFRaw / 1e6
    : (apiData.baseFCF ?? 0)

  // Match the growth model used by the financials API (three-stage for high-CAGR / negative FCF companies)
  const growthModel = (apiData.growthModel as 'two-stage' | 'three-stage') ?? 'two-stage'

  return {
    currentPrice: apiData.quote?.price ?? 0,
    currency: apiData.quote?.currency ?? 'USD',
    ltvRevenueDollars,
    sharesRaw,
    ttmEbitdaDollars,
    netDebtDollars,
    dividendYield: null,
    baseFCF,
    cashM,
    debtM,
    sharesM,
    growthModel,
    fcfMargin,
    historicalCAGR,
    analystTargetMean,
    analystRating,
  }
}

function seedAssumptions(apiData: ApiData): ValuationAssumptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fwdPEBase = deriveForwardPEAssumptions(apiData as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revMultBase = deriveRevenueMultipleAssumptions(apiData as any)

  const sector = apiData.quote?.sector ?? null
  const industry = apiData.quote?.industry ?? null
  const crp = apiData.wacc?.crp ?? 0
  const valuationMethods = apiData.valuationMethods
  const multEstimates: Array<{ multiple: string; actualValue: number }> =
    valuationMethods?.models?.multiples?.estimates ?? []
  const currentEVEBITDA = multEstimates.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
  const { multiple: exitMultiple } = blendEVEBITDAMultiple(sector, industry, currentEVEBITDA, crp)

  return {
    wacc: apiData.wacc?.wacc ?? 0.10,
    cagr: apiData.cagr ?? fwdPEBase.revenueCAGR,
    terminalG: apiData.terminalG ?? 0.03,
    netMargin: fwdPEBase.netMargin,
    dilutionRate: fwdPEBase.dilutionRate,
    exitPE: fwdPEBase.exitPE,
    exitMultiple,
    revenueMultiple: revMultBase.exitEVRevenue,
  }
}

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const multEst: Array<{ multiple: string; actualValue: number }> =
    apiData.valuationMethods?.models?.multiples?.estimates ?? []
  const evEbitdaCurrent = multEst.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
  const evRevCurrent    = multEst.find(e => e.multiple === 'EV/Revenue')?.actualValue ?? null
  const peCurrent       = apiData.quote?.peRatio ?? null

  return {
    cagr:            cagrPoints.length >= 2 ? cagrPoints.slice(-5) : undefined,
    netMargin:       netMarginPoints.length >= 2 ? netMarginPoints.slice(-5) : undefined,
    exitPE:          peCurrent != null && peCurrent > 0 && peCurrent < 300
                       ? [{ label: 'curr', value: peCurrent }] : undefined,
    exitMultiple:    evEbitdaCurrent != null && evEbitdaCurrent > 0
                       ? [{ label: 'curr', value: evEbitdaCurrent }] : undefined,
    revenueMultiple: evRevCurrent != null && evRevCurrent > 0
                       ? [{ label: 'curr', value: evRevCurrent }] : undefined,
  }
}

export default function ValuationCockpit({ apiData, ticker, statementsData, onNavigateToFinancials }: Props) {
  const snapshot       = useMemo(() => buildSnapshot(apiData, statementsData), [apiData, statementsData])
  const defaults       = useMemo(() => seedAssumptions(apiData), [apiData])
  const historicalData = useMemo(() => buildHistoricalData(apiData), [apiData])

  const [assumptions, setAssumptions] = useState<ValuationAssumptions>(() => seedAssumptions(apiData))
  const [history, setHistory] = useState<ValuationAssumptions[]>([])
  const [dcfOpened, setDcfOpened] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const output = useMemo(
    () => computeCockpitOutput(assumptions, snapshot),
    [assumptions, snapshot]
  )

  const defaultOutput = useMemo(
    () => computeCockpitOutput(defaults, snapshot),
    [defaults, snapshot]
  )

  // Sensitivity: % change in blended FV per 1pp (% fields) or 1× (multiple fields)
  const sensitivity = useMemo<Partial<Record<keyof ValuationAssumptions, number>>>(() => {
    const base = output.blendedFairValue
    if (base == null || base <= 0) return {}
    const deltas: Array<[keyof ValuationAssumptions, number]> = [
      ['wacc', 0.01], ['terminalG', 0.01], ['cagr', 0.01], ['netMargin', 0.01],
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

  const currency     = apiData.quote?.currency === 'USD' ? '$' : (apiData.quote?.currency ?? '$') + ' '
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
    setHistory(h => [...h.slice(-9), assumptions])
    setAssumptions(next)
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
    <div className="space-y-4">
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

      {/* Scenario Range */}
      <ScenarioCards
        scenarios={output.scenarios}
        currentPrice={currentPrice}
        currency={currency}
      />

      {/* Two-column: chart + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <FairValueChart
          methods={output.methods}
          blendedFairValue={output.blendedFairValue}
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

      {/* Full-width: divergence context before method numbers */}
      <ModelDivergencePanel divergence={output.divergence} />

      {/* Full-width: method cards */}
      <ValuationMethodCards
        methods={output.methods}
        currentPrice={currentPrice}
        currency={currency}
      />

      {/* Full-width: assumptions editor (single instance, no duplicate) */}
      <div ref={assumptionsPanelRef}>
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
        />
      </div>

      {/* Full DCF Model — blue header, more visible */}
      <details ref={fullDcfRef} className="group" id="full_dcf" onToggle={() => setDcfOpened(true)}>
        <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-xl border border-blue-100 shadow-sm px-4 sm:px-5 py-3.5 hover:bg-blue-50 transition-colors select-none">
          <span className="text-blue-400 text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Full DCF Model — Year-by-Year Projections
          </span>
          <span className="ml-auto text-xs text-slate-400 hidden sm:inline">Damodaran 4-model blend · editable</span>
        </summary>
        <div className="mt-2">
          {dcfOpened && (
            <ModellingWorkspace
              apiData={apiData}
              ticker={ticker}
              statementsData={statementsData}
            />
          )}
        </div>
      </details>

      {/* End-of-page CTA */}
      <div className="rounded-xl bg-white border border-slate-100 shadow-sm px-5 py-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">What do you want to do next?</p>
        <div className={`grid grid-cols-1 gap-3 ${onNavigateToFinancials ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
          <button
            onClick={scrollToFullDCF}
            className="flex flex-col gap-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 hover:bg-blue-100 transition-colors text-left"
          >
            <span className="text-sm font-bold text-blue-700">Full DCF table →</span>
            <span className="text-xs text-slate-500">Edit WACC, year-by-year projections, and 4-model blend</span>
          </button>
          {onNavigateToFinancials && (
            <button
              onClick={() => onNavigateToFinancials('revenue', 'income')}
              className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="text-sm font-bold text-slate-700">Check the financials →</span>
              <span className="text-xs text-slate-500">Revenue, margins, cash flow and debt history</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
