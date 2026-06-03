'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Holding {
  symbol: string
  name: string
  weight: number | null
}

interface DCFModel {
  ticker: string
  fair_value: number | null
  current_price: number | null
}

interface HoldingWithDCF {
  holding: Holding
  dcf: DCFModel | null
  upside: number | null
  weightedUpside: number | null
}

interface Props {
  holdings: Holding[]
}

export function ETFBasketDCF({ holdings }: Props) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null
  const [rows, setRows] = useState<HoldingWithDCF[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const top10 = holdings.slice(0, 10).filter((h) => h.symbol && h.weight != null)
    if (top10.length === 0) { setLoading(false); return }

    Promise.allSettled(
      top10.map((h) =>
        fetch(`/api/valuations?ticker=${encodeURIComponent(h.symbol)}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
      ),
    ).then((results) => {
      const next: HoldingWithDCF[] = top10.map((h, i) => {
        const result = results[i]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dcfData: DCFModel | null = result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0 ? result.value[0] as any : null
        let upside: number | null = null
        let weightedUpside: number | null = null
        if (dcfData?.fair_value && dcfData?.current_price && dcfData.current_price > 0) {
          upside = (dcfData.fair_value / dcfData.current_price - 1)
          weightedUpside = upside * (h.weight ?? 0)
        }
        return { holding: h, dcf: dcfData, upside, weightedUpside }
      })
      setRows(next)
      setLoading(false)
    })
  }, [holdings]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="glass-card-light rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Basket DCF Signal</p>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-7 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const withDCF = rows.filter((r) => r.dcf !== null && r.upside !== null)
  const portfolioWeight = withDCF.reduce((sum, r) => sum + (r.holding.weight ?? 0), 0)
  const weightedSum = withDCF.reduce((sum, r) => sum + (r.weightedUpside ?? 0), 0)
  const avgUpside = portfolioWeight > 0 ? weightedSum / portfolioWeight : null

  if (!userEmail) {
    return (
      <div className="glass-card-light rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-700 mb-2">Basket DCF Signal</p>
        <p className="text-sm text-slate-400">Sign in to see DCF upside signals for this ETF&apos;s holdings.</p>
      </div>
    )
  }

  return (
    <div className="glass-card-light rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Basket DCF Signal</p>
          {withDCF.length > 0 && avgUpside !== null ? (
            <p className="text-xs text-slate-500 mt-0.5">
              <span className={cn('font-bold', avgUpside > 0 ? 'text-emerald-600' : 'text-red-500')}>
                {avgUpside > 0 ? '+' : ''}{(avgUpside * 100).toFixed(1)}% avg implied upside
              </span>
              {' '}based on saved DCF models for {withDCF.length} of top {rows.length} holdings ({(portfolioWeight * 100).toFixed(0)}% of basket)
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">No saved DCF models for top {rows.length} holdings yet</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.holding.symbol} className="flex items-center gap-3">
            <Link
              href={`/stock/${r.holding.symbol}`}
              className="font-mono font-black text-xs text-slate-800 hover:text-blue-600 transition-colors w-12 shrink-0"
            >
              {r.holding.symbol}
            </Link>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-400 truncate block">{r.holding.name}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 shrink-0 w-10 text-right">
              {r.holding.weight != null ? (r.holding.weight * 100).toFixed(1) + '%' : '—'}
            </span>
            <span className={cn('text-xs font-semibold font-mono shrink-0 w-16 text-right', r.upside == null ? 'text-slate-300' : r.upside > 0 ? 'text-emerald-600' : 'text-red-500')}>
              {r.upside == null ? (
                <Link href={`/stock/${r.holding.symbol}`} className="text-blue-400 hover:text-blue-600 transition-colors">Run DCF</Link>
              ) : (
                `${r.upside > 0 ? '+' : ''}${(r.upside * 100).toFixed(1)}%`
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
