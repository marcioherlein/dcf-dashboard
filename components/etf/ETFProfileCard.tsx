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
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[32px] font-extrabold font-sans text-[#06101F] leading-none tracking-tight">{profile.ticker}</span>
            {profile.price != null && (
              <span className="text-[24px] font-bold text-[#3C3C3C] leading-none">{fmtPrice(profile.price, 'USD')}</span>
            )}
            {profile.priceChangePct != null && (
              <div className={cn('flex items-center gap-1 text-sm font-semibold', isUp ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span>{fmtPct(profile.priceChangePct / 100)}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-[#6B6B6B] mt-1">{profile.name}</p>
          {profile.fiftyTwoWeekHigh != null && profile.fiftyTwoWeekLow != null && (
            <p className="text-xs text-[#6B6B6B] mt-1.5">
              52W range: {fmtPrice(profile.fiftyTwoWeekLow, 'USD')} — {fmtPrice(profile.fiftyTwoWeekHigh, 'USD')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link
            href={`/etf/compare?symbols=${profile.ticker}`}
            className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg text-sm font-semibold transition-colors border border-[#E3E1DA] text-[#6B6B6B] hover:border-[#BFD2A1] hover:text-olive-700 hover:bg-olive-50 focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:outline-none"
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
          <div key={c.label} className="bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg px-3 py-2 min-w-[90px]">
            <p className="text-[11px] font-semibold text-[#6B6B6B]">{c.label}</p>
            <p className="text-[12px] font-semibold font-mono text-[#06101F] mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
