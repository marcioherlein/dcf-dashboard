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
      <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] px-5 py-4 flex flex-col items-center justify-center min-h-[140px] text-center">
        <p className="text-sm font-semibold text-slate-300">No saved valuations yet</p>
        <p className="text-xs text-slate-400 mt-1">Save a DCF valuation from any stock page to see model fragility alerts here.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] px-5 py-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-slate-100">Saved Valuations</h2>
        <span className="text-xs text-slate-400">{totalSaved} model{totalSaved !== 1 ? 's' : ''}</span>
      </div>

      {/* Fragility summary */}
      <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Fragility Summary</p>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xl font-bold text-slate-100 font-mono">{modelAlerts.filter(a => a.severity === 'high').length}</p>
            <p className="text-[10px] text-red-600 font-semibold">High Risk</p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-100 font-mono">{modelAlerts.filter(a => a.severity === 'medium').length}</p>
            <p className="text-[10px] text-amber-600 font-semibold">Medium Risk</p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-100 font-mono">{totalSaved - uniqueTickers.length}</p>
            <p className="text-[10px] text-emerald-600 font-semibold">Healthy</p>
          </div>
        </div>
      </div>

      {uniqueTickers.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Flagged Tickers</p>
          <div className="flex flex-wrap gap-1.5">
            {uniqueTickers.map(t => (
              <span key={t} className="text-xs font-bold font-mono bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
