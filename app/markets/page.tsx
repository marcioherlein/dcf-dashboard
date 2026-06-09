'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useInView, useReducedMotion } from 'motion/react'

import IndexSnapshotGrid     from '@/components/markets/IndexSnapshotGrid'
import MarketPulse           from '@/components/markets/MarketPulse'
import NormalizedPerfChart   from '@/components/markets/NormalizedPerfChart'
import TopMoversCard         from '@/components/markets/TopMoversCard'
import MarketHeatmapCard     from '@/components/markets/MarketHeatmapCard'
import SectorRotation        from '@/components/markets/SectorRotation'
import MacroSignals          from '@/components/markets/MacroSignals'
import MarketBreadthCard     from '@/components/markets/MarketBreadthCard'
import SectorPerformanceCard from '@/components/markets/SectorPerformanceCard'
import ValuationContext      from '@/components/markets/ValuationContext'
import PortfolioExposure     from '@/components/markets/PortfolioExposure'
import MarketNewsSection     from '@/components/markets/MarketNewsSection'
import MarketsTabNav         from '@/components/markets/MarketsTabNav'
import CalendarTab           from '@/components/markets/CalendarTab'
import type { MarketTab }    from '@/components/markets/MarketsTabNav'

import type { MarketsData }          from '@/app/api/markets/data/route'
import type { MarketContextPayload } from '@/lib/market-context/types'

const REFRESH_INTERVAL_MS = 60_000

function Sk({ h = 'h-32', className = '' }: { h?: string; className?: string }) {
  return <div className={`motion-safe:animate-pulse rounded-xl bg-[#F5F5F5] border border-[#E5E5E5] ${h} ${className}`} />
}

