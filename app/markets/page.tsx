'use client'
import { useEffect, useState } from 'react'
import PriceTable from '@/components/markets/PriceTable'
import NormalizedPerfChart from '@/components/markets/NormalizedPerfChart'
import MarketNewsSection from '@/components/markets/MarketNewsSection'
import BondYieldsCard from '@/components/markets/BondYieldsCard'
import ModelAlerts from '@/components/markets/ModelAlerts'
import MacroBrief from '@/components/markets/MacroBrief'
import type { MarketsData } from '@/app/api/markets/data/route'
import type { MarketContextPayload } from '@/lib/market-context/types'

function Sk({ h = 'h-32' }: { h?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${h}`} />
}

function pct(v: number | null) {
  if (v == null) return ''
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function pctCls(v: number | null) {
  if (v == null) return 'text-slate-400'
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-slate-500'
}

// Collapsible section for mobile
function Section({ title, children, badge }: { title: string; children: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div>
      {badge ? (
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</h2>
          {badge}
        </div>
      ) : (
        <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{title}</h2>
      )}
      {children}
    </div>
  )
}

export default function MarketsPage() {
  const [mkt, setMkt] = useState<MarketsData | null>(null)
  const [ctx, setCtx] = useState<MarketContextPayload | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/markets/data').then(r => r.json()).catch(() => null),
      fetch('/api/market-context').then(r => r.json()).catch(() => null),
    ]).then(([m, c]) => {
      if (!m) { setErr(true); return }
      setMkt(m)
      setCtx(c)
    })
  }, [])

  const spx   = mkt?.indices.find(i => i.symbol === '^GSPC')
  const vix   = mkt?.indices.find(i => i.symbol === '^VIX')
  const ndx   = mkt?.indices.find(i => i.symbol === '^NDX')
  const dji   = mkt?.indices.find(i => i.symbol === '^DJI')
  const dxy   = mkt?.currencies.find(i => i.symbol === 'DX-Y.NYB')

  return (
    <div className="min-h-screen bg-[#F8FAFB] pt-[52px]">

      {/* ── Top pulse bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex items-center gap-6 overflow-x-auto scrollbar-hide">
          {[
            { label: 'S&P 500',   sym: spx  },
            { label: 'Nasdaq 100', sym: ndx  },
            { label: 'Dow Jones', sym: dji  },
            { label: 'VIX',       sym: vix  },
            { label: 'USD Index', sym: dxy  },
          ].map(({ label, sym }) => (
            <div key={label} className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">{label}</span>
              <span className="text-[12px] font-mono font-bold text-slate-900">
                {sym?.price != null ? sym.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
              </span>
              {sym?.changePct != null && (
                <span className={`text-[11px] font-mono font-bold ${pctCls(sym.changePct)}`}>
                  {pct(sym.changePct)}
                </span>
              )}
            </div>
          ))}
          {mkt && (
            <span className="text-[10px] text-slate-300 font-mono ml-auto shrink-0">
              {new Date(mkt.fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* ── Main 3-column grid ────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">

        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
            Failed to load market data. Check API keys and try again.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4">

          {/* ── Left column ────────────────────────────────────────────────── */}
          <div className="space-y-4 order-2 lg:order-1">
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

          {/* ── Center column ──────────────────────────────────────────────── */}
          <div className="space-y-4 order-1 lg:order-2">
            {/* Model Alerts — always first if present */}
            {ctx && ctx.modelAlerts.length > 0 && (
              <ModelAlerts alerts={ctx.modelAlerts} />
            )}

            {/* Normalized chart — always visible */}
            <NormalizedPerfChart />

            {/* News */}
            {mkt ? (
              mkt.news.length > 0 ? <MarketNewsSection news={mkt.news} /> : null
            ) : (
              <Sk h="h-36" />
            )}

            {/* Macro Brief */}
            {ctx && (
              <MacroBrief
                macroBrief={ctx.macroBrief}
                briefCachedAt={ctx.briefCachedAt}
                signals={ctx.signals}
                pulse={ctx.pulse}
              />
            )}

            {/* Bond Yields — center on mobile, right on wider screens but fits here too */}
            <div className="lg:hidden">
              {mkt ? <BondYieldsCard yieldCurve={mkt.yieldCurve} /> : <Sk h="h-56" />}
            </div>
          </div>

          {/* ── Right column ───────────────────────────────────────────────── */}
          <div className="space-y-4 order-3 hidden lg:block">
            {mkt ? (
              <>
                <Section title="Currencies">
                  <PriceTable title="USD FX Crosses" items={mkt.currencies.filter(i => i.symbol !== 'DX-Y.NYB')} priceDecimals={4} />
                </Section>

                <Section title="Global Markets">
                  <div className="space-y-2">
                    <PriceTable title="Broad Markets" items={mkt.globalBroad} />
                    <PriceTable title="Developed Markets" items={mkt.globalDeveloped} />
                    <PriceTable title="Emerging Markets" items={mkt.globalEmerging} />
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

        {/* ── Mobile-only extra sections ─────────────────────────────────── */}
        <div className="lg:hidden mt-4 space-y-4">
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
            </>
          ) : null}
        </div>

      </div>
    </div>
  )
}
