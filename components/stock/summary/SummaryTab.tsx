'use client'

import { useMemo } from 'react'
import StockIdentityHeader from './StockIdentityHeader'
import RevenueChartCard from './RevenueChartCard'
import FCFChartCard from './FCFChartCard'
import GrowthOutlookCard from './GrowthOutlookCard'
import CashConversionCard from './CashConversionCard'
import ProfitabilityChartCard from './ProfitabilityChartCard'
import ProfitabilityTextCard from './ProfitabilityTextCard'
import PeerValuationChart from './PeerValuationChart'
import ValuationRatiosCard from './ValuationRatiosCard'
import { ETFExposureCard } from './ETFExposureCard'
import HoldingReturns from '@/components/stock/HoldingReturns'
import IncomeFlowCard from './IncomeFlowCard'
import InvestmentVerdict from '@/components/stock/InvestmentVerdict'
import ReverseDCFCompactCard from './ReverseDCFCompactCard'
import { computeConvictionScore } from '@/lib/stock/computeConvictionScore'
import { computeVerdict } from '@/lib/verdict/computeVerdict'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioData {
  fairValue: number
  wacc: number
  cagr: number
  terminalG: number
}

interface SummaryTabProps {
  ticker: string
  companyName: string
  // company identity
  description?: string
  industry?: string
  country?: string
  employees?: number | null
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
  // historical multiples for sparkline charts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ratiosQuarterly?: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  historicalMultiples?: any[]
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
  userModelFairValue?: number | null
  // callbacks
  onViewValuation: () => void
  onViewFinancials?: () => void
  onViewConviction: () => void
  onViewAssumptions: () => void
  analystRecommendation?: string
  // new props
  analystForwardEstimates?: Array<{
    period: string
    eps?: { growth?: number | null } | null
    revenue?: { growth?: number | null } | null
  }>
  roe?: number | null
  roic?: number | null
  ownership?: { insiderPct: number | null; shortPct: number | null } | null
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-[700] text-[#566174] uppercase tracking-wider px-0.5">
      {children}
    </h2>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SummaryTab({
  ticker, companyName, currency, sector,
  description, industry, country, employees,
  price, change, changePct, high52, low52,
  fairValue, upsidePct,
  sharesM, cashM, debtM, revenueM, fcfMargin: fcfMarginProp,
  wacc, terminalG, historicalCAGR, analystCAGR, isEmergingMarket,
  revenueHistory,
  scenarios: _scenarios, ratings, scores, businessProfile, cagrAnalysis, statementsData,
  valuationMethods, quote, analystTargetMean,
  ratiosQuarterly, historicalMultiples,
  analystTargetLow: _analystTargetLow, analystTargetHigh: _analystTargetHigh,
  userModelFairValue,
  marketCap, peRatio, beta, pegRatio: _pegRatio, evToEbitda, dividendYield,
  holdingReturns,
  nextEarningsDate: _nextEarningsDate,
  onViewValuation: _onViewValuation, onViewFinancials: _onViewFinancials, onViewConviction: _onViewConviction,
  onViewAssumptions: _onViewAssumptions, analystRecommendation,
  analystForwardEstimates, roe, roic, ownership,
}: SummaryTabProps) {

  const isFinancialSector = ['Financial Services', 'Banks', 'Insurance', 'Financial'].includes(sector)

  // Extract forward EPS growth for next 1Y from analystForwardEstimates
  const epsGrowthFwd = useMemo(
    () => analystForwardEstimates?.find((e) => e.period === '+1y')?.eps?.growth ?? null,
    [analystForwardEstimates],
  )

  // Conviction Score — synthesizes all signals into a single 0–100 score
  const conviction = useMemo(() => {
    if (!ratings || !scores) return null
    const verdictResult = computeVerdict({
      ticker,
      upsidePct: upsidePct ?? null,
      roic: scores?.roic ?? null,
      analystRecommendation: analystRecommendation ?? null,
      piotroski: scores?.piotroski ?? null,
      altman: scores?.altman ?? null,
      beneish: scores?.beneish ?? null,
      fcfMargin: businessProfile?.fcfMargin ?? null,
      grossMargin: businessProfile?.grossMargin ?? null,
      netMargin: businessProfile?.netMargin ?? null,
      revenueCAGR: cagrAnalysis?.historicalCagr3y ?? null,
    })
    return computeConvictionScore({
      ratings,
      verdict: verdictResult,
      piotroski: scores?.piotroski ?? null,
      altman: scores?.altman ?? null,
      beneish: scores?.beneish ?? null,
      riskDimensions: [],
      upsidePct: upsidePct ?? null,
      ticker,
    })
  }, [ratings, scores, upsidePct, analystRecommendation, businessProfile, cagrAnalysis, ticker])

  return (
    <div className="flex flex-col gap-5">

      {/* ── 1. STOCK IDENTITY HEADER (Sections A + B) ───────────────────────── */}
      <StockIdentityHeader
        ticker={ticker}
        companyName={companyName}
        description={description}
        sector={sector}
        industry={industry}
        country={country}
        employees={employees}
        currency={currency}
        price={price}
        change={change}
        changePct={changePct}
        marketState={quote?.marketState ?? null}
        preMarketPrice={quote?.preMarketPrice ?? null}
        preMarketChangePct={quote?.preMarketChangePct ?? null}
        postMarketPrice={quote?.postMarketPrice ?? null}
        postMarketChangePct={quote?.postMarketChangePct ?? null}
        fairValue={fairValue}
        analystTargetMean={analystTargetMean ?? null}
        userModelFairValue={userModelFairValue ?? null}
        marketCap={marketCap ?? null}
        peRatio={peRatio ?? null}
        evToEbitda={evToEbitda ?? null}
        roe={roe ?? null}
        roic={roic ?? null}
        beta={beta ?? null}
        dividendYield={dividendYield ?? null}
        fcfMargin={businessProfile?.fcfMargin ?? null}
        grossMargin={businessProfile?.grossMargin ?? null}
        netMargin={businessProfile?.netMargin ?? null}
        high52={high52}
        low52={low52}
      />

      {/* ── 2. FUNDAMENTALS SECTION LABEL ──────────────────────────────────── */}
      <SectionLabel>Fundamentals</SectionLabel>

      {/* ── 3. 2-COL: [Revenue + FCF stacked] | [Growth Outlook + Cash Conversion stacked] */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Left col: Revenue chart + FCF chart stacked */}
        <div className="flex flex-col gap-4">
          {statementsData && (
            <RevenueChartCard statementsData={statementsData} currency={currency} />
          )}
          {statementsData && (
            <FCFChartCard statementsData={statementsData} currency={currency} />
          )}
        </div>

        {/* Right col: Growth Outlook + Cash Conversion stacked */}
        <div className="flex flex-col gap-4">
          <GrowthOutlookCard
            historicalCagr3y={cagrAnalysis?.historicalCagr3y}
            analystEstimate1y={cagrAnalysis?.analystEstimate1y}
            epsGrowthFwd={epsGrowthFwd}
            drivers={cagrAnalysis?.drivers}
          />
          <CashConversionCard
            fcfMargin={businessProfile?.fcfMargin}
            statementsData={statementsData}
          />
        </div>
      </div>

      {/* ── 4. REVERSE DCF — What the market is pricing in (full width) ─────── */}
      <ReverseDCFCompactCard
        price={price}
        currency={currency}
        sharesM={sharesM}
        cashM={cashM}
        debtM={debtM}
        revenueM={revenueM}
        fcfMargin={fcfMarginProp ?? businessProfile?.fcfMargin ?? null}
        wacc={wacc}
        terminalG={terminalG}
        historicalCAGR={historicalCAGR ?? cagrAnalysis?.historicalCagr3y ?? null}
        analystCAGR={analystCAGR ?? cagrAnalysis?.analystEstimate1y ?? null}
        isEmergingMarket={isEmergingMarket}
        isFinancialSector={isFinancialSector}
        revenueHistory={revenueHistory}
      />

      {/* ── 5. 2×2 GRID: Profitability chart | Profitability text | Peer valuation | Valuation ratios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        <ProfitabilityChartCard
          statementsData={statementsData}
        />
        <ProfitabilityTextCard
          grossMargin={businessProfile?.grossMargin}
          netMargin={businessProfile?.netMargin}
          fcfMargin={businessProfile?.fcfMargin}
          roe={roe ?? null}
          roic={roic ?? null}
          ratingsGrade={ratings?.overall?.grade}
          ratingsSummary={ratings?.overall?.summary}
          ratingsLabel={ratings?.overall?.label}
          cagrDrivers={cagrAnalysis?.drivers}
        />
        <PeerValuationChart ticker={ticker} isFinancialSector={isFinancialSector} />
        <ValuationRatiosCard
          estimates={valuationMethods?.models?.multiples?.estimates}
          pegRatio={quote?.pegRatio}
          peRatio={peRatio}
          sector={sector}
          ratiosQuarterly={ratiosQuarterly}
          historicalMultiples={historicalMultiples}
        />
      </div>

      {/* ── 5. 2-COL: ETF Exposure | Holding Returns (if present) ──────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <ETFExposureCard ticker={ticker} />
        {holdingReturns && (
          <HoldingReturns returns={holdingReturns} ticker={ticker} />
        )}
      </div>

      {/* ── 6. INCOME FLOW CARD (Sankey, full width) ────────────────────────── */}
      {statementsData && (
        <IncomeFlowCard statementsData={statementsData} currency={currency} />
      )}

      {/* ── 7. INVESTMENT VERDICT (expanded checklist, full width) ──────────── */}
      {scores && (
        <InvestmentVerdict
          ticker={ticker}
          upsidePct={upsidePct}
          scores={scores}
          analystRecommendation={analystRecommendation ?? null}
          fcfMargin={businessProfile?.fcfMargin ?? null}
          grossMargin={businessProfile?.grossMargin ?? null}
          netMargin={businessProfile?.netMargin ?? null}
          revenueCAGR={cagrAnalysis?.historicalCagr3y ?? null}
          pegRatio={quote?.pegRatio ?? null}
          epsGrowthFwd={epsGrowthFwd}
          currentPrice={price}
          high52={high52}
          low52={low52}
          insiderPct={ownership?.insiderPct ?? null}
          shortPct={ownership?.shortPct ?? null}
          analystTargetMean={analystTargetMean ?? null}
          conviction={conviction}
        />
      )}

    </div>
  )
}