function pct(v: number | null) {
  if (v == null) return ''
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}
function pctCls(v: number | null) {
  if (v == null) return 'text-[#6B6B6B]'
  return v > 0 ? 'text-[#11875D]' : v < 0 ? 'text-[#D83B3B]' : 'text-[#6B6B6B]'
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
  if (day === 0 || day === 6) return { label: 'Market Closed', cls: 'bg-[#F5F5F5] text-[#6B6B6B]' }
  if (et >= 240  && et < 570)  return { label: 'Pre-Market',    cls: 'bg-[#FFF4DA] text-[#B56A00]' }
  if (et >= 570  && et < 960)  return { label: '● Market Open', cls: 'bg-[#E8F7EF] text-[#11875D] font-bold' }
  if (et >= 960  && et < 1200) return { label: 'After Hours',   cls: 'bg-[#EAF1FF] text-[#2563EB]' }
  return { label: 'Market Closed', cls: 'bg-[#F5F5F5] text-[#6B6B6B]' }
}

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  return (
    <div ref={ref} className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2 border-b border-[#E5E5E5] pb-2.5">
      <div
        style={{
          clipPath: reduced ? 'none' : inView ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
          transition: reduced ? 'none' : 'clip-path 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <h2 className="text-[16px] font-bold text-[#111111] tracking-tight">{title}</h2>
        {subtitle && <p className="text-[12px] text-[#6B6B6B] mt-0.5">{subtitle}</p>}
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
  const [activeTab,  setActiveTab]  = useState<MarketTab>('overview')
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
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
  })
  const etDate = now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-olive-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:outline-none focus:shadow-lg"
      >
        Skip to content
      </a>
      <div id="main-content" className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 sm:py-6" tabIndex={-1}>

        {err && (
          <div className="rounded-xl border border-[#F0B8B8] bg-[#FCEAEA] px-4 py-3 text-[12px] text-[#D83B3B] flex items-center justify-between mb-4">
            <span>Market data could not be loaded. Check API keys and try again.</span>
            <button
              onClick={() => fetchAll(true)}
              className="text-[#D83B3B] font-semibold text-[11px] hover:underline ml-4 min-h-[44px]"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-2 mb-4">
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-[24px] font-bold text-[#111111] leading-tight [text-wrap:balance]">Markets</h1>
            <p className="text-[12px] text-[#6B6B6B] mt-0.5 hidden sm:block">
              Context and key drivers that influence valuation decisions.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:pt-0.5 shrink-0">
            <span className="text-[11px] text-[#6B6B6B] hidden md:block">{etDate}, {etTime} ET</span>
            {lastFetch > 0 && (
              <span className="text-[11px] text-[#6B6B6B] hidden lg:block">· Updated {timeAgo(lastFetch)}</span>
            )}
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="p-2 rounded-lg text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Refresh"
            >
              <RefreshCw size={13} className={refreshing ? 'motion-safe:animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Persistent: Indices strip ────────────────────────────────────── */}
        <div className="flex items-center gap-4 sm:gap-5 overflow-x-auto scrollbar-hide glass-card-light rounded-xl px-4 py-2.5 min-h-[44px] mb-4">
          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>
            {status.label}
          </span>
          <div className="w-px h-3.5 bg-[#E3E1DA] shrink-0" />
          {STRIP.map(({ label, sym, suffix, rateMode }) => {
            const price = sym?.price ?? null
            const changeCls = rateMode
              ? (sym?.changePct == null ? 'text-[#6B6B6B]' : sym.changePct > 0 ? 'text-[#B56A00]' : sym.changePct < 0 ? 'text-[#2563EB]' : 'text-[#6B6B6B]')
              : pctCls(sym?.changePct ?? null)
            const inner = (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-[#6B6B6B] font-medium">{label}</span>
                <span className="text-[11px] font-semibold text-[#111111] tabular-nums">
                  {price != null
                    ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '—'}
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
              <Link key={label} href={`/markets/${encodeURIComponent(sym.symbol)}`} className="hover:opacity-70 transition-opacity">
                {inner}
              </Link>
            ) : (
              <div key={label}>{inner}</div>
            )
          })}
        </div>

        {/* ── Persistent: Index snapshot cards ────────────────────────────── */}
        <div className="mb-4">
          {mkt ? (
            <IndexSnapshotGrid spx={spx} ndx={ndx} dji={dji} vix={vix} tnx={tnx} dxy={dxy} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(6)].map((_, i) => <Sk key={i} h="h-[132px]" />)}
            </div>
          )}
        </div>

        {/* ── Tab navigation ───────────────────────────────────────────────── */}
        <MarketsTabNav active={activeTab} onChange={setActiveTab} />

        {/* ── Tab panels ───────────────────────────────────────────────────── */}
        <div className="mt-5 space-y-5">

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div id="markets-panel-overview" role="tabpanel" aria-labelledby="markets-tab-overview">
              {/* Market Snapshot */}
              <div>
                <SectionHeader
                  title="Market Snapshot"
                  subtitle="A quick read on the current regime, performance, and what's moving markets."
                  right={lastFetch > 0 ? (
                    <span className="text-[11px] text-[#6B6B6B]">Data as of {etTime} ET</span>
                  ) : undefined}
                />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch mt-3">
                  <div className="lg:col-span-4 flex flex-col">
                    {ctx ? <MarketPulse pulse={ctx.pulse} /> : <Sk h="h-[280px]" />}
                  </div>
                  <div className="lg:col-span-5 flex flex-col">
                    <NormalizedPerfChart />
                  </div>
                  <div className="lg:col-span-3 flex flex-col">
                    <TopMoversCard />
                  </div>
                </div>
              </div>

              {/* Market News */}
              {mkt && mkt.news.length > 0 && (
                <div>
                  <SectionHeader
                    title="Market News"
                    subtitle="Recent headlines — for context only, not a trading signal."
                  />
                  <MarketNewsSection news={mkt.news} />
                </div>
              )}
            </div>
          )}

          {/* ── SECTORS TAB ──────────────────────────────────────────────── */}
          {activeTab === 'sectors' && (
            <div id="markets-panel-sectors" role="tabpanel" aria-labelledby="markets-tab-sectors">
              {/* Heatmap + Rotation */}
              <div>
                <SectionHeader
                  title="Sector Analysis"
                  subtitle="Where market leadership is concentrated and which sectors lead or lag."
                />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-3">
                  <div className="lg:col-span-7 overflow-x-auto">
                    {mkt ? (
                      <div className="overflow-x-auto">
                        <MarketHeatmapCard sectors={mkt.sectors} />
                      </div>
                    ) : (
                      <Sk h="h-[320px]" />
                    )}
                  </div>
                  <div className="lg:col-span-5">
                    {ctx ? <SectorRotation sectors={ctx.sectors} /> : <Sk h="h-[320px]" />}
                  </div>
                </div>
              </div>

              {/* Macro + Breadth + Sector Perf */}
              <div>
                <SectionHeader
                  title="Macro Environment"
                  subtitle="Indicators that affect discount rates, risk appetite, and valuation assumptions."
                />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-3">
                  <div className="lg:col-span-5">
                    {ctx ? <MacroSignals signals={ctx.signals} /> : <Sk h="h-64" />}
                  </div>
                  <div className="lg:col-span-4">
                    {mkt ? <MarketBreadthCard sectors={mkt.sectors} /> : <Sk h="h-64" />}
                  </div>
                  <div className="lg:col-span-3">
                    {mkt ? <SectorPerformanceCard sectors={mkt.sectors} /> : <Sk h="h-64" />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── CALENDAR TAB ─────────────────────────────────────────────── */}
          {activeTab === 'calendar' && (
            <div id="markets-panel-calendar" role="tabpanel" aria-labelledby="markets-tab-calendar">
              <CalendarTab />
            </div>
          )}

          {/* ── VALUATION CONTEXT TAB ────────────────────────────────────── */}
          {activeTab === 'valuation' && (
            <div id="markets-panel-valuation" role="tabpanel" aria-labelledby="markets-tab-valuation">
              <SectionHeader
                title="Valuation Context"
                subtitle="How current market prices compare to historical ranges — and what it means for your DCF."
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
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
          )}

        </div>

        {/* ── Disclaimer ───────────────────────────────────────────────────── */}
        <div className="border-t border-[#E5E5E5] pt-4 mt-8">
          <p className="text-[11px] text-[#6B6B6B] leading-snug">
            Past performance is not indicative of future results. Data is provided for informational purposes only and does not constitute investment advice.
          </p>
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}
