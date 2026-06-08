'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { fmtLargeCurrency } from '@/lib/formatters'

// ─── Dynamic import ───────────────────────────────────────────────────────────

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] animate-pulse rounded-xl bg-[#F4F3EF]" />
  ),
})

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  ticker: string
  companyName: string
  description?: string
  sector?: string
  industry?: string
  country?: string
  employees?: number | null
  currency: string
  price: number
  change: number
  changePct: number
  marketState?: string | null
  preMarketPrice?: number | null
  preMarketChangePct?: number | null
  postMarketPrice?: number | null
  postMarketChangePct?: number | null
  // for chart
  fairValue?: number | null
  analystTargetMean?: number | null
  userModelFairValue?: number | null
  // market metrics
  marketCap?: number | null
  peRatio?: number | null
  evToEbitda?: number | null
  roe?: number | null
  roic?: number | null
  beta?: number | null
  dividendYield?: number | null
  fcfMargin?: number | null
  high52: number
  low52: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currencyPrefix(currency: string): string {
  const code = (currency ?? 'USD').trim()
  if (code === 'USD') return '$'
  if (code === 'BRL') return 'R$ '
  return code + ' '
}

function fmtPriceValue(v: number, currency: string): string {
  const prefix = currencyPrefix(currency)
  if (Math.abs(v) >= 1_000) {
    return prefix + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return prefix + v.toFixed(2)
}

/** Company size label from employee count */
function companySizeLabel(employees: number | null | undefined): string | null {
  if (employees == null) return null
  if (employees < 200) return 'Small-Cap'
  if (employees < 5_000) return 'Mid-Size'
  if (employees < 50_000) return 'Large Enterprise'
  return 'Mega-Corp'
}

/** Initials from company name (up to 2 chars) */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#E5E5E5] bg-white px-3 py-1 text-[12px] font-semibold text-[#6B6B6B]">
      {children}
    </span>
  )
}

interface MetricRowProps {
  label: string
  value: string
  last?: boolean
}
function MetricRow({ label, value, last }: MetricRowProps) {
  return (
    <div
      className={`flex items-center justify-between py-2.5 ${last ? '' : 'border-b border-[#E5E5E5]'}`}
    >
      <span className="text-[12px] text-[#6B6B6B] leading-none">{label}</span>
      <span className="text-[12px] font-semibold font-mono tabular-nums text-[#111111] leading-none">
        {value}
      </span>
    </div>
  )
}

