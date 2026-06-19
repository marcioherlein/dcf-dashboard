'use client'

/**
 * SummaryTabV2 — aggressive density redesign, preview only.
 * Access via /stock/[ticker]?v2=1
 *
 * Key changes vs SummaryTab:
 * - OverviewLayoutV2 replaces OverviewLayout: 6-cell KPI footer, 260px compact sidebar
 * - Fundamentals + Profitability merged into a single 3-col grid
 * - Section gaps reduced: gap-2 sm:gap-3
 * - Section labels removed from between cards (eyebrows inside card headers instead)
 */

import { useMemo } from 'react'
import StockIdentityHeader from './StockIdentityHeader'
import OverviewLayoutV2 from './OverviewLayoutV2'
import RevenueChartCard from './RevenueChartCard'
import FCFChartCard from './FCFChartCard'
// GrowthOutlookCard removed — ReverseDCFCompactCard replaces it in fundamentals right col
import ProfitabilityTextCard from './ProfitabilityTextCard'
import ValuationRatiosCard from './ValuationRatiosCard'
import { ETFExposureCard } from './ETFExposureCard'
import HoldingReturns from '@/components/stock/HoldingReturns'
import InvestmentVerdict from '@/components/stock/InvestmentVerdict'
import ReverseDCFCompactCard from './ReverseDCFCompactCard'
import EpsBeatMissChart, { type EpsSurprise } from '@/components/stock/EpsBeatMissChart'
import AnalystRecommendationsChart, { type RatingPeriod } from '@/components/stock/AnalystRecommendationsChart'
import PeerValuationChart from './PeerValuationChart'
import { computeConvictionScore } from '@/lib/stock/computeConvictionScore'
import { computeVerdict } from '@/lib/verdict/computeVerdict'

// ─── Re-use exact same Props type as SummaryTab ───────────────────────────────
// (duplicated here to keep V2 self-contained without coupling to SummaryTab internals)

interface ScenarioData {
  fairValue: number; wacc: number; cagr: number; terminalG: number
}

interface SummaryTabV2Props {
  ticker: string; companyName: string
  description?: string; industry?: string; country?: string; employees?: number | null
  price: number; change: number; changePct: number; currency: string
  high52: number; low52: number; sector: string
  fairValue: number | null; upsidePct: number | null
  sharesM: number | null; cashM: number | null; debtM: number | null
  revenueM: number | null; fcfMargin: number | null; wacc: number; terminalG: number
  historicalCAGR: number | null; analystCAGR: number | null; isEmergingMarket?: boolean
  revenueHistory?: Array<{ year: string; revenue: number | null; isProjected: boolean }>
  scenarios: { bull: ScenarioData; base: ScenarioData; bear: ScenarioData } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ratings: any; scores: any; businessProfile: any; cagrAnalysis: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statementsData: any; valuationMethods?: any; quote?: any
  analystTargetMean?: number | null; analystTargetLow?: number | null; analystTargetHigh?: number | null
  ratiosQuarterly?: Array<{ date: string; priceEarningsRatio: number | null; enterpriseValueMultiple: number | null; evToSales: number | null; priceToBookRatio: number | null }>
  historicalMultiples?: Array<{ fiscalYear: string; pe: number | null; evEbitda: number | null; evRevenue: number | null }>
  marketCap?: number | null; peRatio?: number | null; beta?: number | null
  pegRatio?: number | null; evToEbitda?: number | null; dividendYield?: number | null
  nextEarningsDate?: string | null; analystForwardPE?: number | null
  holdingReturns?: { stock1y: number|null; stock3y: number|null; stock5y: number|null; spy1y: number|null; spy3y: number|null; spy5y: number|null } | null
  userModelFairValue?: number | null
  onViewValuation: () => void; onViewFinancials?: () => void
  onViewConviction: () => void; onViewAssumptions: () => void
  analystRecommendation?: string
  analystForwardEstimates?: Array<{ period: string; eps?: { growth?: number|null }|null; revenue?: { growth?: number|null }|null }>
  roe?: number | null; roic?: number | null
  ownership?: { insiderPct: number|null; shortPct: number|null } | null
  earningsSurprises?: EpsSurprise[]
  analystRatingTrend?: RatingPeriod[]
}

