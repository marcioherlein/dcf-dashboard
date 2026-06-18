'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import { fmtLargeCurrency as _fmtLargeCurrency } from '@/lib/formatters'
import ValuationSnapshotCard from './ValuationSnapshotCard'
import QualitySnapshotCard from './QualitySnapshotCard'
import TradingRangeCard from './TradingRangeCard'

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => <div className="flex-1 min-h-[400px] motion-safe:animate-pulse rounded-xl bg-[#F5F5F5]" />,
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  // Identity
  ticker: string
  companyName: string
  description?: string
  sector?: string
  industry?: string
  country?: string
  currency: string
  // Price
  price: number
  change: number
  changePct: number
  high52: number
  low52: number
  // Valuation chart lines
  fairValue?: number | null
  analystTargetMean?: number | null
  userModelFairValue?: number | null
  // Snapshot card data
  marketCap?: number | null
  peRatio?: number | null
  forwardPE?: number | null
  pegRatioValue?: number | null
  beta?: number | null
  evToEbitda?: number | null
  // Quality
  revenueGrowth?: number | null
  grossMargin?: number | null
  fcfMargin?: number | null
  roic?: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(v: number, currency: string) {
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  if (Math.abs(v) >= 1000) return sym + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return sym + v.toFixed(2)
}

// ─── Identity strip ───────────────────────────────────────────────────────────

