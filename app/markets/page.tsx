'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'

import { cn } from '@/lib/utils'

import IndexSnapshotGrid     from '@/components/markets/IndexSnapshotGrid'
import MarketPulse           from '@/components/markets/MarketPulse'
import NormalizedPerfChart   from '@/components/markets/NormalizedPerfChart'
import TopMoversCard         from '@/components/markets/TopMoversCard'
import MarketHeatmapCard     from '@/components/markets/MarketHeatmapCard'
import SectorRotation        from '@/components/markets/SectorRotation'
import MacroSignals          from '@/components/markets/MacroSignals'
import SectorPerformanceCard from '@/components/markets/SectorPerformanceCard'
import ValuationContext      from '@/components/markets/ValuationContext'
import MarketNewsSection     from '@/components/markets/MarketNewsSection'
import MarketsTabNav         from '@/components/markets/MarketsTabNav'
import { useSetTopBarTabs }  from '@/contexts/TopBarTabsContext'
import CalendarTab           from '@/components/markets/CalendarTab'
import YieldCurveChart       from '@/components/markets/YieldCurveChart'
import PriceTable            from '@/components/markets/PriceTable'
import SectorStocksCard      from '@/components/markets/SectorStocksCard'
import type { MarketTab }    from '@/components/markets/MarketsTabNav'

import type { MarketsData }          from '@/app/api/markets/data/route'
import type { MarketContextPayload } from '@/lib/market-context/types'

const REFRESH_INTERVAL_MS = 60_000

function Sk({ h = 'h-32', className = '' }: { h?: string; className?: string }) {
  return <div className={`motion-safe:animate-pulse rounded-xl bg-[#EBEBEB] border border-[#E0E0E0] ${h} ${className}`} />
}

type MarketStatusTone = 'green' | 'amber' | 'blue' | 'gray'

function getMarketStatus(): { label: string; tone: MarketStatusTone } {
  const now = new Date()
  const etParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
  }).formatToParts(now)
  const weekday = etParts.find(p => p.type === 'weekday')?.value ?? ''
  const h = parseInt(etParts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const m = parseInt(etParts.find(p => p.type === 'minute')?.value ?? '0', 10)
  const et = h * 60 + m
  const isWeekend = weekday === 'Sat' || weekday === 'Sun'
  if (isWeekend) return { label: 'Market Closed', tone: 'gray' }
  if (et >= 240  && et < 570)  return { label: 'Pre-Market',    tone: 'amber' }
  if (et >= 570  && et < 960)  return { label: '● Market Open', tone: 'green' }
  if (et >= 960  && et < 1200) return { label: 'After Hours',   tone: 'blue'  }
  return { label: 'Market Closed', tone: 'gray' }
}

