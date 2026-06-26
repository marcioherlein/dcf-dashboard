'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useInView, useReducedMotion } from 'motion/react'

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

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  return (
    <div ref={ref} className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2 border-b border-[#E5E5E5] pb-2.5">
      <div
        style={{
          opacity: reduced ? 1 : inView ? 1 : 0,
          transform: reduced ? 'none' : inView ? 'translateY(0)' : 'translateY(6px)',
          transition: reduced ? 'none' : 'opacity 0.5s ease, transform 0.5s ease',
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
  const [newsErr,    setNewsErr]    = useState(false)
  const [lastFetch,  setLastFetch]  = useState<number>(0)
  const [status]                    = useState(getMarketStatus)
  const [activeTab,  setActiveTab]  = useState<MarketTab>('overview')

  // Push tabs into TopBar
  const marketTabs = useMemo(() => [
    { id: 'overview',  label: 'Overview'  },
    { id: 'sectors',   label: 'Sectors'   },
    { id: 'news',      label: 'News'      },
    { id: 'calendar',  label: 'Calendar'  },
    { id: 'valuation', label: 'Valuation' },
  ], [])
  useSetTopBarTabs(marketTabs, activeTab, (id: string) => setActiveTab(id as MarketTab))
  const intervalRef                 = useRef<ReturnType<typeof setInterval> | null>(null)

  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])

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

      // Fetch news lazily after price boxes have data — non-blocking
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
              onClick={() => fetchAll()}
              className="text-[#D83B3B] font-semibold text-[11px] hover:underline ml-4 min-h-[44px]"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Persistent: Index snapshot strip ────────────────────────────── */}
        <div className="mb-4">
          {mkt ? (
            <IndexSnapshotGrid spx={spx} ndx={ndx} dji={dji} vix={vix} tnx={tnx} dxy={dxy} vwo={vwo} vgk={vgk} mchi={mchi} botz={botz} marketStatus={status} />
          ) : (
            <div className="bg-white border border-[#E5E5E5] rounded-xl h-[56px] animate-pulse" />
          )}
        </div>

        {/* ── Tab navigation — mobile only (desktop tabs live in TopBar) ──── */}
        <div className="flex items-center w-full lg:hidden">
          <MarketsTabNav active={activeTab} onChange={setActiveTab} />
        </div>

        {/* ── Tab panels ───────────────────────────────────────────────────── */}
        <div className="mt-5 space-y-5">

          {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div id="markets-panel-overview" role="tabpanel" aria-labelledby="markets-tab-overview">

              {/* Breadth strip — first-class metric above everything else */}
              {mkt && (() => {
                const valid     = mkt.sectors.filter(s => s.changePct != null)
                const advancing = valid.filter(s => (s.changePct ?? 0) > 0).length
                const declining = valid.filter(s => (s.changePct ?? 0) < 0).length
                const unchanged = valid.length - advancing - declining
                const total     = valid.length || 1
                const advPct    = Math.round((advancing / total) * 100)
                const decPct    = Math.round((declining / total) * 100)
                const unchPct   = 100 - advPct - decPct
                const isHealthy = advPct > 65
                const isMixed   = advPct >= 45 && !isHealthy
                const toneLabel = isHealthy ? 'Broad advance' : isMixed ? 'Mixed breadth' : 'Broad decline'
                const toneCls   = isHealthy
                  ? 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]'
                  : isMixed
                  ? 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]'
                  : 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
                return (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[#E5E5E5] bg-white px-4 py-3 mb-4">
                    <span className={`shrink-0 text-[10px] font-[700] px-2 py-0.5 rounded-full border ${toneCls}`}>{toneLabel}</span>
                    <div className="flex items-center gap-4 flex-wrap flex-1">
                      <span className="text-[11px] text-[#6B6B6B]">
                        Advancing <strong className="font-[750] tabular-nums text-[#11875D]">{advPct}%</strong>
                        <span className="text-[10px] text-[#9B9B9B] ml-1">({advancing}/{total})</span>
                      </span>
                      <span className="text-[11px] text-[#6B6B6B]">
                        Declining <strong className="font-[750] tabular-nums text-[#D83B3B]">{decPct}%</strong>
                        <span className="text-[10px] text-[#9B9B9B] ml-1">({declining}/{total})</span>
                      </span>
                      {unchanged > 0 && (
                        <span className="text-[11px] text-[#9B9B9B]">
                          Flat <strong className="font-[650] tabular-nums">{unchPct}%</strong>
                        </span>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center min-w-[140px] max-w-[200px] flex-1">
                      <div className="h-1.5 flex w-full rounded-full overflow-hidden">
                        <div className="bg-[#11875D] h-full transition-all" style={{ width: `${advPct}%` }} />
                        <div className="bg-[#E3E1DA] h-full transition-all" style={{ width: `${unchPct}%` }} />
                        <div className="bg-[#D83B3B] h-full transition-all" style={{ width: `${decPct}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })()}

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

              {/* Macro Signals — moved from Sectors tab: directly relevant to DCF inputs */}
              <div>
                <SectionHeader
                  title="Macro Signals"
                  subtitle="Key indicators that drive discount rates, risk appetite, and valuation assumptions."
                />
                <div className="mt-3">
                  {ctx ? <MacroSignals signals={ctx.signals} /> : <Sk h="h-48" />}
                </div>
              </div>

              {/* Stocks by Sector — peer groups with price, 1D, YTD, sparkline */}
              <div>
                <SectionHeader
                  title="Stocks by Sector"
                  subtitle="Key names in each sector — click any ticker to run a full valuation."
                />
                <div className="mt-3">
                  <SectorStocksCard />
                </div>
              </div>

              {/* Fixed income / currencies / commodities */}
              {mkt && (mkt.fixedIncome.length > 0 || mkt.currencies.length > 0 || mkt.commodities.length > 0) && (
                <div>
                  <SectionHeader
                    title="Rates, Currencies & Commodities"
                    subtitle="Key macro instruments that feed into WACC and discount rate assumptions."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
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
                    <div className="overflow-x-auto">
                      {mkt ? <MarketHeatmapCard sectors={mkt.sectors} /> : <Sk h="h-[320px]" />}
                    </div>
                  </div>
                  <div className="lg:col-span-5">
                    {ctx ? <SectorRotation sectors={ctx.sectors} /> : <Sk h="h-[320px]" />}
                  </div>
                </div>
              </div>

              {/* Sector Performance */}
              <div>
                <SectionHeader
                  title="Sector Performance"
                  subtitle="Daily ranked performance across all 11 S&P 500 sectors."
                />
                <div className="mt-3">
                  {mkt ? <SectorPerformanceCard sectors={mkt.sectors} /> : <Sk h="h-64" />}
                </div>
              </div>
            </div>
          )}

          {/* ── NEWS TAB ─────────────────────────────────────────────────── */}
          {activeTab === 'news' && (
            <div id="markets-panel-news" role="tabpanel" aria-labelledby="markets-tab-news">
              <SectionHeader
                title="Market News"
                subtitle="Recent headlines — for context only, not a trading signal."
              />
              <div className="mt-3">
                {!mkt ? (
                  <Sk h="h-48" />
                ) : newsErr ? (
                  <div className="rounded-xl border border-[#E3E1DA] bg-[#FAFAFA] px-5 py-8 text-center">
                    <p className="text-[13px] text-[#6B6B6B]">Market news could not be loaded. Try refreshing the page.</p>
                  </div>
                ) : mkt.news.length > 0 ? (
                  <MarketNewsSection news={mkt.news} />
                ) : (
                  <div className="rounded-xl border border-[#E3E1DA] bg-[#FAFAFA] px-5 py-8 text-center">
                    <p className="text-[13px] text-[#6B6B6B]">No market news available right now. Check back shortly.</p>
                  </div>
                )}
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
              {/* Fwd P/E + ERP */}
              <SectionHeader
                title="Valuation Context"
                subtitle="How current market prices compare to historical ranges — and what it means for your DCF."
              />
              <div className="mt-3">
                {ctx ? <ValuationContext valuation={ctx.valuation} /> : <Sk h="h-56" />}
              </div>

              {/* Credit Market — HY spread from ctx.signals */}
              {ctx && (() => {
                const hySignal = ctx.signals.find(s => s.id === 'hy')
                if (!hySignal) return null
                const toneMap: Record<string, { bg: string; text: string; border: string }> = {
                  positive: { bg: 'bg-[#E8F7EF]', text: 'text-[#11875D]', border: 'border-[#A3D9BE]' },
                  warning:  { bg: 'bg-[#FFF4DA]', text: 'text-[#B56A00]', border: 'border-[#F3D391]' },
                  negative: { bg: 'bg-[#FCEAEA]', text: 'text-[#D83B3B]', border: 'border-[#F0B8B8]' },
                  neutral:  { bg: 'bg-[#F5F5F5]', text: 'text-[#6B6B6B]', border: 'border-[#E5E5E5]' },
                }
                const t = toneMap[(hySignal as { tone: string }).tone] ?? toneMap.neutral
                return (
                  <div className="mt-4">
                    <SectionHeader
                      title="Credit Market"
                      subtitle="High-yield spreads signal credit stress before it appears in equity prices."
                    />
                    <div className="mt-3 rounded-xl border border-[#E3E1DA] bg-white p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-[600] text-[#566174] uppercase tracking-wider mb-1">HY Spread (OAS)</p>
                          <p className="text-[24px] font-[750] tabular-nums text-[#111111] leading-none">
                            {(hySignal as { value: string }).value}
                          </p>
                          <p className="text-[12px] text-[#566174] mt-1 leading-snug max-w-[380px]">
                            {(hySignal as { equityImplication: string }).equityImplication}
                          </p>
                        </div>
                        <div className="shrink-0">
                          <span className={`inline-flex text-[11px] font-[700] px-3 py-1.5 rounded-full border ${t.bg} ${t.text} ${t.border}`}>
                            {(hySignal as { regimeLabel: string }).regimeLabel}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#F5F5F5]">
                        <p className="text-[11px] text-[#6B6B6B] leading-snug">
                          HY spread = high-yield bond yield minus equivalent Treasury yield. Spreads below 4% = low credit stress (risk-on). 4–7% = elevated caution. Above 7% = crisis conditions historically associated with equity drawdowns. Source: FRED BAMLH0A0HYM2.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Yield Curve */}
              {!mkt ? (
                <div className="mt-4"><Sk h="h-32" /></div>
              ) : mkt.yieldCurve.length > 0 ? (
                <div className="mt-4">
                  <YieldCurveChart points={mkt.yieldCurve} />
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-[#E3E1DA] bg-[#FAFAFA] px-5 py-4">
                  <p className="text-[13px] text-[#6B6B6B]">Yield curve data unavailable — Treasury rates could not be loaded.</p>
                </div>
              )}
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
