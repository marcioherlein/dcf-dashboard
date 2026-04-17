'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import PriceHeader from '@/components/stock/PriceHeader'
import WACCBreakdown from '@/components/stock/WACCBreakdown'
import DCFModel from '@/components/stock/DCFModel'
import NewsPanel from '@/components/stock/NewsPanel'
import InsiderTable from '@/components/stock/InsiderTable'
import ValuationHistory, { saveLocal } from '@/components/stock/ValuationHistory'
import CAGRAnalysis from '@/components/stock/CAGRAnalysis'
import BusinessModel from '@/components/stock/BusinessModel'
import RatingsPanel from '@/components/stock/RatingsPanel'
import ValuationMethods from '@/components/stock/ValuationMethods'
import FinancialStatements from '@/components/stock/FinancialStatements'
import FinancialCharts from '@/components/stock/FinancialCharts'
import FinancialScores from '@/components/stock/FinancialScores'
import OwnershipPanel from '@/components/stock/OwnershipPanel'
import TabNav, { type TabId } from '@/components/stock/TabNav'

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />,
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
  const [data, setData] = useState<FinancialsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [waccOverride, setWaccOverride] = useState<number | null>(null)
  const [terminalGOverride, setTerminalGOverride] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  useEffect(() => {
    setLoading(true)
    setError('')
    setWaccOverride(null)
    setTerminalGOverride(null)
    setActiveTab('summary')
    fetch(`/api/financials?ticker=${ticker}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [ticker])

  const handleSave = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!data) return { ok: false, error: 'No data loaded' }
    setSaving(true)
    try {
      const res = await fetch('/api/valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: data.ticker,
          company: data.companyName,
          price_at_save: data.quote.price,
          fair_value: data.fairValue.fairValuePerShare,
          wacc: waccOverride ?? data.wacc.wacc,
          beta: data.wacc.inputs.beta,
          terminal_g: terminalGOverride ?? data.terminalG,
          cagr: data.cagr,
          upside_pct: data.fairValue.upsidePct,
          inputs: data.wacc.inputs,
          scenarios: data.scenarios,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        saveLocal(data.ticker, {
          id: `local_${Date.now()}`,
          saved_at: new Date().toISOString(),
          price_at_save: data.quote.price,
          fair_value: data.fairValue.fairValuePerShare,
          wacc: waccOverride ?? data.wacc.wacc,
          cagr: data.cagr,
          upside_pct: data.fairValue.upsidePct,
        })
        return { ok: false, error: body.error ?? `Server error ${res.status}` }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String(e) }
    } finally {
      setSaving(false)
    }
  }, [data, waccOverride, terminalGOverride])

  const currency = data?.quote.currency === 'USD' ? '$' : (data?.quote.currency ?? '$') + ' '

  return (
    <div className="min-h-screen bg-[#F8FAFB]">

      {/* Breadcrumb bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-3">
        <button
          onClick={() => router.push('/factor-ranking')}
          className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-blue-600 transition-colors"
        >
          ← Screener
        </button>
        <span className="text-slate-300">·</span>
        <span className="text-[12px] text-blue-600 font-semibold">{ticker}</span>
        {data && <span className="text-[12px] text-slate-400 truncate max-w-xs">{data.companyName}</span>}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-12">
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
          <div>
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

            <div className="-mx-4 sm:-mx-6 lg:-mx-8 mt-4">
              <TabNav activeTab={activeTab} onChange={setActiveTab} />
            </div>

            {/* ── Summary ── */}
            <div className={`pt-6 space-y-4 ${activeTab === 'summary' ? 'block' : 'hidden'}`}>
              <PriceChart
                ticker={ticker}
                isDark={false}
                fcffFairValue={data.fairValue.fairValuePerShare}
                triangulatedFairValue={data.valuationMethods?.triangulatedFairValue}
                analystTarget={data.quote.analystTargetMean}
              />
              {data.ratings && <RatingsPanel ratings={data.ratings} />}
            </div>

            {/* ── Financials ── */}
            <div className={`pt-6 space-y-4 ${activeTab === 'financials' ? 'block' : 'hidden'}`}>
              {data.financialStatements && (
                <FinancialStatements
                  incomeStatement={data.financialStatements.incomeStatement}
                  balanceSheet={data.financialStatements.balanceSheet}
                  cashFlow={data.financialStatements.cashFlow}
                  currency={currency}
                  cagr={data.cagr}
                />
              )}
              {data.financialStatements && (
                <FinancialCharts
                  incomeStatement={data.financialStatements.incomeStatement}
                  cashFlow={data.financialStatements.cashFlow}
                  currency={currency}
                  isDark={false}
                />
              )}
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
            </div>

            {/* ── Valuation ── */}
            <div className={`pt-6 space-y-4 ${activeTab === 'valuation' ? 'block' : 'hidden'}`}>
              {data.valuationMethods && (
                <ValuationMethods
                  valuationMethods={data.valuationMethods}
                  currency={currency}
                />
              )}
              <DCFModel
                projections={data.dcf.projections}
                terminalValue={data.dcf.terminalValue}
                terminalValueDiscounted={data.dcf.terminalValueDiscounted}
                sumPV={data.dcf.sumPV}
                ev={data.dcf.ev}
                fairValue={data.fairValue}
                wacc={waccOverride ?? data.wacc.wacc}
                cagr={data.cagr}
                terminalG={data.terminalG}
                scenarios={data.scenarios}
                baseFCF={data.baseFCF}
                terminalGOverride={terminalGOverride}
                onTerminalGChange={setTerminalGOverride}
                growthModel={data.growthModel}
                yearlyGrowthRates={data.dcf.yearlyGrowthRates}
                historicalFCF={data.historicalFCF}
              />
              <WACCBreakdown
                wacc={data.wacc}
                onWACCChange={(w) => setWaccOverride(w)}
              />
              {data.cagrAnalysis && (
                <CAGRAnalysis
                  cagrAnalysis={data.cagrAnalysis}
                  isNegativeFCF={data.isNegativeFCF ?? false}
                  growthModel={data.growthModel}
                  terminalG={data.terminalG}
                />
              )}
            </div>

            {/* ── Quality ── */}
            <div className={`pt-6 space-y-4 ${activeTab === 'quality' ? 'block' : 'hidden'}`}>
              {data.scores && <FinancialScores scores={data.scores} />}
            </div>

            {/* ── Ownership ── */}
            <div className={`pt-6 space-y-4 ${activeTab === 'ownership' ? 'block' : 'hidden'}`}>
              {data.ownership && <OwnershipPanel ownership={data.ownership} />}
              <InsiderTable ticker={ticker} />
            </div>

            {/* ── News ── */}
            <div className={`pt-6 space-y-4 ${activeTab === 'news' ? 'block' : 'hidden'}`}>
              <NewsPanel ticker={ticker} />
            </div>

            <div className="pt-6">
              <ValuationHistory
                ticker={ticker}
                onSave={handleSave}
                saving={saving}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
