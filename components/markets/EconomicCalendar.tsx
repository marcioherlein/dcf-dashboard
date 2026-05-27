'use client'
import { useEffect, useState } from 'react'
import { Calendar } from 'lucide-react'
import type { EconomicEvent } from '@/app/api/markets/economic-calendar/route'

const IMPACT_STYLE: Record<string, string> = {
  High:   'bg-red-50 text-red-700 border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low:    'bg-slate-100 text-slate-500 border-slate-200',
}

const IMPACT_DOT: Record<string, string> = {
  High:   'bg-red-500',
  Medium: 'bg-amber-400',
  Low:    'bg-slate-300',
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

  const byDate = events.reduce<Record<string, EconomicEvent[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
        <Calendar size={13} className="text-slate-500" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Economic Calendar</span>
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
        <div className="max-h-[400px] overflow-y-auto">
          {/* Table header */}
          <div className="sticky top-0 z-20 bg-slate-50/95 border-b border-slate-100 px-4 py-1.5 grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-400"
            style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          >
            <span>Event</span>
            <span className="text-right hidden sm:block w-14">Estimate</span>
            <span className="text-right hidden sm:block w-14">Prior</span>
            <span className="text-right w-14">Impact</span>
          </div>

          <div className="divide-y divide-slate-100">
            {Object.entries(byDate).map(([date, dayEvents]) => (
              <div key={date}>
                <div className="px-4 py-1.5 sticky top-8 z-10 border-b border-slate-100"
                  style={{ background: 'rgba(248,250,252,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                  <span className="text-[11px] font-bold text-slate-700">{fmtDate(date)}</span>
                </div>
                {dayEvents.map((e, i) => (
                  <div key={i} className="px-4 py-2.5 grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center hover:bg-indigo-50/30 transition-colors min-h-[44px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[e.impact] ?? 'bg-slate-300'}`} />
                        <p className="text-[12px] font-semibold text-slate-800 leading-tight truncate">{e.event}</p>
                      </div>
                      {e.time && <p className="text-[10px] text-slate-400 mt-0.5 ml-3">{e.time}</p>}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 tabular-nums hidden sm:block w-14 text-right">
                      {e.estimate != null ? e.estimate : '—'}
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums hidden sm:block w-14 text-right">
                      {e.previous != null ? e.previous : '—'}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 w-14 text-center ${IMPACT_STYLE[e.impact] ?? IMPACT_STYLE.Low}`}>
                      {e.impact}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
