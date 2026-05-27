'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import NewsPanel from '@/components/stock/NewsPanel'
import HealthSection from '@/components/stock/HealthSection'
import { type TabId } from '@/components/stock/TabNav'
import StockContextBar from '@/components/stock/StockContextBar'
import StockSidebar from '@/components/stock/StockSidebar'
import { cn } from '@/lib/utils'
import ValuationCockpit from '@/components/valuation/ValuationCockpit'
import FinancialsHub from '@/components/stock/FinancialsHub'
import MobileKeyInsights from '@/components/stock/MobileKeyInsights'
import ReverseDcfCallout from '@/components/stock/ReverseDcfCallout'
import { LoginGateProvider } from '@/components/auth/LoginGateProvider'
import AuthBanner from '@/components/auth/AuthBanner'
import { calculatePiotroski, calculateAltman, calculateBeneish } from '@/lib/dcf/calculateScores'
import { track } from '@/lib/analytics/events'
import { loadPreLoginState, clearPreLoginState } from '@/lib/auth/preLoginState'
import { useSession } from 'next-auth/react'
import SaveToWatchlistDialog, { type WatchlistSavePayload } from '@/components/watchlist/SaveToWatchlistDialog'
import ValuationNotAvailableCard from '@/components/stock/ValuationNotAvailableCard'
import OverviewMetricGrid from '@/components/stock/OverviewMetricGrid'
import FlipCard from '@/components/ui/FlipCard'
import CardBack from '@/components/ui/CardBack'
import StockSummaryCard from '@/components/stock/overview/StockSummaryCard'

import SignalDivergenceCallout from '@/components/stock/overview/SignalDivergenceCallout'
import OverviewBottomStrip from '@/components/stock/overview/OverviewBottomStrip'

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />,
})

interface CAGRAnalysisData {
  historicalCagr3y: number
  analystEstimate1y: number
  analystEstimate2y: number
  fundamentalGrowth: number | null
  blended: number
  rawBlended: number
  cagrCap: number
  weights: { historical: number; analyst: number; fundamental: number }
  confidence: number
  confidenceLabel: 'High' | 'Medium' | 'Low'
  numAnalysts: number
  drivers: string[]
}

