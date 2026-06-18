'use client'

import { useMemo } from 'react'
import StockIdentityHeader from './StockIdentityHeader'
import OverviewLayout from './OverviewLayout'
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
import EpsBeatMissChart, { type EpsSurprise } from '@/components/stock/EpsBeatMissChart'
import AnalystRecommendationsChart, { type RatingPeriod } from '@/components/stock/AnalystRecommendationsChart'
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
  analystForwardPE?: number | null
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
  earningsSurprises?: EpsSurprise[]
  analystRatingTrend?: RatingPeriod[]
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-0.5 h-4 rounded-full" style={{ background: 'linear-gradient(to bottom, #334155, #475569)' }} aria-hidden="true" />
      <h2 className="text-[11px] font-[700] text-[#334155] uppercase tracking-wider">
        {children}
      </h2>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SummaryTab({
  ticker, companyName, currency, sector,
  description, industry, country, employees: _employees,
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
  marketCap, peRatio, beta, pegRatio: _pegRatio, evToEbitda, dividendYield: _dividendYield,
  holdingReturns,
  nextEarningsDate: _nextEarningsDate,
  onViewValuation: _onViewValuation, onViewFinancials: _onViewFinancials, onViewConviction: _onViewConviction,
  onViewAssumptions: _onViewAssumptions, analystRecommendation,
  analystForwardEstimates, analystForwardPE, roe, roic, ownership, earningsSurprises, analystRatingTrend,
}: SummaryTabProps) {

  const isFinancialSector = ['Financial Services', 'Banks', 'Insurance', 'Financial'].includes(sector)

  // Build sparkline series from quarterly ratios for the metrics panel
  const _peSparkline = useMemo(() => {
    const rq = (ratiosQuarterly ?? []) as Array<{ date: string; priceEarningsRatio?: number | null }>
    return [...rq]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map(r => r.priceEarningsRatio)
      .filter((v): v is number => v != null && isFinite(v) && v > 0 && v < 500)
  }, [ratiosQuarterly])

  const _evSparkline = useMemo(() => {
    const rq = (ratiosQuarterly ?? []) as Array<{ date: string; enterpriseValueMultiple?: number | null }>
    return [...rq]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map(r => r.enterpriseValueMultiple)
      .filter((v): v is number => v != null && isFinite(v) && v > 0 && v < 150)
  }, [ratiosQuarterly])

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
    <div className="flex flex-col gap-3 sm:gap-5">

      {/* ── 1. HERO CARD — company identity, price, model estimate, analyst target ── */}
      <StockIdentityHeader
        ticker={ticker}
        companyName={companyName}
        description={description}
        sector={sector}
        industry={industry}
        country={country}
        employees={undefined}
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
        analystTargetLow={_analystTargetLow ?? null}
        analystTargetHigh={_analystTargetHigh ?? null}
        numAnalysts={quote?.numAnalysts ?? null}
        userModelFairValue={userModelFairValue ?? null}
        marketCap={marketCap ?? null}
        peRatio={peRatio ?? null}
        evToEbitda={evToEbitda ?? null}
        roe={roe ?? null}
        roic={roic ?? null}
        beta={beta ?? null}
        dividendYield={_dividendYield ?? null}
        fcfMargin={businessProfile?.fcfMargin ?? null}
        grossMargin={businessProfile?.grossMargin ?? null}
        netMargin={businessProfile?.netMargin ?? null}
        high52={high52}
        low52={low52}
        nextEarningsDate={_nextEarningsDate ?? null}
        revenueGrowth={cagrAnalysis?.historicalCagr3y ?? null}
        forwardPE={analystForwardPE ?? null}
        pegRatioValue={quote?.pegRatio ?? null}
        peHistory={undefined}
        evHistory={undefined}
        earningsSurprises={earningsSurprises ?? null}
        onViewValuation={_onViewValuation}
        onViewConviction={_onViewConviction}
      />

      {/* ── 2. CHART + SNAPSHOT RAIL ────────────────────────────────────────── */}
      {/* Right rail: ValuationSnapshot + QualitySnapshot + TradingRange */}
      {/* (52W Range, P/E, Gross Margin etc shown only here — not in hero sidebar) */}
      <OverviewLayout
        ticker={ticker}
        companyName={companyName}
        currency={currency}
        price={price}
        change={change}
        changePct={changePct}
        high52={high52}
        low52={low52}
        fairValue={fairValue}
        analystTargetMean={analystTargetMean ?? null}
        userModelFairValue={userModelFairValue ?? null}
        marketCap={marketCap ?? null}
        peRatio={peRatio ?? null}
        forwardPE={analystForwardPE ?? null}
        pegRatioValue={quote?.pegRatio ?? null}
        beta={beta ?? null}
        evToEbitda={evToEbitda ?? null}
        revenueGrowth={cagrAnalysis?.historicalCagr3y ?? null}
        grossMargin={businessProfile?.grossMargin ?? null}
        fcfMargin={businessProfile?.fcfMargin ?? null}
        roic={roic ?? null}
      />

      {/* ── 3. WHAT THE MARKET IS PRICING IN (Reverse DCF — full width) ─────── */}
      {/* Placed directly after the chart so valuation context is immediately clear */}
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
        analystCAGR2y={cagrAnalysis?.analystEstimate2y ?? null}
        fundamentalGrowth={cagrAnalysis?.fundamentalGrowth ?? null}
        blendedCAGR={cagrAnalysis?.blended ?? null}
        epsGrowthFwd={epsGrowthFwd}
        numAnalysts={cagrAnalysis?.numAnalysts ?? null}
        isEmergingMarket={isEmergingMarket}
        isFinancialSector={isFinancialSector}
        revenueHistory={revenueHistory}
      />

      {/* ── 4. FUNDAMENTALS ──────────────────────────────────────────────────── */}
      <SectionLabel>Fundamentals</SectionLabel>

      {/* Revenue + FCF | Growth Outlook + Cash Conversion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
        <div className="flex flex-col gap-4">
          {statementsData && <RevenueChartCard statementsData={statementsData} currency={currency} />}
          {statementsData && <FCFChartCard statementsData={statementsData} currency={currency} />}
        </div>
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

      {/* ── 5. PROFITABILITY ─────────────────────────────────────────────────── */}
      <SectionLabel>Profitability</SectionLabel>

      {/* Chart + text side by side — both about the same topic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-stretch">
        <ProfitabilityChartCard statementsData={statementsData} />
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
      </div>

      {/* Income flow waterfall — same section, full width */}
      {statementsData && (
        <IncomeFlowCard statementsData={statementsData} currency={currency} />
      )}

      {/* ── 6. VALUATION ANALYSIS ────────────────────────────────────────────── */}
      <SectionLabel>Valuation Analysis</SectionLabel>

      <ValuationRatiosCard
        estimates={valuationMethods?.models?.multiples?.estimates}
        pegRatio={quote?.pegRatio}
        peRatio={peRatio}
        sector={sector}
        ratiosQuarterly={ratiosQuarterly}
        historicalMultiples={historicalMultiples}
        epsGrowthFwd={epsGrowthFwd}
        analystForwardPE={analystForwardPE ?? null}
      />

      {/* ── 7. MARKET SIGNALS ────────────────────────────────────────────────── */}
      <SectionLabel>Market Signals</SectionLabel>

      {/* EPS Beat/Miss + Analyst Recommendations — only render when data exists */}
      {(earningsSurprises?.length || analystRatingTrend?.length) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
          {earningsSurprises && earningsSurprises.length > 0 && (
            <EpsBeatMissChart
              surprises={earningsSurprises}
              currency={currency}
              epsGrowthYoy={cagrAnalysis?.epsGrowthYoy ?? null}
            />
          )}
          {analystRatingTrend && analystRatingTrend.length > 0 && (
            <AnalystRecommendationsChart
              trend={analystRatingTrend}
              numAnalysts={quote?.numAnalysts ?? null}
              currentPrice={price}
              targetMean={null}
              targetLow={null}
              targetHigh={null}
              currency={currency}
            />
          )}
        </div>
      ) : null}

      {/* Peer valuation — only when signals section has context */}
      <PeerValuationChart ticker={ticker} isFinancialSector={isFinancialSector} />

      {/* ── 8. CONTEXT ───────────────────────────────────────────────────────── */}
      {/* ETF exposure + holding returns — additional context, not primary analysis */}
      {(holdingReturns) && (
        <HoldingReturns returns={holdingReturns} ticker={ticker} />
      )}

      {/* ETF exposure guarded — only render when it has data to show */}
      <ETFExposureCard ticker={ticker} />

      {/* ── 9. INVESTMENT CHECKLIST ──────────────────────────────────────────── */}
      <SectionLabel>Investment Checklist</SectionLabel>

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