// ─── Eyebrow section label (used sparingly, inside cards) ─────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-[700] uppercase tracking-[0.08em] text-[#9B9B9B] mb-2">{children}</p>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SummaryTabV2({
  ticker, companyName, currency, sector,
  description, industry, country,
  price, change, changePct, high52, low52,
  fairValue, upsidePct,
  sharesM, cashM, debtM, revenueM, fcfMargin: fcfMarginProp,
  wacc, terminalG, historicalCAGR, analystCAGR, isEmergingMarket,
  revenueHistory,
  ratings, scores, businessProfile, cagrAnalysis, statementsData,
  valuationMethods, quote, analystTargetMean,
  analystTargetLow: _analystTargetLow, analystTargetHigh: _analystTargetHigh,
  ratiosQuarterly, historicalMultiples,
  userModelFairValue,
  marketCap, peRatio, beta, pegRatio: _pegRatio, evToEbitda, dividendYield: _dividendYield,
  holdingReturns,
  nextEarningsDate: _nextEarningsDate,
  onViewValuation: _onViewValuation, onViewFinancials: _onViewFinancials, onViewConviction: _onViewConviction,
  onViewAssumptions: _onViewAssumptions, analystRecommendation,
  analystForwardEstimates, analystForwardPE, roe, roic, ownership, earningsSurprises, analystRatingTrend,
}: SummaryTabV2Props) {

  const isFinancialSector = ['Financial Services', 'Banks', 'Insurance', 'Financial'].includes(sector)

  const epsGrowthFwd = useMemo(
    () => analystForwardEstimates?.find((e) => e.period === '+1y')?.eps?.growth ?? null,
    [analystForwardEstimates],
  )

  const conviction = useMemo(() => {
    if (!ratings || !scores) return null
    const verdictResult = computeVerdict({
      ticker, upsidePct: upsidePct ?? null, roic: scores?.roic ?? null,
      analystRecommendation: analystRecommendation ?? null,
      piotroski: scores?.piotroski ?? null, altman: scores?.altman ?? null,
      beneish: scores?.beneish ?? null, fcfMargin: businessProfile?.fcfMargin ?? null,
      grossMargin: businessProfile?.grossMargin ?? null, netMargin: businessProfile?.netMargin ?? null,
      revenueCAGR: cagrAnalysis?.historicalCagr3y ?? null,
    })
    return computeConvictionScore({
      ratings, verdict: verdictResult, piotroski: scores?.piotroski ?? null,
      altman: scores?.altman ?? null, beneish: scores?.beneish ?? null,
      riskDimensions: [], upsidePct: upsidePct ?? null, ticker,
    })
  }, [ratings, scores, upsidePct, analystRecommendation, businessProfile, cagrAnalysis, ticker])

  return (
    <div className="flex flex-col gap-2 sm:gap-3">

      {/* ── 1. HERO — identity + price ──────────────────────────────────────── */}
      <StockIdentityHeader
        ticker={ticker} companyName={companyName} description={description}
        sector={sector} industry={industry} country={country} employees={undefined}
        currency={currency} price={price} change={change} changePct={changePct}
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
        marketCap={marketCap ?? null} peRatio={peRatio ?? null}
        evToEbitda={evToEbitda ?? null} roe={roe ?? null} roic={roic ?? null}
        beta={beta ?? null} dividendYield={_dividendYield ?? null}
        fcfMargin={businessProfile?.fcfMargin ?? null}
        grossMargin={businessProfile?.grossMargin ?? null}
        netMargin={businessProfile?.netMargin ?? null}
        high52={high52} low52={low52}
        nextEarningsDate={_nextEarningsDate ?? null}
        revenueGrowth={cagrAnalysis?.historicalCagr3y ?? null}
        forwardPE={analystForwardPE ?? null}
        pegRatioValue={quote?.pegRatio ?? null}
        peHistory={undefined} evHistory={undefined}
        earningsSurprises={earningsSurprises ?? null}
        onViewValuation={_onViewValuation}
        onViewConviction={_onViewConviction}
      />

      {/* ── 2. CHART + 6-CELL KPI + COMPACT SIDEBAR ─────────────────────────── */}
      <OverviewLayoutV2
        ticker={ticker} currency={currency}
        price={price} change={change} changePct={changePct}
        high52={high52} low52={low52}
        fairValue={fairValue}
        analystTargetMean={analystTargetMean ?? null}
        userModelFairValue={userModelFairValue ?? null}
        marketCap={marketCap ?? null}
        peRatio={peRatio ?? null} forwardPE={analystForwardPE ?? null}
        pegRatioValue={quote?.pegRatio ?? null}
        beta={beta ?? null} evToEbitda={evToEbitda ?? null}
        revenueGrowth={cagrAnalysis?.historicalCagr3y ?? null}
        grossMargin={businessProfile?.grossMargin ?? null}
        fcfMargin={businessProfile?.fcfMargin ?? null}
        roic={roic ?? null}
      />

      {/* ── FUNDAMENTALS + PROFITABILITY ─────────────────────────────────────── */}
      {/* Right col now uses ReverseDCF (replaces GrowthOutlook to eliminate white space) */}
      <div className="bg-white rounded-xl border border-[#E3E1DA] overflow-hidden"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="px-3 pt-3 pb-2 border-b border-[#F5F5F5]">
          <Eyebrow>Fundamentals &amp; Profitability</Eyebrow>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[#F5F5F5]">
          {/* Left: Revenue stacked above FCF */}
          <div className="divide-y divide-[#F5F5F5]">
            <div className="p-3">
              {statementsData && (
                <RevenueChartCard statementsData={statementsData} currency={currency} chartHeight={200} barCategoryGap="8%" />
              )}
            </div>
            <div className="p-3">
              {statementsData && (
                <FCFChartCard statementsData={statementsData} currency={currency} chartHeight={200} barCategoryGap="8%" />
              )}
            </div>
          </div>
          {/* Right: ReverseDCF (fills space tightly) + Profitability */}
          <div className="p-3 flex flex-col gap-3">
            <ReverseDCFCompactCard
              price={price} currency={currency}
              sharesM={sharesM} cashM={cashM} debtM={debtM} revenueM={revenueM}
              fcfMargin={fcfMarginProp ?? businessProfile?.fcfMargin ?? null}
              wacc={wacc} terminalG={terminalG}
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
            <ProfitabilityTextCard
              grossMargin={businessProfile?.grossMargin}
              netMargin={businessProfile?.netMargin}
              fcfMargin={businessProfile?.fcfMargin}
              roe={roe ?? null} roic={roic ?? null}
              ratingsGrade={ratings?.overall?.grade}
              ratingsSummary={ratings?.overall?.summary}
              ratingsLabel={ratings?.overall?.label}
              cagrDrivers={cagrAnalysis?.drivers}
            />
          </div>
        </div>
      </div>

      {/* ── MARKET SIGNALS ───────────────────────────────────────────────────── */}
      {(earningsSurprises?.length || analystRatingTrend?.length) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 items-stretch">
          {earningsSurprises && earningsSurprises.length > 0 && (
            <EpsBeatMissChart surprises={earningsSurprises} currency={currency} epsGrowthYoy={cagrAnalysis?.epsGrowthYoy ?? null} />
          )}
          {analystRatingTrend && analystRatingTrend.length > 0 && (
            <AnalystRecommendationsChart
              trend={analystRatingTrend} numAnalysts={quote?.numAnalysts ?? null}
              currentPrice={price} targetMean={analystTargetMean ?? null}
              targetLow={_analystTargetLow ?? null} targetHigh={_analystTargetHigh ?? null}
              currency={currency}
            />
          )}
        </div>
      )}

      {/* ── PEER COMPARISON + ETF EXPOSURE — same row ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 items-stretch">
        <PeerValuationChart ticker={ticker} isFinancialSector={isFinancialSector} />
        <ETFExposureCard ticker={ticker} />
      </div>

      {/* ── VALUATION RATIOS + IF YOU HAD HELD — same row ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 items-stretch">
        <ValuationRatiosCard
          estimates={valuationMethods?.models?.multiples?.estimates}
          pegRatio={quote?.pegRatio} peRatio={peRatio} sector={sector}
          ratiosQuarterly={ratiosQuarterly} historicalMultiples={historicalMultiples}
          epsGrowthFwd={epsGrowthFwd} analystForwardPE={analystForwardPE ?? null}
        />
        {holdingReturns ? (
          <HoldingReturns returns={holdingReturns} ticker={ticker} />
        ) : (
          <div />
        )}
      </div>

      {/* ── 9. INVESTMENT CHECKLIST ─────────────────────────────────────────── */}
      {scores && (
        <InvestmentVerdict
          ticker={ticker} upsidePct={upsidePct} scores={scores}
          analystRecommendation={analystRecommendation ?? null}
          fcfMargin={businessProfile?.fcfMargin ?? null}
          grossMargin={businessProfile?.grossMargin ?? null}
          netMargin={businessProfile?.netMargin ?? null}
          revenueCAGR={cagrAnalysis?.historicalCagr3y ?? null}
          pegRatio={quote?.pegRatio ?? null}
          epsGrowthFwd={epsGrowthFwd}
          currentPrice={price} high52={high52} low52={low52}
          insiderPct={ownership?.insiderPct ?? null}
          shortPct={ownership?.shortPct ?? null}
          analystTargetMean={analystTargetMean ?? null}
          conviction={conviction}
        />
      )}

    </div>
  )
}
