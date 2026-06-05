'use client'
import { useEffect, useState } from 'react'
import { Calendar, ExternalLink } from 'lucide-react'
import type { EconomicEvent } from '@/app/api/markets/economic-calendar/route'

const IMPACT_DOT: Record<string, string> = {
  High:   'bg-red-500',
  Medium: 'bg-amber-400',
  Low:    'bg-slate-300',
}

const IMPACT_BADGE: Record<string, string> = {
  High:   'bg-red-50 text-red-700 border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low:    'bg-slate-100 text-slate-500 border-slate-200',
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
  if (diff === 1) return 'TOMORROW, ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

function fmtTime(timeStr: string): string {
  if (!timeStr) return '—'
  return timeStr.replace(' ET', '')
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
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="px-6 py-8 flex flex-col items-center gap-2 text-center">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <Calendar size={16} className="text-slate-400" />
          </div>
          <p className="text-[12px] font-semibold text-slate-500">No high-impact U.S. events</p>
          <p className="text-[11px] text-slate-400 max-w-[220px] leading-snug">No scheduled economic releases in the next 14 days, or data is unavailable.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
          <div style={{ minWidth: '480px' }}>
          {/* Column headers */}
          <div className="px-4 py-1.5 border-b border-slate-100 bg-slate-50/70 grid gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400"
            style={{ gridTemplateColumns: '5rem 1fr 4.5rem 3rem 3rem 3rem' }}>
            <span>Time</span>
            <span>Event</span>
            <span>Importance</span>
            <span className="text-right">Actual</span>
            <span className="text-right">Est.</span>
            <span className="text-right">Prior</span>
          </div>

          <div className="divide-y divide-slate-100">
            {Object.entries(byDate).map(([date, dayEvents]) => (
              <div key={date}>
                {/* Date group header */}
                <div className="px-4 py-1.5 bg-slate-50/50 border-b border-slate-100">
                  <span className="text-[10px] font-bold text-slate-600">{fmtDate(date)}</span>
                </div>
                {dayEvents.map((e, i) => (
                  <div
                    key={i}
                    className="px-4 py-2.5 grid gap-2 items-center hover:bg-indigo-50/30 transition-colors min-h-[44px]"
                    style={{ gridTemplateColumns: '5rem 1fr 4.5rem 3rem 3rem 3rem' }}
                  >
                    {/* Time */}
                    <p className="text-[10px] font-mono text-slate-500 shrink-0">{fmtTime(e.time)}</p>
                    {/* Event */}
                    <div className="min-w-0 flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${IMPACT_DOT[e.impact] ?? 'bg-slate-300'}`} />
                      <p className="text-[11.5px] font-semibold text-slate-800 leading-tight truncate">{e.event}</p>
                    </div>
                    {/* Importance */}
                    <span className={`inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${IMPACT_BADGE[e.impact] ?? IMPACT_BADGE.Low}`}>
                      {e.impact}
                    </span>
                    {/* Actual */}
                    <span className="text-[11px] font-semibold text-slate-700 tabular-nums text-right">
                      {e.actual ?? '—'}
                    </span>
                    {/* Estimate */}
                    <span className="text-[11px] text-slate-500 tabular-nums text-right">
                      {e.estimate ?? '—'}
                    </span>
                    {/* Prior */}
                    <span className="text-[11px] text-slate-400 tabular-nums text-right">
                      {e.previous ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          </div>
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[11px] text-slate-400">All times in ET</p>
            <a
              href="https://financialmodelingprep.com/financial-calendars"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              View full economic calendar
              <ExternalLink size={10} />
            </a>
          </div>
        </>
      )}
    </div>
  )
}
