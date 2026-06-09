'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useParams } from 'next/navigation'
import NewsPanel from '@/components/stock/NewsPanel'
import HealthSection from '@/components/stock/HealthSection'
import { type TabId } from '@/components/stock/TabNav'
import TabNav from '@/components/stock/TabNav'
import StockContextBar from '@/components/stock/StockContextBar'
import FinancialsHub from '@/components/stock/FinancialsHub'
import { computeCockpitOutput } from '@/lib/valuation/cockpit'
import ValuationCockpit, { buildSnapshot, seedAssumptions } from '@/components/valuation/ValuationCockpit'
import AuthBanner from '@/components/auth/AuthBanner'
import LoginToSaveModal from '@/components/auth/LoginToSaveModal'
import StockLoginWall from '@/components/stock/StockLoginWall'
import StockUpgradeWall from '@/components/stock/StockUpgradeWall'
import { calculatePiotroski, calculateAltman, calculateBeneish } from '@/lib/dcf/calculateScores'
import { track } from '@/lib/analytics/events'
import { loadPreLoginState, clearPreLoginState } from '@/lib/auth/preLoginState'
import { useSession } from 'next-auth/react'
import SaveToWatchlistDialog, { type WatchlistSavePayload } from '@/components/watchlist/SaveToWatchlistDialog'
import ShareCardModal from '@/components/valuation/ShareCardModal'
import ValuationNotAvailableCard from '@/components/stock/ValuationNotAvailableCard'
import SummaryTab from '@/components/stock/summary/SummaryTab'
import StockOrientationStrip from '@/components/onboarding/StockOrientationStrip'
import { LoginGateProvider } from '@/components/auth/LoginGateProvider'
import TabErrorBoundary from '@/components/stock/TabErrorBoundary'
import GatedTabOverlay from '@/components/stock/GatedTabOverlay'


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
    // Extended hours
    marketState?: string | null
    preMarketPrice?: number | null; preMarketChangePct?: number | null
    postMarketPrice?: number | null; postMarketChangePct?: number | null
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
  limitedHistory?: boolean
  historyYears?: number
  peerComps?: Array<{
    ticker: string
    trailingPE: number | null
    priceToBook: number | null
    priceToSales: number | null
    evToEbitda: number | null
    evToRevenue: number | null
  }>
  analystForwardEstimates?: Array<{
    period: string
    eps?: { growth?: number | null } | null
    revenue?: { growth?: number | null } | null
  }>
}

