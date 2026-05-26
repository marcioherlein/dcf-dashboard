'use client'

import { useState, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  computeCockpitOutput,
  type ValuationAssumptions,
  type CockpitSnapshot,
} from '@/lib/valuation/cockpit'
import { deriveForwardPEAssumptions, deriveRevenueMultipleAssumptions } from '@/lib/valuation/assumptions/deriveAssumptions'
import { blendEVEBITDAMultiple } from '@/lib/valuation/methods/evEbitda'
import SummaryCards from './cockpit/SummaryCards'
import GuidanceStrip from './cockpit/GuidanceStrip'
import FairValueChart from './cockpit/FairValueChart'
import AssumptionsPanel, { type SparkPoint } from './cockpit/AssumptionsPanel'
import KeyAssumptions from './cockpit/KeyAssumptions'
import ScenarioCards from './cockpit/ScenarioCards'
import ValuationMethodCards from './cockpit/ValuationMethodCards'
import ModelDivergencePanel from './cockpit/ModelDivergencePanel'
import RightSidebar from './cockpit/RightSidebar'

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

function buildSnapshot(apiData: ApiData): CockpitSnapshot {
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
  const ttmEbitdaDollars = lastEbitda != null ? lastEbitda * 1e6 : null

  const netDebtDollars = (debtM - cashM) * 1e6
  const fcfMargin = apiData.businessProfile?.fcfMargin ?? null
  const historicalCAGR = apiData.cagrAnalysis?.historicalCagr3y ?? null
  const analystTargetMean = apiData.quote?.analystTargetMean ?? null
  const analystRating = apiData.analystRecommendation ?? null

  return {
    currentPrice: apiData.quote?.price ?? 0,
    currency: apiData.quote?.currency ?? 'USD',
    ltvRevenueDollars,
    sharesRaw,
    ttmEbitdaDollars,
    netDebtDollars,
    dividendYield: null,
    baseFCF: apiData.baseFCF ?? 0,
    cashM,
    debtM,
    sharesM,
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
      cagrPoints.push({ label: `'${String(actuals[i].year).slice(-2)}`, value: (curr - prev) / prev })
    }
  }

  const netMarginPoints: SparkPoint[] = actuals
    .filter(r => r.revenue != null && r.revenue > 0 && r.netIncome != null)
    .map(r => ({ label: `'${String(r.year).slice(-2)}`, value: r.netIncome! / r.revenue! }))

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
  const snapshot       = useMemo(() => buildSnapshot(apiData), [apiData])
  const defaults       = useMemo(() => seedAssumptions(apiData), [apiData])
  const historicalData = useMemo(() => buildHistoricalData(apiData), [apiData])
  const [assumptions, setAssumptions] = useState<ValuationAssumptions>(() => seedAssumptions(apiData))

  const output = useMemo(
    () => computeCockpitOutput(assumptions, snapshot),
    [assumptions, snapshot]
  )

  const currency     = apiData.quote?.currency === 'USD' ? '$' : (apiData.quote?.currency ?? '$') + ' '
  const currentPrice = apiData.quote?.price ?? 0
  const changePct    = apiData.quote?.changePct ?? null

  const fullDcfRef        = useRef<HTMLDetailsElement>(null)
  const assumptionsPanelRef = useRef<HTMLDivElement>(null)

  function scrollToFullDCF() {
    fullDcfRef.current?.setAttribute('open', '')
    fullDcfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function scrollToAssumptions() {
    assumptionsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">
      {/* Unified 4-item summary strip */}
      <SummaryCards
        output={output}
        currentPrice={currentPrice}
        changePct={changePct}
        currency={currency}
      />

      {/* Scenario Range — Bear / Base / Bull */}
      <ScenarioCards
        scenarios={output.scenarios}
        currentPrice={currentPrice}
        currency={currency}
      />

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        {/* Left column */}
        <div className="space-y-4 min-w-0">
          {/* Fair Value Chart + Key Assumptions side by side */}
          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-4 items-stretch">
            <FairValueChart
              methods={output.methods}
              blendedFairValue={output.blendedFairValue}
              currentPrice={currentPrice}
              currency={currency}
            />
            <KeyAssumptions
              assumptions={assumptions}
              defaults={defaults}
              onChange={setAssumptions}
              onReset={() => setAssumptions(defaults)}
              onViewAll={scrollToAssumptions}
            />
          </div>

          {/* Valuation Models — 4 method cards */}
          <ValuationMethodCards
            methods={output.methods}
            currentPrice={currentPrice}
            currency={currency}
          />

          {/* Model Divergence & Confidence */}
          <ModelDivergencePanel
            divergence={output.divergence}
            blendedFairValue={output.blendedFairValue}
            currency={currency}
          />

          {/* Full Assumptions Panel */}
          <div ref={assumptionsPanelRef}>
            <AssumptionsPanel
              assumptions={assumptions}
              defaults={defaults}
              onChange={setAssumptions}
              onReset={() => setAssumptions(defaults)}
              historicalData={historicalData}
            />
          </div>

          {/* Advanced: Full DCF Modelling Table */}
          <details ref={fullDcfRef} className="group" id="full_dcf">
            <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-3 hover:bg-slate-50 transition-colors select-none">
              <span className="text-slate-400 text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Advanced: Full DCF Modelling Table
              </span>
              <span className="ml-auto text-[10px] text-slate-400">Damodaran 4-model blend · editable year-by-year</span>
            </summary>
            <div className="mt-2">
              <ModellingWorkspace
                apiData={apiData}
                ticker={ticker}
                statementsData={statementsData}
              />
            </div>
          </details>

          {/* End-of-page CTA */}
          <div className="rounded-xl bg-white border border-slate-100 shadow-sm px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">What do you want to do next?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <a
                href={`/simplifier/${ticker}`}
                className="flex flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 hover:bg-emerald-100 transition-colors"
              >
                <span className="text-sm font-bold text-emerald-700">Save valuation →</span>
                <span className="text-[11px] text-slate-500">Track when the price hits your fair value estimate</span>
              </a>
              <button
                onClick={scrollToFullDCF}
                className="flex flex-col gap-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 hover:bg-blue-100 transition-colors text-left"
              >
                <span className="text-sm font-bold text-blue-700">Full DCF table →</span>
                <span className="text-[11px] text-slate-500">Edit WACC, year-by-year projections, and 4-model blend</span>
              </button>
              {onNavigateToFinancials && (
                <button
                  onClick={() => onNavigateToFinancials('revenue', 'income')}
                  className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition-colors text-left"
                >
                  <span className="text-sm font-bold text-slate-700">Check the financials →</span>
                  <span className="text-[11px] text-slate-500">Revenue, margins, cash flow and debt history</span>
                </button>
              )}
            </div>
          </div>

          {/* Guidance Strip — how to read this valuation */}
          <GuidanceStrip />
        </div>

        {/* Right sidebar */}
        <RightSidebar
          output={output}
          currentPrice={currentPrice}
          currency={currency}
          ticker={ticker}
          onViewFullDCF={scrollToFullDCF}
          onViewAllAssumptions={scrollToAssumptions}
        />
      </div>
    </div>
  )
}
