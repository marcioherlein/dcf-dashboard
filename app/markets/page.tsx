'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { RefreshCw, Settings2, ExternalLink } from 'lucide-react'

import IndexSnapshotGrid    from '@/components/markets/IndexSnapshotGrid'
import MarketPulse          from '@/components/markets/MarketPulse'
import NormalizedPerfChart  from '@/components/markets/NormalizedPerfChart'
import TopMoversCard        from '@/components/markets/TopMoversCard'
import MarketHeatmapCard    from '@/components/markets/MarketHeatmapCard'
import SectorRotation       from '@/components/markets/SectorRotation'
import MacroSignals         from '@/components/markets/MacroSignals'
import MarketBreadthCard    from '@/components/markets/MarketBreadthCard'
import SectorPerformanceCard from '@/components/markets/SectorPerformanceCard'
import EconomicCalendar     from '@/components/markets/EconomicCalendar'
import EarningsCalendar     from '@/components/markets/EarningsCalendar'
import ValuationContext     from '@/components/markets/ValuationContext'
import PortfolioExposure    from '@/components/markets/PortfolioExposure'
import MarketNewsSection    from '@/components/markets/MarketNewsSection'

import type { MarketsData }          from '@/app/api/markets/data/route'
import type { MarketContextPayload } from '@/lib/market-context/types'

const REFRESH_INTERVAL_MS = 60_000

