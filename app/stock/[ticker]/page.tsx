'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import PriceHeader from '@/components/stock/PriceHeader'
import NewsPanel from '@/components/stock/NewsPanel'
import InsiderTable from '@/components/stock/InsiderTable'
import BusinessModel from '@/components/stock/BusinessModel'
import FinancialStatements from '@/components/stock/FinancialStatements'
import FinancialCharts from '@/components/stock/FinancialCharts'
import YahooFinancials from '@/components/stock/YahooFinancials'
import FinancialScores from '@/components/stock/FinancialScores'
import OwnershipPanel from '@/components/stock/OwnershipPanel'
import AtAGlance from '@/components/stock/AtAGlance'
import HealthSection from '@/components/stock/HealthSection'
import TabNav, { type TabId } from '@/components/stock/TabNav'
import ValuationLab from '@/components/valuation/ValuationLab'

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
  const { ticker } = useParams<{ ticker: string }>()
  const router = useRouter()
  const [data, setData]       = useState<FinancialsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('valuation')

  useEffect(() => {
    setLoading(true)
    setError('')
    setActiveTab('valuation')
    fetch(`/api/financials?ticker=${ticker}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [ticker])

  // Keep saving state for potential future use — suppress unused warning
  void setSaving; void saving

  const currency = data?.quote.currency === 'USD' ? '$' : (data?.quote.currency ?? '$') + ' '

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
        <TabNav activeTab={activeTab} onChange={setActiveTab} />
      )}

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-16">

        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
            <p className="text-sm text-slate-400">Calculating WACC · Beta · DCF…</p>
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
            <strong>Error:</strong> {error}. Yahoo Finance may be temporarily unavailable — try again in a moment.
          </div>
        )}

        {data && !loading && (
          <>
            {/* Always-visible price header */}
            <div className="pt-5">
              <PriceHeader
                ticker={data.ticker}
                companyName={data.companyName}
                price={data.quote.price}
                change={data.quote.change}
                changePct={data.quote.changePct}
                marketCap={data.quote.marketCap}
                peRatio={data.quote.peRatio}
                high52={data.quote.fiftyTwoWeekHigh}
                low52={data.quote.fiftyTwoWeekLow}
                analystTarget={data.quote.analystTargetMean}
                currency={data.quote.currency ?? 'USD'}
                sector={data.quote.sector ?? ''}
                analystRec={data.analystRecommendation}
              />
            </div>

            {/* ── Summary tab ── */}
            {activeTab === 'summary' && (
              <div className="space-y-4 pt-5">
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
                  high52={data.quote.fiftyTwoWeekHigh}
                  low52={data.quote.fiftyTwoWeekLow}
                  sector={data.quote.sector ?? ''}
                  country={data.businessProfile.country}
                  currency={currency}
                  fairValue={data.valuationMethods?.triangulatedFairValue ?? data.fairValue.fairValuePerShare}
                  upsidePct={data.valuationMethods?.triangulatedUpsidePct ?? data.fairValue.upsidePct}
                  overallGrade={data.ratings?.overall?.grade ?? 'N/A'}
                  overallLabel={data.ratings?.overall?.label ?? ''}
                />

                {(data.businessProfile.description || data.historicalRevenues.length >= 2) && (
                  <BusinessModel
                    businessProfile={data.businessProfile}
                    historicalRevenues={data.historicalRevenues}
                    ticker={ticker}
                    isDark={false}
                    incomeStatement={data.financialStatements?.incomeStatement}
                    cashFlow={data.financialStatements?.cashFlow}
                  />
                )}

                {data.ratings && data.scores && (
                  <HealthSection
                    ratings={data.ratings}
                    scores={data.scores}
                    financialsData={data}
                  />
                )}

                {/* CTA to Valuation Lab */}
                <div
                  className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => setActiveTab('valuation')}
                >
                  <div>
                    <div className="text-[13px] font-semibold text-slate-800">Build your own valuation</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Open Valuation Lab → adjust assumptions, see fair value live</div>
                  </div>
                  <span className="text-blue-600 font-medium text-[13px]">Valuation Lab →</span>
                </div>
              </div>
            )}

            {/* ── Valuation Lab tab ── */}
            {activeTab === 'valuation' && (
              <div className="space-y-4 pt-5">
                <ValuationLab apiData={data} ticker={ticker} />
              </div>
            )}

            {/* ── Financials tab ── */}
            {activeTab === 'financials' && (
              <div className="space-y-4 pt-5">
                <YahooFinancials ticker={ticker} />
                {data.financialStatements ? (
                  <>
                    <FinancialStatements
                      incomeStatement={data.financialStatements.incomeStatement}
                      balanceSheet={data.financialStatements.balanceSheet}
                      cashFlow={data.financialStatements.cashFlow}
                      currency={currency}
                      cagr={data.cagr}
                    />
                    <FinancialCharts
                      incomeStatement={data.financialStatements.incomeStatement}
                      cashFlow={data.financialStatements.cashFlow}
                      currency={currency}
                      isDark={false}
                    />
                  </>
                ) : (
                  <p className="text-sm text-slate-400 py-8 text-center">Financial statement data unavailable</p>
                )}
              </div>
            )}

            {/* ── Peers stub ── */}
            {activeTab === 'peers' && (
              <div className="space-y-4 pt-5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-6 py-12 text-center">
                  <div className="text-[15px] font-semibold text-slate-700 mb-2">Peer Comparison</div>
                  <div className="text-[13px] text-slate-400">Coming soon — peer multiples, growth, and margin comparison.</div>
                </div>
              </div>
            )}

            {/* ── Quality tab ── */}
            {activeTab === 'quality' && (
              <div className="space-y-4 pt-5">
                {data.scores && <FinancialScores scores={data.scores} />}
                {data.ratings && data.scores && (
                  <HealthSection
                    ratings={data.ratings}
                    scores={data.scores}
                    financialsData={data}
                  />
                )}
              </div>
            )}

            {/* ── Ownership tab ── */}
            {activeTab === 'ownership' && (
              <div className="space-y-4 pt-5">
                {data.ownership && <OwnershipPanel ownership={data.ownership} />}
                <InsiderTable ticker={ticker} />
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
