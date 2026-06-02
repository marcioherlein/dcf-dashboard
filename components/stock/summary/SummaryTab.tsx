'use client'

import { useMemo } from 'react'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'
import SummaryHeroCard from './SummaryHeroCard'
import SummaryPriceChartCard from './SummaryPriceChartCard'
import ReverseDCFCompactCard from './ReverseDCFCompactCard'
import MarketInterpretationCard from './MarketInterpretationCard'
import BullCaseCard from './BullCaseCard'
import BearCaseCard from './BearCaseCard'
import NextStepsCard from './NextStepsCard'
import OverviewMetricGrid from '@/components/stock/OverviewMetricGrid'
import CompanyCard from '@/components/stock/overview/CompanyCard'
import IncomeFlowCard from './IncomeFlowCard'

// ─── types ────────────────────────────────────────────────────────────────────

interface ScenarioData {
  fairValue: number
  wacc: number
  cagr: number
  terminalG: number
}

interface SummaryTabProps {
  ticker: string
  companyName: string
  // quote
  price: number
  change: number
  changePct: number
  currency: string
  high52: number
  low52: number
  sector: string
  // cockpit
  fairValue: number | null
  upsidePct: number | null
  confidence: 'High' | 'Medium' | 'Low' | null
  modelCount: number
  totalModels: number
  // reverse DCF inputs
  sharesM: number | null
  cashM: number | null
  debtM: number | null
  revenueM: number | null
  fcfMargin: number | null
  wacc: number
  terminalG: number
  historicalCAGR: number | null
  analystCAGR: number | null
  isEmergingMarket?: boolean
  revenueHistory?: Array<{ year: string; revenue: number | null; isProjected: boolean }>
  // scenarios
  scenarios: {
    bull: ScenarioData
    base: ScenarioData
    bear: ScenarioData
  } | null
  // quality grid
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ratings: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scores: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessProfile: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cagrAnalysis: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statementsData: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valuationMethods?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote?: any
  analystTargetMean?: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userModelFairValue?: number | null
  // callbacks
  onViewValuation: () => void
  onViewRisks: () => void
  onViewAssumptions: () => void
  analystRecommendation?: string
}

// ─── main export ──────────────────────────────────────────────────────────────

export default function SummaryTab({
  ticker, currency, sector,
  price, change: _change, changePct: _changePct, high52, low52,
  fairValue, upsidePct, confidence, modelCount, totalModels,
  sharesM, cashM, debtM, revenueM, fcfMargin,
  wacc, terminalG, historicalCAGR, analystCAGR, isEmergingMarket, revenueHistory,
  scenarios, ratings, scores, businessProfile, cagrAnalysis, statementsData,
  valuationMethods, quote, analystTargetMean, userModelFairValue,
  onViewValuation, onViewRisks, onViewAssumptions, analystRecommendation,
}: SummaryTabProps) {

  const rdcfResult = useMemo(() => computeReverseDCF({
    currentPrice: price,
    sharesOutstanding: sharesM != null ? sharesM * 1e6 : null,
    cashM,
    debtM,
    lastRevenue:   revenueM != null ? revenueM * 1e6 : null,
    lastFCFMargin: fcfMargin,
    wacc,
    terminalG,
    historicalCAGR,
  }), [price, sharesM, cashM, debtM, revenueM, fcfMargin, wacc, terminalG, historicalCAGR])

  const isFinancialSector = ['Financial Services', 'Banks', 'Insurance', 'Financial'].includes(sector)

  const drivers: string[] = cagrAnalysis?.drivers ?? []

  return (
    <div className="flex flex-col gap-4">

      {/* ── Row 0: Company identity ───────────────────────────────────────── */}
      {businessProfile?.description && (
        <CompanyCard
          description={businessProfile.description}
          sector={sector}
          industry={businessProfile.industry ?? ''}
          country={businessProfile.country ?? ''}
          employees={businessProfile.employees ?? null}
          ticker={ticker}
        />
      )}

      {/* ── Zone 1: Verdict — hero + price chart, equal columns ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <SummaryHeroCard
          ticker={ticker}
          price={price}
          currency={currency}
          fairValue={fairValue}
          upsidePct={upsidePct}
          confidence={confidence}
          modelCount={modelCount}
          totalModels={totalModels}
          scenarios={scenarios}
          drivers={drivers}
          onViewValuation={onViewValuation}
        />
        <SummaryPriceChartCard
          ticker={ticker}
          fairValue={fairValue}
          analystTargetMean={analystTargetMean ?? null}
          userModelFairValue={userModelFairValue ?? null}
          high52={high52}
          low52={low52}
          marketCap={quote?.marketCap ?? null}
          beta={quote?.beta ?? null}
          currency={currency}
        />
      </div>

      {/* ── Zone 2: What the price assumes ───────────────────────────────── */}
      <div className="rounded-[20px] bg-[#F8FAFC] border border-[#E6ECF5] p-4 sm:p-5">
        <p className="text-[12px] font-[650] text-slate-500 mb-3">What the market is pricing in</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <ReverseDCFCompactCard
            price={price}
            currency={currency}
            sharesM={sharesM}
            cashM={cashM}
            debtM={debtM}
            revenueM={revenueM}
            fcfMargin={fcfMargin}
            wacc={wacc}
            terminalG={terminalG}
            historicalCAGR={historicalCAGR}
            analystCAGR={analystCAGR}
            isEmergingMarket={isEmergingMarket}
            isFinancialSector={isFinancialSector}
            rawBlendedCagr={cagrAnalysis?.rawBlended ?? null}
            cagrCap={cagrAnalysis?.cagrCap ?? null}
            revenueHistory={revenueHistory ?? []}
          />
          <MarketInterpretationCard
            upsidePct={upsidePct}
            confidence={confidence}
            reverseDCFInterpretation={rdcfResult.interpretation}
            reverseDCFText={rdcfResult.interpretationText}
            analystRecommendation={analystRecommendation ?? ''}
            analystTargetMean={analystTargetMean ?? null}
            currency={currency}
          />
        </div>
      </div>

      {/* ── Zone 2.5: Income flow chart ───────────────────────────────────── */}
      {statementsData && (
        <IncomeFlowCard
          statementsData={statementsData}
          currency={currency}
        />
      )}

      {/* ── Zone 3: Business fundamentals panel ──────────────────────────── */}      {ratings && (
        <div className="rounded-[20px] overflow-hidden border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="px-4 sm:px-5 py-3 bg-white border-b border-slate-100">
            <p className="text-[12px] font-[650] text-slate-500">Business fundamentals</p>
          </div>
          <OverviewMetricGrid
            ratings={ratings}
            scores={scores}
            businessProfile={businessProfile}
            cagrAnalysis={cagrAnalysis}
            statementsData={statementsData}
            onViewRisks={onViewRisks}
            valuationMethods={valuationMethods}
            quote={quote}
            panel
          />
        </div>
      )}

      {/* ── Zone 4: Bull · Bear · Next steps ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        <BullCaseCard
          drivers={drivers}
          upsidePct={upsidePct}
          onViewDetails={onViewRisks}
        />
        <BearCaseCard
          drivers={drivers}
          upsidePct={upsidePct}
          ratings={ratings}
          onViewDetails={onViewRisks}
        />
        <NextStepsCard
          onViewValuation={onViewValuation}
          onViewAssumptions={onViewAssumptions}
          onViewRisks={onViewRisks}
        />
      </div>

    </div>
  )
}