function Sk({ h = 'h-32', className = '' }: { h?: string; className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/70 border border-slate-100 ${h} ${className}`} />
}

function pct(v: number | null) {
  if (v == null) return ''
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}
function pctCls(v: number | null) {
  if (v == null) return 'text-slate-400'
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-slate-500'
}
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 10)  return 'just now'
  if (s < 60)  return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}
function getMarketStatus(): { label: string; cls: string } {
  const now  = new Date()
  const utcH = now.getUTCHours()
  const utcM = now.getUTCMinutes()
  const day  = now.getUTCDay()
  const et   = (utcH * 60 + utcM - 240 + 1440) % 1440
  if (day === 0 || day === 6) return { label: 'Market Closed', cls: 'bg-slate-100 text-slate-500' }
  if (et >= 240  && et < 570)  return { label: 'Pre-Market',    cls: 'bg-amber-50 text-amber-700' }
  if (et >= 570  && et < 960)  return { label: '● Market Open', cls: 'bg-emerald-50 text-emerald-700 font-bold' }
  if (et >= 960  && et < 1200) return { label: 'After Hours',   cls: 'bg-blue-50 text-blue-700' }
  return { label: 'Market Closed', cls: 'bg-slate-100 text-slate-500' }
}

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

export default function MarketsPage() {
  const [mkt,        setMkt]        = useState<MarketsData | null>(null)
  const [ctx,        setCtx]        = useState<MarketContextPayload | null>(null)
  const [err,        setErr]        = useState(false)
  const [lastFetch,  setLastFetch]  = useState<number>(0)
  const [refreshing, setRefreshing] = useState(false)
  const [status]                    = useState(getMarketStatus)
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null)

  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])

  const fetchAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const [m, c] = await Promise.all([
        fetch('/api/markets/data').then(r => r.json()).catch(() => null),
        fetch('/api/market-context').then(r => r.json()).catch(() => null),
      ])
      if (!m) { setErr(true); return }
      setMkt(m)
      setCtx(c)
      setLastFetch(Date.now())
      setErr(false)
    } finally {
      if (isManual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(() => fetchAll(), REFRESH_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchAll])

  const spx = mkt?.indices.find(i => i.symbol === '^GSPC')       ?? null
  const ndx = mkt?.indices.find(i => i.symbol === '^NDX')        ?? null
  const dji = mkt?.indices.find(i => i.symbol === '^DJI')        ?? null
  const vix = mkt?.indices.find(i => i.symbol === '^VIX')        ?? null
  const tnx = mkt?.indices.find(i => i.symbol === '^TNX')        ?? null
  const dxy = mkt?.currencies.find(i => i.symbol === 'DX-Y.NYB') ?? null

  const STRIP = [
    { label: 'S&P 500',    sym: spx  },
    { label: 'Nasdaq 100', sym: ndx  },
    { label: 'Dow Jones',  sym: dji  },
    { label: 'VIX',        sym: vix  },
    { label: '10Y Yield',  sym: tnx, suffix: '%', rateMode: true },
    { label: 'USD Index',  sym: dxy  },
  ]

  const now = new Date()
  const etTime = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const etDate = now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8FAFF] to-[#F5F7FE] pt-[52px]">

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-6">

        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-600 flex items-center justify-between">
            <span>Market data could not be loaded. Check API keys and try again.</span>
            <button
              onClick={() => fetchAll(true)}
              className="text-red-700 font-semibold text-[11px] hover:underline ml-4"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[18px] sm:text-[20px] font-bold text-slate-900 leading-tight">Markets Overview</h1>
            <p className="text-[11px] sm:text-[12px] text-slate-400 mt-0.5 hidden sm:block">
              Market context and key drivers that influence valuation decisions.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-0.5 shrink-0">
            <span className="text-[10px] text-slate-400 hidden md:block">
              {etDate}, {etTime} ET
            </span>
            {lastFetch > 0 && (
              <span className="text-[10px] text-slate-400 hidden lg:block">
                · Updated {timeAgo(lastFetch)}
              </span>
            )}
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Refresh"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
              <Settings2 size={11} />
              Customize
            </button>
          </div>
        </div>

        {/* ── Inline market strip ──────────────────────────────────────────── */}
        <div className="flex items-center gap-4 sm:gap-5 overflow-x-auto scrollbar-hide bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-2.5 min-h-[44px]">
          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>
            {status.label}
          </span>
          <div className="w-px h-3.5 bg-slate-200 shrink-0" />
          {STRIP.map(({ label, sym, suffix, rateMode }) => {
            const price = sym?.price ?? null
            const changeCls = rateMode
              ? (sym?.changePct == null ? 'text-slate-400' : sym.changePct > 0 ? 'text-amber-600' : sym.changePct < 0 ? 'text-blue-600' : 'text-slate-400')
              : pctCls(sym?.changePct ?? null)
            const inner = (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-slate-500 font-medium">{label}</span>
                <span className="text-[11px] font-semibold text-slate-800 tabular-nums">
                  {price != null
                    ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'
                  }
                  {suffix ?? ''}
                </span>
                {sym?.changePct != null && (
                  <span className={`text-[10px] font-medium tabular-nums ${changeCls}`}>
                    {pct(sym.changePct)}
                  </span>
                )}
              </div>
            )
            return sym ? (
              <Link
                key={label}
                href={`/markets/${encodeURIComponent(sym.symbol)}`}
                className="hover:opacity-70 transition-opacity"
              >
                {inner}
              </Link>
            ) : (
              <div key={label}>{inner}</div>
            )
          })}
        </div>

        {/* ── Row 1: Index Snapshot Cards ─────────────────────────────────── */}
        {mkt ? (
          <IndexSnapshotGrid spx={spx} ndx={ndx} dji={dji} vix={vix} tnx={tnx} dxy={dxy} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => <Sk key={i} h="h-[132px]" />)}
          </div>
        )}

        {/* ── Row 2: Market Pulse · Performance Chart · Top Movers ─────────── */}
        <div>
          <SectionHeader
            title="Market Snapshot"
            subtitle="A quick read on the current regime, performance, and what's moving markets."
            right={lastFetch > 0 ? (
              <span className="text-[11px] text-slate-400">Data as of {etTime} ET</span>
            ) : undefined}
          />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4">
              {ctx ? <MarketPulse pulse={ctx.pulse} /> : <Sk h="h-[280px]" />}
            </div>
            <div className="lg:col-span-5">
              <NormalizedPerfChart />
            </div>
            <div className="lg:col-span-3">
              <TopMoversCard />
            </div>
          </div>
        </div>

        {/* ── Row 3: Heatmap · Sector Rotation ────────────────────────────── */}
        <div>
          <SectionHeader
            title="Sector Analysis"
            subtitle="Where market leadership is concentrated and which sectors lead or lag."
          />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7">
              {mkt ? (
                <MarketHeatmapCard sectors={mkt.sectors} />
              ) : (
                <Sk h="h-[320px]" />
              )}
            </div>
            <div className="lg:col-span-5">
              {ctx ? <SectorRotation sectors={ctx.sectors} /> : <Sk h="h-[320px]" />}
            </div>
          </div>
        </div>

        {/* ── Row 4: Macro Signals · Market Breadth · Sector Performance ──── */}
        <div>
          <SectionHeader
            title="Macro Environment"
            subtitle="Indicators that affect discount rates, risk appetite, and valuation assumptions."
          />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              {ctx ? <MacroSignals signals={ctx.signals} /> : <Sk h="h-64" />}
            </div>
            <div className="lg:col-span-4">
              {mkt ? (
                <MarketBreadthCard sectors={mkt.sectors} />
              ) : (
                <Sk h="h-64" />
              )}
            </div>
            <div className="lg:col-span-3">
              {mkt ? (
                <SectorPerformanceCard sectors={mkt.sectors} />
              ) : (
                <Sk h="h-64" />
              )}
            </div>
          </div>
        </div>

        {/* ── Row 5: Calendars ────────────────────────────────────────────── */}
        <div>
          <SectionHeader
            title="Upcoming Events"
            subtitle="Economic releases and earnings that may affect your valuation assumptions."
            right={
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-400 hidden sm:block">All times in ET</span>
                <a
                  href="https://finance.yahoo.com/calendar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View full calendars
                  <ExternalLink size={11} />
                </a>
              </div>
            }
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <EconomicCalendar />
            <EarningsCalendar />
          </div>
        </div>

        {/* ── Row 6: Valuation Context · Saved Valuations ─────────────────── */}
        <div>
          <SectionHeader
            title="Valuation Context"
            subtitle="How current market prices compare to historical ranges — and what it means for your DCF."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ctx ? <ValuationContext valuation={ctx.valuation} /> : <Sk h="h-56" />}
            {ctx ? (
              <PortfolioExposure
                portfolioExposure={ctx.portfolioExposure}
                modelAlerts={ctx.modelAlerts}
              />
            ) : (
              <Sk h="h-56" />
            )}
          </div>
        </div>

        {/* ── Row 7: Market News ───────────────────────────────────────────── */}
        {mkt && mkt.news.length > 0 && (
          <div>
            <SectionHeader
              title="Market News"
              subtitle="Recent headlines — for context only, not a trading signal."
              right={
                <a
                  href="https://finance.yahoo.com/news"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  View all news
                  <ExternalLink size={11} />
                </a>
              }
            />
            <MarketNewsSection news={mkt.news} />
          </div>
        )}

        {/* ── Disclaimer ───────────────────────────────────────────────────── */}
        <div className="border-t border-slate-200 pt-4">
          <p className="text-[10px] text-slate-400 leading-snug">
            Past performance is not indicative of future results. Data is provided for informational purposes only and does not constitute investment advice.
          </p>
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}