interface RangeSliderProps {
  low: number
  high: number
  current: number
  currency: string
}
function RangeSlider({ low, high, current, currency }: RangeSliderProps) {
  const range = high - low
  const pct = range > 0 ? Math.max(0, Math.min(100, ((current - low) / range) * 100)) : 50

  return (
    <div className="mt-3">
      {/* Track */}
      <div
        className="relative h-2 rounded-full bg-[#E5E5E5] mx-1"
        role="meter"
        aria-label="52-week price range"
        aria-valuemin={low}
        aria-valuemax={high}
        aria-valuenow={current}
        aria-valuetext={`${fmtPriceValue(current, currency)} — range ${fmtPriceValue(low, currency)} to ${fmtPriceValue(high, currency)}`}
      >
        {/* Filled portion */}
        <div
          className="absolute left-0 top-0 h-2 rounded-full bg-[#5F790B]"
          style={{ width: `${pct}%` }}
        />
        {/* Thumb dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-white border-2 border-[#5F790B]"
          style={{ left: `${pct}%`, boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
        />
      </div>
      {/* Labels */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] font-mono tabular-nums text-[#6B6B6B]">
          {fmtPriceValue(low, currency)}
        </span>
        <span className="text-[12px] font-mono tabular-nums text-[#111111] font-semibold">
          {fmtPriceValue(current, currency)}
        </span>
        <span className="text-[12px] font-mono tabular-nums text-[#6B6B6B]">
          {fmtPriceValue(high, currency)}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StockIdentityHeader({
  ticker,
  companyName,
  description,
  sector,
  industry,
  country,
  employees,
  currency,
  price,
  change,
  changePct,
  marketState,
  preMarketPrice,
  preMarketChangePct,
  postMarketPrice,
  postMarketChangePct,
  fairValue,
  analystTargetMean,
  userModelFairValue,
  marketCap,
  peRatio,
  evToEbitda,
  roe,
  roic,
  beta,
  dividendYield,
  fcfMargin: _fcfMargin,
  high52,
  low52,
}: Props) {
  const [descExpanded, setDescExpanded] = useState(false)

  const isPositive = change >= 0
  const changeSign = isPositive ? '+' : ''

  const prefix = currencyPrefix(currency)

  // Computed metrics (memoised to avoid recomputation on unrelated re-renders)
  const roeStr = useMemo(
    () => (roe != null && isFinite(roe) ? (roe * 100).toFixed(1) + '%' : '—'),
    [roe],
  )
  const roicStr = useMemo(
    () => (roic != null && isFinite(roic) ? (roic * 100).toFixed(1) + '%' : '—'),
    [roic],
  )
  const divYieldStr = useMemo(
    () =>
      dividendYield != null && isFinite(dividendYield) && dividendYield > 0
        ? (dividendYield * 100).toFixed(2) + '%'
        : '—',
    [dividendYield],
  )

  // Description truncation
  const DESC_LIMIT = 160
  const shouldTruncate = description && description.length > DESC_LIMIT
  const displayedDesc =
    shouldTruncate && !descExpanded
      ? description!.slice(0, DESC_LIMIT).trimEnd() + '…'
      : description

  // Tag chips
  const tags = useMemo(() => {
    const result: string[] = []
    if (sector) result.push(sector)
    if (industry) result.push(industry)
    const sizeLabel = companySizeLabel(employees)
    if (sizeLabel) result.push(sizeLabel)
    if (dividendYield != null && dividendYield > 0) result.push('Dividend Paying')
    return result
  }, [sector, industry, employees, dividendYield])

  // Company type label (simple heuristic)
  const companyType = industry ?? sector ?? 'Equity'

  return (
    <div className="flex flex-col gap-4">
      {/* ── ROW 1: Identity + Price ─────────────────────────────────────────── */}
      <div
        className="bg-white border border-[#E5E5E5] rounded-xl p-5 flex flex-col sm:flex-row gap-5"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        {/* Left col (≈70%) — Identity */}
        <div className="w-full sm:basis-[68%] sm:max-w-[68%] flex-1 min-w-0">
          <div className="flex items-start gap-4">
            {/* Logo placeholder */}
            <div
              role="img"
              aria-label={companyName + ' logo'}
              className="flex-shrink-0 flex items-center justify-center rounded-xl bg-[#F4F3EF] border border-[#E5E5E5] text-[#6B6B6B] font-bold select-none w-14 h-14 text-lg tracking-wide"
            >
              {initials(companyName)}
            </div>

            {/* Name + subtitle */}
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] font-bold leading-tight text-[#111111] tracking-tight truncate">
                {companyName}
              </h1>
              <p className="mt-0.5 text-[13px] text-[#6B6B6B] truncate">
                <span className="font-semibold text-[#111111]">{ticker}</span>
                {companyType ? ` · ${companyType}` : ''}
                {country ? ` · ${country}` : ''}
              </p>
            </div>
          </div>

          {/* Description */}
          {displayedDesc && (
            <div className="mt-3">
              <p className="text-[13px] text-[#6B6B6B] leading-relaxed">
                {displayedDesc}
                {shouldTruncate && (
                  <button
                    onClick={() => setDescExpanded((v) => !v)}
                    aria-expanded={descExpanded}
                    className="ml-1 inline-flex items-center min-h-[44px] px-1 text-[#5F790B] font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1 rounded text-[13px]"
                  >
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </p>
            </div>
          )}

          {/* Tag chips */}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <TagChip key={tag}>{tag}</TagChip>
              ))}
            </div>
          )}
        </div>

        {/* Right col (≈30%) — Price */}
        <div
          className="flex-shrink-0 flex flex-col justify-start w-full sm:basis-[30%] sm:max-w-[30%] sm:min-w-[160px]"
        >
          <p className="text-[12px] font-semibold text-[#6B6B6B] mb-1">
            Current price
          </p>
          <p className="text-[32px] font-mono tabular-nums font-bold leading-none text-[#111111]">
            {prefix}
            {price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>

          {/* 1D change row — changePct is a whole-number % (e.g. 0.97 means 0.97%) */}
          <div
            className={`mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold font-mono tabular-nums ${isPositive ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}
          >
            <span aria-hidden="true">{isPositive ? '▲' : '▼'}</span>
            <span className="sr-only">{isPositive ? 'up' : 'down'}</span>
            <span>
              {changeSign}
              {change.toFixed(2)}
            </span>
            <span className="text-[12px] opacity-80">
              ({changeSign}
              {Math.abs(changePct).toFixed(2)}%)
            </span>
            <span className="text-[12px] font-normal text-[#6B6B6B] ml-0.5">1D</span>
          </div>

          {/* Pre-Market row */}
          {marketState === 'PRE' && preMarketPrice != null && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] font-semibold text-[#6B6B6B]">
                Pre-market
              </span>
              <span className="font-mono tabular-nums text-[12px] font-semibold text-[#111111]">
                {fmtPriceValue(preMarketPrice, currency)}
              </span>
              {preMarketChangePct != null && (
                <span
                  className={`font-mono tabular-nums text-[11px] font-semibold ${preMarketChangePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}
                >
                  <span aria-hidden="true">{preMarketChangePct >= 0 ? '▲' : '▼'}</span>
                  {preMarketChangePct >= 0 ? '+' : ''}
                  {Math.abs(preMarketChangePct).toFixed(2)}%
                </span>
              )}
            </div>
          )}

          {/* After-Hours row */}
          {marketState === 'POST' && postMarketPrice != null && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] font-semibold text-[#6B6B6B]">
                After hours
              </span>
              <span className="font-mono tabular-nums text-[12px] font-semibold text-[#111111]">
                {fmtPriceValue(postMarketPrice, currency)}
              </span>
              {postMarketChangePct != null && (
                <span
                  className={`font-mono tabular-nums text-[11px] font-semibold ${postMarketChangePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}
                >
                  <span aria-hidden="true">{postMarketChangePct >= 0 ? '▲' : '▼'}</span>
                  {postMarketChangePct >= 0 ? '+' : ''}
                  {Math.abs(postMarketChangePct).toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: Price Chart + Market Metrics ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
        {/* Left col (≈70%) — Price Chart */}
        <div
          className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden flex flex-col w-full sm:basis-[68%] sm:max-w-[68%]"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          {/* Card header */}
          <div className="px-4 pt-4 pb-2 border-b border-[#E5E5E5]">
            <p className="text-[12px] font-semibold text-[#6B6B6B]">
              Price chart
            </p>
          </div>
          <div className="flex-1 min-h-[220px] sm:min-h-[320px]" role="img" aria-label={`${ticker} price history chart`}>
            <PriceChart
              ticker={ticker}
              isDark={false}
              triangulatedFairValue={fairValue ?? undefined}
              analystTarget={analystTargetMean ?? undefined}
              userModelFairValue={userModelFairValue ?? undefined}
            />
          </div>
        </div>

        {/* Right col (≈30%) — Market Metrics */}
        <div
          className="bg-white border border-[#E5E5E5] rounded-xl flex flex-col w-full sm:basis-[30%] sm:max-w-[30%] sm:min-w-[200px]"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="px-4 pt-4 pb-3 border-b border-[#E5E5E5]">
            <p className="text-[12px] font-semibold text-[#6B6B6B]">
              Market metrics
            </p>
          </div>

          <div className="px-4 pt-1 pb-2 flex-1">
            <MetricRow
              label="Market Cap"
              value={fmtLargeCurrency(marketCap ?? null, currency)}
            />
            <MetricRow
              label="P/E (TTM)"
              value={peRatio != null ? peRatio.toFixed(2) + '×' : '—'}
            />
            <MetricRow
              label="EV/EBITDA (TTM)"
              value={evToEbitda != null ? evToEbitda.toFixed(2) + '×' : '—'}
            />
            <MetricRow
              label="ROE (TTM)"
              value={roeStr}
            />
            <MetricRow
              label="ROIC (TTM)"
              value={roicStr}
            />
            <MetricRow
              label="Beta (5Y Monthly)"
              value={beta != null ? beta.toFixed(2) : '—'}
            />
            <MetricRow
              label="Dividend Yield (TTM)"
              value={divYieldStr}
              last
            />
          </div>

          {/* 52-Week Range */}
          <div className="px-4 pb-4 pt-1 border-t border-[#E5E5E5] mt-1">
            <p className="text-[12px] font-semibold text-[#6B6B6B] mb-1">
              52-week range
            </p>
            <RangeSlider
              low={low52}
              high={high52}
              current={price}
              currency={currency}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
