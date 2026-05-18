'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import NewsPanel from '@/components/stock/NewsPanel'
import BusinessModel from '@/components/stock/BusinessModel'
import FinancialScores from '@/components/stock/FinancialScores'
import AtAGlance from '@/components/stock/AtAGlance'
import HealthSection from '@/components/stock/HealthSection'
import TabNav, { type TabId } from '@/components/stock/TabNav'
import ValuationLab from '@/components/valuation/ValuationLab'
import FinancialsHub from '@/components/stock/FinancialsHub'
import InvestorGradeCard from '@/components/stock/InvestorGradeCard'
import InvestmentVerdictCard from '@/components/stock/InvestmentVerdictCard'
import ThesisBuilderTab from '@/components/stock/ThesisBuilderTab'
import { LoginGateProvider, useLoginGate } from '@/components/auth/LoginGateProvider'
import AuthBanner from '@/components/auth/AuthBanner'
import { calculatePiotroski, calculateAltman, calculateBeneish } from '@/lib/dcf/calculateScores'
import { track } from '@/lib/analytics/events'
import { loadPreLoginState, clearPreLoginState } from '@/lib/auth/preLoginState'
import { useSession } from 'next-auth/react'
import { Sparkles } from 'lucide-react'

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
    analystTargetMean: number; currency: string; sector: string
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
  const router = useRouter()
  const { requireAuth } = useLoginGate()
  const { data: session } = useSession()
  const [data, setData]             = useState<FinancialsData | null>(null)
  const [statementsData, setStatementsData] = useState<StatementsData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [financialsHighlight, setFinancialsHighlight] = useState<{ rowKey: string; statement: 'income' | 'balance' | 'cashflow' } | null>(null)

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

  // Derive verdict zone and top risk for InvestmentVerdictCard
  const verdictZone: 'undervalued' | 'fairvalue' | 'overvalued' | 'unknown' = (() => {
    if (!data) return 'unknown'
    const pct = data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue?.upsidePct ?? null
    if (pct == null) return 'unknown'
    const base: 'undervalued' | 'fairvalue' | 'overvalued' = pct > 0.15 ? 'undervalued' : pct < -0.10 ? 'overvalued' : 'fairvalue'
    if (computedScores?.altman?.zone === 'Distress') return 'overvalued'
    return base
  })()

  const topRisk: string | null = (() => {
    if (!data) return null
    if (computedScores?.beneish?.mScore != null && computedScores.beneish.mScore > -1.78)
      return 'Beneish M-Score flags possible earnings manipulation'
    if (computedScores?.altman?.zone === 'Distress')
      return 'Altman Z-Score in financial distress zone'
    if ((computedScores?.piotroski?.score ?? 9) <= 2)
      return 'Piotroski F-Score very low — weak fundamentals'
    if (data.isNegativeFCF)
      return 'Negative free cash flow — DCF relies on turnaround assumption'
    return null
  })()

  const topDrivers: string[] = data?.cagrAnalysis?.drivers?.slice(0, 3) ?? []

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    if (data) track('tab_changed', { ticker, tab })
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB]">

      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-blue-600 transition-colors"
        >
          ← Home
        </button>
        <span className="text-slate-300">·</span>
        <span className="text-[12px] text-blue-600 font-semibold">{ticker}</span>
        {data && <span className="text-[12px] text-slate-400 truncate max-w-xs">{data.companyName}</span>}
      </div>

      {/* Tab navigation */}
      {data && !loading && (
        <TabNav activeTab={activeTab} onChange={handleTabChange} />
      )}

      {/* Session-based soft auth nudge (appears on 2nd+ stock page view) */}
      <AuthBanner />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-16">

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
          <div className="mt-8 rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
            <strong>Error:</strong> {error}. Yahoo Finance may be temporarily unavailable — try again in a moment.
          </div>
        )}

        {data && !loading && (
          <>
            {/* ── InvestorGradeCard — persistent above-fold summary ── */}
            <div className="pt-5">
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
                peRatio={data.quote.peRatio}
                high52={data.quote.fiftyTwoWeekHigh}
                low52={data.quote.fiftyTwoWeekLow}
                analystTarget={data.quote.analystTargetMean}
                onSave={() => requireAuth({ intent: 'save_watchlist' })}
                onViewDetails={() => handleTabChange('valuation')}
              />
            </div>

            {/* ── Overview tab ── */}
            {activeTab === 'overview' && (
              <div id="tabpanel-overview" role="tabpanel" className="space-y-4 pt-5">
                <InvestmentVerdictCard
                  ticker={data.ticker}
                  companyName={data.companyName}
                  sector={data.quote.sector ?? ''}
                  price={data.quote.price}
                  currency={data.quote.currency ?? 'USD'}
                  grade={data.ratings?.overall?.grade ?? 'N/A'}
                  gradeLabel={data.ratings?.overall?.label ?? ''}
                  fairValue={data.valuationMethods?.triangulatedFairValue ?? data.fairValue?.fairValuePerShare ?? null}
                  upsidePct={data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue?.upsidePct ?? null}
                  bearFV={data.scenarios?.bear?.fairValue ?? null}
                  bullFV={data.scenarios?.bull?.fairValue ?? null}
                  verdictZone={verdictZone}
                  topRisk={topRisk}
                  topDrivers={topDrivers}
                  onSave={() => requireAuth({ intent: 'save_watchlist' })}
                  onViewValuation={() => handleTabChange('valuation')}
                />

                <PriceChart
                  ticker={ticker}
                  isDark={false}
                  fcffFairValue={data.fairValue.fairValuePerShare}
                  triangulatedFairValue={data.valuationMethods?.triangulatedFairValue}
                  analystTarget={data.quote.analystTargetMean}
                />

                <AtAGlance
                  companyName={data.companyName}
                  price={data.quote.price}
                  marketCap={data.quote.marketCap}
                  high52={data.quote.fiftyTwoWeekHigh}
                  low52={data.quote.fiftyTwoWeekLow}
                  sector={data.quote.sector ?? ''}
                  country={data.businessProfile.country}
                  currency={currency}
                  fairValue={data.valuationMethods?.triangulatedFairValue ?? data.fairValue.fairValuePerShare}
                  upsidePct={data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue.upsidePct}
                  overallGrade={data.ratings?.overall?.grade ?? 'N/A'}
                  overallLabel={data.ratings?.overall?.label ?? ''}
                  statementsData={statementsData}
                />

                {(data.businessProfile.description || data.historicalRevenues.length >= 2) && (
                  <BusinessModel
                    businessProfile={data.businessProfile}
                    historicalRevenues={data.historicalRevenues}
                    ticker={ticker}
                    isDark={false}
                    incomeStatement={data.financialStatements?.incomeStatement}
                    cashFlow={data.financialStatements?.cashFlow}
                    statementsData={statementsData}
                  />
                )}

                {data.ratings && data.scores && (
                  <HealthSection
                    ratings={data.ratings}
                    scores={computedScores ?? data.scores}
                    financialsData={data}
                  />
                )}

                <div
                  className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleTabChange('valuation')}
                >
                  <div>
                    <div className="text-[13px] font-semibold text-slate-800">Build your own valuation</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Open Valuation → adjust assumptions, see fair value live</div>
                  </div>
                  <span className="text-blue-600 font-medium text-[13px]">Valuation →</span>
                </div>

                {/* AI Analysis teaser — no login gate; navigates to risks tab */}
                <button
                  onClick={() => handleTabChange('risks')}
                  className="w-full rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-4 flex items-center justify-between hover:from-indigo-100 hover:to-violet-100 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles size={18} className="text-indigo-500 shrink-0" />
                    <div>
                      <div className="text-[13px] font-semibold text-indigo-900">Risks &amp; Signals</div>
                      <div className="text-[11px] text-indigo-500 mt-0.5">Plain-English breakdown of financials, risks, and key drivers</div>
                    </div>
                  </div>
                  <span className="text-[12px] font-semibold text-indigo-600 shrink-0">View →</span>
                </button>
              </div>
            )}

            {/* ── Valuation tab ── */}
            {activeTab === 'valuation' && (
              <div className="space-y-4 pt-5">
                <ValuationLab apiData={data} ticker={ticker} statementsData={statementsData} onNavigateToFinancials={handleNavigateToFinancials} />

                {/* Thesis Builder — collapsible at bottom of Valuation tab */}
                <details className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <summary className="px-5 py-4 cursor-pointer text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors list-none flex items-center justify-between">
                    <span>Thesis Builder — build your investment case</span>
                    <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="p-5 border-t border-slate-100">
                    <ThesisBuilderTab ticker={ticker} data={data} />
                  </div>
                </details>
              </div>
            )}

            {/* ── Financials tab ── */}
            {activeTab === 'financials' && (
              <div className="space-y-4 pt-5">
                <FinancialsHub
                  statementsData={statementsData}
                  financialsData={data}
                  currency={currency}
                  reportingCurrency={statementsData?.financialCurrency}
                  cagr={data.cagr}
                  highlight={financialsHighlight}
                />
              </div>
            )}

            {/* ── Risks & Signals tab ── */}
            {activeTab === 'risks' && (
              <div className="space-y-4 pt-5">
                {data.ratings && data.scores && (
                  <HealthSection
                    ratings={data.ratings}
                    scores={computedScores ?? data.scores}
                    financialsData={data}
                  />
                )}
                {data.scores && <FinancialScores scores={computedScores ?? data.scores} />}
              </div>
            )}

            {/* ── News tab ── */}
            {activeTab === 'news' && (
              <div className="space-y-4 pt-5">
                <NewsPanel ticker={ticker} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
