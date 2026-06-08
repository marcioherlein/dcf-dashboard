'use client'

import { useMemo } from 'react'
import { ArrowRight, TrendingUp, BarChart3, FileText } from 'lucide-react'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'
import SummaryHeroCard from './SummaryHeroCard'
import SummaryPriceChartCard from './SummaryPriceChartCard'
import ReverseDCFCompactCard from './ReverseDCFCompactCard'
import BullCaseCard from './BullCaseCard'
import BearCaseCard from './BearCaseCard'
import BusinessPerformanceCard from './BusinessPerformanceCard'
import { ETFExposureCard } from './ETFExposureCard'
import PeerValuationChart from './PeerValuationChart'
import QuickStatsBar from '@/components/stock/QuickStatsBar'
import HoldingReturns from '@/components/stock/HoldingReturns'
import InvestmentVerdict from '@/components/stock/InvestmentVerdict'
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
  onViewFinancials?: () => void
  onViewRisks: () => void
  onViewAssumptions: () => void
  analystRecommendation?: string
}

// ─── Tab crosslink row ────────────────────────────────────────────────────────

function TabNavRow({
  onViewValuation,
  onViewFinancials,
  onViewRisks,
}: {
  onViewValuation: () => void
  onViewFinancials?: () => void
  onViewRisks: () => void
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <button
        onClick={onViewValuation}
        className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 hover:border-[#BFD2A1] hover:bg-[#F6FAEA] transition-colors group min-h-[52px]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 size={14} className="text-[#5F790B] shrink-0" />
          <span className="text-[13px] font-semibold text-[#111111] truncate">Valuation</span>
        </div>
        <ArrowRight size={13} className="text-[#9B9B9B] group-hover:text-[#5F790B] shrink-0 transition-colors" />
      </button>

      {onViewFinancials && (
        <button
          onClick={onViewFinancials}
          className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 hover:border-[#BFD2A1] hover:bg-[#F6FAEA] transition-colors group min-h-[52px]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={14} className="text-[#5F790B] shrink-0" />
            <span className="text-[13px] font-semibold text-[#111111] truncate">Financials</span>
          </div>
          <ArrowRight size={13} className="text-[#9B9B9B] group-hover:text-[#5F790B] shrink-0 transition-colors" />
        </button>
      )}

      <button
        onClick={onViewRisks}
        className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 hover:border-[#BFD2A1] hover:bg-[#F6FAEA] transition-colors group min-h-[52px]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp size={14} className="text-[#5F790B] shrink-0" />
          <span className="text-[13px] font-semibold text-[#111111] truncate">Risks</span>
        </div>
        <ArrowRight size={13} className="text-[#9B9B9B] group-hover:text-[#5F790B] shrink-0 transition-colors" />
      </button>
    </div>
  )
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9B9B9B] px-0.5">
      {children}
    </h2>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────

export default function SummaryTab({
  ticker, currency, sector,
  description, industry, country, employees,
  price, change: _change, changePct: _changePct, high52, low52,
  fairValue, upsidePct, confidence, modelCount, totalModels,
  sharesM, cashM, debtM, revenueM, fcfMargin,
  wacc, terminalG, historicalCAGR, analystCAGR, isEmergingMarket, revenueHistory,
  scenarios, ratings, scores, businessProfile, cagrAnalysis, statementsData,
  valuationMethods: _valuationMethods, quote, analystTargetMean, analystTargetLow: _analystTargetLow,
  analystTargetHigh: _analystTargetHigh, userModelFairValue,
  marketCap, peRatio, beta, pegRatio, evToEbitda, dividendYield, holdingReturns,
  nextEarningsDate, onViewValuation, onViewFinancials, onViewRisks,
  onViewAssumptions: _onViewAssumptions, analystRecommendation,
}: SummaryTabProps) {

  const _rdcfResult = useMemo(() => computeReverseDCF({
    currentPrice: price,
    sharesOutstanding: sharesM != null ? sharesM * 1e6 : null,
    cashM, debtM,
    lastRevenue:   revenueM != null ? revenueM * 1e6 : null,
    lastFCFMargin: fcfMargin,
    wacc, terminalG, historicalCAGR,
  }), [price, sharesM, cashM, debtM, revenueM, fcfMargin, wacc, terminalG, historicalCAGR])

  const isFinancialSector = ['Financial Services', 'Banks', 'Insurance', 'Financial'].includes(sector)
  const drivers: string[] = cagrAnalysis?.drivers ?? []

  return (
    <div className="flex flex-col gap-5">

      {/* ── 1. COMPANY IDENTITY ──────────────────────────────────────────────── */}
      {description && (
        <CompanyCard
          description={description}
          sector={sector}
          industry={industry ?? ''}
          country={country ?? ''}
          employees={employees ?? null}
          ticker={ticker}
        />
      )}

      {/* ── 2. KEY STATS BAR (Market Cap, P/E, EV/EBITDA, Beta, 52W, Div) ───── */}
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

      {/* ── 3. VALUATION HEADLINE + PRICE CHART ─────────────────────────────── */}
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

      {/* ── 4. WHAT THE MARKET IS PRICING IN ─────────────────────────────────── */}
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

      {/* ── 5. FUNDAMENTALS ──────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Fundamentals</SectionLabel>
        <div className="mt-3 flex flex-col gap-4">

          {/* Business Performance — Revenue chart + FCF chart (A/Q toggle) */}
          {statementsData && (
            <BusinessPerformanceCard statementsData={statementsData} currency={currency} />
          )}

          {/* Business quality panel — profitability, growth, moat signals */}
          {ratings && (
            <div className="rounded-xl overflow-hidden border border-[#E5E5E5]">
              <div className="px-4 py-3 bg-white border-b border-[#E5E5E5] flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[#111111]">Business quality</p>
                {ratings?.overall?.grade && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F5] text-[#6B6B6B] border border-[#E5E5E5]">
                    Grade {ratings.overall.grade}
                  </span>
                )}
              </div>
              <div className="bg-white">
                {/* Profitability row */}
                {(businessProfile?.grossMargin != null || businessProfile?.netMargin != null || businessProfile?.fcfMargin != null) && (
                  <div className="grid grid-cols-3 divide-x divide-[#F5F5F5] border-b border-[#F5F5F5]">
                    {[
                      { label: 'Gross margin', value: businessProfile?.grossMargin },
                      { label: 'Net margin',   value: businessProfile?.netMargin },
                      { label: 'FCF margin',   value: businessProfile?.fcfMargin },
                    ].map(({ label, value }) => (
                      <div key={label} className="px-4 py-3">
                        <p className="text-[10px] font-semibold text-[#9B9B9B] mb-0.5">{label}</p>
                        <p className="text-[14px] font-bold text-[#111111] tabular-nums">
                          {value != null ? `${(value * 100).toFixed(1)}%` : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Growth row */}
                {cagrAnalysis && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-[#F5F5F5]">
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-semibold text-[#9B9B9B] mb-0.5">Revenue CAGR (3Y)</p>
                      <p className="text-[14px] font-bold text-[#111111] tabular-nums">
                        {cagrAnalysis.historicalCagr3y != null
                          ? `${(cagrAnalysis.historicalCagr3y * 100).toFixed(1)}%`
                          : '—'}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-semibold text-[#9B9B9B] mb-0.5">Analyst est. (1Y)</p>
                      <p className="text-[14px] font-bold text-[#111111] tabular-nums">
                        {cagrAnalysis.analystEstimate1y != null
                          ? `${(cagrAnalysis.analystEstimate1y * 100).toFixed(1)}%`
                          : '—'}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-semibold text-[#9B9B9B] mb-0.5">Model CAGR</p>
                      <p className="text-[14px] font-bold text-[#111111] tabular-nums">
                        {cagrAnalysis.blended != null
                          ? `${(cagrAnalysis.blended * 100).toFixed(1)}%`
                          : '—'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Peer valuation chart */}
          <PeerValuationChart ticker={ticker} isFinancialSector={isFinancialSector} />

        </div>
      </div>

      {/* ── 6. BULL / BEAR THESIS ────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Bull and bear cases</SectionLabel>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
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
      </div>

      {/* ── 7. INVESTMENT CHECKLIST ──────────────────────────────────────────── */}
      {scores && (
        <div>
          <SectionLabel>Investment checklist</SectionLabel>
          <div className="mt-3">
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
          </div>
        </div>
      )}

      {/* ── 8. IF YOU HAD HELD + ETF EXPOSURE ───────────────────────────────── */}
      {holdingReturns && (
        <div>
          <SectionLabel>If you had held</SectionLabel>
          <div className="mt-3">
            <HoldingReturns returns={holdingReturns} ticker={ticker} />
          </div>
        </div>
      )}

      <ETFExposureCard ticker={ticker} />

      {/* ── 9. TAB NAVIGATION LINKS ─────────────────────────────────────────── */}
      <TabNavRow
        onViewValuation={onViewValuation}
        onViewFinancials={onViewFinancials}
        onViewRisks={onViewRisks}
      />

    </div>
  )
}
