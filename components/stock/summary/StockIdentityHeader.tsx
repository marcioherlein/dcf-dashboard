'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { fmtLargeCurrency } from '@/lib/formatters'

// ─── Dynamic import ───────────────────────────────────────────────────────────

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] animate-pulse rounded-xl bg-[#F5F5F5]" />
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
  grossMargin?: number | null
  netMargin?: number | null
  revenueGrowth?: number | null
  high52: number
  low52: number
  // earnings
  nextEarningsDate?: string | null
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

/** Initials from company name (up to 2 chars) */
function initials(name: string): string {
  if (!name) return '?'
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
    <span className="rounded-full border border-[#E5E5E5] bg-white px-2.5 py-0.5 text-[11px] font-[600] text-[#6B6B6B]">
      {children}
    </span>
  )
}

type Sentiment = 'positive' | 'negative' | 'neutral'

interface MetricRowProps {
  label: string
  value: string
  last?: boolean
  sentiment?: Sentiment
}
function MetricRow({ label, value, last, sentiment }: MetricRowProps) {
  const valueColor =
    sentiment === 'positive'
      ? 'text-[#11875D]'
      : sentiment === 'negative'
      ? 'text-[#D83B3B]'
      : 'text-[#111111]'

  return (
    <div
      className={`flex items-center justify-between py-2.5 ${last ? '' : 'border-b border-[#E5E5E5]'}`}
    >
      <span className="text-[12px] text-[#6B6B6B] leading-none">{label}</span>
      <span className={`text-[12px] font-bold leading-none tabular-nums ${valueColor}`}>
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
  description: _description,
  sector,
  industry,
  country,
  employees: _employees,
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
  fcfMargin,
  grossMargin,
  netMargin,
  revenueGrowth,
  high52,
  low52,
  nextEarningsDate,
}: Props) {
  const [logoError, setLogoError] = useState(false)

  const logoSrc = "https://financialmodelingprep.com/image-stock/" + ticker + ".png"

  const isPositive = change >= 0
  const prefix = currencyPrefix(currency)

  // ── Fair value derived values ──────────────────────────────────────────────
  const upside = fairValue != null ? (fairValue - price) / price * 100 : null
  const fairValueBg =
    upside == null
      ? ''
      : upside > 15
      ? 'bg-[#E8F7EF] border border-[#A3D9BE]'
      : upside < -10
      ? 'bg-[#FCEAEA] border border-[#F0B8B8]'
      : 'bg-white border border-[#E5E5E5]'

  const analystUpside =
    analystTargetMean != null ? (analystTargetMean - price) / price * 100 : null

  // ── Next earnings ──────────────────────────────────────────────────────────
  const earningsInfo = useMemo(() => {
    if (!nextEarningsDate) return null
    const now = new Date()
    const earningsDay = new Date(nextEarningsDate)
    const diffMs = earningsDay.getTime() - now.setHours(0, 0, 0, 0)
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (days < 0 || days > 60) return null
    return { days }
  }, [nextEarningsDate])

  // ── Computed metric strings ────────────────────────────────────────────────
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

  // ── Tag chips — sector, industry, dividend only (no employee-size label) ──
  const tags = useMemo(() => {
    const result: string[] = []
    if (sector) result.push(sector)
    if (industry) result.push(industry)
    if (dividendYield != null && dividendYield > 0) result.push('Dividend')
    return result
  }, [sector, industry, dividendYield])

  // Company type label (simple heuristic)
  const companyType = industry ?? sector ?? 'Equity'

  // ── Metric sentiments ──────────────────────────────────────────────────────
  const peSentiment: Sentiment =
    peRatio == null ? 'neutral' : peRatio < 15 ? 'positive' : peRatio > 50 ? 'negative' : 'neutral'
  const evSentiment: Sentiment =
    evToEbitda == null ? 'neutral' : evToEbitda < 10 ? 'positive' : evToEbitda > 30 ? 'negative' : 'neutral'
  const revGrowthSentiment: Sentiment =
    revenueGrowth == null ? 'neutral' : revenueGrowth > 0.10 ? 'positive' : revenueGrowth < 0 ? 'negative' : 'neutral'
  const grossMarginSentiment: Sentiment =
    grossMargin == null ? 'neutral' : grossMargin > 0.40 ? 'positive' : 'neutral'
  const netMarginSentiment: Sentiment =
    netMargin == null ? 'neutral' : netMargin > 0.15 ? 'positive' : netMargin < 0 ? 'negative' : 'neutral'
  const fcfMarginSentiment: Sentiment =
    fcfMargin == null ? 'neutral' : fcfMargin > 0.15 ? 'positive' : fcfMargin < 0 ? 'negative' : 'neutral'
  const divYieldSentiment: Sentiment =
    dividendYield != null && dividendYield > 0 ? 'positive' : 'neutral'
  const roeSentiment: Sentiment =
    roe == null ? 'neutral' : roe > 0.15 ? 'positive' : roe < 0 ? 'negative' : 'neutral'
  const roicSentiment: Sentiment =
    roic == null ? 'neutral' : roic > 0.12 ? 'positive' : roic < 0 ? 'negative' : 'neutral'

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
            {/* Company logo / initials fallback */}
            {!logoError ? (
              <img
                src={logoSrc}
                alt={companyName}
                onError={() => setLogoError(true)}
                className="flex-shrink-0 w-14 h-14 rounded-xl object-cover border border-[#E5E5E5]"
              />
            ) : (
              <div
                role="img"
                aria-label={companyName + ' logo'}
                className="flex-shrink-0 flex items-center justify-center rounded-xl bg-[#F5F5F5] border border-[#E5E5E5] text-[#6B6B6B] font-bold select-none w-14 h-14 text-lg tracking-wide"
              >
                {initials(companyName)}
              </div>
            )}

            {/* Name + subtitle + tags + mobile price inline */}
            <div className="min-w-0 flex-1">
              <h1 className="text-[20px] sm:text-[22px] font-bold leading-tight text-[#111111] tracking-tight truncate">
                {companyName}
              </h1>
              <p className="mt-0.5 text-[13px] text-[#6B6B6B] truncate">
                <span className="font-semibold text-[#111111]">{ticker}</span>
                {companyType ? ` · ${companyType}` : ''}
                {country ? ` · ${country}` : ''}
              </p>

              {/* Tag chips — inline under ticker */}
              {(tags.length > 0 || earningsInfo) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <TagChip key={tag}>{tag}</TagChip>
                  ))}
                  {earningsInfo && (
                    <span className="rounded-full border border-[#F3D391] bg-[#FFF4DA] px-2.5 py-0.5 text-[11px] font-[600] text-[#B56A00]">
                      Earnings {earningsInfo.days === 0 ? 'today' : earningsInfo.days === 1 ? 'tomorrow' : `in ${earningsInfo.days}d`}
                    </span>
                  )}
                </div>
              )}

              {/* Mobile-only compact price line — visible below sm breakpoint */}
              <div className="mt-1.5 flex items-baseline gap-2 sm:hidden">
                <span className="text-[20px] font-bold text-[#111111] tracking-tight leading-none">
                  {prefix}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-[13px] font-semibold ${isPositive ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                  {isPositive ? '+' : ''}{Math.abs(changePct).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right col (≈30%) — Price — HIDDEN on mobile, shown on sm+ */}
        <div
          className="hidden sm:flex flex-shrink-0 flex-col justify-start sm:basis-[30%] sm:max-w-[30%] sm:min-w-[160px]"
        >
          <p className="text-[34px] font-bold leading-none text-[#111111] tracking-tight">
            {prefix}
            {price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>

          {/* 1D change row */}
          <div
            className={`mt-1.5 flex items-center gap-1 text-[14px] font-semibold ${isPositive ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}
          >
            <span>{isPositive ? '+' : ''}{change.toFixed(2)}</span>
            <span className="text-[13px] opacity-80">
              ({isPositive ? '+' : ''}{Math.abs(changePct).toFixed(2)}%)
            </span>
            <span className="text-[12px] font-normal text-[#6B6B6B] ml-0.5">1D</span>
          </div>

          {/* Pre-Market row */}
          {marketState === 'PRE' && preMarketPrice != null && (
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] font-semibold text-[#6B6B6B]">
                Pre-market
              </span>
              <span className="text-[12px] font-semibold text-[#111111]">
                {fmtPriceValue(preMarketPrice, currency)}
              </span>
              {preMarketChangePct != null && (
                <span
                  className={`text-[12px] font-semibold ${preMarketChangePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}
                >
                  {preMarketChangePct >= 0 ? '+' : ''}{Math.abs(preMarketChangePct).toFixed(2)}%
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
              <span className="text-[12px] font-semibold text-[#111111]">
                {fmtPriceValue(postMarketPrice, currency)}
              </span>
              {postMarketChangePct != null && (
                <span
                  className={`text-[12px] font-semibold ${postMarketChangePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}
                >
                  {postMarketChangePct >= 0 ? '+' : ''}{Math.abs(postMarketChangePct).toFixed(2)}%
                </span>
              )}
            </div>
          )}

          {/* Fair Value block */}
          {fairValue != null && upside != null && (
            <>
              <div className="mt-3 border-t border-[#E5E5E5]" />
              <div className={`mt-3 rounded-lg p-3 ${fairValueBg}`}>
                <p className="text-[11px] text-[#6B6B6B]">Fair Value</p>
                <p className="text-[24px] font-bold leading-none text-[#111111] tracking-tight mt-0.5">
                  {fmtPriceValue(fairValue, currency)}
                </p>
                <p className={`mt-1 text-[13px] font-semibold ${upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                  {upside >= 0 ? '+' : ''}{upside.toFixed(1)}% {upside >= 0 ? 'upside' : 'downside'}
                </p>
              </div>
            </>
          )}

          {/* Analyst target */}
          {analystTargetMean != null && analystUpside != null && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#6B6B6B]">Analyst target</span>
              <span className="flex items-center gap-1.5 tabular-nums">
                <span className="text-[12px] font-semibold text-[#111111]">
                  {fmtPriceValue(analystTargetMean, currency)}
                </span>
                <span className={`text-[11px] font-semibold ${analystUpside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                  ({analystUpside >= 0 ? '+' : ''}{analystUpside.toFixed(1)}%)
                </span>
              </span>
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
          <div className="flex-1 min-h-[220px] sm:min-h-[320px]" role="img" aria-label={`${ticker} price history chart`}>
            <PriceChart
              ticker={ticker}
              isDark={false}
              triangulatedFairValue={fairValue ?? undefined}
              analystTarget={analystTargetMean ?? undefined}
              userModelFairValue={userModelFairValue ?? undefined}
              initialPeriod="3mo"
            />
          </div>
          {/* Chart legend */}
          {(fairValue != null || analystTargetMean != null || userModelFairValue != null) && (
            <div className="flex items-center gap-4 px-4 py-2 border-t border-[#E5E5E5]">
              {fairValue != null && (
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                  <span className="w-3 h-0.5 bg-[#5F790B] rounded-full inline-block" />
                  Insic estimate
                </span>
              )}
              {analystTargetMean != null && (
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                  <span className="w-3 h-0.5 bg-[#2563EB] rounded-full inline-block" />
                  Analyst target
                </span>
              )}
              {userModelFairValue != null && (
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                  <span className="w-3 h-0.5 bg-[#B56A00] rounded-full inline-block" />
                  Your model
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right col (≈30%) — Market Metrics */}
        <div
          className="bg-white border border-[#E5E5E5] rounded-xl flex flex-col w-full sm:basis-[30%] sm:max-w-[30%] sm:min-w-[200px]"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="px-4 pt-4 pb-3 border-b border-[#E5E5E5]" />

          <div className="px-4 pt-1 pb-2 flex-1">
            <MetricRow
              label="Market Cap"
              value={fmtLargeCurrency(marketCap ?? null, currency)}
            />
            <MetricRow
              label="P/E (TTM)"
              value={peRatio != null ? peRatio.toFixed(2) + '×' : '—'}
              sentiment={peSentiment}
            />
            <MetricRow
              label="Revenue Growth (TTM)"
              value={revenueGrowth != null ? (revenueGrowth * 100).toFixed(1) + '%' : '—'}
              sentiment={revGrowthSentiment}
            />
            <MetricRow
              label="EV/EBITDA (TTM)"
              value={evToEbitda != null ? evToEbitda.toFixed(2) + '×' : '—'}
              sentiment={evSentiment}
            />
            <MetricRow
              label="ROE (TTM)"
              value={roeStr}
              sentiment={roeSentiment}
            />
            <MetricRow
              label="ROIC (TTM)"
              value={roicStr}
              sentiment={roicSentiment}
            />
            <MetricRow
              label="Beta (5Y Monthly)"
              value={beta != null ? beta.toFixed(2) : '—'}
            />
            <MetricRow
              label="Dividend Yield (TTM)"
              value={divYieldStr}
              sentiment={divYieldSentiment}
            />
            <MetricRow
              label="Gross Margin (TTM)"
              value={grossMargin != null ? (grossMargin * 100).toFixed(1) + '%' : '—'}
              sentiment={grossMarginSentiment}
            />
            <MetricRow
              label="Net Margin (TTM)"
              value={netMargin != null ? (netMargin * 100).toFixed(1) + '%' : '—'}
              sentiment={netMarginSentiment}
            />
            <MetricRow
              label="FCF Margin (TTM)"
              value={fcfMargin != null ? (fcfMargin * 100).toFixed(1) + '%' : '—'}
              sentiment={fcfMarginSentiment}
              last
            />
          </div>

          {/* 52-Week Range — label removed, slider is self-explanatory */}
          <div className="px-4 pb-4 pt-1 border-t border-[#E5E5E5] mt-1">
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
