'use client'
import Link from 'next/link'
import type { MarketContextPayload } from '@/lib/market-context/types'

interface Props {
  portfolioExposure: MarketContextPayload['portfolioExposure']
  modelAlerts: MarketContextPayload['modelAlerts']
}

export default function PortfolioExposure({ portfolioExposure, modelAlerts }: Props) {
  const uniqueTickers = Array.from(new Set(modelAlerts.map(a => a.ticker)))
  const totalSaved = portfolioExposure.reduce((s, e) => s + e.count, 0)
  const highCount   = modelAlerts.filter(a => a.severity === 'high').length
  const medCount    = modelAlerts.filter(a => a.severity === 'medium').length
  const healthCount = Math.max(0, totalSaved - uniqueTickers.length)

  if (totalSaved === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-6 flex flex-col items-center justify-center min-h-[140px] text-center">
        <p className="text-sm font-semibold text-slate-700">No saved valuations yet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">Save a DCF valuation from any stock page to see model fragility alerts here.</p>
        <Link href="/analyze" className="mt-3 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          Go to stock analysis →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Saved Valuations</span>
        <span className="text-[11px] text-slate-400">{totalSaved} model{totalSaved !== 1 ? 's' : ''}</span>
      </div>
      <div className="px-5 py-4 space-y-3">

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 flex flex-col">
            <p className="text-[20px] font-bold text-red-700 tabular-nums leading-none">{highCount}</p>
            <p className="text-[11px] text-red-600 font-semibold mt-1 uppercase tracking-wider">High Risk</p>
            <p className="text-[11px] text-red-400 mt-1 leading-tight">Models with elevated valuation risk</p>
            {highCount > 0 && (
              <Link href="/valuations" className="mt-1.5 text-[11px] font-semibold text-red-600 hover:text-red-700 transition-colors self-start">
                View models →
              </Link>
            )}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 flex flex-col">
            <p className="text-[20px] font-bold text-amber-700 tabular-nums leading-none">{medCount}</p>
            <p className="text-[11px] text-amber-600 font-semibold mt-1 uppercase tracking-wider">Medium</p>
            <p className="text-[11px] text-amber-400 mt-1 leading-tight">Models with moderate valuation risk</p>
            {medCount > 0 && (
              <Link href="/valuations" className="mt-1.5 text-[11px] font-semibold text-amber-600 hover:text-amber-700 transition-colors self-start">
                View models →
              </Link>
            )}
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 flex flex-col">
            <p className="text-[20px] font-bold text-emerald-700 tabular-nums leading-none">{healthCount}</p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1 uppercase tracking-wider">Healthy</p>
            <p className="text-[11px] text-emerald-400 mt-1 leading-tight">Models with attractive valuation and risk</p>
            {healthCount > 0 && (
              <Link href="/valuations" className="mt-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors self-start">
                View models →
              </Link>
            )}
          </div>
        </div>

        {uniqueTickers.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Flagged Tickers</p>
            <div className="flex flex-wrap gap-1.5">
              {uniqueTickers.map(t => (
                <Link
                  key={t}
                  href={`/stock/${t}`}
                  className="text-[11px] font-bold bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded hover:bg-red-100 transition-colors"
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="pt-1 border-t border-slate-50">
          <Link href="/valuations" className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            Go to My Valuations →
          </Link>
        </div>

      </div>
    </div>
  )
}