function _StockIdentityStrip({
  ticker, companyName, description, sector, industry, country, currency, price, change, changePct,
}: Pick<Props, 'ticker' | 'companyName' | 'description' | 'sector' | 'industry' | 'country' | 'currency' | 'price' | 'change' | 'changePct'>) {
  const [logoErr, setLogoErr] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const logoSrc = `https://financialmodelingprep.com/image-stock/${ticker}.png`
  const isPos = change >= 0

  const tags = [sector, industry, country].filter(Boolean) as string[]

  return (
    <div className="mb-4">
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        {/* Logo */}
        {!logoErr ? (
          <Image src={logoSrc} alt={`${companyName} logo`} width={40} height={40}
            className="rounded-xl border border-[rgba(15,23,42,0.08)] object-cover shrink-0"
            onError={() => setLogoErr(true)} />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-[#EEF2FA] border border-[rgba(15,23,42,0.08)] flex items-center justify-center shrink-0"
            role="img" aria-label={`${companyName} logo`}>
            <span className="text-[13px] font-[800] text-[#5F790B]">{ticker.slice(0, 2)}</span>
          </div>
        )}

        {/* Name + tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[20px] font-[800] text-[#111111] tracking-tight leading-tight">{ticker}</span>
            <span className="text-[15px] font-[500] text-[#6B6B6B] truncate max-w-[280px]">{companyName}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {tags.map(t => (
              <span key={t} className="text-[11px] font-[500] text-[#6B6B6B] bg-[rgba(15,23,42,0.05)] rounded-full px-2 py-0.5">{t}</span>
            ))}
            {description && (
              <button
                onClick={() => setAboutOpen(v => !v)}
                aria-expanded={aboutOpen}
                aria-label={aboutOpen ? 'Hide company description' : 'Show company description'}
                className="text-[11px] font-[600] text-[#5F790B] hover:underline ml-1 min-h-[44px] min-w-[44px] flex items-center px-1 -mx-1"
              >
                {aboutOpen ? 'Hide' : 'Company profile'}
              </button>
            )}
          </div>
        </div>

        {/* Price — stacks below on mobile, inline on sm+ */}
        <div className="text-right shrink-0 w-full sm:w-auto">
          <p className="text-[22px] font-[800] text-[#111111] tabular-nums tracking-tight leading-tight">
            {fmtPrice(price, currency)}
          </p>
          <p className={cn('text-[13px] font-[600] tabular-nums', isPos ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
            {isPos ? '+' : ''}{change.toFixed(2)} ({isPos ? '+' : ''}{Math.abs(changePct).toFixed(2)}%) today
          </p>
        </div>
      </div>

      {/* Collapsible description */}
      {aboutOpen && description && (
        <div className="mt-3 px-1">
          <p className="text-[13px] text-[#6B6B6B] leading-relaxed max-w-3xl">{description}</p>
        </div>
      )}
    </div>
  )
}

// ─── Chart metrics summary footer ────────────────────────────────────────────

interface ChartMetricsProps {
  currency: string
  price: number
  changePct: number
  fairValue: number | null | undefined
  analystTargetMean: number | null | undefined
  periodLabel: string
  spyReturn: number | null
}

function ChartMetricsSummary({ currency, price, changePct, fairValue, analystTargetMean, periodLabel, spyReturn, lastUpdated }: ChartMetricsProps & { lastUpdated: string }) {
  const fv = fairValue ?? null
  const at = analystTargetMean ?? null
  const fvUpside = fv != null ? ((fv - price) / price) * 100 : null
  const atUpside = at != null ? ((at - price) / price) * 100 : null
  const vsSpyPct = spyReturn != null && spyReturn !== 0 ? changePct - spyReturn : null
  const outperformed = vsSpyPct != null && vsSpyPct > 0

  const col = (ariaLabel: string, label: string, primary: string, secondary: string, primaryColor?: string, isLast?: boolean) => (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex-1 min-w-[120px] px-4 py-3 text-center', !isLast && 'border-r border-[rgba(15,23,42,0.06)]')}
    >
      <p className="text-[11px] text-[#9B9B9B] font-[500] mb-0.5 truncate">{label}</p>
      <p className="text-[18px] font-[800] tabular-nums truncate" style={{ color: primaryColor ?? '#111111' }}>{primary}</p>
      <p className="text-[11px] font-[500] mt-0.5 truncate" style={{ color: primaryColor ?? '#6B6B6B' }}>{secondary}</p>
    </div>
  )

  const priceSign = changePct >= 0 ? '+' : ''

  return (
    <div className="border-t border-[rgba(15,23,42,0.06)]">
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {col('Current price', 'Current Price', fmtPrice(price, currency), `${priceSign}${changePct.toFixed(2)}% today`, changePct >= 0 ? '#11875D' : '#D83B3B')}
        {fv != null
          ? col('Cockpit estimate', 'Cockpit Estimate', fmtPrice(fv, currency), fvUpside != null ? `${fvUpside >= 0 ? '+' : ''}${fvUpside.toFixed(1)}% upside` : '—', '#8b5cf6')
          : col('Cockpit estimate', 'Cockpit Estimate', '—', 'Run valuation', '#9B9B9B')}
        {at != null
          ? col('Analyst target', 'Analyst Target', fmtPrice(at, currency), atUpside != null ? `${atUpside >= 0 ? '+' : ''}${atUpside.toFixed(1)}% upside` : '—', '#f59e0b')
          : col('Analyst target', 'Analyst Target', '—', 'No coverage', '#9B9B9B')}
        {vsSpyPct != null
          ? col(`Performance vs SPY over ${periodLabel}`, `vs SPY (${periodLabel})`, `${vsSpyPct >= 0 ? '+' : ''}${vsSpyPct.toFixed(2)}%`, outperformed ? 'Outperformed' : 'Underperformed', outperformed ? '#11875D' : '#D83B3B', true)
          : col(`Performance vs SPY`, `vs SPY (${periodLabel})`, '—', 'Comparison off', '#9B9B9B', true)}
      </div>
      <div className="px-5 py-2 border-t border-[rgba(15,23,42,0.04)]">
        <p className="text-[11px] text-[#9B9B9B]">
          Prices delayed · Last updated: {lastUpdated} ET
        </p>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  '5d': '5D', '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y', '5y': '5Y', 'max': 'Max',
}

export default function OverviewLayout({
  ticker, companyName: _companyName, description: _description, sector: _sector, industry: _industry, country: _country, currency,
  price, change: _change, changePct, high52, low52,
  fairValue, analystTargetMean, userModelFairValue,
  marketCap, peRatio, forwardPE, pegRatioValue, beta, evToEbitda,
  revenueGrowth, grossMargin, fcfMargin, roic,
}: Props) {
  const [periodReturn, setPeriodReturn] = useState<number | null>(null)
  const [spyReturn, setSpyReturn] = useState<number | null>(null)
  const [period, setPeriod] = useState('3mo')

  // Computed once on mount — refreshes when spy fetch completes
  const [fetchedAt, setFetchedAt] = useState<string>('')

  const handlePeriodChange = useCallback((p: string) => {
    setPeriod(p)
    setPeriodReturn(null)
    setSpyReturn(null)
  }, [])

  const handlePeriodReturnChange = useCallback((pct: number | null) => {
    setPeriodReturn(pct)
  }, [])

  // Fetch SPY return for the same period
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

  // Fallback timestamp computed once on mount
  const mountTimestamp = useMemo(() => new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
  }), [])

  const periodLabel = PERIOD_LABELS[period] ?? period.toUpperCase()

  return (
    <div>
      {/* Two-column grid — chart left, snapshot rail right */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.15fr)_minmax(300px,0.95fr)] items-start">

        {/* Left: Chart + footer as one unified card */}
        <div
          className="bg-white rounded-2xl overflow-hidden flex flex-col"
          style={{ border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)' }}
        >
          <PriceChart
            ticker={ticker}
            isDark={false}
            noShell
            triangulatedFairValue={fairValue ?? undefined}
            analystTarget={analystTargetMean ?? undefined}
            userModelFairValue={userModelFairValue ?? undefined}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            period={period as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onPeriodChange={handlePeriodChange as any}
            onPeriodReturnChange={handlePeriodReturnChange}
          />

          {/* Chart metrics footer — same card, below the chart */}
          <ChartMetricsSummary
            currency={currency}
            price={price}
            changePct={periodReturn ?? changePct}
            fairValue={fairValue}
            analystTargetMean={analystTargetMean}
            periodLabel={periodLabel}
            spyReturn={spyReturn}
            lastUpdated={fetchedAt || mountTimestamp}
          />
        </div>

        {/* Right: Snapshot rail */}
        <div className="flex flex-col gap-4">
          <ValuationSnapshotCard
            marketCap={marketCap}
            peRatio={peRatio}
            forwardPE={forwardPE}
            pegRatio={pegRatioValue}
            beta={beta}
            evToEbitda={evToEbitda}
            currency={currency}
          />
          <QualitySnapshotCard
            revenueGrowth={revenueGrowth}
            grossMargin={grossMargin}
            fcfMargin={fcfMargin}
            roic={roic}
          />
          <TradingRangeCard
            high52={high52}
            low52={low52}
            price={price}
            currency={currency}
          />
        </div>
      </div>
    </div>
  )
}
