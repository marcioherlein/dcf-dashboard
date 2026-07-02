'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { EconomicEvent } from '@/app/api/markets/economic-calendar/route'
import type { EarningsItem } from '@/app/api/markets/earnings/route'

// ── Types ─────────────────────────────────────────────────────────────────────

type EventKind = 'economic' | 'earnings'

interface TodayEvent {
  time: string          // display string e.g. "8:30 AM ET" or "BMO"
  timeSortKey: number   // minutes since midnight for sorting (9999 = no time)
  label: string         // e.g. "US Retail Sales" or "AAPL Earnings"
  country: string       // flag emoji or ticker
  impact: 'High' | 'Medium' | null
  kind: EventKind
  actual: string | null
  estimate: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

// Convert "8:30 AM ET" → minutes since midnight for sorting
function parseSortKey(time: string): number {
  const m = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return 9999
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0
  return h * 60 + min
}

const COUNTRY_FLAG: Record<string, string> = {
  US: '🇺🇸', EU: '🇪🇺', GB: '🇬🇧', JP: '🇯🇵',
  CA: '🇨🇦', AU: '🇦🇺', CN: '🇨🇳', DE: '🇩🇪', FR: '🇫🇷',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TodayEventsStrip() {
  const [events, setEvents] = useState<TodayEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = todayET()

    Promise.allSettled([
      fetch(`/api/markets/economic-calendar?from=${today}&to=${today}`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/markets/earnings')
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([econRes, earningsRes]) => {
      const out: TodayEvent[] = []

      // Economic events
      const econData = econRes.status === 'fulfilled' ? econRes.value : null
      const econEvents: EconomicEvent[] = econData?.events ?? []
      for (const e of econEvents) {
        if (e.date !== today) continue
        if (e.impact === 'Low') continue
        out.push({
          time: e.time || 'TBA',
          timeSortKey: parseSortKey(e.time),
          label: e.event,
          country: e.country,
          impact: e.impact === 'High' ? 'High' : 'Medium',
          kind: 'economic',
          actual: e.actual ?? null,
          estimate: e.estimate ?? null,
        })
      }

      // Earnings
      const earningsData = earningsRes.status === 'fulfilled' ? earningsRes.value : null
      const earningsItems: EarningsItem[] = earningsData?.items ?? []
      for (const e of earningsItems) {
        if (e.date !== today) continue
        const time = e.timeOfDay === 'BMO' ? 'Pre-Market'
          : e.timeOfDay === 'AMC' ? 'After Close'
          : 'Market Hours'
        out.push({
          time,
          timeSortKey: e.timeOfDay === 'BMO' ? 0 : e.timeOfDay === 'AMC' ? 1440 : 780,
          label: `${e.ticker} Earnings`,
          country: e.ticker,
          impact: null,
          kind: 'earnings',
          actual: null,
          estimate: e.epsEstimate != null ? `EPS est. $${e.epsEstimate.toFixed(2)}` : null,
        })
      }

      out.sort((a, b) => a.timeSortKey - b.timeSortKey)
      setEvents(out)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="shrink-0 flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {[1,2,3].map(i => (
          <div key={i} className="shrink-0 h-[52px] w-[160px] rounded-xl bg-[#EBEBEB] animate-pulse" />
        ))}
      </div>
    )
  }

  if (events.length === 0) return null

  return (
    <div className="shrink-0">
      {/* Section label */}
      <p className="text-[10px] font-[700] uppercase tracking-[0.07em] text-[#9B9B9B] mb-1.5">
        Today&apos;s Events to Watch
      </p>

      {/* Horizontal scroll strip */}
      <div className="flex items-stretch gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {events.map((ev, i) => {
          const flag = COUNTRY_FLAG[ev.country] ?? '🌐'
          const isEarnings = ev.kind === 'earnings'
          const impactDot = ev.impact === 'High'
            ? 'bg-[#D83B3B]'
            : ev.impact === 'Medium'
            ? 'bg-[#B56A00]'
            : null

          return (
            <div
              key={i}
              className={cn(
                'shrink-0 flex flex-col justify-between rounded-xl border px-3 py-2 min-w-[156px] max-w-[220px]',
                isEarnings
                  ? 'bg-[#EAF1FF] border-[#C7D9FC]'
                  : ev.impact === 'High'
                  ? 'bg-white border-[#F0B8B8]'
                  : 'bg-white border-[#E5E5E5]',
              )}
            >
              {/* Time + flag */}
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="text-[10px] font-[700] text-[#6B6B6B] tabular-nums whitespace-nowrap">
                  {ev.time}
                </span>
                <div className="flex items-center gap-1">
                  {impactDot && (
                    <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', impactDot)} />
                  )}
                  <span className="text-[11px] leading-none">{isEarnings ? '📊' : flag}</span>
                </div>
              </div>

              {/* Label */}
              <p className="text-[11px] font-[650] text-[#111111] leading-tight line-clamp-2">
                {ev.label}
              </p>

              {/* Estimate / actual */}
              {(ev.estimate || ev.actual) && (
                <p className="text-[10px] text-[#6B6B6B] mt-1 leading-none tabular-nums truncate">
                  {ev.actual ? `Actual: ${ev.actual}` : `Est: ${ev.estimate}`}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
