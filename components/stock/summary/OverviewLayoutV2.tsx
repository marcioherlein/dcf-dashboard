'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { fmtLargeCurrency } from '@/lib/formatters'
import CompactSnapshotSidebar from './CompactSnapshotSidebar'

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => <div className="flex-1 min-h-[340px] motion-safe:animate-pulse rounded-xl bg-[#F5F5F5]" />,
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  ticker: string
  currency: string
  price: number
  change: number
  changePct: number
  high52: number
  low52: number
  fairValue?: number | null
  analystTargetMean?: number | null
  userModelFairValue?: number | null
  // Sidebar data
  marketCap?: number | null
  peRatio?: number | null
  forwardPE?: number | null
  pegRatioValue?: number | null
  beta?: number | null
  evToEbitda?: number | null
  revenueGrowth?: number | null
  grossMargin?: number | null
  fcfMargin?: number | null
  roic?: number | null
}

// ─── KPI footer cell ──────────────────────────────────────────────────────────

function KpiCell({
  label, primary, secondary, color, last,
}: {
  label: string; primary: string; secondary?: string; color?: string; last?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex flex-col justify-center px-3 py-2 text-center',
        !last && 'border-r border-[rgba(15,23,42,0.06)]',
      )}
    >
      <p className="text-[10px] text-[#9B9B9B] font-[500] mb-0.5 truncate leading-none">{label}</p>
      <p className="text-[15px] font-[800] tabular-nums leading-tight truncate" style={{ color: color ?? '#111111' }}>
        {primary}
      </p>
      {secondary && (
        <p className="text-[10px] font-[500] mt-0.5 truncate leading-none" style={{ color: color ?? '#6B6B6B' }}>
          {secondary}
        </p>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtP(v: number, currency: string) {
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  if (Math.abs(v) >= 1000) return sym + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return sym + v.toFixed(2)
}

const fmtX = (v: number | null | undefined) =>
  v != null && isFinite(v) && v > 0 ? `${v.toFixed(1)}×` : '—'

const _fmtPct = (v: number | null | undefined) =>
  v != null && isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—'

const PERIOD_LABELS: Record<string, string> = {
  '5d': '5D', '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y', '5y': '5Y', 'max': 'Max',
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OverviewLayoutV2({
  ticker, currency,
  price, changePct,
  high52, low52,
  fairValue, analystTargetMean, userModelFairValue,
  marketCap, peRatio, forwardPE, pegRatioValue, beta, evToEbitda,
  revenueGrowth, grossMargin, fcfMargin, roic,
}: Props) {
  const [periodReturn, setPeriodReturn] = useState<number | null>(null)
  const [spyReturn, setSpyReturn] = useState<number | null>(null)
  const [period, setPeriod] = useState('3mo')
  const [fetchedAt, setFetchedAt] = useState('')

  const handlePeriodChange = useCallback((p: string) => {
    setPeriod(p)
    setPeriodReturn(null)
    setSpyReturn(null)
  }, [])

  const handlePeriodReturnChange = useCallback((pct: number | null) => {
    setPeriodReturn(pct)
  }, [])

  useEffect(() => {
    if (ticker.toUpperCase() === 'SPY') { setSpyReturn(null); return }
    fetch(`/api/historical?ticker=SPY&period=${period}`)
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((bars: any[]) => {
        if (!bars?.length) return
        const first = bars[0]?.close, last = bars[bars.length - 1]?.close
        if (first && last) {
          setSpyReturn(((last - first) / first) * 100)
          setFetchedAt(new Date().toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
          }))
        }
      })
      .catch(() => {})
  }, [ticker, period])

  const mountTimestamp = useMemo(() => new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
  }), [])

  const periodLabel = PERIOD_LABELS[period] ?? period.toUpperCase()
  const effectiveChangePct = periodReturn ?? changePct

  // KPI computations
  const fvUpside = fairValue != null ? ((fairValue - price) / price) * 100 : null
  const atUpside = analystTargetMean != null ? ((analystTargetMean - price) / price) * 100 : null
  const vsSpyPct = spyReturn != null ? effectiveChangePct - spyReturn : null

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_260px] items-stretch">

      {/* ── Chart card ─────────────────────────────────────────────────────── */}
      <div
        className="bg-white rounded-xl overflow-hidden flex flex-col"
        style={{ border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)' }}
      >
        <PriceChart
          ticker={ticker}
          isDark={false}
          noShell
          chartHeight={260}
          triangulatedFairValue={fairValue ?? undefined}
          analystTarget={analystTargetMean ?? undefined}
          userModelFairValue={userModelFairValue ?? undefined}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          period={period as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPeriodChange={handlePeriodChange as any}
          onPeriodReturnChange={handlePeriodReturnChange}
        />

        {/* 6-cell KPI footer — denser than the current 4-cell */}
        <div className="border-t border-[rgba(15,23,42,0.06)]">
          <div className="grid grid-cols-3 sm:grid-cols-6">
            <KpiCell
              label={`Change (${periodLabel})`}
              primary={`${effectiveChangePct >= 0 ? '+' : ''}${effectiveChangePct.toFixed(2)}%`}
              color={effectiveChangePct >= 0 ? '#11875D' : '#D83B3B'}
            />
            <KpiCell
              label="Cockpit Est."
              primary={fairValue != null ? fmtP(fairValue, currency) : '—'}
              secondary={fvUpside != null ? `${fvUpside >= 0 ? '+' : ''}${fvUpside.toFixed(1)}%` : undefined}
              color="#8b5cf6"
            />
            <KpiCell
              label="Analyst Target"
              primary={analystTargetMean != null ? fmtP(analystTargetMean, currency) : '—'}
              secondary={atUpside != null ? `${atUpside >= 0 ? '+' : ''}${atUpside.toFixed(1)}%` : undefined}
              color="#f59e0b"
            />
            <KpiCell
              label={`vs SPY (${periodLabel})`}
              primary={vsSpyPct != null ? `${vsSpyPct >= 0 ? '+' : ''}${vsSpyPct.toFixed(2)}%` : '—'}
              color={vsSpyPct != null ? (vsSpyPct >= 0 ? '#11875D' : '#D83B3B') : '#9B9B9B'}
            />
            <KpiCell
              label="Market Cap"
              primary={marketCap != null ? fmtLargeCurrency(marketCap, currency) : '—'}
            />
            <KpiCell
              label="P/E"
              primary={fmtX(peRatio)}
              secondary={forwardPE != null ? `Fwd ${fmtX(forwardPE)}` : undefined}
              last
            />
          </div>
          <div className="px-4 py-1.5 border-t border-[rgba(15,23,42,0.04)]">
            <p className="text-[10px] text-[#9B9B9B]">
              Prices delayed · {fetchedAt || mountTimestamp} ET
            </p>
          </div>
        </div>
      </div>

      {/* ── Compact sidebar ────────────────────────────────────────────────── */}
      <CompactSnapshotSidebar
        marketCap={marketCap}
        peRatio={peRatio}
        forwardPE={forwardPE}
        pegRatio={pegRatioValue}
        evToEbitda={evToEbitda}
        beta={beta}
        currency={currency}
        revenueGrowth={revenueGrowth}
        grossMargin={grossMargin}
        fcfMargin={fcfMargin}
        roic={roic}
        high52={high52}
        low52={low52}
        price={price}
        fairValue={fairValue}
      />
    </div>
  )
}