interface BusinessProfile {
  description: string
  industry: string
  country: string
  employees: number | null
  grossMargin: number | null
  netMargin: number | null
  fcfMargin: number | null
  revenueM: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StatementRow = Record<string, any>

interface StatementsData {
  financialCurrency: string
  tradingCurrency: string
  annual:    { incomeStatement: StatementRow[]; balanceSheet: StatementRow[]; cashFlow: StatementRow[] }
  quarterly: { incomeStatement: StatementRow[]; balanceSheet: StatementRow[]; cashFlow: StatementRow[] }
  ttm:       { incomeStatement: StatementRow | null; balanceSheet: StatementRow | null; cashFlow: StatementRow | null }
}

interface FinancialsData {
  ticker: string
  companyName: string
  quote: {
    price: number; change: number; changePct: number; marketCap: number
    peRatio: number; fiftyTwoWeekHigh: number; fiftyTwoWeekLow: number
    analystTargetMean: number; currency: string; sector: string; industry?: string; exchange?: string; quoteType?: string
    analystTargetLow?: number | null; analystTargetHigh?: number | null
    pegRatio?: number | null; nextEarningsDate?: string | null; sharesOutstanding?: number | null
  }
  wacc: {
    wacc: number; costOfEquity: number; afterTaxCostOfDebt: number
    weightEquity: number; weightDebt: number
    inputs: { rfRate: number; beta: number; erp: number; costOfDebt: number; taxRate: number; debtToEquity: number }
  }
  dcf: {
    projections: { year: number; cashFlow: number; discounted: number }[]
    terminalValue: number; terminalValueDiscounted: number; sumPV: number; ev: number
    yearlyGrowthRates?: number[]
  }
  growthModel?: 'two-stage' | 'three-stage'
  historicalFCF?: { year: number; cashFlow: number }[]
  fairValue: {
    ev: number; cash: number; debt: number; marketCap: number
    equityValue: number; sharesOutstanding: number
    fairValuePerShare: number; currentPrice: number; upsidePct: number; irr: number
  }
  scenarios: {
    bull: { fairValue: number; wacc: number; cagr: number; terminalG: number }
    base: { fairValue: number; wacc: number; cagr: number; terminalG: number }
    bear: { fairValue: number; wacc: number; cagr: number; terminalG: number }
    modelMethodology?: {
      companyType: string
      companyTypeLabel: string
      rationale: string
      weights: { ufcfPGM: number; ufcfEM: number; lfcfPGM: number; lfcfEM: number }
    }
  }
  baseFCF: number
  cagr: number
  cagrAnalysis: CAGRAnalysisData
  isNegativeFCF: boolean
  terminalG: number
  historicalRevenues: number[]
  businessProfile: BusinessProfile
  analystRecommendation: string
  financialCurrencyNote?: string
  ratings: import('@/lib/dcf/calculateRatings').StockRatings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valuationMethods?: any
  scores?: {
    piotroski: import('@/lib/dcf/calculateScores').PiotroskiResult
    altman: import('@/lib/dcf/calculateScores').AltmanResult | null
    beneish: import('@/lib/dcf/calculateScores').BeneishResult | null
    roic: import('@/lib/dcf/calculateScores').ROICResult
  }
  ownership?: {
    insiderPct: number | null
    institutionalPct: number | null
    shortPct: number | null
    shortRatio: number | null
    sharesShort: number | null
  }
  holdingReturns?: {
    stock1y: number | null
    stock3y: number | null
    stock5y: number | null
    spy1y: number | null
    spy3y: number | null
    spy5y: number | null
  }
  financialStatements?: {
    incomeStatement: Array<{
      year: string; revenue: number | null; grossProfit: number | null
      operatingIncome: number | null; ebitda: number | null
      netIncome: number | null; eps: number | null; isProjected: boolean
    }>
    balanceSheet: Array<{
      year: string; cash: number | null; totalCurrentAssets: number | null
      totalAssets: number | null; longTermDebt: number | null
      totalCurrentLiabilities: number | null; totalEquity: number | null; isProjected: boolean
    }>
    cashFlow: Array<{
      year: string; operatingCF: number | null; capex: number | null
      freeCashFlow: number | null; investingCF: number | null
      financingCF: number | null; dividendsPaid: number | null; isProjected: boolean
    }>
  }
  canComputeDCF?: boolean
  vetoReasons?: string[]
}

export default function StockPage() {
  return (
    <LoginGateProvider>
      <StockPageBody />
    </LoginGateProvider>
  )
}

function StockPageBody() {
  const { ticker } = useParams<{ ticker: string }>()
  const { data: session } = useSession()
  const [data, setData]             = useState<FinancialsData | null>(null)
  const [statementsData, setStatementsData] = useState<StatementsData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savePayload, _setSavePayload] = useState<WatchlistSavePayload | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [tabDirection, setTabDirection] = useState(0)
  const reducedMotion = useReducedMotion()
  const [financialsHighlight, setFinancialsHighlight] = useState<{ rowKey: string; statement: 'income' | 'balance' | 'cashflow' } | null>(null)
  const [financialsSubTab, setFinancialsSubTab] = useState<'statements' | 'growth' | 'profitability' | 'solvency' | 'analysts' | 'snapshot' | 'ownership' | null>(null)
  const [userModelFairValue, setUserModelFairValue] = useState<number | null>(null)

