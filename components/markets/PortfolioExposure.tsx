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
      <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm px-5 py-6 flex flex-col items-center justify-center min-h-[140px] text-center">
        <p className="text-sm font-semibold text-[#06101F]">No saved valuations yet</p>
        <p className="text-xs text-[#566174] mt-1 max-w-xs">Save a DCF valuation from any stock page to see model fragility alerts here.</p>
        <Link href="/analyze" className="mt-3 text-[12px] font-semibold text-[#2563EB] hover:text-[#2563EB] transition-colors">
          Go to stock analysis →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E3E1DA] flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#566174] uppercase tracking-wider">Saved Valuations</span>
        <span className="text-[11px] text-[#8A95A6]">{totalSaved} model{totalSaved !== 1 ? 's' : ''}</span>
      </div>
      <div className="px-5 py-4 space-y-3">

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[#E3E1DA] bg-[#FCEAEA] px-3 py-3 flex flex-col">
            <p className="text-[20px] font-bold text-[#D83B3B] tabular-nums leading-none">{highCount}</p>
            <p className="text-[11px] text-[#D83B3B] font-semibold mt-1 uppercase tracking-wider">High Risk</p>
            <p className="text-[11px] text-[#D83B3B] mt-1 leading-tight">Models with elevated valuation risk</p>
            {highCount > 0 && (
              <Link href="/valuations" className="mt-1.5 text-[11px] font-semibold text-[#D83B3B] hover:text-[#D83B3B] transition-colors self-start">
                View models →
              </Link>
            )}
          </div>
          <div className="rounded-xl border border-[#E3E1DA] bg-[#FFF4DA] px-3 py-3 flex flex-col">
            <p className="text-[20px] font-bold text-[#B56A00] tabular-nums leading-none">{medCount}</p>
            <p className="text-[11px] text-[#B56A00] font-semibold mt-1 uppercase tracking-wider">Medium</p>
            <p className="text-[11px] text-[#B56A00] mt-1 leading-tight">Models with moderate valuation risk</p>
            {medCount > 0 && (
              <Link href="/valuations" className="mt-1.5 text-[11px] font-semibold text-[#B56A00] hover:text-[#B56A00] transition-colors self-start">
                View models →
              </Link>
            )}
          </div>
          <div className="rounded-xl border border-[#CDD1C8] bg-[#E8F7EF] px-3 py-3 flex flex-col">
            <p className="text-[20px] font-bold text-[#11875D] tabular-nums leading-none">{healthCount}</p>
            <p className="text-[11px] text-[#11875D] font-semibold mt-1 uppercase tracking-wider">Healthy</p>
            <p className="text-[11px] text-[#11875D] mt-1 leading-tight">Models with attractive valuation and risk</p>
            {healthCount > 0 && (
              <Link href="/valuations" className="mt-1.5 text-[11px] font-semibold text-[#11875D] hover:text-[#11875D] transition-colors self-start">
                View models →
              </Link>
            )}
          </div>
        </div>

        {uniqueTickers.length > 0 && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#566174] mb-1.5">Flagged Tickers</p>
            <div className="flex flex-wrap gap-1.5">
              {uniqueTickers.map(t => (
                <Link
                  key={t}
                  href={`/stock/${t}`}
                  className="text-[11px] font-bold bg-[#FCEAEA] border border-[#E3E1DA] text-[#D83B3B] px-2 py-0.5 rounded hover:bg-[#FCEAEA] transition-colors"
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="pt-1 border-t border-[#F4F3EF]">
          <Link href="/valuations" className="text-[12px] font-semibold text-[#2563EB] hover:text-[#2563EB] transition-colors">
            Go to My Valuations →
          </Link>
        </div>

      </div>
    </div>
  )
}
