'use client'
import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { EarningsItem } from '@/app/api/markets/earnings/route'

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtEPS(v: number | null): string {
  if (v == null) return '—'
  return `$${v.toFixed(2)}`
}

function TimeChip({ time }: { time: EarningsItem['timeOfDay'] }) {
  if (!time || time === 'TAS') return null
  const cls = time === 'BMO'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
  const label = time === 'BMO' ? 'Pre-Market' : 'After Close'
  return (
    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0', cls)}>
      {label}
    </span>
  )
}

export default function EarningsCalendar() {
  const [items, setItems] = useState<EarningsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/markets/earnings')
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const byDate = items.reduce<Record<string, EarningsItem[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
        <TrendingUp size={13} className="text-slate-500" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Earnings Calendar</span>
        <span className="ml-auto text-[10px] text-slate-400">S&P 500 · Next 3 weeks</span>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">No upcoming earnings</div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {Object.entries(byDate).map(([date, dayItems]) => (
            <div key={date}>
              <div className="px-4 py-1.5 sticky top-0 z-10 border-b border-slate-100"
                style={{ background: 'rgba(248,250,252,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                <span className="text-[11px] font-bold text-slate-700">{fmtDate(date)}</span>
                <span className="ml-2 text-[10px] text-slate-400">{dayItems.length} report{dayItems.length !== 1 ? 's' : ''}</span>
              </div>
              {dayItems.map((e, i) => (
                <Link
                  key={i}
                  href={`/stock/${e.ticker}`}
                  className="px-4 py-2.5 flex items-center gap-2.5 hover:bg-indigo-50/40 transition-colors group min-h-[44px]"
                >
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded w-14 text-center shrink-0 font-mono">
                    {e.ticker}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700 truncate group-hover:text-slate-900">{e.company}</p>
                  </div>
                  <TimeChip time={e.timeOfDay} />
                  {e.epsEstimate != null && (
                    <div className="text-right shrink-0">
                      <p className="text-[9px] text-slate-400 uppercase tracking-wide">EPS Est.</p>
                      <p className="text-[11px] font-semibold text-slate-700 tabular-nums font-mono">{fmtEPS(e.epsEstimate)}</p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
