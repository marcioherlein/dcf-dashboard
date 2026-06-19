'use client'

import { cn } from '@/lib/utils'
import { fmtLargeCurrency } from '@/lib/formatters'

interface Props {
  // Valuation
  marketCap?: number | null
  peRatio?: number | null
  forwardPE?: number | null
  pegRatio?: number | null
  evToEbitda?: number | null
  beta?: number | null
  currency?: string
  // Quality
  revenueGrowth?: number | null
  grossMargin?: number | null
  fcfMargin?: number | null
  roic?: number | null
  // 52W
  high52?: number
  low52?: number
  price?: number
  fairValue?: number | null
}

// ── Tiny metric row — 28px height ────────────────────────────────────────────

function Row({
  label, value, sentiment, bar, barPct, last,
}: {
  label: string
  value: string
  sentiment?: 'positive' | 'negative' | 'neutral'
  bar?: boolean
  barPct?: number
  last?: boolean
}) {
  const valColor = sentiment === 'positive' ? 'text-[#11875D]'
    : sentiment === 'negative' ? 'text-[#D83B3B]'
    : 'text-[#111111]'

  return (
    <div className={cn('flex items-center justify-between py-1.5', !last && 'border-b border-[#F5F5F5]')}>
      <span className="text-[11px] text-[#6B6B6B] leading-none">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        {bar && barPct != null && (
          <div className="w-14 h-1 rounded-full bg-[#F0F0F0] overflow-hidden shrink-0">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, barPct))}%`,
                background: sentiment === 'negative' ? '#D83B3B' : '#5F790B',
              }}
            />
          </div>
        )}
        <span className={cn('text-[12px] font-[650] tabular-nums shrink-0 leading-none', valColor)}>{value}</span>
      </div>
    </div>
  )
}

// ── Section divider ────────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="pt-2.5 pb-1">
      <p className="text-[9px] font-[700] uppercase tracking-[0.08em] text-[#9B9B9B]">{label}</p>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtX = (v: number | null | undefined) =>
  v != null && isFinite(v) && v > 0 ? `${v.toFixed(1)}×` : '—'

const fmtPct = (v: number | null | undefined) =>
  v != null && isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—'

const fmtNum = (v: number | null | undefined, dec = 2) =>
  v != null && isFinite(v) ? v.toFixed(dec) : '—'

function barW(val: number | null | undefined, cap: number): number {
  if (val == null || !isFinite(val)) return 0
  return Math.max(0, Math.min(100, (Math.abs(val) / cap) * 100))
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompactSnapshotSidebar({
  marketCap, peRatio, forwardPE, pegRatio, evToEbitda, beta, currency = 'USD',
  revenueGrowth, grossMargin, fcfMargin, roic,
  high52, low52, price, fairValue,
}: Props) {
  const pegSentiment = pegRatio == null ? 'neutral' : pegRatio < 1.5 ? 'positive' : pegRatio > 2.5 ? 'negative' : 'neutral'

  // 52W range position
  const range52 = high52 != null && low52 != null ? high52 - low52 : null
  const rangePct = range52 && range52 > 0 && price != null
    ? Math.max(2, Math.min(98, ((price - low52!) / range52) * 100))
    : null
  const fvPct = range52 && range52 > 0 && fairValue != null && low52 != null
    ? Math.max(0, Math.min(100, ((fairValue - low52) / range52) * 100))
    : null

  return (
    <div
      className="bg-white rounded-xl px-3 py-2.5 flex flex-col h-full"
      style={{
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
      }}
    >

      {/* ── Valuation ─────────────────────────────────────────────────────── */}
      <Divider label="Valuation" />
      <Row label="Market Cap" value={marketCap != null ? fmtLargeCurrency(marketCap, currency) : '—'} />
      <Row label="P/E (TTM)" value={fmtX(peRatio)} />
      {forwardPE != null && forwardPE > 0 && (
        <Row label="Forward P/E" value={fmtX(forwardPE)} />
      )}
      {pegRatio != null && (
        <Row label="PEG" value={fmtNum(pegRatio)} sentiment={pegSentiment} />
      )}
      {evToEbitda != null && evToEbitda > 0 && (
        <Row label="EV / EBITDA" value={fmtX(evToEbitda)} />
      )}
      <Row label="Beta" value={fmtNum(beta)} />

      {/* ── Quality ───────────────────────────────────────────────────────── */}
      <Divider label="Quality" />
      <Row
        label="Revenue Growth"
        value={fmtPct(revenueGrowth)}
        sentiment={(revenueGrowth ?? 0) < 0 ? 'negative' : 'positive'}
        bar
        barPct={barW(revenueGrowth, 0.50)}
      />
      <Row
        label="Gross Margin"
        value={fmtPct(grossMargin)}
        sentiment={(grossMargin ?? 0) < 0 ? 'negative' : 'positive'}
        bar
        barPct={barW(grossMargin, 1.0)}
      />
      <Row
        label="FCF Margin"
        value={fmtPct(fcfMargin)}
        sentiment={(fcfMargin ?? 0) < 0 ? 'negative' : 'positive'}
        bar
        barPct={barW(fcfMargin, 0.50)}
      />
      <Row
        label="ROIC"
        value={fmtPct(roic)}
        sentiment={(roic ?? 0) < 0 ? 'negative' : 'positive'}
        bar
        barPct={barW(roic, 0.40)}
      />

      {/* ── 52-Week Range ─────────────────────────────────────────────────── */}
      {low52 != null && high52 != null && price != null && (
        <>
          <Divider label="52-Week Range" />
          <div className="py-1.5">
            <div className="relative h-1.5 rounded-full bg-[#F0F0F0] mb-1.5">
              {fvPct != null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 rounded-full bg-[#9B9B9B] opacity-50"
                  style={{ left: `${fvPct}%` }}
                  title="Fair value"
                />
              )}
              {rangePct != null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#5F790B]"
                  style={{ left: `${rangePct}%`, boxShadow: '0 1px 3px rgba(0,0,0,0.18)' }}
                />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#9B9B9B] tabular-nums font-mono">
                {currency === 'USD' ? '$' : currency + ' '}{low52.toFixed(2)}
              </span>
              <span className="text-[10px] text-[#9B9B9B] tabular-nums font-mono">
                {currency === 'USD' ? '$' : currency + ' '}{high52.toFixed(2)}
              </span>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
