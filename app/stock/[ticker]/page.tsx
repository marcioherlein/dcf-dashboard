'use client'
import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import NewsPanel from '@/components/stock/NewsPanel'
import BusinessModel from '@/components/stock/BusinessModel'
import FinancialScores from '@/components/stock/FinancialScores'
import AtAGlance from '@/components/stock/AtAGlance'
import HealthSection from '@/components/stock/HealthSection'
import ScenarioComparisonCard from '@/components/stock/ScenarioComparisonCard'
import MispricingExplainer from '@/components/stock/MispricingExplainer'
import { type TabId } from '@/components/stock/TabNav'
import StockContextBar from '@/components/stock/StockContextBar'
import StockSidebar from '@/components/stock/StockSidebar'
import { cn } from '@/lib/utils'
import ValuationLab from '@/components/valuation/ValuationLab'
import FinancialsHub from '@/components/stock/FinancialsHub'
import InvestorGradeCard from '@/components/stock/InvestorGradeCard'
import MobileKeyInsights from '@/components/stock/MobileKeyInsights'
import InvestorVerdictCard from '@/components/stock/InvestorVerdictCard'
import ReverseDcfCallout from '@/components/stock/ReverseDcfCallout'
import { LoginGateProvider, useLoginGate } from '@/components/auth/LoginGateProvider'
import AuthBanner from '@/components/auth/AuthBanner'
import { calculatePiotroski, calculateAltman, calculateBeneish } from '@/lib/dcf/calculateScores'
import { track } from '@/lib/analytics/events'
import { loadPreLoginState, clearPreLoginState } from '@/lib/auth/preLoginState'
import { useSession } from 'next-auth/react'
import SaveToWatchlistDialog, { type WatchlistSavePayload } from '@/components/watchlist/SaveToWatchlistDialog'
import ValuationNotAvailableCard from '@/components/stock/ValuationNotAvailableCard'
import FlipCard from '@/components/ui/FlipCard'
import CardBack from '@/components/ui/CardBack'

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
    analystTargetMean: number; currency: string; sector: string; quoteType?: string
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
  const { requireAuth } = useLoginGate()
  const { data: session } = useSession()
  const [data, setData]             = useState<FinancialsData | null>(null)
  const [statementsData, setStatementsData] = useState<StatementsData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savePayload, setSavePayload] = useState<WatchlistSavePayload | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [tabDirection, setTabDirection] = useState(0)
  const reducedMotion = useReducedMotion()
  const [financialsHighlight, setFinancialsHighlight] = useState<{ rowKey: string; statement: 'income' | 'balance' | 'cashflow' } | null>(null)
  const [userModelFairValue, setUserModelFairValue] = useState<number | null>(null)
  const [activeValuationMethod, setActiveValuationMethod] = useState<string | null>(null)
  const [companyExpanded, setCompanyExpanded] = useState(true)

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

  useEffect(() => {
    setLoading(true)
    setError('')
    setActiveTab('overview')
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
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [ticker])

  // Keep saving state for potential future use — suppress unused warning
  void setSaving; void saving

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
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      {/* Session-based soft auth nudge (appears on 2nd+ stock page view) */}
      <AuthBanner />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-16">

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
              <p className="text-sm text-red-700">
                <strong>Error:</strong> {error}. Yahoo Finance may be temporarily unavailable — try again in a moment.
              </p>
            )}
          </div>
        )}

        {data && !loading && (
          <>
            {/* ── Desktop grid: main content + contextual sidebar ── */}
            {/* Full DCF collapses to single column so the modelling table gets the full width */}
            <div className={cn(
              activeTab !== 'news'
                ? (activeTab === 'valuation' && activeValuationMethod === 'full_dcf'
                    ? 'lg:block'
                    : 'lg:grid lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px] lg:gap-6 lg:items-start')
                : ''
            )}>
            <div className="min-w-0">
            {/* ── InvestorGradeCard — top of main column, sidebar starts alongside it ── */}
            <motion.div
              className="pt-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <InvestorGradeCard
                ticker={data.ticker}
                companyName={data.companyName}
                sector={data.quote.sector ?? ''}
                price={data.quote.price}
                change={data.quote.change}
                changePct={data.quote.changePct}
                currency={data.quote.currency ?? 'USD'}
                grade={data.ratings?.overall?.grade ?? 'N/A'}
                gradeLabel={data.ratings?.overall?.label ?? ''}
                fairValue={data.valuationMethods?.triangulatedFairValue ?? data.fairValue?.fairValuePerShare ?? null}
                upsidePct={data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue?.upsidePct ?? null}
                profitabilitySummary={data.ratings?.profitability?.summary ?? ''}
                liquiditySummary={data.ratings?.liquidity?.summary ?? ''}
                growthSummary={data.ratings?.growth?.summary ?? ''}
                marketCap={data.quote.marketCap}
                high52={data.quote.fiftyTwoWeekHigh}
                low52={data.quote.fiftyTwoWeekLow}
                analystTarget={data.quote.analystTargetMean}
                drivers={data.cagrAnalysis?.drivers}
                onSave={() => {
                  if (!session?.user) { requireAuth({ intent: 'save_watchlist' }); return }
                  const isETF = (data.quote.quoteType ?? '').toUpperCase() === 'ETF'
                  setSavePayload({
                    ticker: data.ticker,
                    name: data.companyName,
                    assetType: isETF ? 'etf' : 'stock',
                    fairValue: data.valuationMethods?.triangulatedFairValue ?? data.fairValue?.fairValuePerShare ?? null,
                    upsidePct: data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue?.upsidePct ?? null,
                    valuationSnapshot: isETF ? null : {
                      price_at_save: data.quote.price,
                      fair_value: data.valuationMethods?.triangulatedFairValue ?? data.fairValue?.fairValuePerShare ?? 0,
                      wacc: data.wacc?.wacc ?? 0,
                      beta: data.wacc?.inputs?.beta ?? 1,
                      terminal_g: data.scenarios?.base?.terminalG ?? 0.025,
                      cagr: data.scenarios?.base?.cagr ?? 0,
                      upside_pct: data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue?.upsidePct ?? 0,
                      inputs: data.wacc?.inputs ?? {},
                      scenarios: {
                        bull: data.scenarios?.bull?.fairValue ?? 0,
                        base: data.scenarios?.base?.fairValue ?? 0,
                        bear: data.scenarios?.bear?.fairValue ?? 0,
                      },
                    },
                  })
                  setSaveDialogOpen(true)
                }}
                onViewDetails={() => handleTabChange('valuation')}
                compact={activeTab === 'valuation'}
              />
            </motion.div>
            {/* Mobile-only collapsible quick insights — hidden on desktop where sidebar shows */}
            <MobileKeyInsights data={data} />
            <AnimatePresence mode="wait">
              {/* ── Overview tab ── */}
              {activeTab === 'overview' && (
                <motion.div
                  key="tab-overview"
                  id="tabpanel-overview"
                  role="tabpanel"
                  className="space-y-4 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  <FlipCard
                    back={<CardBack
                      emoji="📊" title="Overall Grade & Fair Value"
                      intro="This card summarizes whether the stock looks cheap or expensive right now, based on the model's calculations."
                      sections={[
                        { title: 'The Grade (A → F)', body: 'A or B means the model thinks the stock is undervalued — you might be getting a bargain. C means fairly priced. D or F means it looks overpriced — you may be paying more than it\'s worth.' },
                        { title: 'Fair Value', body: 'The model\'s estimate of what one share is truly worth, based on the company\'s expected future cash flows. Think of it as the "right price" according to the numbers.' },
                        { title: 'Upside %', body: 'How much the stock could grow if the market eventually agrees with the model. +20% means the model thinks the stock is 20% cheaper than it should be.' },
                        { title: 'Confidence', body: 'How reliable the estimate is. High confidence = strong analyst data + solid financials. Low confidence = limited data, so take the estimate with more caution.' },
                      ]}
                      warning="This is a model estimate, not a prediction. Models can be wrong. Always do your own research before investing."
                    />}
                  >
                  <InvestorVerdictCard
                    upside={data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue?.upsidePct ?? null}
                    fairValue={data.valuationMethods?.triangulatedFairValue ?? data.fairValue?.fairValuePerShare ?? null}
                    price={data.quote.price}
                    currency={currency}
                    analystRecommendation={data.analystRecommendation ?? ''}
                    ratings={data.ratings ?? null}
                    confidence={data.cagrAnalysis?.confidenceLabel}
                    growthModel={data.growthModel}
                    scores={computedScores ?? data.scores}
                  />
                  </FlipCard>

                  {/* Reverse DCF — signature card */}
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

                  <PriceChart
                    ticker={ticker}
                    isDark={false}
                    triangulatedFairValue={data.valuationMethods?.triangulatedFairValue}
                    analystTarget={data.quote.analystTargetMean}
                    userModelFairValue={userModelFairValue}
                  />

                  {data.ratings && data.scores && (
                    <HealthSection
                      ratings={data.ratings}
                      scores={computedScores ?? data.scores}
                      financialsData={data}
                      collapsible
                    />
                  )}

                  {/* Company Overview — collapsible */}
                  {(data.businessProfile.description || data.historicalRevenues.length >= 2) && (
                    <div>
                      <button
                        onClick={() => setCompanyExpanded(e => !e)}
                        className="flex items-center gap-2 w-full text-left px-1 mb-2 group"
                      >
                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-500 transition-colors">Company Overview</span>
                        <svg className={`w-3.5 h-3.5 text-slate-400 ml-auto transition-transform duration-200 ${companyExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {companyExpanded && (
                        <div className="space-y-4">
                          <BusinessModel
                            businessProfile={data.businessProfile}
                            historicalRevenues={data.historicalRevenues}
                            ticker={ticker}
                            isDark={false}
                            incomeStatement={data.financialStatements?.incomeStatement}
                            cashFlow={data.financialStatements?.cashFlow}
                            statementsData={statementsData}
                          />
                          <FlipCard
                            back={<CardBack
                              emoji="📋" title="Key Numbers at a Glance"
                              intro="These are the main numbers investors look at to quickly judge if a stock is cheap, expensive, or fairly priced."
                              sections={[
                                { title: 'P/E Ratio (Price-to-Earnings)', body: 'How much you pay for every $1 of profit. A P/E of 20 means you pay $20 for $1 of annual earnings. Lower can mean cheaper — but a very low P/E can also signal problems.' },
                                { title: 'EV/EBITDA', body: 'A cleaner version of P/E that accounts for debt. It compares the company\'s total value (including debt) to its operating profit. Under 10× is often considered reasonable.' },
                                { title: 'P/S (Price-to-Sales)', body: 'Compares the price to revenue rather than profit. Useful for companies that aren\'t yet profitable. Lower is generally cheaper.' },
                                { title: '52-Week Range', body: 'The highest and lowest price the stock traded at over the past year. If today\'s price is near the low, you might be buying at a discount. Near the high might mean it\'s already had a big run.' },
                                { title: 'Market Cap', body: 'The total market value of the company (price × number of shares). Small companies (<$2B) tend to be riskier but with more growth potential. Large companies (>$10B) tend to be more stable.' },
                              ]}
                            />}
                          >
                          <AtAGlance
                            price={data.quote.price}
                            marketCap={data.quote.marketCap}
                            high52={data.quote.fiftyTwoWeekHigh}
                            low52={data.quote.fiftyTwoWeekLow}
                            sector={data.quote.sector ?? ''}
                            country={data.businessProfile.country}
                            currency={currency}
                            statementsData={statementsData}
                          />
                          </FlipCard>
                        </div>
                      )}
                    </div>
                  )}
                  {/* ── Overview → Valuation CTA ── */}
                  <div className="rounded-xl glass-card-light px-5 py-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">Explore the full valuation</p>
                        </div>
                        <p className="text-xs text-slate-500 ml-8">Adjust growth assumptions, compare DCF methods, and build your own fair-value estimate.</p>
                      </div>
                      <button
                        onClick={() => handleTabChange('valuation')}
                        className="w-full sm:w-auto rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm shadow-blue-200 shrink-0"
                      >
                        Go to Valuation →
                      </button>
                    </div>
                  </div>
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
                  <>
                  {data.scenarios && (
                    <FlipCard
                      back={<CardBack
                        emoji="🐂🐻" title="Bull / Base / Bear Scenarios"
                        intro="Three versions of the future. Because nobody knows exactly what will happen, the model looks at three possible outcomes."
                        sections={[
                          { title: 'Bear (pessimistic)', body: 'What if things go worse than expected? Slower growth, higher costs, tougher competition. This gives you the low end of what the stock might be worth.' },
                          { title: 'Base (most likely)', body: 'The central estimate — the outcome the model considers most probable based on current data. This is the main fair value number used throughout the analysis.' },
                          { title: 'Bull (optimistic)', body: 'What if everything goes well? Strong growth, expanding margins, good conditions. This gives you the high end of what the stock could be worth.' },
                          { title: 'WACC & CAGR', body: 'These are the two main levers. WACC = the "cost" of investing (risk). CAGR = how fast revenue grows. Bull scenarios use lower WACC and higher CAGR; bear scenarios flip that.' },
                        ]}
                        warning="The range between bear and bull shows how uncertain the estimate is. A wide range = more uncertainty."
                      />}
                    >
                    <ScenarioComparisonCard
                      scenarios={data.scenarios}
                      currentPrice={data.quote.price}
                      currency={data.quote.currency ?? 'USD'}
                    />
                    </FlipCard>
                  )}
                  <ValuationLab apiData={data} ticker={ticker} statementsData={statementsData} onNavigateToFinancials={handleNavigateToFinancials} onWeightedFVChange={setUserModelFairValue} onActiveMethodChange={setActiveValuationMethod} />
                  {data.fairValue?.fairValuePerShare != null && (
                    <FlipCard
                      back={<CardBack
                        emoji="📐" title="Why Is the Price Different from Fair Value?"
                        intro="This card breaks down the gap between what the stock trades at today and what the model thinks it's worth."
                        sections={[
                          { title: 'WACC (discount rate)', body: 'This is how much return investors demand for the risk they\'re taking. Higher WACC = lower fair value, because future earnings are worth less when discounted more aggressively.' },
                          { title: 'CAGR (growth rate)', body: 'How fast the company\'s revenue is expected to grow per year. Faster growth = higher fair value. This is usually the biggest driver of the estimate.' },
                          { title: 'Terminal value', body: 'What the business is assumed to be worth far in the future (typically 60–80% of the total fair value). A small change in the long-term growth rate can move the estimate significantly.' },
                          { title: 'The gap', body: 'If the stock is below fair value: the market may be underestimating the company\'s potential. If it\'s above: the market is already pricing in a lot of optimism — or the model is too conservative.' },
                        ]}
                        warning="Two analysts can get very different fair values for the same stock just by using different WACC or growth assumptions. The model is a tool, not a verdict."
                      />}
                    >
                    <MispricingExplainer
                      ticker={ticker}
                      fairValue={data.fairValue.fairValuePerShare}
                      currentPrice={data.quote.price}
                      upsidePct={data.fairValue.upsidePct ?? null}
                      wacc={data.wacc?.wacc ?? null}
                      cagr={data.cagr ?? null}
                      sector={data.quote.sector ?? ''}
                    />
                    </FlipCard>
                  )}
                  {/* End-of-page CTA */}
                  <div className="rounded-xl glass-card-light px-5 py-5">
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
                        onClick={() => { const el = document.getElementById('full_dcf'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                        className="flex flex-col gap-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 hover:bg-blue-100 transition-colors text-left"
                      >
                        <span className="text-sm font-bold text-blue-700">Adjust assumptions →</span>
                        <span className="text-[11px] text-slate-500">Open the Full DCF and change WACC or growth rate</span>
                      </button>
                      <button
                        onClick={() => handleTabChange('financials')}
                        className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:bg-slate-100 transition-colors text-left"
                      >
                        <span className="text-sm font-bold text-slate-700">Check the financials →</span>
                        <span className="text-[11px] text-slate-500">Revenue, margins, cash flow and debt history</span>
                      </button>
                    </div>
                  </div>
                  </>
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
                  {data.ratings && data.scores && (
                    <HealthSection
                      ratings={data.ratings}
                      scores={computedScores ?? data.scores}
                      financialsData={data}
                    />
                  )}
                  {data.scores && <FinancialScores scores={computedScores ?? data.scores} />}
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

            {/* Sidebar — desktop only, hidden on news tab and when Full DCF is open */}
            {activeTab !== 'news' && !(activeTab === 'valuation' && activeValuationMethod === 'full_dcf') && (
              <aside className="hidden lg:block">
                <div className="sticky top-[68px] self-start space-y-3 pb-4 pt-5">
                  <StockSidebar activeTab={activeTab} data={data} statementsData={statementsData} onNavigateToFinancials={handleNavigateToFinancials} activeValuationMethodId={activeValuationMethod} />
                </div>
              </aside>
            )}
            </div>{/* end grid */}
          </>
        )}

        {/* ── Investment disclaimer ── */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-8 pt-2">
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
