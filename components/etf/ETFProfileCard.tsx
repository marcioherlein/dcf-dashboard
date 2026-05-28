'use client'

import { Plus, Check, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct, fmtLarge, fmtPctAbs } from '@/lib/formatters'

interface ETFProfile {
  ticker: string
  name: string
  price: number | null
  priceChange: number | null
  priceChangePct: number | null
  fiftyTwoWeekHigh: number | null
  fiftyTwoWeekLow: number | null
  aum: number | null
  expenseRatio: number | null
  yield: number | null
  category: string | null
  issuer: string | null
  inceptionDate: string | null
}

interface Props {
  profile: ETFProfile
  isWatchlisted: boolean
  onWatchlist: () => void
}

export function ETFProfileCard({ profile, isWatchlisted, onWatchlist }: Props) {
  const isUp = (profile.priceChangePct ?? 0) >= 0
  const er = profile.expenseRatio != null ? (profile.expenseRatio * 100).toFixed(2) + '%' : '—'
  const yld = profile.yield != null ? fmtPctAbs(profile.yield) : '—'

  const chips = [
    { label: 'AUM', value: profile.aum != null ? fmtLarge(profile.aum) : '—' },
    { label: 'Expense Ratio', value: er },
    { label: 'Yield', value: yld },
    { label: 'Category', value: profile.category ?? '—' },
    { label: 'Issuer', value: profile.issuer ?? '—' },
    { label: 'Inception', value: profile.inceptionDate ?? '—' },
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-black font-mono text-slate-900">{profile.ticker}</span>
            {profile.price != null && (
              <span className="text-2xl font-bold text-slate-800">{fmtPrice(profile.price, 'USD')}</span>
            )}
            {profile.priceChangePct != null && (
              <div className={cn('flex items-center gap-1 text-sm font-semibold', isUp ? 'text-emerald-500' : 'text-red-500')}>
                {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{fmtPct(profile.priceChangePct / 100)}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{profile.name}</p>
          {profile.fiftyTwoWeekHigh != null && profile.fiftyTwoWeekLow != null && (
            <p className="text-xs text-slate-400 mt-1">
              52W {fmtPrice(profile.fiftyTwoWeekLow, 'USD')} — {fmtPrice(profile.fiftyTwoWeekHigh, 'USD')}
            </p>
          )}
        </div>

        <button
          onClick={onWatchlist}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shrink-0',
            isWatchlisted
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100'
              : 'bg-blue-600 text-white hover:bg-blue-500',
          )}
        >
          {isWatchlisted ? <Check size={14} /> : <Plus size={14} />}
          {isWatchlisted ? 'Watchlisted' : 'Add to Watchlist'}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {chips.map((c) => (
          <div key={c.label} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 min-w-[90px]">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">{c.label}</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
