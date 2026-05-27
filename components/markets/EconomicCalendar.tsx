'use client'
import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import type { EconomicEvent } from '@/app/api/markets/economic-calendar/route'

const IMPACT_STYLE: Record<string, string> = {
  High:   'bg-red-50 text-red-700 border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low:    'bg-slate-100 text-slate-500 border-slate-200',
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function EconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/markets/economic-calendar')
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [])

  // Group by date
  const byDate = events.reduce<Record<string, EconomicEvent[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div className="rounded-xl glass-card-light overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
        <Calendar size={13} className="text-slate-500" />
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Economic Calendar</span>
        <span className="ml-auto text-[10px] text-slate-400">Next 14 days · US only</span>
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">No upcoming events</div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {Object.entries(byDate).map(([date, dayEvents]) => (
            <div key={date}>
              <div className="px-4 py-1.5 sticky top-0 z-10 border-b border-slate-100"
                style={{ background: 'rgba(248,250,252,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                <span className="text-[11px] font-bold text-slate-700">{fmtDate(date)}</span>
              </div>
              {dayEvents.map((e, i) => (
                <div key={i} className="px-3 sm:px-4 py-2.5 flex items-center gap-2 sm:gap-3 hover:bg-indigo-50/30 transition-colors min-h-[44px]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] sm:text-[12.5px] font-semibold text-slate-800 leading-tight truncate">{e.event}</p>
                    {e.time && <p className="text-[10px] text-slate-400 mt-0.5">{e.time}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 text-right">
                    {e.estimate != null && (
                      <div className="text-right hidden xs:block sm:block">
                        <p className="text-[9px] text-slate-400 uppercase tracking-wide">Est.</p>
                        <p className="text-[11px] font-mono font-semibold text-slate-700">{e.estimate}</p>
                      </div>
                    )}
                    {e.previous != null && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] text-slate-400 uppercase tracking-wide">Prev.</p>
                        <p className="text-[11px] font-mono text-slate-500">{e.previous}</p>
                      </div>
                    )}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${IMPACT_STYLE[e.impact]}`}>
                      {e.impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