  // After Google OAuth redirect, restore the user's pre-login state (tab, etc.)
  useEffect(() => {
    if (!session?.user) return
    const saved = loadPreLoginState()
    if (!saved) return
    clearPreLoginState()
    if (saved.tab && ['overview', 'valuation', 'financials', 'risks', 'news'].includes(saved.tab)) {
      setActiveTab(saved.tab as TabId)
    }
    track('saved_after_login', { intent: saved.intent, ticker: saved.ticker ?? ticker })
  // Only run once when session first becomes available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user])

  const handleNavigateToFinancials = (rowKey: string, statement: 'income' | 'balance' | 'cashflow') => {
    setActiveTab('financials')
    setFinancialsHighlight({ rowKey, statement })
  }

  const handleNavigateToRisks = () => setActiveTab('risks')

  const handleNavigateToFinancialsSection = (section: 'analysts' | 'snapshot' | 'ownership') => {
    setActiveTab('financials')
    setFinancialsSubTab(section)
  }

  // Recompute quality scores from Yahoo Finance fundamentalsTimeSeries data when available.
  // The API-route scores use quoteSummary.incomeStatementHistory which is absent for many
  // non-US companies, producing artificially low (e.g. 1/9) Piotroski results.
  // fundamentalsTimeSeries (used by the three statements tab) is available for all companies.
  const computedScores = useMemo(() => {
    if (!statementsData?.annual || !data?.scores) return data?.scores ?? null
    const annBS = statementsData.annual.balanceSheet
    const annIS = statementsData.annual.incomeStatement
    const annCF = statementsData.annual.cashFlow
    if (!annBS?.length || !annIS?.length) return data.scores

    // fundamentalsTimeSeries rows are ascending (oldest first); score functions expect [0] = most recent
    const bsR = [...annBS].reverse()
    const isR = [...annIS].reverse()
    const cfR = [...annCF].reverse()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharesNow = (isR[0] as any)?.dilutedAverageShares
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?? (isR[0] as any)?.ordinarySharesNumber
      ?? ((data.quote?.marketCap ?? 0) / Math.max(0.01, data.quote?.price ?? 1))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharesPrior = (isR[1] as any)?.dilutedAverageShares
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ?? (isR[1] as any)?.ordinarySharesNumber
      ?? sharesNow

    const fxRate = (data.wacc as any)?.fxRate ?? 1
    const marketCapRaw = (data.quote?.marketCap ?? 0) / fxRate

    const piotroski = calculatePiotroski(bsR, isR, cfR, sharesNow, sharesPrior)
    const altman    = calculateAltman(bsR[0] ?? {}, isR[0] ?? {}, marketCapRaw)
    const beneish   = bsR.length >= 2 && isR.length >= 2
      ? calculateBeneish(bsR[0], bsR[1], isR[0], isR[1], cfR[0] ?? {})
      : data.scores.beneish

    return {
      ...data.scores,
      piotroski,
      altman:  altman  ?? data.scores.altman,
      beneish: beneish ?? data.scores.beneish,
    }
  }, [statementsData, data])

  const loadData = useCallback(() => {
    setLoading(true)
    setError('')
    Promise.all([
      fetch(`/api/financials?ticker=${ticker}`).then(r => r.json()),
      fetch(`/api/statements?ticker=${ticker}`).then(r => r.json()).catch(() => null),
    ])
      .then(([finJson, stmtJson]) => {
        if (finJson.error) { setError(finJson.error); setLoading(false); return }
        setData(finJson)
        setStatementsData(stmtJson ?? null)
        setLoading(false)
        track('stock_viewed', { ticker, sector: finJson.quote?.sector ?? '' })
        try {
          const item = { ticker: finJson.ticker, name: finJson.companyName, price: finJson.quote?.price ?? null, changePct: finJson.quote?.changePct ?? null }
          const prev = JSON.parse(localStorage.getItem('intrinsico_recent') ?? '[]') as typeof item[]
          localStorage.setItem('intrinsico_recent', JSON.stringify([item, ...prev.filter(r => r.ticker !== item.ticker)].slice(0, 8)))
        } catch {}
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [ticker])

  useEffect(() => {
    setActiveTab('overview')
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker])

  // Keep saving state for potential future use — suppress unused warning
  void setSaving; void saving
  void setUserModelFairValue

  const currency = data?.quote.currency === 'USD' ? '$' : (data?.quote.currency ?? '$') + ' '

  const TAB_ORDER: TabId[] = ['overview', 'valuation', 'financials', 'risks', 'news']

  const handleTabChange = (tab: TabId) => {
    const dir = TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(activeTab) ? 1 : -1
    setTabDirection(dir)
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (data) track('tab_changed', { ticker, tab })
  }

  return (
    <>
    <div className="min-h-dvh bg-slate-50">

      {/* Context bar: stock identity + tab navigation */}
      <StockContextBar
        ticker={ticker}
        companyName={data?.companyName ?? ''}
        price={data?.quote.price ?? null}
        change={data?.quote.change ?? null}
        changePct={data?.quote.changePct ?? null}
        currency={data?.quote.currency === 'USD' ? '$' : (data?.quote.currency ?? '$') + ' '}
        sector={data?.quote.sector ?? ''}
        industry={data?.quote.industry ?? ''}
        exchange={data?.quote.exchange ?? ''}
        activeTab={activeTab}
        onChange={handleTabChange}
        onSave={() => setSaveDialogOpen(true)}
      />

      {/* Session-based soft auth nudge (appears on 2nd+ stock page view) */}
      <AuthBanner />

      <div className="px-4 sm:px-6 lg:px-8 pb-16">

        {loading && (
          <div className="pt-5 space-y-4 animate-pulse">
            {/* PriceHeader skeleton */}
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <div className="flex justify-between gap-4">
                <div className="space-y-2">
                  <div className="h-6 w-20 rounded-lg bg-slate-100" />
                  <div className="h-7 w-52 rounded-lg bg-slate-100" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-9 w-32 rounded-lg bg-slate-100 ml-auto" />
                  <div className="h-4 w-24 rounded-lg bg-slate-100 ml-auto" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-100" />
                ))}
              </div>
            </div>
            {/* Content skeleton */}
            <div className="h-72 rounded-xl bg-white border border-slate-200" />
            <div className="h-48 rounded-xl bg-white border border-slate-200" />
          </div>
        )}

        {error && (
          <div className={`mt-8 rounded-xl border px-5 py-5 ${error.includes('NYSE and NASDAQ') ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'}`}>
            {error.includes('NYSE and NASDAQ') ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-slate-800">{error}</p>
                <p className="text-xs text-slate-500">
                  International markets and other exchanges are on the roadmap.
                  Try searching for a US-listed equivalent or ADR.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-red-700">
                  <strong>Error:</strong> {error}. Yahoo Finance may be temporarily unavailable.
                </p>
                <button
                  onClick={loadData}
                  className="self-start text-sm font-medium px-4 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {data && !loading && (
          <>
            {/* ── Desktop grid: main content + contextual sidebar ── */}
            {/* Overview tab is intentionally full-width — decision flow without right-rail clutter */}
            {/* Valuation tab uses single column — ValuationCockpit has its own internal sidebar */}
            <div className={cn(
              activeTab === 'financials'
                ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px] lg:gap-6 lg:items-start'
                : ''
            )}>
            <div className="min-w-0">
            {/* Mobile-only collapsible quick insights — hidden on desktop where sidebar shows */}
            <MobileKeyInsights data={data} />
            <AnimatePresence mode="wait">
              {/* ── Overview tab ── */}
              {activeTab === 'overview' && (
                <motion.div
                  key="tab-overview"
                  id="tabpanel-overview"
                  role="tabpanel"
                  className="space-y-5 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  {/* 1. Unified summary card — 4 hero columns */}
                  <StockSummaryCard
                    ticker={data.ticker}
                    companyName={data.companyName}
                    sector={data.quote.sector ?? ''}
                    industry={data.quote.industry ?? ''}
                    description={data.businessProfile?.description ?? ''}
                    price={data.quote.price}
                    change={data.quote.change}
                    changePct={data.quote.changePct}
                    currency={data.quote.currency ?? 'USD'}
                    high52={data.quote.fiftyTwoWeekHigh}
                    low52={data.quote.fiftyTwoWeekLow}
                    fairValue={data.valuationMethods?.triangulatedFairValue ?? data.fairValue?.fairValuePerShare ?? null}
                    upsidePct={data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue?.upsidePct ?? null}
                    confidenceLabel={data.cagrAnalysis?.confidenceLabel ?? null}
                    scenarios={data.scenarios ?? null}
                    onViewDetails={() => handleTabChange('valuation')}
                  />

                  {/* 1b. Signal divergence — only shown when analyst and model disagree */}
                  <SignalDivergenceCallout
                    analystRecommendation={data.analystRecommendation ?? ''}
                    analystTargetMean={data.quote.analystTargetMean ?? 0}
                    numAnalysts={data.cagrAnalysis?.numAnalysts ?? 0}
                    price={data.quote.price}
                    currency={data.quote.currency ?? 'USD'}
                    upsidePct={data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue?.upsidePct ?? null}
                    fairValue={data.valuationMethods?.triangulatedFairValue ?? data.fairValue?.fairValuePerShare ?? null}
                  />

                  {/* 2. Reverse DCF — what the market is pricing in */}
                  <FlipCard
                    back={<CardBack
                      emoji="🔄" title="Reverse DCF"
                      intro="Instead of asking 'what is this stock worth?', Reverse DCF flips the question: 'What growth rate would the company need to justify today's price?'"
                      sections={[
                        { title: 'How to read it', body: 'The number shown is the implied annual growth rate baked into the current price. If the stock trades at $200, the market is essentially betting the company will grow revenue at X% per year for the next 5–10 years.' },
                        { title: 'Low implied growth', body: 'If the number is low (e.g. 5%), the market isn\'t expecting much — so even modest growth could make the stock a good deal.' },
                        { title: 'High implied growth', body: 'If the number is high (e.g. 30%+), the market is already pricing in a best-case scenario. Any disappointment could cause the price to drop sharply.' },
                        { title: 'The gut-check', body: 'Ask yourself: "Do I genuinely believe this company can grow that fast?" If yes, the price makes sense. If you\'re unsure, you might be overpaying.' },
                      ]}
                      warning="High implied growth isn't automatically bad — some companies (like fast-growing tech) do sustain it. Context matters."
                    />}
                  >
                  <ReverseDcfCallout
                    price={data.quote.price}
                    sharesM={data.fairValue?.sharesOutstanding ?? null}
                    cashM={data.fairValue?.cash ?? null}
                    debtM={data.fairValue?.debt ?? null}
                    revenueM={data.businessProfile?.revenueM ?? null}
                    fcfMargin={data.businessProfile?.fcfMargin ?? null}
                    wacc={data.wacc?.wacc ?? 0.09}
                    terminalG={data.terminalG ?? 0.025}
                    historicalCAGR={data.cagrAnalysis?.historicalCagr3y ?? null}
                    isEmergingMarket={computedScores?.altman?.isReliable === false}
                  />
                  </FlipCard>

                  {/* 3. 3x2 quality grid (risks included) */}
                  {data.ratings && (
                    <OverviewMetricGrid
                      ratings={data.ratings}
                      scores={computedScores ?? data.scores}
                      businessProfile={data.businessProfile}
                      cagrAnalysis={data.cagrAnalysis ?? null}
                      statementsData={statementsData}
                      onViewRisks={() => handleTabChange('risks')}
                      valuationMethods={data.valuationMethods ?? null}
                      quote={data.quote}
                    />
                  )}

                  {/* 4. Bottom decision strip: supports / risks / next step */}
                  {data.ratings && (
                    <OverviewBottomStrip
                      drivers={data.cagrAnalysis?.drivers ?? []}
                      ratings={data.ratings}
                      cagrAnalysis={data.cagrAnalysis ?? null}
                      onViewValuation={() => handleTabChange('valuation')}
                      onViewRisks={() => handleTabChange('risks')}
                    />
                  )}

                  {/* 5. Price chart */}
                  <PriceChart
                    ticker={ticker}
                    isDark={false}
                    triangulatedFairValue={data.valuationMethods?.triangulatedFairValue}
                    analystTarget={data.quote.analystTargetMean}
                    userModelFairValue={userModelFairValue}
                  />
                </motion.div>
              )}
              {activeTab === 'valuation' && (
                <motion.div
                  key="tab-valuation"
                  className="space-y-4 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  {data.canComputeDCF === false ? (
                    <ValuationNotAvailableCard vetoReasons={data.vetoReasons ?? []} ticker={ticker} />
                  ) : (
                    <ValuationCockpit
                      apiData={data}
                      ticker={ticker}
                      statementsData={statementsData}
                      onNavigateToFinancials={handleNavigateToFinancials}
                      onNavigateToRisks={handleNavigateToRisks}
                    />
                  )}
                </motion.div>
              )}

              {/* ── Financials tab ── */}
              {activeTab === 'financials' && (
                <motion.div
                  key="tab-financials"
                  className="space-y-4 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  <FinancialsHub
                    statementsData={statementsData}
                    financialsData={data}
                    currency={currency}
                    reportingCurrency={statementsData?.financialCurrency}
                    cagr={data.cagr}
                    highlight={financialsHighlight}
                    initialSubTab={financialsSubTab}
                  />
                </motion.div>
              )}

              {/* ── Risks & Signals tab ── */}
              {activeTab === 'risks' && (
                <motion.div
                  key="tab-risks"
                  className="space-y-4 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  {data.ratings && data.scores ? (
                    <HealthSection
                      ratings={data.ratings}
                      scores={computedScores ?? data.scores}
                      financialsData={data}
                    />
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-12">Health data unavailable for this stock.</p>
                  )}
                </motion.div>
              )}

              {/* ── News tab ── */}
              {activeTab === 'news' && (
                <motion.div
                  key="tab-news"
                  className="space-y-4 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  <NewsPanel ticker={ticker} />
                </motion.div>
              )}
            </AnimatePresence>
            </div>{/* end main column */}

            {/* Sidebar — desktop only, financials tab only (overview is intentionally full-width) */}
            {activeTab === 'financials' && (
              <aside className="hidden lg:block">
                <div className="sticky top-[68px] self-start space-y-3 pb-4 pt-5">
                  <StockSidebar activeTab={activeTab} data={data} statementsData={statementsData} computedScores={computedScores} onNavigateToFinancials={handleNavigateToFinancials} onNavigateToFinancialsSection={handleNavigateToFinancialsSection} />
                </div>
              </aside>
            )}
            </div>{/* end grid */}
          </>
        )}

        {/* ── Investment disclaimer ── */}
        <div className="px-4 sm:px-6 lg:px-8 pb-8 pt-2">
          <p className="text-[11px] text-slate-400 leading-relaxed text-center max-w-3xl mx-auto">
            <strong className="font-semibold text-slate-500">Not financial advice.</strong>{' '}
            All outputs — DCF estimates, fair values, health scores, and scenarios — are model results
            based on publicly available data and mathematical assumptions. They are for informational
            purposes only and are not recommendations to buy, sell, or hold any security.
            Always consult a qualified financial advisor before making investment decisions.{' '}
            <a href="/terms" className="underline hover:text-slate-600 transition-colors">Terms</a>
            {' '}·{' '}
            <a href="/privacy" className="underline hover:text-slate-600 transition-colors">Privacy</a>
          </p>
        </div>

      </div>
    </div>

    <SaveToWatchlistDialog
      open={saveDialogOpen}
      payload={savePayload}
      onClose={() => setSaveDialogOpen(false)}
      onReviewAssumptions={() => handleTabChange('valuation')}
    />
    </>
  )
}
