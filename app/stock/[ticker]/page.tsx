'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useParams } from 'next/navigation'
import NewsPanel from '@/components/stock/NewsPanel'
import HealthSection from '@/components/stock/HealthSection'
import { type TabId } from '@/components/stock/TabNav'
import StockContextBar from '@/components/stock/StockContextBar'
import FinancialsSidebar from '@/components/stock/sidebar/FinancialsSidebar'
import ValuationCockpit, { buildSnapshot, seedAssumptions } from '@/components/valuation/ValuationCockpit'
import { computeCockpitOutput } from '@/lib/valuation/cockpit'
import FinancialsHub from '@/components/stock/FinancialsHub'
import MobileKeyInsights from '@/components/stock/MobileKeyInsights'

import { LoginGateProvider } from '@/components/auth/LoginGateProvider'
import AuthBanner from '@/components/auth/AuthBanner'
import { calculatePiotroski, calculateAltman, calculateBeneish } from '@/lib/dcf/calculateScores'
import { track } from '@/lib/analytics/events'
import { loadPreLoginState, clearPreLoginState } from '@/lib/auth/preLoginState'
import { useSession } from 'next-auth/react'
import SaveToWatchlistDialog, { type WatchlistSavePayload } from '@/components/watchlist/SaveToWatchlistDialog'
import ValuationNotAvailableCard from '@/components/stock/ValuationNotAvailableCard'
import SummaryTab from '@/components/stock/summary/SummaryTab'
import StockOrientationStrip from '@/components/onboarding/StockOrientationStrip'


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
  const [savePayload, setSavePayload] = useState<WatchlistSavePayload | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [tabDirection, setTabDirection] = useState(0)
  const reducedMotion = useReducedMotion()
  const [financialsHighlight, setFinancialsHighlight] = useState<{ rowKey: string; statement: 'income' | 'balance' | 'cashflow' } | null>(null)
  const [financialsSubTab, _setFinancialsSubTab] = useState<'statements' | 'growth' | 'profitability' | 'solvency' | 'analysts' | 'ownership' | null>(null)
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

  // Compute the cockpit blended fair value at default assumptions so Summary and Valuation
  // tabs always show the same number (previously Summary used a stale API triangulatedFairValue).
  const cockpitSnapshot = useMemo(
    () => (data ? buildSnapshot(data, statementsData) : null),
    [data, statementsData]
  )
  const cockpitDefaults = useMemo(
    () => (data ? seedAssumptions(data) : null),
    [data]
  )
  const cockpitOutput = useMemo(
    () => (cockpitSnapshot && cockpitDefaults
      ? computeCockpitOutput(cockpitDefaults, cockpitSnapshot)
      : null),
    [cockpitSnapshot, cockpitDefaults]
  )

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
        onSave={() => {
            const isETF = (data?.quote?.quoteType ?? '').toUpperCase() === 'ETF'
            setSavePayload({
              ticker,
              name: data?.companyName ?? ticker,
              assetType: isETF ? 'etf' : 'stock',
              fairValue: cockpitOutput?.blendedFairValue ?? null,
              upsidePct: cockpitOutput?.upsidePct ?? null,
              valuationSnapshot: (!isETF && cockpitOutput?.blendedFairValue != null) ? {
                price_at_save:  data?.quote?.price ?? 0,
                fair_value:     cockpitOutput.blendedFairValue,
                wacc:           cockpitDefaults?.wacc ?? 0.10,
                beta:           data?.wacc?.inputs?.beta ?? 1,
                terminal_g:     cockpitDefaults?.terminalG ?? 0.025,
                cagr:           cockpitDefaults?.cagr ?? 0.10,
                upside_pct:     cockpitOutput.upsidePct ?? 0,
                inputs: {
                  wacc:            cockpitDefaults?.wacc ?? 0.10,
                  cagr:            cockpitDefaults?.cagr ?? 0.10,
                  terminalG:       cockpitDefaults?.terminalG ?? 0.025,
                  netMargin:       cockpitDefaults?.netMargin ?? 0,
                  exitPE:          cockpitDefaults?.exitPE ?? 0,
                  exitMultiple:    cockpitDefaults?.exitMultiple ?? 0,
                  revenueMultiple: cockpitDefaults?.revenueMultiple ?? 0,
                },
                scenarios: {
                  bull: cockpitOutput.scenarios.bull.fairValue ?? 0,
                  base: cockpitOutput.scenarios.base.fairValue ?? 0,
                  bear: cockpitOutput.scenarios.bear.fairValue ?? 0,
                },
              } : null,
            })
            setSaveDialogOpen(true)
          }}
      />

      {/* Session-based soft auth nudge (appears on 2nd+ stock page view) */}
      <AuthBanner />

      <div className="px-4 sm:px-6 lg:px-8 pb-[calc(120px+env(safe-area-inset-bottom,0px))] lg:pb-16">
        {/* First-visit orientation — shown once, then dismissed to localStorage */}
        <div className="pt-4">
          <StockOrientationStrip />
        </div>

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
                  {/* Summary tab — 5-card strip, insight tri-column, quality grid, bottom row */}
                  <SummaryTab
                    ticker={data.ticker}
                    companyName={data.companyName}
                    price={data.quote.price}
                    change={data.quote.change}
                    changePct={data.quote.changePct}
                    currency={currency}
                    high52={data.quote.fiftyTwoWeekHigh}
                    low52={data.quote.fiftyTwoWeekLow}
                    sector={data.quote.sector ?? ''}
                    fairValue={cockpitOutput?.blendedFairValue ?? null}
                    upsidePct={cockpitOutput?.upsidePct ?? null}
                    confidence={
                      cockpitOutput?.divergence?.overallConfidence === 'high'   ? 'High'   :
                      cockpitOutput?.divergence?.overallConfidence === 'medium' ? 'Medium' :
                      cockpitOutput ? 'Low' : null
                    }
                    modelCount={cockpitOutput?.methods?.filter(m => m.fairValue != null && m.fairValue > 0).length ?? 0}
                    totalModels={cockpitOutput?.methods?.length ?? 4}
                    sharesM={data.fairValue?.sharesOutstanding ?? null}
                    cashM={data.fairValue?.cash ?? null}
                    debtM={data.fairValue?.debt ?? null}
                    revenueM={data.businessProfile?.revenueM ?? null}
                    fcfMargin={data.businessProfile?.fcfMargin ?? null}
                    wacc={data.wacc?.wacc ?? 0.09}
                    terminalG={data.terminalG ?? 0.025}
                    historicalCAGR={data.cagrAnalysis?.historicalCagr3y ?? null}
                    analystCAGR={data.cagrAnalysis?.analystEstimate1y ?? null}
                    isEmergingMarket={computedScores?.altman?.isReliable === false}
                    scenarios={cockpitOutput ? {
                      bull: { fairValue: cockpitOutput.scenarios.bull.fairValue ?? 0, wacc: cockpitOutput.scenarios.bull.wacc, cagr: cockpitOutput.scenarios.bull.cagr, terminalG: data.terminalG ?? 0.025 },
                      base: { fairValue: cockpitOutput.scenarios.base.fairValue ?? 0, wacc: cockpitOutput.scenarios.base.wacc, cagr: cockpitOutput.scenarios.base.cagr, terminalG: data.terminalG ?? 0.025 },
                      bear: { fairValue: cockpitOutput.scenarios.bear.fairValue ?? 0, wacc: cockpitOutput.scenarios.bear.wacc, cagr: cockpitOutput.scenarios.bear.cagr, terminalG: data.terminalG ?? 0.025 },
                    } : null}
                    ratings={data.ratings}
                    scores={computedScores ?? data.scores}
                    businessProfile={data.businessProfile}
                    cagrAnalysis={data.cagrAnalysis ?? null}
                    statementsData={statementsData}
                    valuationMethods={data.valuationMethods ?? null}
                    quote={data.quote}
                    analystTargetMean={data.quote.analystTargetMean ?? null}
                    userModelFairValue={userModelFairValue}
                    analystRecommendation={data.analystRecommendation ?? ''}
                    onViewValuation={() => handleTabChange('valuation')}
                    onViewRisks={() => handleTabChange('risks')}
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
                  {/* Sidebar content as grid of boxes below the main card */}
                  <FinancialsSidebar
                    businessProfile={data.businessProfile}
                    scores={computedScores ?? data.scores}
                    financialStatements={data.financialStatements}
                    ownership={data.ownership}
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
          </>
        )}

        {/* ── Investment disclaimer ── */}
        <div className="px-4 sm:px-6 lg:px-8 pb-8 pt-2">
          <p className="text-[11px] text-slate-500 leading-relaxed text-center max-w-3xl mx-auto">
            <strong className="font-semibold text-slate-600">Not financial advice.</strong>{' '}
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
