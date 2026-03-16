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

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />,
})

interface CAGRAnalysisData {
  historicalCagr3y: number
  analystEstimate1y: number
  analystEstimate2y: number
  blended: number
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
  }
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
}

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
      aria-label="Toggle theme"
    >
      <span className="text-sm">{isDark ? '☀︎' : '☾'}</span>
      <div className={`relative flex h-5 w-9 items-center rounded-full transition-colors duration-300 ${isDark ? 'bg-white/20' : 'bg-gray-200'}`}>
        <span className={`absolute h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${isDark ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}

export default function StockPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const router = useRouter()
  const [data, setData] = useState<FinancialsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [waccOverride, setWaccOverride] = useState<number | null>(null)
  const [isDark, setIsDark] = useState(false)

  // Persist theme preference
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') setIsDark(true)
  }, [])

  const toggleTheme = () => {
    setIsDark((d) => {
      localStorage.setItem('theme', !d ? 'dark' : 'light')
      return !d
    })
  }

  useEffect(() => {
    setLoading(true)
    setError('')
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
          terminal_g: data.terminalG,
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
  }, [data, waccOverride])

  const currency = data?.quote.currency === 'USD' ? '$' : (data?.quote.currency ?? '$') + ' '

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-black" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>

        {/* Nav */}
        <nav className="sticky top-0 z-10 border-b border-black/[0.06] bg-white/80 px-6 py-3 backdrop-blur-xl dark:border-white/8 dark:bg-black/80">
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-400 transition hover:text-gray-700 dark:text-white/30 dark:hover:text-white/70"
            >
              ← Search
            </button>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{ticker}</span>
            {data && <span className="text-sm text-gray-400 dark:text-white/40">{data.companyName}</span>}
            <div className="ml-auto">
              <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
            </div>
          </div>
        </nav>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {loading && (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-800 dark:border-white/10 dark:border-t-white/60" />
              <p className="text-sm text-gray-400 dark:text-white/30">Calculating WACC, Beta, DCF… this takes ~10s</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
              <strong>Error:</strong> {error}. Yahoo Finance may be temporarily unavailable — try again in a moment.
            </div>
          )}

          {data && !loading && (
            <div className="space-y-4">
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

              <PriceChart ticker={ticker} isDark={isDark} />

              {data.ratings && <RatingsPanel ratings={data.ratings} />}

              {(data.businessProfile.description || data.historicalRevenues.length >= 2) && (
                <BusinessModel
                  businessProfile={data.businessProfile}
                  historicalRevenues={data.historicalRevenues}
                  ticker={ticker}
                  isDark={isDark}
                />
              )}

              <WACCBreakdown
                wacc={data.wacc}
                onWACCChange={(w) => setWaccOverride(w)}
              />

              {data.cagrAnalysis && (
                <CAGRAnalysis
                  cagrAnalysis={data.cagrAnalysis}
                  isNegativeFCF={data.isNegativeFCF ?? false}
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
              />

              {data.valuationMethods && (
                <ValuationMethods
                  valuationMethods={data.valuationMethods}
                  currency={currency}
                />
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <NewsPanel ticker={ticker} />
                <InsiderTable ticker={ticker} />
              </div>

              <ValuationHistory
                ticker={ticker}
                onSave={handleSave}
                saving={saving}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
