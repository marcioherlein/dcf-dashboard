'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import PriceTable from '@/components/markets/PriceTable'
import NormalizedPerfChart from '@/components/markets/NormalizedPerfChart'
import MarketNewsSection from '@/components/markets/MarketNewsSection'
import BondYieldsCard from '@/components/markets/BondYieldsCard'
import ModelAlerts from '@/components/markets/ModelAlerts'
import MacroBrief from '@/components/markets/MacroBrief'
import MarketPulse from '@/components/markets/MarketPulse'
import SectorRotation from '@/components/markets/SectorRotation'
import MacroSignals from '@/components/markets/MacroSignals'
import ValuationContext from '@/components/markets/ValuationContext'
import PortfolioExposure from '@/components/markets/PortfolioExposure'
import EconomicCalendar from '@/components/markets/EconomicCalendar'
import EarningsCalendar from '@/components/markets/EarningsCalendar'
import type { MarketsData } from '@/app/api/markets/data/route'
import type { MarketContextPayload } from '@/lib/market-context/types'

const REFRESH_INTERVAL_MS = 60_000  // 1 minute

function Sk({ h = 'h-32' }: { h?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/60 ${h}`} />
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
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

// Market status based on ET time (UTC-4 DST / UTC-5 EST)
function getMarketStatus(): { label: string; cls: string } {
  const now = new Date()
  // Use UTC offset to approximate ET (simplistic, ignores DST edge)
  const utcH = now.getUTCHours()
  const utcM = now.getUTCMinutes()
  const day = now.getUTCDay()
  const totalMinutesUTC = utcH * 60 + utcM
  // ET = UTC - 4 (EDT) for most of trading year (Mar-Nov)
  // We approximate as UTC-4
  const etMinutes = (totalMinutesUTC - 4 * 60 + 1440) % 1440

  if (day === 0 || day === 6) {
    return { label: 'Market Closed', cls: 'bg-slate-100 text-slate-500' }
  }
  // Pre-market: 4:00 AM – 9:30 AM ET
  if (etMinutes >= 240 && etMinutes < 570) {
    return { label: 'Pre-Market', cls: 'bg-amber-50 text-amber-700' }
  }
  // Regular: 9:30 AM – 4:00 PM ET
  if (etMinutes >= 570 && etMinutes < 960) {
    return { label: '● Market Open', cls: 'bg-emerald-50 text-emerald-700 font-bold' }
  }
  // After-hours: 4:00 PM – 8:00 PM ET
  if (etMinutes >= 960 && etMinutes < 1200) {
    return { label: 'After Hours', cls: 'bg-blue-50 text-blue-700' }
  }
  return { label: 'Market Closed', cls: 'bg-slate-100 text-slate-500' }
}

function Section({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div>
      {badge ? (
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</h2>
          {badge}
        </div>
      ) : (
        <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{title}</h2>
      )}
      {children}
    </div>
  )
}

export default function MarketsPage() {
  const [mkt, setMkt] = useState<MarketsData | null>(null)
  const [ctx, setCtx] = useState<MarketContextPayload | null>(null)
  const [err, setErr] = useState(false)
  const [lastFetch, setLastFetch] = useState<number>(0)
  const [refreshing, setRefreshing] = useState(false)
  const [status] = useState(getMarketStatus)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Live "X ago" counter
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])

  const spx   = mkt?.indices.find(i => i.symbol === '^GSPC')
  const vix   = mkt?.indices.find(i => i.symbol === '^VIX')
  const ndx   = mkt?.indices.find(i => i.symbol === '^NDX')
  const dji   = mkt?.indices.find(i => i.symbol === '^DJI')
  const dxy   = mkt?.currencies.find(i => i.symbol === 'DX-Y.NYB')

  return (
    <div className="min-h-screen lqg-bg pt-[52px]">

      {/* ── Top ticker bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 glass-toolbar">
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-5 overflow-x-auto scrollbar-hide">
          {/* Market status badge */}
          <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>
            {status.label}
          </span>

          {[
            { label: 'S&P 500',    sym: spx  },
            { label: 'Nasdaq 100', sym: ndx  },
            { label: 'Dow Jones',  sym: dji  },
            { label: 'VIX',        sym: vix  },
            { label: 'USD Index',  sym: dxy  },
          ].map(({ label, sym }) => {
            const inner = (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-500 font-medium">{label}</span>
                <span className="text-[12px] font-mono font-bold text-slate-800 tabular-nums">
                  {sym?.price != null ? sym.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </span>
                {sym?.changePct != null && (
                  <span className={`text-[11px] font-mono font-bold tabular-nums ${pctCls(sym.changePct)}`}>
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

          {/* Refresh controls */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {lastFetch > 0 && (
              <span className="text-[10px] text-slate-400 font-mono hidden sm:block">
                Updated {timeAgo(lastFetch)}
              </span>
            )}
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              title="Refresh market data"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">

        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4">
            Failed to load market data. Check API keys and try again.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,300px)_1fr_minmax(280px,300px)] gap-4">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div className="space-y-4 order-2 lg:order-1 min-w-0">
            {mkt ? (
              <>
                <Section title="U.S. Equity Markets">
                  <PriceTable title="Major Indices & ETFs" items={mkt.indices.filter(i => i.symbol !== '^IXIC')} />
                </Section>
                <Section title="U.S. Equity Sectors">
                  <PriceTable title="S&P Sector ETFs" items={mkt.sectors} />
                </Section>
                <Section title="Fixed Income">
                  <PriceTable title="Govt Credit ETFs" items={mkt.fixedIncome} />
                </Section>
              </>
            ) : (
              <>
                <Sk h="h-40" />
                <Sk h="h-72" />
                <Sk h="h-48" />
              </>
            )}
          </div>

          {/* ── Center column ───────────────────────────────────────────── */}
          <div className="space-y-4 order-1 lg:order-2 min-w-0">
            {ctx && <MarketPulse pulse={ctx.pulse} />}
            {ctx && ctx.modelAlerts.length > 0 && <ModelAlerts alerts={ctx.modelAlerts} />}
            <NormalizedPerfChart />
            {mkt ? (
              mkt.news.length > 0 ? <MarketNewsSection news={mkt.news} /> : null
            ) : (
              <Sk h="h-36" />
            )}
            {ctx && (
              <MacroBrief
                macroBrief={ctx.macroBrief}
                briefCachedAt={ctx.briefCachedAt}
                signals={ctx.signals}
                pulse={ctx.pulse}
              />
            )}
          </div>

          {/* ── Right column ────────────────────────────────────────────── */}
          <div className="space-y-4 order-3 min-w-0">
            {mkt ? (
              <>
                <Section title="Currencies">
                  <PriceTable title="USD FX Crosses" items={mkt.currencies.filter(i => i.symbol !== 'DX-Y.NYB')} priceDecimals={4} />
                </Section>
                <Section title="Global Markets">
                  <div className="space-y-2">
                    <PriceTable title="Broad Markets"     items={mkt.globalBroad}    />
                    <PriceTable title="Developed Markets" items={mkt.globalDeveloped} />
                    <PriceTable title="Emerging Markets"  items={mkt.globalEmerging}  />
                  </div>
                </Section>
                <Section title="Commodities">
                  <PriceTable title="Commodities" items={mkt.commodities} />
                </Section>
                <BondYieldsCard yieldCurve={mkt.yieldCurve} />
              </>
            ) : (
              <>
                <Sk h="h-40" />
                <Sk h="h-64" />
                <Sk h="h-36" />
                <Sk h="h-52" />
              </>
            )}
          </div>

        </div>

        {/* ── Sector Rotation & Macro Signals ─────────────────────────────── */}
        {ctx && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <SectorRotation sectors={ctx.sectors} />
            <MacroSignals signals={ctx.signals} />
          </div>
        )}

        {/* ── Economic & Earnings Calendars ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <EconomicCalendar />
          <EarningsCalendar />
        </div>

        {/* ── Valuation Context & Portfolio Exposure ───────────────────────── */}
        {ctx && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <ValuationContext valuation={ctx.valuation} />
            <PortfolioExposure portfolioExposure={ctx.portfolioExposure} modelAlerts={ctx.modelAlerts} />
          </div>
        )}

      </div>
    </div>
  )
}
