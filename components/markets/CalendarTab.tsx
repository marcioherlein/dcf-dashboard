'use client'
import { useEffect, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar, TrendingUp, Landmark, Scissors, Rocket, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { EconomicEvent } from '@/app/api/markets/economic-calendar/route'
import type { EarningsItem } from '@/app/api/markets/earnings/route'

// ── Types ────────────────────────────────────────────────────────────────────

type CalSub = 'all' | 'earnings' | 'economic' | 'splits' | 'ipos'

export interface SplitItem {
  ticker: string
  company: string
  date: string
  numerator: number
  denominator: number
}

export interface IpoItem {
  ticker: string
  company: string
  date: string
  exchange: string
  priceRange: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Returns ISO strings (stable primitives) for the week at the given offset
function getWeekRange(offset = 0): { from: string; to: string; label: string } {
  // Use ET (America/New_York) as the reference timezone for financial week boundaries
  const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = nowET.getDay()
  const monday = new Date(nowET)
  monday.setDate(nowET.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const label =
    monday.getFullYear() === sunday.getFullYear()
      ? `${fmt(monday)} – ${fmt(sunday)}, ${monday.getFullYear()}`
      : `${fmt(monday)}, ${monday.getFullYear()} – ${fmt(sunday)}, ${sunday.getFullYear()}`

  // Return YYYY-MM-DD strings relative to the monday in ET
  const toISO = (d: Date) => d.toISOString().split('T')[0]
  return { from: toISO(monday), to: toISO(sunday), label }
}

function inRange(dateStr: string, from: string, to: string): boolean {
  return dateStr >= from && dateStr <= to
}

function weekDays(from: string): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from + 'T00:00:00')
    d.setDate(d.getDate() + i)
    return d
  })
}

function isToday(d: Date): boolean {
  const t = new Date()
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
}

function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6
}

const IMPACT_COLORS: Record<string, string> = {
  High:   'bg-[#FCEAEA] text-[#D83B3B]',
  Medium: 'bg-[#FFF4DA] text-[#B56A00]',
  Low:    'bg-[#F5F5F5] text-[#6B6B6B]',
}

const HIGH_IMPORTANCE = new Set([
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','BRK-B','LLY','JPM','V',
  'XOM','UNH','AVGO','WMT','TSLA','JNJ','MA','PG','HD','ORCL',
  'MRK','COST','ABBV','BAC','KO','CVX','PEP','NFLX','AMD','CSCO',
  'ADBE','TMO','QCOM','GS','MS','IBM','TXN','ACN','NEE',
])

function earningsImportance(ticker: string): 'High' | 'Medium' {
  return HIGH_IMPORTANCE.has(ticker) ? 'High' : 'Medium'
}

// ── Sub-components ───────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <div className="p-4 space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-8 rounded-md bg-[#F5F5F5] animate-pulse" />
      ))}
    </div>
  )
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center py-12 gap-2">
      <span className="text-[#C4C4C4]">{icon ?? <Calendar size={28} />}</span>
      <p className="text-[13px] text-[#6B6B6B] text-center max-w-[280px] leading-snug">{message}</p>
    </div>
  )
}

// ── Week Column Grid (All Events view) ───────────────────────────────────────

interface WeekGridProps {
  days: Date[]
  earnings: EarningsItem[]
  economic: EconomicEvent[]
  splits: SplitItem[]
  ipos: IpoItem[]
  onSubTab: (tab: CalSub) => void
}

