'use client'

import { Plus, Check, TrendingUp, TrendingDown, GitCompare } from 'lucide-react'
import Link from 'next/link'
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
    <div className="glass-card-light rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black font-sans text-[#06101F]">{profile.ticker}</span>
            {profile.price != null && (
              <span className="text-2xl font-bold text-[#06101F]">{fmtPrice(profile.price, 'USD')}</span>
            )}
            {profile.priceChangePct != null && (
              <div className={cn('flex items-center gap-1 text-sm font-semibold', isUp ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{fmtPct(profile.priceChangePct / 100)}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-[#566174] mt-0.5">{profile.name}</p>
          {profile.fiftyTwoWeekHigh != null && profile.fiftyTwoWeekLow != null && (
            <p className="text-xs text-[#8A95A6] mt-1">
              52W {fmtPrice(profile.fiftyTwoWeekLow, 'USD')} — {fmtPrice(profile.fiftyTwoWeekHigh, 'USD')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link
            href={`/etf/compare?symbols=${profile.ticker}`}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-colors border border-[#E3E1DA] text-[#566174] hover:border-[#BFD2A1] hover:text-olive-700 hover:bg-olive-50 focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:outline-none"
          >
            <GitCompare size={14} />
            Compare
          </Link>
          <button
            onClick={onWatchlist}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:ring-offset-1 focus-visible:outline-none',
              isWatchlisted
                ? 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE] hover:bg-[#E8F7EF]'
                : 'bg-olive-700 text-white hover:bg-olive-600',
            )}
          >
            {isWatchlisted ? <Check size={14} /> : <Plus size={14} />}
            {isWatchlisted ? 'In watchlist' : 'Add to Watchlist'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {chips.map((c) => (
          <div key={c.label} className="bg-[#F4F3EF] border border-[#E3E1DA] rounded-lg px-3 py-2 min-w-[90px]">
            <p className="text-[11px] font-semibold text-[#566174]">{c.label}</p>
            <p className="text-[12px] font-semibold font-mono text-[#06101F] mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
