'use client'
import { useEffect, useState } from 'react'
import ModelAlerts from '@/components/markets/ModelAlerts'
import MarketPulse from '@/components/markets/MarketPulse'
import MacroBrief from '@/components/markets/MacroBrief'
import SectorRotation from '@/components/markets/SectorRotation'
import MacroSignals from '@/components/markets/MacroSignals'
import ValuationContext from '@/components/markets/ValuationContext'
import PortfolioExposure from '@/components/markets/PortfolioExposure'
import type { MarketContextPayload } from '@/lib/market-context/types'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-100 rounded-xl ${className ?? ''}`} />
}

export default function MarketsPage() {
  const [data, setData] = useState<MarketContextPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/market-context')
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(String(e)))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] pt-[52px]">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load market data: {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] pt-[52px]">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold text-slate-900">Market Context</h1>
          {data && (
            <span className="text-xs text-slate-400">
              Updated {new Date(data.fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* 1. Model Fragility Alerts */}
        {data ? (
          <ModelAlerts alerts={data.modelAlerts} />
        ) : (
          <Skeleton className="h-16" />
        )}

        {/* 2. Market Pulse */}
        {data ? (
          <MarketPulse pulse={data.pulse} />
        ) : (
          <Skeleton className="h-28" />
        )}

        {/* 3. Macro Brief */}
        {data ? (
          <MacroBrief
            macroBrief={data.macroBrief}
            briefCachedAt={data.briefCachedAt}
            signals={data.signals}
            pulse={data.pulse}
          />
        ) : (
          <Skeleton className="h-20" />
        )}

        {/* 4. Sector Rotation + Macro Signals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data ? (
            <SectorRotation sectors={data.sectors} />
          ) : (
            <Skeleton className="h-64" />
          )}
          {data ? (
            <MacroSignals signals={data.signals} />
          ) : (
            <Skeleton className="h-64" />
          )}
        </div>

        {/* 5. Valuation Context + Portfolio Exposure */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data ? (
            <ValuationContext valuation={data.valuation} />
          ) : (
            <Skeleton className="h-52" />
          )}
          {data ? (
            <PortfolioExposure
              portfolioExposure={data.portfolioExposure}
              modelAlerts={data.modelAlerts}
            />
          ) : (
            <Skeleton className="h-52" />
          )}
        </div>

      </div>
    </div>
  )
}
