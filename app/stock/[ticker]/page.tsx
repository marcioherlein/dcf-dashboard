'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PriceHeader from '@/components/stock/PriceHeader'
import PriceChart from '@/components/stock/PriceChart'
import WACCBreakdown from '@/components/stock/WACCBreakdown'
import DCFModel from '@/components/stock/DCFModel'
import NewsPanel from '@/components/stock/NewsPanel'
import InsiderTable from '@/components/stock/InsiderTable'
import ValuationHistory from '@/components/stock/ValuationHistory'

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
  terminalG: number
  analystRecommendation: string
}

export default function StockPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const router = useRouter()
  const [data, setData] = useState<FinancialsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [waccOverride, setWaccOverride] = useState<number | null>(null)

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

  const handleSave = useCallback(async () => {
    if (!data) return
    setSaving(true)
    try {
      await fetch('/api/valuations', {
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
    } finally {
      setSaving(false)
    }
  }, [data, waccOverride])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:text-gray-700">← Search</button>
          <span className="text-sm font-bold text-gray-900">{ticker}</span>
          {data && <span className="text-sm text-gray-400">{data.companyName}</span>}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-800" />
            <p className="text-sm text-gray-400">Calculating WACC, Beta, DCF… this takes ~10s</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <strong>Error:</strong> {error}. Yahoo Finance may be temporarily unavailable — try again in a moment.
          </div>
        )}

        {data && !loading && (
          <div className="space-y-6">
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

            <PriceChart ticker={ticker} />

            <WACCBreakdown
              wacc={data.wacc}
              onWACCChange={(w) => setWaccOverride(w)}
            />

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

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
  )
}
