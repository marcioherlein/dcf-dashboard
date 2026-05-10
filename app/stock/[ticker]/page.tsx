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
import ValuationSection from '@/components/stock/ValuationSection'
import FCFBuildUp from '@/components/stock/FCFBuildUp'
import FinancialStatements from '@/components/stock/FinancialStatements'
import FinancialCharts from '@/components/stock/FinancialCharts'
import FinancialScores from '@/components/stock/FinancialScores'
import OwnershipPanel from '@/components/stock/OwnershipPanel'
import AtAGlance from '@/components/stock/AtAGlance'
import HealthSection from '@/components/stock/HealthSection'
import ModelSection from '@/components/stock/ModelSection'
import TabNav, { type TabId } from '@/components/stock/TabNav'
import ModellingWorkspace from '@/components/modelling/ModellingWorkspace'

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
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  // Overrides from WACCBreakdown / DCFModel inline editors (kept for the Details section)
  const [waccOverride, setWaccOverride]         = useState<number | null>(null)
  const [terminalGOverride, setTerminalGOverride] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    setWaccOverride(null)
    setTerminalGOverride(null)
    setDetailsOpen(false)
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
          <div className="space-y-4 pt-5">

            {/* Always-visible price header */}
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

            {/* ── Modelling tab ── */}
            {activeTab === 'modelling' && (
              <ModellingWorkspace apiData={data} ticker={ticker} />
            )}

            {/* ── Summary / default tabs ── */}
            {activeTab !== 'modelling' && (<>

            {/* Section 1: At a Glance */}
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

            {/* Section 2: The Business */}
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

            {/* Section 3: Financial Health */}
            {data.ratings && data.scores && (
              <HealthSection
                ratings={data.ratings}
                scores={data.scores}
                financialsData={data}
              />
            )}

            {/* Section 4: What Is It Worth? */}
            {data.valuationMethods && (
              <ValuationSection
                companyName={data.companyName}
                currency={currency}
                fairValuePerShare={data.valuationMethods.triangulatedFairValue ?? data.fairValue.fairValuePerShare}
                upsidePct={data.valuationMethods.triangulatedUpsidePct ?? data.fairValue.upsidePct}
                valuationMethods={data.valuationMethods}
                scenarios={data.scenarios}
                currentPrice={data.quote.price}
                financialsData={data}
              />
            )}

            {/* Section 5: Model the Assumptions */}
            <ModelSection
              baseCagr={data.cagr}
              baseWacc={data.wacc.wacc}
              baseTerminalG={data.terminalG}
              baseFairValue={data.valuationMethods?.triangulatedFairValue ?? data.fairValue.fairValuePerShare}
              currentPrice={data.quote.price}
              currency={currency}
              cagrAnalysis={data.cagrAnalysis}
              baseFCF={data.baseFCF}
              cashM={data.fairValue.cash}
              debtM={data.fairValue.debt}
              sharesM={data.fairValue.sharesOutstanding}
              growthModel={data.growthModel ?? 'two-stage'}
            />

            {/* Section 6: Detailed Analysis (collapsible) */}
            <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
              <button
                onClick={() => setDetailsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Show full analysis</span>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {detailsOpen && (
                <div className="border-t border-slate-100 px-4 sm:px-6 pb-8 space-y-5 pt-5">

                  {/* Price chart */}
                  <PriceChart
                    ticker={ticker}
                    isDark={false}
                    fcffFairValue={data.fairValue.fairValuePerShare}
                    triangulatedFairValue={data.valuationMethods?.triangulatedFairValue}
                    analystTarget={data.quote.analystTargetMean}
                  />

                  {/* Financial statements */}
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

                  {/* DCF model */}
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

                  {/* FCF build-up */}
                  {data.financialStatements && (
                    <FCFBuildUp
                      incomeStatement={data.financialStatements.incomeStatement}
                      balanceSheet={data.financialStatements.balanceSheet}
                      cashFlow={data.financialStatements.cashFlow}
                      wacc={waccOverride ?? data.wacc.wacc}
                      taxRate={data.wacc.inputs.taxRate}
                      cash={data.fairValue.cash}
                      debt={data.fairValue.debt}
                      sharesOutstanding={data.fairValue.sharesOutstanding}
                      currentPrice={data.fairValue.currentPrice}
                      cagrAnalysis={data.cagrAnalysis}
                      currency={currency}
                      financialCurrencyNote={data.financialCurrencyNote}
                    />
                  )}

                  {/* WACC breakdown */}
                  <WACCBreakdown
                    wacc={data.wacc}
                    onWACCChange={(w) => setWaccOverride(w)}
                  />

                  {/* CAGR analysis */}
                  {data.cagrAnalysis && (
                    <CAGRAnalysis
                      cagrAnalysis={data.cagrAnalysis}
                      isNegativeFCF={data.isNegativeFCF ?? false}
                      growthModel={data.growthModel}
                      terminalG={data.terminalG}
                    />
                  )}

                  {/* Quality scores */}
                  {data.scores && <FinancialScores scores={data.scores} />}

                  {/* Ownership */}
                  {data.ownership && <OwnershipPanel ownership={data.ownership} />}
                  <InsiderTable ticker={ticker} />

                  {/* News */}
                  <NewsPanel ticker={ticker} />

                  {/* Valuation history */}
                  <ValuationHistory
                    ticker={ticker}
                    onSave={handleSave}
                    saving={saving}
                  />
                </div>
              )}
            </div>

            </>)}

          </div>
        )}
      </div>
    </div>
  )
}