function _WeekGrid({ days, earnings, economic, splits, ipos, onSubTab }: WeekGridProps) {
  const weekdays = days.filter(d => !isWeekend(d))

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `repeat(${weekdays.length}, 1fr)` }}>
        {weekdays.map(day => {
          const iso = day.toISOString().split('T')[0]
          const earningsDay = earnings.filter(e => e.date === iso)
          const economicDay = economic.filter(e => e.date === iso)
          const splitsDay   = splits.filter(e => e.date === iso)
          const iposDay     = ipos.filter(e => e.date === iso)
          const total = earningsDay.length + economicDay.length + splitsDay.length + iposDay.length
          const today = isToday(day)

          return (
            <div
              key={iso}
              className={cn(
                'border-r border-[#E5E5E5] last:border-r-0 p-3',
                today && 'bg-[#FAFAFA]',
              )}
            >
              {/* Day header */}
              <div className="mb-3">
                <div className={cn(
                  'text-[11px] font-bold tracking-wide',
                  today ? 'text-[#5F790B]' : 'text-[#111111]',
                )}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                </div>
                <div className={cn(
                  'text-[11px] text-[#6B6B6B]',
                )}>
                  {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                {today && (
                  <div className="mt-1 inline-block text-[9px] font-bold bg-[#5F790B] text-white px-1.5 py-0.5 rounded-sm tracking-wide">
                    TODAY
                  </div>
                )}
              </div>

              {/* Event pills */}
              {total === 0 ? (
                <div className="text-[11px] text-[#C4C4C4]">—</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {economicDay.length > 0 && (
                    <button
                      onClick={() => onSubTab('economic')}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#FED7AA] bg-[#FFF7ED] text-[#B56A00] text-[11px] font-medium hover:bg-[#FFEDD5] transition-colors text-left"
                    >
                      <Landmark size={10} />
                      <span>{economicDay.length} Economic</span>
                    </button>
                  )}
                  {earningsDay.length > 0 && (
                    <button
                      onClick={() => onSubTab('earnings')}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB] text-[11px] font-medium hover:bg-[#DBEAFE] transition-colors text-left"
                    >
                      <TrendingUp size={10} />
                      <span>{earningsDay.length} Earnings</span>
                    </button>
                  )}
                  {splitsDay.length > 0 && (
                    <button
                      onClick={() => onSubTab('splits')}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#BBF7D0] bg-[#ECFDF5] text-[#047857] text-[11px] font-medium hover:bg-[#D1FAE5] transition-colors text-left"
                    >
                      <Scissors size={10} />
                      <span>{splitsDay.length} Splits</span>
                    </button>
                  )}
                  {iposDay.length > 0 && (
                    <button
                      onClick={() => onSubTab('ipos')}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#E9D5FF] bg-[#FAF5FF] text-[#7C3AED] text-[11px] font-medium hover:bg-[#EDE9FE] transition-colors text-left"
                    >
                      <Rocket size={10} />
                      <span>{iposDay.length} IPO Pricings</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Earnings List ─────────────────────────────────────────────────────────────

function EarningsList({ items, loading }: { items: EarningsItem[]; loading: boolean }) {
  if (loading) return <LoadingRows />
  if (!loading && items.length === 0) return <EmptyState icon={<Calendar size={28} />} message="No events scheduled for this week." />

  const byDate = items.reduce<Record<string, EarningsItem[]>>((acc, e) => {
    acc[e.date] ??= []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div className="divide-y divide-[#E5E5E5]">
      {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => {
        const d = new Date(date + 'T00:00:00')
        const today = isToday(d)
        return (
          <div key={date}>
            <div className={cn(
              'px-4 py-2 text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]',
              today ? 'text-[#5F790B] bg-[#F6FAEA]' : 'text-[#6B6B6B] bg-[#FAFAFA]',
            )}>
              {today ? 'TODAY · ' : ''}
              {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
            </div>
            {group.map(item => {
              const imp = earningsImportance(item.ticker)
              return (
                <div key={item.ticker} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors">
                  {/* Ticker chip */}
                  <Link
                    href={`/stock/${item.ticker}`}
                    className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-[#F5F5F5] text-[#111111] hover:bg-[#EEF2FA] hover:text-[#5F790B] transition-colors"
                  >
                    {item.ticker}
                  </Link>
                  {/* Company */}
                  <span className="flex-1 min-w-0 text-[13px] text-[#111111] truncate">{item.company}</span>
                  {/* Time of day */}
                  {item.timeOfDay && (
                    <span className="shrink-0 text-[10px] text-[#9B9B9B]">
                      {item.timeOfDay === 'BMO' ? 'Pre-market' : item.timeOfDay === 'AMC' ? 'After hours' : item.timeOfDay === 'TAS' ? 'Time specified' : ''}
                    </span>
                  )}
                  {/* Importance */}
                  <span className={cn('shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold', IMPACT_COLORS[imp])}>
                    {imp}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Economic List ─────────────────────────────────────────────────────────────

function EconomicList({ events, loading, missingKey, fetchError }: { events: EconomicEvent[]; loading: boolean; missingKey?: boolean; fetchError?: boolean }) {
  if (loading) return <LoadingRows />
  if (missingKey) return <EmptyState icon={<AlertCircle size={28} />} message="Economic calendar data is temporarily unavailable. Check back soon." />
  if (fetchError) return <EmptyState icon={<AlertCircle size={28} />} message="Could not load economic events — check your connection and try again." />
  if (!loading && !missingKey && !fetchError && events.length === 0) return <EmptyState icon={<Calendar size={28} />} message="No events scheduled for this week." />

  const byDate = events.reduce<Record<string, EconomicEvent[]>>((acc, e) => {
    acc[e.date] ??= []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div className="divide-y divide-[#E5E5E5]">
      {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => {
        const d = new Date(date + 'T00:00:00')
        const today = isToday(d)
        return (
          <div key={date}>
            <div className={cn(
              'px-4 py-2 text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]',
              today ? 'text-[#5F790B] bg-[#F6FAEA]' : 'text-[#6B6B6B] bg-[#FAFAFA]',
            )}>
              {today ? 'TODAY · ' : ''}{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
            </div>
            {group.map((ev, idx) => (
              <div key={`${date}-${ev.event}-${idx}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors">
                {/* Time */}
                <span className="shrink-0 w-20 text-[11px] text-[#6B6B6B] tabular-nums">{ev.time || '—'}</span>
                {/* Event name */}
                <span className="flex-1 min-w-0 text-[13px] text-[#111111] truncate">{ev.event}</span>
                {/* Impact */}
                <span className={cn('shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold', IMPACT_COLORS[ev.impact])}>
                  {ev.impact}
                </span>
                {/* Previous / Estimate / Actual */}
                <div className="shrink-0 flex gap-3 text-[11px] tabular-nums text-right">
                  <div className="w-12">
                    <div className="text-[10px] text-[#9B9B9B]">PREV</div>
                    <div className="text-[#6B6B6B]">{ev.previous ?? '—'}</div>
                  </div>
                  <div className="w-12">
                    <div className="text-[10px] text-[#9B9B9B]">EST</div>
                    <div className="text-[#6B6B6B]">{ev.estimate ?? '—'}</div>
                  </div>
                  <div className="w-12">
                    <div className="text-[10px] text-[#9B9B9B]">ACT</div>
                    <div className={cn(
                      'font-semibold',
                      ev.actual != null && ev.estimate != null
                        ? parseFloat(ev.actual) >= parseFloat(ev.estimate) ? 'text-[#11875D]' : 'text-[#D83B3B]'
                        : 'text-[#9B9B9B]',
                    )}>{ev.actual ?? '—'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Splits List ───────────────────────────────────────────────────────────────

function SplitsList({ splits, loading, missingKey, fetchError }: { splits: SplitItem[]; loading: boolean; missingKey?: boolean; fetchError?: boolean }) {
  if (loading) return <LoadingRows />
  if (missingKey) return <EmptyState icon={<AlertCircle size={28} />} message="Splits calendar is temporarily unavailable. Check back soon." />
  if (fetchError) return <EmptyState icon={<AlertCircle size={28} />} message="Could not load splits data — check your connection and try again." />
  if (!loading && !missingKey && !fetchError && splits.length === 0) return <EmptyState icon={<Calendar size={28} />} message="No events scheduled for this week." />

  const byDate = splits.reduce<Record<string, SplitItem[]>>((acc, e) => {
    acc[e.date] ??= []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div className="divide-y divide-[#E5E5E5]">
      {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => {
        const d = new Date(date + 'T00:00:00')
        const today = isToday(d)
        return (
          <div key={date}>
            <div className={cn(
              'px-4 py-2 text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]',
              today ? 'text-[#5F790B] bg-[#F6FAEA]' : 'text-[#6B6B6B] bg-[#FAFAFA]',
            )}>
              {today ? 'TODAY · ' : ''}{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
            </div>
            {group.map(item => (
              <div key={item.ticker} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors">
                <Link
                  href={`/stock/${item.ticker}`}
                  className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-[#F5F5F5] text-[#111111] hover:bg-[#EEF2FA] hover:text-[#5F790B] transition-colors"
                >
                  {item.ticker}
                </Link>
                <span className="flex-1 min-w-0 text-[13px] text-[#111111] truncate">{item.company}</span>
                <span className="shrink-0 px-2.5 py-0.5 rounded-md bg-[#ECFDF5] border border-[#BBF7D0] text-[#047857] text-[11px] font-semibold">
                  {item.numerator}-for-{item.denominator}
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── IPOs List ─────────────────────────────────────────────────────────────────

function IposList({ ipos, loading, missingKey, fetchError }: { ipos: IpoItem[]; loading: boolean; missingKey?: boolean; fetchError?: boolean }) {
  if (loading) return <LoadingRows />
  if (missingKey) return <EmptyState icon={<AlertCircle size={28} />} message="IPO calendar is temporarily unavailable. Check back soon." />
  if (fetchError) return <EmptyState icon={<AlertCircle size={28} />} message="Could not load IPO data — check your connection and try again." />
  if (!loading && !missingKey && !fetchError && ipos.length === 0) return <EmptyState icon={<Calendar size={28} />} message="No events scheduled for this week." />

  const byDate = ipos.reduce<Record<string, IpoItem[]>>((acc, e) => {
    acc[e.date] ??= []
    acc[e.date].push(e)
    return acc
  }, {})

  return (
    <div className="divide-y divide-[#E5E5E5]">
      {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => {
        const d = new Date(date + 'T00:00:00')
        const today = isToday(d)
        return (
          <div key={date}>
            <div className={cn(
              'px-4 py-2 text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]',
              today ? 'text-[#5F790B] bg-[#F6FAEA]' : 'text-[#6B6B6B] bg-[#FAFAFA]',
            )}>
              {today ? 'TODAY · ' : ''}{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
            </div>
            {group.map((item, idx) => (
              <div key={`${date}-${item.company}-${idx}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors">
                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-[#FAF5FF] border border-[#E9D5FF] text-[#7C3AED]">
                  {item.ticker || 'IPO'}
                </span>
                <span className="flex-1 min-w-0 text-[13px] text-[#111111] truncate">{item.company}</span>
                {item.exchange && (
                  <span className="shrink-0 text-[10px] text-[#9B9B9B]">{item.exchange}</span>
                )}
                {item.priceRange && (
                  <span className="shrink-0 text-[12px] font-semibold text-[#111111] tabular-nums">{item.priceRange}</span>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Sub-tab bar ───────────────────────────────────────────────────────────────

const SUB_TABS: { id: CalSub; label: string; icon: React.ReactNode }[] = [
  { id: 'all',      label: 'All Events',     icon: <Calendar size={12} /> },
  { id: 'earnings', label: 'Earnings',       icon: <TrendingUp size={12} /> },
  { id: 'economic', label: 'Economic',       icon: <Landmark size={12} /> },
  { id: 'splits',   label: 'Stock Splits',   icon: <Scissors size={12} /> },
  { id: 'ipos',     label: 'IPO Pricings',   icon: <Rocket size={12} /> },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function CalendarTab() {
  const [sub, setSub]             = useState<CalSub>('all')
  const [weekOffset, setOffset]   = useState(0)
  const [earnings, setEarnings]   = useState<EarningsItem[]>([])
  const [economic, setEconomic]   = useState<EconomicEvent[]>([])
  const [splits, setSplits]       = useState<SplitItem[]>([])
  const [ipos, setIpos]           = useState<IpoItem[]>([])
  const [loadingE, setLoadingE]   = useState(true)
  const [loadingEc, setLoadingEc] = useState(true)
  const [loadingS, setLoadingS]   = useState(true)
  const [loadingI, setLoadingI]   = useState(true)
  const [missingKeyEc, setMissingKeyEc] = useState(false)
  const [missingKeyS, setMissingKeyS]   = useState(false)
  const [missingKeyI, setMissingKeyI]   = useState(false)
  const [fetchErrEc, setFetchErrEc] = useState(false)
  const [fetchErrS, setFetchErrS]   = useState(false)
  const [fetchErrI, setFetchErrI]   = useState(false)

  // Stable ISO strings — only change when weekOffset changes (integer dep, no Date objects)
  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset])

  useEffect(() => {
    const { from, to } = week

    setLoadingE(true)
    fetch('/api/markets/earnings')
      .then(r => r.json())
      .then(d => setEarnings((d.items ?? []).filter((e: EarningsItem) => inRange(e.date, from, to))))
      .catch(() => setEarnings([]))
      .finally(() => setLoadingE(false))

    setLoadingEc(true)
    setFetchErrEc(false)
    fetch(`/api/markets/economic-calendar?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => {
        setMissingKeyEc(!!d.missingKey)
        setEconomic((d.events ?? []).filter((e: EconomicEvent) => inRange(e.date, from, to)))
      })
      .catch(() => { setEconomic([]); setFetchErrEc(true) })
      .finally(() => setLoadingEc(false))

    setLoadingS(true)
    setFetchErrS(false)
    fetch(`/api/markets/splits?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => {
        setMissingKeyS(!!d.missingKey)
        setSplits(d.splits ?? [])
      })
      .catch(() => { setSplits([]); setFetchErrS(true) })
      .finally(() => setLoadingS(false))

    setLoadingI(true)
    setFetchErrI(false)
    fetch(`/api/markets/ipos?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => {
        setMissingKeyI(!!d.missingKey)
        setIpos(d.ipos ?? [])
      })
      .catch(() => { setIpos([]); setFetchErrI(true) })
      .finally(() => setLoadingI(false))
  }, [week]) // week is memoized — only re-runs when weekOffset changes

  const _days = weekDays(week.from)
  const anyLoading = loadingE || loadingEc || loadingS || loadingI

  // Column header row labels for the list views
  function ListHeader({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#9B9B9B] tracking-wider">
        {children}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Week navigator ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset(o => o - 1)}
            disabled={weekOffset <= -4}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md border border-[#E5E5E5] text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#111111] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous week"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[13px] font-semibold text-[#111111]">
            <span className="text-[#6B6B6B] font-normal">{week.label}</span>
          </span>
          <button
            onClick={() => setOffset(o => o + 1)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md border border-[#E5E5E5] text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#111111] transition-colors"
            aria-label="Next week"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setOffset(0)}
            aria-pressed={weekOffset === 0}
            className={cn(
              'text-[11px] font-semibold px-2.5 py-2.5 min-h-[44px] rounded-md border transition-colors',
              weekOffset === 0
                ? 'border-[#5F790B] bg-[#F6FAEA] text-[#5F790B]'
                : 'border-[#E5E5E5] text-[#6B6B6B] hover:border-[#5F790B] hover:text-[#5F790B]',
            )}
          >
            This week
          </button>
        </div>
      </div>

      {/* ── Card with sub-tabs ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm [overflow:clip]">

        {/* Sub-tab nav */}
        <div role="tablist" aria-label="Calendar event types" className="flex items-center gap-0 border-b border-[#E5E5E5] overflow-x-auto scrollbar-hide">
          {SUB_TABS.map(t => {
            const isActive = sub === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                id={`cal-sub-${t.id}`}
                onClick={() => setSub(t.id)}
                className={cn(
                  'flex items-center gap-1.5 shrink-0 px-4 py-2.5 text-[12px] font-semibold border-b-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-inset',
                  isActive
                    ? 'border-[#5F790B] text-[#111111]'
                    : 'border-transparent text-[#6B6B6B] hover:text-[#111111]',
                )}
              >
                {t.icon}
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}

        {sub === 'all' && (
          anyLoading ? (
            <LoadingRows />
          ) : (
            (() => {
              // Build a flat list of all events sorted by date for the combined view
              type AllEvent =
                | { kind: 'earnings'; date: string; data: EarningsItem }
                | { kind: 'economic'; date: string; data: EconomicEvent }
                | { kind: 'split';    date: string; data: SplitItem }
                | { kind: 'ipo';      date: string; data: IpoItem }

              const allEvents: AllEvent[] = [
                ...earnings.map(e => ({ kind: 'earnings' as const, date: e.date, data: e })),
                ...economic.map(e => ({ kind: 'economic' as const, date: e.date, data: e })),
                ...splits.map(e =>   ({ kind: 'split'    as const, date: e.date, data: e })),
                ...ipos.map(e =>     ({ kind: 'ipo'      as const, date: e.date, data: e })),
              ].sort((a, b) => a.date.localeCompare(b.date))

              if (allEvents.length === 0) {
                return <EmptyState icon={<Calendar size={28} />} message="No events scheduled for this week." />
              }

              const byDate = allEvents.reduce<Record<string, AllEvent[]>>((acc, e) => {
                acc[e.date] ??= []
                acc[e.date].push(e)
                return acc
              }, {})

              return (
                <div className="divide-y divide-[#E5E5E5]">
                  {Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => {
                    const d = new Date(date + 'T00:00:00')
                    const today = isToday(d)
                    return (
                      <div key={date}>
                        <div className={cn(
                          'px-4 py-2 text-[10px] font-bold tracking-wider border-b border-[#E5E5E5]',
                          today ? 'text-[#5F790B] bg-[#F6FAEA]' : 'text-[#6B6B6B] bg-[#FAFAFA]',
                        )}>
                          {today ? 'TODAY · ' : ''}
                          {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                        </div>
                        {group.map((ev, idx) => {
                          if (ev.kind === 'earnings') {
                            const item = ev.data as EarningsItem
                            const imp = earningsImportance(item.ticker)
                            return (
                              <div key={`e-${item.ticker}-${idx}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors">
                                <span className="text-[9px] font-[700] px-1.5 py-px rounded-full bg-[#EAF1FF] text-[#2563EB] border border-[#C7D9FC] shrink-0">Earnings</span>
                                <Link
                                  href={`/stock/${item.ticker}`}
                                  className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-[#F5F5F5] text-[#111111] hover:bg-[#EEF2FA] hover:text-[#5F790B] transition-colors"
                                >
                                  {item.ticker}
                                </Link>
                                <span className="flex-1 min-w-0 text-[13px] text-[#111111] truncate">{item.company}</span>
                                {item.timeOfDay && (
                                  <span className="shrink-0 text-[10px] text-[#9B9B9B]">
                                    {item.timeOfDay === 'BMO' ? 'Pre-market' : item.timeOfDay === 'AMC' ? 'After hours' : item.timeOfDay === 'TAS' ? 'Time specified' : ''}
                                  </span>
                                )}
                                <span className={cn('shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold', IMPACT_COLORS[imp])}>
                                  {imp}
                                </span>
                              </div>
                            )
                          }
                          if (ev.kind === 'economic') {
                            const item = ev.data as EconomicEvent
                            return (
                              <div key={`ec-${date}-${item.event}-${idx}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors">
                                <span className="text-[9px] font-[700] px-1.5 py-px rounded-full bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391] shrink-0">Economic</span>
                                <span className="shrink-0 w-20 text-[11px] text-[#6B6B6B] tabular-nums">{item.time || '—'}</span>
                                <span className="flex-1 min-w-0 text-[13px] text-[#111111] truncate">{item.event}</span>
                                <span className={cn('shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold', IMPACT_COLORS[item.impact])}>
                                  {item.impact}
                                </span>
                              </div>
                            )
                          }
                          if (ev.kind === 'split') {
                            const item = ev.data as SplitItem
                            return (
                              <div key={`s-${item.ticker}-${idx}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors">
                                <span className="text-[9px] font-[700] px-1.5 py-px rounded-full bg-[#F5F5F5] text-[#6B6B6B] border border-[#E5E5E5] shrink-0">Split</span>
                                <Link
                                  href={`/stock/${item.ticker}`}
                                  className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-[#F5F5F5] text-[#111111] hover:bg-[#EEF2FA] hover:text-[#5F790B] transition-colors"
                                >
                                  {item.ticker}
                                </Link>
                                <span className="flex-1 min-w-0 text-[13px] text-[#111111] truncate">{item.company}</span>
                                <span className="shrink-0 px-2.5 py-0.5 rounded-md bg-[#ECFDF5] border border-[#BBF7D0] text-[#047857] text-[11px] font-semibold">
                                  {item.numerator}-for-{item.denominator}
                                </span>
                              </div>
                            )
                          }
                          if (ev.kind === 'ipo') {
                            const item = ev.data as IpoItem
                            return (
                              <div key={`i-${date}-${item.company}-${idx}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAFA] transition-colors">
                                <span className="text-[9px] font-[700] px-1.5 py-px rounded-full bg-[#F3F0FF] text-[#6D28D9] border border-[#DDD6FE] shrink-0">IPO</span>
                                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-bold bg-[#FAF5FF] border border-[#E9D5FF] text-[#7C3AED]">
                                  {item.ticker || 'IPO'}
                                </span>
                                <span className="flex-1 min-w-0 text-[13px] text-[#111111] truncate">{item.company}</span>
                                {item.exchange && (
                                  <span className="shrink-0 text-[10px] text-[#9B9B9B]">{item.exchange}</span>
                                )}
                                {item.priceRange && (
                                  <span className="shrink-0 text-[12px] font-semibold text-[#111111] tabular-nums">{item.priceRange}</span>
                                )}
                              </div>
                            )
                          }
                          return null
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })()
          )
        )}

        {sub === 'earnings' && (
          <>
            <ListHeader>
              <span className="flex-1">TICKER / COMPANY</span>
              <span className="w-24 text-right">IMPORTANCE</span>
            </ListHeader>
            <EarningsList items={earnings} loading={loadingE} />
          </>
        )}

        {sub === 'economic' && (
          <>
            <ListHeader>
              <span className="w-20">TIME (ET)</span>
              <span className="flex-1">EVENT</span>
              <span className="w-16 text-right">IMPACT</span>
              <span className="w-12 text-right">PREV</span>
              <span className="w-12 text-right">EST</span>
              <span className="w-12 text-right">ACTUAL</span>
            </ListHeader>
            <EconomicList events={economic} loading={loadingEc} missingKey={missingKeyEc} fetchError={fetchErrEc} />
          </>
        )}

        {sub === 'splits' && (
          <>
            <ListHeader>
              <span className="flex-1">TICKER / COMPANY</span>
              <span className="w-24 text-right">RATIO</span>
            </ListHeader>
            <SplitsList splits={splits} loading={loadingS} missingKey={missingKeyS} fetchError={fetchErrS} />
          </>
        )}

        {sub === 'ipos' && (
          <>
            <ListHeader>
              <span className="flex-1">COMPANY</span>
              <span className="w-20 text-right">EXCHANGE</span>
              <span className="w-24 text-right">PRICE RANGE</span>
            </ListHeader>
            <IposList ipos={ipos} loading={loadingI} missingKey={missingKeyI} fetchError={fetchErrI} />
          </>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#E5E5E5] bg-[#FAFAFA]">
          <span className="text-[10px] text-[#9B9B9B]">
            Earnings: S&P 500 major companies · Economic: US high/medium impact events · All times ET
          </span>
        </div>
      </div>
    </div>
  )
}
