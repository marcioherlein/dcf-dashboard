'use client'

import { useMemo } from 'react'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'
import SummaryHeroCard from './SummaryHeroCard'
import SummaryPriceChartCard from './SummaryPriceChartCard'
import ReverseDCFCompactCard from './ReverseDCFCompactCard'
import BullCaseCard from './BullCaseCard'
import BearCaseCard from './BearCaseCard'
import BusinessPerformanceCard from './BusinessPerformanceCard'
import OverviewMetricGrid from '@/components/stock/OverviewMetricGrid'
import { ETFExposureCard } from './ETFExposureCard'
import PeerValuationChart from './PeerValuationChart'
import QuickStatsBar from '@/components/stock/QuickStatsBar'
import HoldingReturns from '@/components/stock/HoldingReturns'
import InvestmentVerdict from '@/components/stock/InvestmentVerdict'

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
  analystTargetLow?: number | null
  analystTargetHigh?: number | null
  // quick stats bar
  marketCap?: number | null
  peRatio?: number | null
  beta?: number | null
  pegRatio?: number | null
  evToEbitda?: number | null
  dividendYield?: number | null
  nextEarningsDate?: string | null
  // holding returns
  holdingReturns?: {
    stock1y: number | null; stock3y: number | null; stock5y: number | null
    spy1y: number | null;   spy3y: number | null;   spy5y: number | null
  } | null
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
  valuationMethods, quote, analystTargetMean, analystTargetLow: _analystTargetLow, analystTargetHigh: _analystTargetHigh, userModelFairValue,
  marketCap, peRatio, beta, pegRatio, evToEbitda, dividendYield, holdingReturns, nextEarningsDate,
  onViewValuation, onViewRisks, onViewAssumptions: _onViewAssumptions, analystRecommendation,
}: SummaryTabProps) {

  const _rdcfResult = useMemo(() => computeReverseDCF({
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

      {/* ── 1. VERDICT ───────────────────────────────────────────────────────── */}
      {scores && (
        <InvestmentVerdict
          ticker={ticker}
          upsidePct={upsidePct}
          scores={scores}
          analystRecommendation={analystRecommendation}
          fcfMargin={businessProfile?.fcfMargin ?? null}
          grossMargin={businessProfile?.grossMargin ?? null}
          netMargin={businessProfile?.netMargin ?? null}
          revenueCAGR={cagrAnalysis?.historicalCagr3y ?? null}
        />
      )}

      {/* ── 2. VALUATION — hero + price chart, equal columns ─────────────────── */}
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
          analystTargetMean={analystTargetMean ?? null}
          analystRecommendation={analystRecommendation ?? null}
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

      {/* ── 3. MARKET PRICING — what is the price implying? ──────────────────── */}
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

      {/* ── 4. THESIS — bull and bear cases ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
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
      </div>

      {/* ── 5. CONTEXT — market stats bar ────────────────────────────────────── */}
      <QuickStatsBar
        marketCap={marketCap ?? null}
        peRatio={peRatio ?? null}
        beta={beta ?? null}
        high52={high52}
        low52={low52}
        currentPrice={price}
        currency={currency}
        pegRatio={pegRatio ?? null}
        evToEbitda={evToEbitda ?? null}
        dividendYield={dividendYield ?? null}
        nextEarningsDate={nextEarningsDate ?? null}
      />

      {/* ── 6. FUNDAMENTALS — business quality panel ─────────────────────────── */}
      {ratings && (
        <div className="rounded-2xl overflow-hidden border border-[#E5E5E5] shadow-card">
          <div className="px-4 sm:px-5 py-3 bg-white border-b border-[#E5E5E5]">
            <p className="text-[12px] font-[650] text-[#6B6B6B]">Business fundamentals</p>
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

      {/* ── 7. PERFORMANCE — revenue trend + income breakdown ────────────────── */}
      {statementsData && (
        <BusinessPerformanceCard statementsData={statementsData} currency={currency} />
      )}

      {/* ── 8. RELATIVE — peer valuation scatter ─────────────────────────────── */}
      <PeerValuationChart ticker={ticker} isFinancialSector={isFinancialSector} />

      {/* ── 9. EXTRAS — holding returns + ETF exposure ───────────────────────── */}
      {holdingReturns && (
        <HoldingReturns returns={holdingReturns} ticker={ticker} />
      )}
      <ETFExposureCard ticker={ticker} />

    </div>
  )
}
