'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { scoreLabel, scoreBadge } from '@/lib/data/etfScore'

interface ETFHoldingResult {
  etfTicker: string
  etfName: string
  weight: number
  valueScore: number | null
}

interface Props {
  ticker: string
}

export function ETFExposureCard({ ticker }: Props) {
  const [data, setData] = useState<ETFHoldingResult[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    fetch(`/api/etf/stock-holdings?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d: ETFHoldingResult[]) => { setData(d); setLoading(false) })
      .catch(() => { setData([]); setLoading(false) })
  }, [ticker])

  if (loading) {
    return (
      <div className="glass-card-light rounded-xl p-4 animate-pulse">
        <div className="h-4 w-40 bg-slate-200 rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card-light rounded-xl p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-sm font-semibold text-slate-700">ETF Exposure</p>
        {data && data.length > 0 && (
          <span className="text-xs text-slate-400">Found in {data.length} ETF{data.length !== 1 ? 's' : ''} we track</span>
        )}
      </div>

      {!data || data.length === 0 ? (
        <p className="text-sm text-slate-400 py-2">{ticker} not found in any ETF in our universe.</p>
      ) : (
        <div className="space-y-1.5">
          {data.map((etf) => {
            const maxWeight = data[0].weight
            return (
              <Link
                key={etf.etfTicker}
                href={`/etf/${etf.etfTicker}`}
                className="flex items-center gap-3 hover:bg-slate-50/80 rounded-lg px-2 py-1.5 -mx-2 transition-colors group"
              >
                <span className="font-mono font-black text-sm text-slate-900 group-hover:text-blue-600 transition-colors w-12 shrink-0">{etf.etfTicker}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full"
                        style={{ width: `${(etf.weight / maxWeight) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-600 shrink-0 w-12 text-right">
                      {(etf.weight * 100).toFixed(2)}%
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block mt-0.5">{etf.etfName}</span>
                </div>
                {etf.valueScore != null && (
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', scoreBadge(etf.valueScore))}>
                    {scoreLabel(etf.valueScore)}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
