'use client'
import { useEffect, useState } from 'react'
import { TrendingUp, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { EarningsItem } from '@/app/api/markets/earnings/route'

const PREVIEW_COUNT = 5

// Mega-cap/high-profile tickers that warrant "High" importance
const HIGH_IMPORTANCE = new Set([
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'BRK-B', 'LLY', 'JPM', 'V',
  'XOM', 'UNH', 'AVGO', 'WMT', 'TSLA', 'JNJ', 'MA', 'PG', 'HD', 'ORCL',
  'MRK', 'COST', 'ABBV', 'BAC', 'KO', 'CVX', 'PEP', 'NFLX',
])

function getImportance(ticker: string): 'High' | 'Medium' {
  return HIGH_IMPORTANCE.has(ticker) ? 'High' : 'Medium'
}

const IMPORTANCE_BADGE: Record<string, string> = {
  High:   'bg-[#FCEAEA] text-[#D83B3B] border-[#E5E5E5]',
  Medium: 'bg-[#FFF4DA] text-[#B56A00] border-[#E5E5E5]',
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'TODAY, ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
  if (diff === 1) return 'TOMORROW, ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

function fmtEPS(v: number | null): string {
  if (v == null) return '—'
  return `$${v.toFixed(2)}`
}

export default function EarningsCalendar() {
  const [items, setItems] = useState<EarningsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/markets/earnings')
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const visibleItems = expanded ? items : items.slice(0, PREVIEW_COUNT)

  const byDate = visibleItems.reduce<Record<string, EarningsItem[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E5E5E5] flex items-center gap-2">
        <TrendingUp size={13} className="text-[#6B6B6B]" />
        <span className="text-[10px] font-bold text-[#6B6B6B]">Earnings Calendar</span>
        <span className="ml-auto text-[10px] text-[#6B6B6B]">S&P 500 · Next 3 weeks</span>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-[#E3E1DA] motion-safe:animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] font-semibold text-[#6B6B6B]">No upcoming earnings</p>
          <p className="text-[11px] text-[#6B6B6B] mt-1">No major S&P 500 earnings in the next 3 weeks.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
          <div style={{ minWidth: '480px' }}>
          {/* Column headers */}
          <div className="px-4 py-1.5 border-b border-[#E5E5E5] bg-[#F5F5F5]/70 grid gap-2 text-[11px] font-bold text-[#6B6B6B]"
            style={{ gridTemplateColumns: '3.5rem 1fr 4.5rem 4rem auto' }}>
            <span>Ticker</span>
            <span>Company</span>
            <span>Importance</span>
            <span className="text-right">EPS Est.</span>
            <span />
          </div>

          <div className="divide-y divide-[#E3E1DA]">
            {Object.entries(byDate).map(([date, dayItems]) => (
              <div key={date}>
                {/* Date group header */}
                <div className="px-4 py-1.5 bg-[#F5F5F5]/50 border-b border-[#E5E5E5]">
                  <span className="text-[10px] font-bold text-[#6B6B6B]">{fmtDate(date)}</span>
                </div>
                {dayItems.map((e, i) => {
                  const importance = getImportance(e.ticker)
                  return (
                    <Link
                      key={i}
                      href={`/stock/${e.ticker}`}
                      className="px-4 py-2.5 grid gap-2 items-center hover:bg-indigo-50/40 transition-colors group min-h-[44px]"
                      style={{ gridTemplateColumns: '3.5rem 1fr 4.5rem 4rem auto' }}
                    >
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded text-center font-mono',
                        importance === 'High'
                          ? 'text-[#2563EB] bg-[#EAF1FF] border border-[#93B4F5]'
                          : 'text-[#6B6B6B] bg-[#E3E1DA] border border-[#E5E5E5]'
                      )}>
                        {e.ticker}
                      </span>
                      <p className="text-[11.5px] font-semibold text-[#111111] truncate group-hover:text-[#111111]">{e.company}</p>
                      <span className={`inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${IMPORTANCE_BADGE[importance]}`}>
                        {importance}
                      </span>
                      <p className="text-[11px] font-semibold text-[#111111] tabular-nums font-mono text-right">{fmtEPS(e.epsEstimate)}</p>
                      <ExternalLink size={10} className="text-[#6B6B6B] group-hover:text-[#6B6B6B] transition-colors" />
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
          </div>
          </div>

          {items.length > PREVIEW_COUNT && (
            <button
              onClick={() => setExpanded(x => !x)}
              className="w-full px-4 py-2.5 min-h-[44px] border-t border-[#E5E5E5] flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#2563EB] hover:bg-[#EAF1FF]/50 transition-colors"
            >
              {expanded ? (
                <><ChevronUp size={13} /> Show fewer</>
              ) : (
                <><ChevronDown size={13} /> View all {items.length} earnings</>
              )}
            </button>
          )}

          {!expanded && (
            <div className="px-4 py-2.5 border-t border-[#E5E5E5]" />
          )}
        </>
      )}
    </div>
  )
}
