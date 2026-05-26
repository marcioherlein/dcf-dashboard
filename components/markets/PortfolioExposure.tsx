'use client'
import type { MarketContextPayload } from '@/lib/market-context/types'

interface Props {
  portfolioExposure: MarketContextPayload['portfolioExposure']
  modelAlerts: MarketContextPayload['modelAlerts']
}

export default function PortfolioExposure({ portfolioExposure, modelAlerts }: Props) {
  const uniqueTickers = Array.from(new Set(modelAlerts.map(a => a.ticker)))
  const totalSaved = portfolioExposure.reduce((s, e) => s + e.count, 0)

  if (totalSaved === 0) {
    return (
      <div className="rounded-xl glass-card-light px-5 py-4 flex flex-col items-center justify-center min-h-[140px] text-center">
        <p className="text-sm font-semibold text-slate-700">No saved valuations yet</p>
        <p className="text-xs text-slate-500 mt-1">Save a DCF valuation from any stock page to see model fragility alerts here.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl glass-card-light overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saved Valuations</span>
        <span className="text-[10px] text-slate-400">{totalSaved} model{totalSaved !== 1 ? 's' : ''}</span>
      </div>
      <div className="px-5 py-4 space-y-3">

      {/* Fragility summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-red-200 bg-red-50/70 px-3 py-2.5 text-center">
          <p className="text-[20px] font-bold text-red-700 tabular-nums leading-none">{modelAlerts.filter(a => a.severity === 'high').length}</p>
          <p className="text-[10px] text-red-600 font-semibold mt-1 uppercase tracking-wider">High Risk</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-center">
          <p className="text-[20px] font-bold text-amber-700 tabular-nums leading-none">{modelAlerts.filter(a => a.severity === 'medium').length}</p>
          <p className="text-[10px] text-amber-600 font-semibold mt-1 uppercase tracking-wider">Medium</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-center">
          <p className="text-[20px] font-bold text-emerald-700 tabular-nums leading-none">{totalSaved - uniqueTickers.length}</p>
          <p className="text-[10px] text-emerald-600 font-semibold mt-1 uppercase tracking-wider">Healthy</p>
        </div>
      </div>

      {uniqueTickers.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Flagged Tickers</p>
          <div className="flex flex-wrap gap-1.5">
            {uniqueTickers.map(t => (
              <span key={t} className="text-[11px] font-bold bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