export default function MarketsPage() {
  const [mkt,        setMkt]        = useState<MarketsData | null>(null)
  const [ctx,        setCtx]        = useState<MarketContextPayload | null>(null)
  const [err,        setErr]        = useState(false)
  const [newsErr,    setNewsErr]    = useState(false)
  const [lastFetch,  setLastFetch]  = useState<number>(0)
  const [activeTab,  setActiveTab]  = useState<MarketTab>('overview')
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(new Set(['overview']))

  const marketTabs = useMemo(() => [
    { id: 'overview',  label: 'Overview'  },
    { id: 'sectors',   label: 'Sectors'   },
    { id: 'news',      label: 'News'      },
    { id: 'calendar',  label: 'Calendar'  },
    { id: 'valuation', label: 'Valuation' },
  ], [])
  useSetTopBarTabs(marketTabs, activeTab, (id: string) => setActiveTab(id as MarketTab))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [liveStatus, setLiveStatus] = useState(getMarketStatus)
  useEffect(() => {
    const t = setInterval(() => setLiveStatus(getMarketStatus()), 10_000)
    return () => clearInterval(t)
  }, [])

  // Lazy-mount tabs on first visit so heavy components aren't pre-rendered
  useEffect(() => {
    setMountedTabs(prev => new Set(Array.from(prev).concat(activeTab)))
  }, [activeTab])

  const fetchAll = useCallback(async () => {
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
      fetch('/api/markets/news')
        .then(r => r.json())
        .then(d => { if (d?.news) setMkt(prev => prev ? { ...prev, news: d.news } : prev) })
        .catch(() => { setNewsErr(true) })
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(() => fetchAll(), REFRESH_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchAll])

  const spx  = mkt?.indices.find(i => i.symbol === '^GSPC')       ?? null
  const ndx  = mkt?.indices.find(i => i.symbol === '^NDX')        ?? null
  const dji  = mkt?.indices.find(i => i.symbol === '^DJI')        ?? null
  const vix  = mkt?.indices.find(i => i.symbol === '^VIX')        ?? null
  const tnx  = mkt?.indices.find(i => i.symbol === '^TNX')        ?? null
  const dxy  = mkt?.currencies.find(i => i.symbol === 'DX-Y.NYB') ?? null
  const vwo  = mkt?.snapshotEtfs?.find(i => i.symbol === 'VWO')   ?? null
  const vgk  = mkt?.snapshotEtfs?.find(i => i.symbol === 'VGK')   ?? null
  const mchi = mkt?.snapshotEtfs?.find(i => i.symbol === 'MCHI')  ?? null
  const botz = mkt?.snapshotEtfs?.find(i => i.symbol === 'BOTZ')  ?? null

  const now = new Date()
  const etTime = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
  })

  return (
    /* Mobile: natural scroll page. Desktop (lg+): fixed-height Koyfin layout. */
    <div className="bg-background lg:h-content-shell lg:overflow-hidden lg:flex lg:flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-olive-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:outline-none focus:shadow-lg"
      >
        Skip to content
      </a>

      <div
        id="main-content"
        className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 pt-2 pb-[calc(80px+env(safe-area-inset-bottom,0px))] lg:pb-1 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden"
        tabIndex={-1}
      >

        {/* ── Error banner ── */}
        {err && (
          <div className="shrink-0 rounded-xl border border-[#F0B8B8] bg-[#FCEAEA] px-4 py-3 text-[12px] text-[#D83B3B] flex items-center justify-between mb-2">
            <span>Market data could not be loaded.</span>
            <button onClick={() => fetchAll()} className="font-semibold text-[11px] hover:underline ml-4 min-h-[44px]">
              Retry
            </button>
          </div>
        )}

        {/* ── Persistent: Index snapshot strip ── */}
        <div className="shrink-0 mb-2">
          {mkt ? (
            <IndexSnapshotGrid spx={spx} ndx={ndx} dji={dji} vix={vix} tnx={tnx} dxy={dxy} vwo={vwo} vgk={vgk} mchi={mchi} botz={botz} marketStatus={liveStatus} />
          ) : (
            <div className="bg-white border border-[#E5E5E5] rounded-xl h-[56px] motion-safe:animate-pulse" />
          )}
        </div>

        {/* ── Tab navigation — mobile only (desktop tabs in TopBar) ── */}
        <div className="shrink-0 flex items-center w-full lg:hidden mb-2">
          <MarketsTabNav active={activeTab} onChange={setActiveTab} />
        </div>

        {/* ── Tab panels container ── */}
        {/* ── Tab panels container — natural height on mobile, flex fill on desktop ── */}
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">

          {/* ── OVERVIEW ── */}
          <div
            id="markets-panel-overview"
            role="tabpanel"
            aria-labelledby="markets-tab-overview"
            className={cn(activeTab === 'overview' ? 'lg:h-full lg:flex lg:flex-col lg:overflow-hidden' : 'hidden')}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:flex-1 lg:min-h-[200px] lg:overflow-hidden">
              <div className="lg:col-span-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
                {ctx ? <MarketPulse pulse={ctx.pulse} /> : <Sk h="h-[280px]" />}
              </div>
              <div className="lg:col-span-6 lg:h-full lg:min-h-0 lg:overflow-hidden">
                <NormalizedPerfChart />
              </div>
              <div className="lg:col-span-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
                <TopMoversCard />
              </div>
            </div>
            <div className="mt-3 pb-2 lg:shrink-0 lg:mt-2 lg:pb-1">
              {ctx ? <MacroSignals signals={ctx.signals} /> : <Sk h="h-[72px]" />}
            </div>
          </div>

          {/* ── SECTORS ── */}
          <div
            id="markets-panel-sectors"
            role="tabpanel"
            aria-labelledby="markets-tab-sectors"
            className={cn(activeTab === 'sectors' ? 'lg:h-full lg:flex lg:flex-col lg:overflow-hidden' : 'hidden')}
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:flex-1 lg:min-h-0 lg:overflow-hidden pb-4 lg:pb-0">
              <div className="lg:col-span-7 lg:h-full lg:min-h-0 lg:overflow-hidden">
                {mkt ? <MarketHeatmapCard sectors={mkt.sectors} /> : <Sk h="h-[320px]" />}
              </div>
              <div className="lg:col-span-5 lg:h-full lg:min-h-0 flex flex-col gap-3 lg:overflow-hidden">
                <div className="lg:flex-none lg:h-[180px] lg:overflow-hidden">
                  {ctx ? <SectorRotation sectors={ctx.sectors} /> : <Sk h="h-[180px]" />}
                </div>
                <div className="lg:flex-none lg:h-[180px] lg:overflow-hidden">
                  {mkt ? <SectorPerformanceCard sectors={mkt.sectors} /> : <Sk h="h-[180px]" />}
                </div>
                <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">
                  <SectorStocksCard />
                </div>
              </div>
            </div>
          </div>

          {/* ── NEWS ── */}
          <div
            id="markets-panel-news"
            role="tabpanel"
            aria-labelledby="markets-tab-news"
            className={cn(activeTab === 'news' ? 'lg:h-full lg:flex lg:flex-col lg:overflow-hidden' : 'hidden')}
          >
            {!mkt ? (
              <Sk h="h-48" />
            ) : newsErr ? (
              <div className="rounded-xl border border-[#E3E1DA] bg-[#FAFAFA] px-5 py-8 text-center">
                <p className="text-[13px] text-[#6B6B6B]">Market news could not be loaded. Try refreshing.</p>
              </div>
            ) : mkt.news.length > 0 ? (
              <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                <MarketNewsSection news={mkt.news} />
              </div>
            ) : (
              <div className="rounded-xl border border-[#E3E1DA] bg-[#FAFAFA] px-5 py-8 text-center">
                <p className="text-[13px] text-[#6B6B6B]">No market news available right now.</p>
              </div>
            )}
          </div>

          {/* ── CALENDAR ── */}
          <div
            id="markets-panel-calendar"
            role="tabpanel"
            aria-labelledby="markets-tab-calendar"
            className={cn(activeTab === 'calendar' ? 'lg:h-full lg:overflow-hidden' : 'hidden')}
          >
            {mountedTabs.has('calendar') && <CalendarTab />}
          </div>

          {/* ── VALUATION ── */}
          <div
            id="markets-panel-valuation"
            role="tabpanel"
            aria-labelledby="markets-tab-valuation"
            className={cn(activeTab === 'valuation' ? 'flex flex-col lg:flex-row gap-3 lg:h-full lg:overflow-hidden' : 'hidden')}
          >
            {/* Left col: YieldCurveChart */}
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden flex flex-col">
              {!mkt ? (
                <Sk h="h-[280px]" />
              ) : mkt.yieldCurve.length > 0 ? (
                <YieldCurveChart points={mkt.yieldCurve} />
              ) : (
                <div className="rounded-xl border border-[#E3E1DA] bg-[#FAFAFA] px-5 py-4">
                  <p className="text-[13px] text-[#6B6B6B]">Yield curve data unavailable.</p>
                </div>
              )}
            </div>

            {/* Right col: ValuationContext + HY Spread + PriceTables */}
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto flex flex-col gap-3 pb-4 lg:pb-0">
              {ctx ? <ValuationContext valuation={ctx.valuation} /> : <Sk h="h-56" />}

              {/* HY Credit Spread */}
              {ctx && (() => {
                const hySignal = ctx.signals.find(s => s.id === 'hy')
                if (!hySignal) return null
                const toneMap: Record<string, { bg: string; text: string; border: string }> = {
                  positive: { bg: 'bg-[#E8F7EF]', text: 'text-[#11875D]', border: 'border-[#A3D9BE]' },
                  warning:  { bg: 'bg-[#FFF4DA]', text: 'text-[#B56A00]', border: 'border-[#F3D391]' },
                  negative: { bg: 'bg-[#FCEAEA]', text: 'text-[#D83B3B]', border: 'border-[#F0B8B8]' },
                  neutral:  { bg: 'bg-[#F5F5F5]', text: 'text-[#6B6B6B]', border: 'border-[#E5E5E5]' },
                }
                const t = toneMap[(hySignal as { tone?: string }).tone ?? 'neutral'] ?? toneMap.neutral
                return (
                  <div className="rounded-xl border border-[#E3E1DA] bg-white p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-[11px] font-[700] uppercase tracking-[0.05em] text-[#9B9B9B] mb-1">HY Credit Spread (OAS)</p>
                        <p className="text-[24px] font-[800] tabular-nums text-[#111111] leading-none">
                          {(hySignal as { value?: string }).value ?? '—'}
                        </p>
                        <p className="text-[12px] text-[#566174] mt-1 leading-snug max-w-[380px]">
                          {(hySignal as { equityImplication?: string }).equityImplication ?? ''}
                        </p>
                      </div>
                      <span className={`inline-flex text-[11px] font-[700] px-3 py-1.5 rounded-full border shrink-0 ${t.bg} ${t.text} ${t.border}`}>
                        {(hySignal as { regimeLabel?: string }).regimeLabel ?? '—'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9B9B9B] leading-snug border-t border-[#F5F5F5] pt-3">
                      Spreads below 4% = low credit stress. 4–7% = elevated caution. Above 7% = historically associated with equity drawdowns. Source: FRED BAMLH0A0HYM2.
                    </p>
                  </div>
                )
              })()}

              {/* Rates, Currencies & Commodities PriceTables */}
              {mkt && (mkt.fixedIncome.length > 0 || mkt.currencies.length > 0 || mkt.commodities.length > 0) && (
                <div className="flex flex-col gap-3">
                  {mkt.fixedIncome.length > 0 && (
                    <PriceTable title="Fixed Income" items={mkt.fixedIncome} />
                  )}
                  {mkt.currencies.length > 0 && (
                    <PriceTable title="Currencies" items={mkt.currencies} priceDecimals={4} />
                  )}
                  {mkt.commodities.length > 0 && (
                    <PriceTable title="Commodities" items={mkt.commodities} />
                  )}
                </div>
              )}

              {/* Footer — inside scrollable right col */}
              <div className="mt-auto pt-4 flex items-center justify-between flex-wrap gap-2 shrink-0">
                <p className="text-[11px] text-[#9B9B9B] leading-snug">
                  Past performance is not indicative of future results. For informational purposes only.
                </p>
                {lastFetch > 0 && (
                  <p className="text-[11px] text-[#9B9B9B] shrink-0 tabular-nums">{etTime} ET</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
