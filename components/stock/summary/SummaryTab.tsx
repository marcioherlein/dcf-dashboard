'use client'

import { useMemo } from 'react'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'
import SummaryHeroCard from './SummaryHeroCard'
import SummaryPriceChartCard from './SummaryPriceChartCard'
import ReverseDCFCompactCard from './ReverseDCFCompactCard'
import PriceVsFairValueCard from './PriceVsFairValueCard'
import MarketInterpretationCard from './MarketInterpretationCard'
import BullCaseCard from './BullCaseCard'
import BearCaseCard from './BearCaseCard'
import NextStepsCard from './NextStepsCard'
import OverviewMetricGrid from '@/components/stock/OverviewMetricGrid'
import CompanyCard from '@/components/stock/overview/CompanyCard'

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
  analystRecommendation?: string
}

// ─── main export ──────────────────────────────────────────────────────────────

export default function SummaryTab({
  ticker, currency, sector,
  price, change: _change, changePct: _changePct, high52, low52,
  fairValue, upsidePct, confidence, modelCount, totalModels,
  sharesM, cashM, debtM, revenueM, fcfMargin,
  wacc, terminalG, historicalCAGR, analystCAGR, isEmergingMarket,
  scenarios, ratings, scores, businessProfile, cagrAnalysis, statementsData,
  valuationMethods, quote, analystTargetMean, userModelFairValue,
  onViewValuation, onViewRisks, analystRecommendation,
}: SummaryTabProps) {

  // Compute reverse DCF once here; pass result to both ReverseDCFCompactCard and MarketInterpretationCard
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

  const drivers: string[] = cagrAnalysis?.drivers ?? []

  return (
    <div className="space-y-[14px]">

      {/* ── Row 1: Hero narrative + Price chart ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-[14px]">
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

      {/* ── Row 2: Reverse DCF · Price vs FV · Interpretation ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.9fr)_minmax(190px,1fr)_minmax(0,1.5fr)] gap-[14px]">
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
        />
        <PriceVsFairValueCard
          price={price}
          fairValue={fairValue}
          upsidePct={upsidePct}
          currency={currency}
          analystTargetMean={analystTargetMean ?? null}
        />
        <MarketInterpretationCard
          upsidePct={upsidePct}
          confidence={confidence}
          reverseDCFInterpretation={rdcfResult.interpretation}
          reverseDCFText={rdcfResult.interpretationText}
          analystRecommendation={analystRecommendation ?? ''}
          analystTargetMean={analystTargetMean ?? null}
          currency={currency}
          drivers={drivers}
        />
      </div>

      {/* ── Row 3: Six compact quality cards ──────────────────────────────── */}
      {ratings && (
        <OverviewMetricGrid
          ratings={ratings}
          scores={scores}
          businessProfile={businessProfile}
          cagrAnalysis={cagrAnalysis}
          statementsData={statementsData}
          onViewRisks={onViewRisks}
          valuationMethods={valuationMethods}
          quote={quote}
        />
      )}

      {/* ── Row 4: Bull · Bear · Next steps ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[14px]">
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
          onViewAssumptions={onViewValuation}
          onViewRisks={onViewRisks}
        />
      </div>

      {/* ── Company overview ───────────────────────────────────────────────── */}
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

    </div>
  )
}