export default function StockPage() {
  return (
    // eslint-disable-next-line react/jsx-no-undef
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
  const [pageLiveDcfFV, setPageLiveDcfFV] = useState<number | null>(null)
  const [viewGate, setViewGate] = useState<'idle' | 'allowed' | 'login' | 'upgrade'>('idle')
  const [viewCount, setViewCount] = useState(0)
  const [loginToSaveOpen, setLoginToSaveOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

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

  // Check / record stock view gate
  useEffect(() => {
    if (session === undefined) return // still loading
    if (!session?.user) {
      setViewGate('allowed') // unauthenticated users see Overview + Financials; other tabs gate individually
      return
    }
    fetch('/api/stock-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }),
    })
      .then(r => r.json())
      .then((res: { allowed: boolean; viewCount: number }) => {
        setViewCount(res.viewCount)
        setViewGate(res.allowed ? 'allowed' : 'upgrade')
      })
      .catch(() => setViewGate(session?.user ? 'upgrade' : 'allowed')) // fail-closed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, ticker])

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
  // tabs always show the same number. pageLiveDcfFV is set when the ModellingWorkspace
  // (inside ValuationCockpit) computes, keeping both tabs in sync with the Full DCF Table.
  const cockpitSnapshot = useMemo(
    () => (data ? buildSnapshot(data, statementsData) : null),
    [data, statementsData]
  )
  const effectiveCockpitSnapshot = useMemo(
    () => pageLiveDcfFV != null && cockpitSnapshot
      ? { ...cockpitSnapshot, fullDcfFairValue: pageLiveDcfFV }
      : cockpitSnapshot,
    [cockpitSnapshot, pageLiveDcfFV]
  )
  const cockpitDefaults = useMemo(
    () => (data ? seedAssumptions(data) : null),
    [data]
  )
  const cockpitOutput = useMemo(
    () => (effectiveCockpitSnapshot && cockpitDefaults
      ? computeCockpitOutput(cockpitDefaults, effectiveCockpitSnapshot)
      : null),
    [effectiveCockpitSnapshot, cockpitDefaults]
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
    <div className="min-h-dvh bg-[#F4F3EF]">

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
        nextEarningsDate={data?.quote.nextEarningsDate ?? null}
        marketState={data?.quote.marketState ?? null}
        preMarketPrice={data?.quote.preMarketPrice ?? null}
        preMarketChangePct={data?.quote.preMarketChangePct ?? null}
        postMarketPrice={data?.quote.postMarketPrice ?? null}
        postMarketChangePct={data?.quote.postMarketChangePct ?? null}
        onSave={() => {
            if (!session?.user) { setLoginToSaveOpen(true); return }
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
        onShare={() => setShareOpen(true)}
      />

      <TabNav activeTab={activeTab} onChange={handleTabChange} isAuthed={!!session?.user} />

<div className="px-4 sm:px-6 lg:px-8 pb-[calc(120px+env(safe-area-inset-bottom,0px))] lg:pb-16">
        {/* First-visit orientation — shown once, then dismissed to localStorage */}
        <div className="pt-4">
          <StockOrientationStrip />
        </div>

        {/* Soft auth nudge — inline, not covering the page (appears on 2nd+ stock view) */}
        <AuthBanner />

        {loading && (
          <div className="pt-5 space-y-4 motion-safe:animate-pulse">
            {/* PriceHeader skeleton */}
            <div className="rounded-xl bg-white border border-[#E3E1DA] p-5">
              <div className="flex justify-between gap-4">
                <div className="space-y-2">
                  <div className="h-6 w-20 rounded-lg bg-[#F4F3EF]" />
                  <div className="h-7 w-52 rounded-lg bg-[#F4F3EF]" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-9 w-32 rounded-lg bg-[#F4F3EF] ml-auto" />
                  <div className="h-4 w-24 rounded-lg bg-[#F4F3EF] ml-auto" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-[#F4F3EF]" />
                ))}
              </div>
            </div>
            {/* Content skeleton */}
            <div className="h-72 rounded-xl bg-white border border-[#E3E1DA]" />
            <div className="h-48 rounded-xl bg-white border border-[#E3E1DA]" />
          </div>
        )}

        {error && (
          <div className={`mt-8 rounded-xl border px-5 py-5 ${error.includes('NYSE and NASDAQ') ? 'bg-[#F4F3EF] border-[#E3E1DA]' : 'bg-[#FCEAEA] border-[#D83B3B]/30'}`}>
            {error.includes('NYSE and NASDAQ') ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-[#06101F]">{error}</p>
                <p className="text-xs text-[#566174]">
                  International markets and other exchanges are on the roadmap.
                  Try searching for a US-listed equivalent or ADR.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-[#D83B3B]">
                  <strong>Error:</strong> {error}. Yahoo Finance may be temporarily unavailable.
                </p>
                <button
                  onClick={loadData}
                  className="self-start text-sm font-medium px-4 py-1.5 rounded-lg bg-[#FCEAEA] hover:bg-red-200 text-[#D83B3B] transition-colors"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}

        {data && !loading && (
          <>
            {/* ── View gate: login wall or upgrade wall ── */}
            {viewGate === 'login' && (
              <StockLoginWall
                ticker={ticker}
                companyName={data.companyName}
                price={data.quote.price}
                currency={currency}
                fairValue={cockpitOutput?.blendedFairValue ?? null}
                upsidePct={cockpitOutput?.upsidePct ?? null}
                scenarios={cockpitOutput ? {
                  bull: { fairValue: cockpitOutput.scenarios.bull.fairValue ?? 0 },
                  base: { fairValue: cockpitOutput.scenarios.base.fairValue ?? 0 },
                  bear: { fairValue: cockpitOutput.scenarios.bear.fairValue ?? 0 },
                } : null}
                grade={null}
              />
            )}
            {viewGate === 'upgrade' && (
              <StockUpgradeWall
                ticker={ticker}
                companyName={data.companyName}
                price={data.quote.price}
                currency={currency}
                fairValue={cockpitOutput?.blendedFairValue ?? null}
                upsidePct={cockpitOutput?.upsidePct ?? null}
                scenarios={cockpitOutput ? {
                  bull: { fairValue: cockpitOutput.scenarios.bull.fairValue ?? 0 },
                  base: { fairValue: cockpitOutput.scenarios.base.fairValue ?? 0 },
                  bear: { fairValue: cockpitOutput.scenarios.bear.fairValue ?? 0 },
                } : null}
                grade={null}
                viewCount={viewCount}
              />
            )}
            {/* While auth state is being determined, render a subtle pulse placeholder */}
            {viewGate === 'idle' && (
              <div className="pt-5 space-y-4 motion-safe:animate-pulse">
                <div className="h-24 rounded-xl bg-white border border-[#E3E1DA]" />
                <div className="h-48 rounded-xl bg-white border border-[#E3E1DA]" />
              </div>
            )}
            {viewGate === 'allowed' && (
            <div className="min-w-0">
            <AnimatePresence mode="wait">
              {/* ── Overview tab ── */}
              {activeTab === 'overview' && (
                <motion.div
                  key="tab-overview"
                  id="tabpanel-overview"
                  role="tabpanel"
                  aria-labelledby="tab-overview"
                  className="space-y-5 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  <TabErrorBoundary tabName="Overview">
                  {/* Summary tab */}
                  <SummaryTab
                    ticker={data.ticker}
                    companyName={data.companyName}
                    description={data.businessProfile?.description ?? undefined}
                    industry={data.businessProfile?.industry ?? undefined}
                    country={data.businessProfile?.country ?? undefined}
                    employees={data.businessProfile?.employees ?? null}
                    price={data.quote.price}
                    change={data.quote.change}
                    changePct={data.quote.changePct}
                    currency={currency}
                    high52={data.quote.fiftyTwoWeekHigh}
                    low52={data.quote.fiftyTwoWeekLow}
                    sector={data.quote.sector ?? ''}
                    fairValue={cockpitOutput?.blendedFairValue ?? null}
                    upsidePct={cockpitOutput?.upsidePct ?? null}
                    sharesM={data.fairValue?.sharesOutstanding ?? null}
                    cashM={data.fairValue?.cash ?? null}
                    debtM={data.fairValue?.debt ?? null}
                    revenueM={data.businessProfile?.revenueM ?? null}
                    fcfMargin={data.businessProfile?.fcfMargin ?? null}
                    wacc={data.wacc?.wacc ?? 0.10}
                    terminalG={data.terminalG ?? 0.03}
                    historicalCAGR={data.cagrAnalysis?.historicalCagr3y ?? null}
                    analystCAGR={data.cagrAnalysis?.analystEstimate1y ?? null}
                    isEmergingMarket={computedScores?.altman?.isReliable === false}
                    revenueHistory={data.financialStatements?.incomeStatement ?? []}
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
                    analystTargetLow={data.quote.analystTargetLow ?? null}
                    analystTargetHigh={data.quote.analystTargetHigh ?? null}
                    marketCap={data.quote.marketCap ?? null}
                    peRatio={data.quote.peRatio ?? null}
                    beta={data.wacc?.inputs?.beta ?? null}
                    pegRatio={data.quote.pegRatio ?? null}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    evToEbitda={(data.businessProfile as any)?.evToEbitda ?? null}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    dividendYield={(data as any)?.quote?.dividendYield ?? null}
                    nextEarningsDate={data.quote.nextEarningsDate ?? null}
                    holdingReturns={data.holdingReturns ?? null}
                    userModelFairValue={userModelFairValue}
                    analystRecommendation={data.analystRecommendation ?? ''}
                    analystForwardEstimates={data.analystForwardEstimates ?? []}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    roe={(data.businessProfile as any)?.roe ?? null}
                    roic={computedScores?.roic?.roic ?? data.scores?.roic?.roic ?? null}
                    ownership={data.ownership ? { insiderPct: data.ownership.insiderPct ?? null, shortPct: data.ownership.shortPct ?? null } : null}
                    onViewValuation={() => handleTabChange('valuation')}
                    onViewFinancials={() => handleTabChange('financials')}
                    onViewRisks={() => handleTabChange('risks')}
                    onViewAssumptions={() => {
                      handleTabChange('valuation')
                      setTimeout(() => {
                        document.getElementById('assumptions-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 400)
                    }}
                  />
                  </TabErrorBoundary>
                </motion.div>
              )}
              {activeTab === 'valuation' && (
                <motion.div
                  key="tab-valuation"
                  id="tabpanel-valuation"
                  role="tabpanel"
                  aria-labelledby="tab-valuation"
                  className="space-y-4 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  {!session?.user ? (
                    <GatedTabOverlay tabName="Valuation" />
                  ) : (
                  <TabErrorBoundary tabName="Valuation">
                  {data.canComputeDCF === false ? (
                    <ValuationNotAvailableCard
                      vetoReasons={data.vetoReasons ?? []}
                      ticker={ticker}
                      currentPrice={data.quote?.price ?? null}
                      analystTargetMean={data.quote?.analystTargetMean ?? null}
                      analystTargetLow={data.quote?.analystTargetLow ?? null}
                      analystTargetHigh={data.quote?.analystTargetHigh ?? null}
                      evToRevenue={(data.businessProfile as unknown as Record<string, unknown>)?.evToRevenue as number | null ?? null}
                      priceToSales={(data.businessProfile as unknown as Record<string, unknown>)?.priceToSales as number | null ?? null}
                      priceToBook={(data.businessProfile as unknown as Record<string, unknown>)?.priceToBook as number | null ?? null}
                      trailingPE={data.quote?.peRatio ?? null}
                      multiplesBlendedFV={data.valuationMethods?.models?.multiples?.blendedFairValue ?? null}
                      peerComps={data.peerComps ?? []}
                      currency={data.quote?.currency ?? 'USD'}
                    />
                  ) : (
                    <ValuationCockpit
                      apiData={data}
                      ticker={ticker}
                      statementsData={statementsData}
                      limitedHistory={data.limitedHistory}
                      historyYears={data.historyYears}
                      onNavigateToFinancials={handleNavigateToFinancials}
                      onNavigateToRisks={handleNavigateToRisks}
                      onLiveDcfFVChange={setPageLiveDcfFV}
                    />
                  )}
                  </TabErrorBoundary>
                  )}
                </motion.div>
              )}

              {/* ── Financials tab ── */}
              {activeTab === 'financials' && (
                <motion.div
                  key="tab-financials"
                  id="tabpanel-financials"
                  role="tabpanel"
                  aria-labelledby="tab-financials"
                  className="space-y-4 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  <TabErrorBoundary tabName="Financials">
                  <FinancialsHub
                    statementsData={statementsData}
                    financialsData={data}
                    currency={currency}
                    reportingCurrency={statementsData?.financialCurrency}
                    cagr={data.cagr}
                    highlight={financialsHighlight}
                    initialSubTab={financialsSubTab}
                  />
                  </TabErrorBoundary>
                </motion.div>
              )}

              {/* ── Risks & Signals tab ── */}
              {activeTab === 'risks' && (
                <motion.div
                  key="tab-risks"
                  id="tabpanel-risks"
                  role="tabpanel"
                  aria-labelledby="tab-risks"
                  className="space-y-4 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  {!session?.user ? (
                    <GatedTabOverlay tabName="Risks & Signals" />
                  ) : (
                  <TabErrorBoundary tabName="Risks">
                  {data.ratings && data.scores ? (
                    <HealthSection
                      ratings={data.ratings}
                      scores={computedScores ?? data.scores}
                      financialsData={{ ...data, scores: computedScores ?? data.scores }}
                      nextEarningsDate={data.quote.nextEarningsDate ?? null}
                    />
                  ) : (
                    <p className="text-sm text-[#8A95A6] text-center py-12">Health data unavailable for this stock.</p>
                  )}
                  </TabErrorBoundary>
                  )}
                </motion.div>
              )}

              {/* ── News tab ── */}
              {activeTab === 'news' && (
                <motion.div
                  key="tab-news"
                  id="tabpanel-news"
                  role="tabpanel"
                  aria-labelledby="tab-news"
                  className="space-y-4 pt-5"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reducedMotion ? 0 : tabDirection * -12 }}
                  transition={{ type: 'spring', duration: 0.32, bounce: 0.1 }}
                >
                  <TabErrorBoundary tabName="News">
                  {!session?.user ? (
                    <GatedTabOverlay tabName="News" />
                  ) : (
                    <NewsPanel ticker={ticker} />
                  )}
                  </TabErrorBoundary>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
            )}
          </>
        )}

        {/* ── Investment disclaimer ── */}
        <div className="px-4 sm:px-6 lg:px-8 pt-2 pb-[calc(72px+env(safe-area-inset-bottom,0px))] lg:pb-8">
          <p className="text-[11px] text-[#566174] leading-relaxed text-center max-w-3xl mx-auto">
            <strong className="font-semibold text-[#566174]">Not financial advice.</strong>{' '}
            All outputs — DCF estimates, fair values, health scores, and scenarios — are model results
            based on publicly available data and mathematical assumptions. They are for informational
            purposes only and are not recommendations to buy, sell, or hold any security.
            Always consult a qualified financial advisor before making investment decisions.{' '}
            <a href="/terms" className="underline hover:text-[#566174] transition-colors">Terms</a>
            {' '}·{' '}
            <a href="/privacy" className="underline hover:text-[#566174] transition-colors">Privacy</a>
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
    {loginToSaveOpen && (
      <LoginToSaveModal
        ticker={ticker}
        companyName={data?.companyName ?? ticker}
        fairValue={cockpitOutput?.blendedFairValue ?? null}
        upsidePct={cockpitOutput?.upsidePct ?? null}
        currency={currency}
        onClose={() => setLoginToSaveOpen(false)}
      />
    )}
    {shareOpen && cockpitOutput && (
      <ShareCardModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        ticker={ticker}
        companyName={data?.companyName ?? ticker}
        output={cockpitOutput}
        currentPrice={data?.quote?.price ?? 0}
        currency={currency}
      />
    )}
    </>
  )
}
