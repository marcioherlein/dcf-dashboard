'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { fmtLargeCurrency } from '@/lib/formatters'

// ─── Tiny inline sparkline (SVG — no recharts needed) ───────────────────────

function TinySparkline({ values, color = '#5F790B' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const w = 56; const h = 22
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Dynamic import ───────────────────────────────────────────────────────────

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => (
    <div className="motion-safe:animate-pulse rounded-xl bg-[#F5F5F5] flex-1 min-h-[320px]" />
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
  fairValue?: number | null
  analystTargetMean?: number | null
  analystTargetLow?: number | null
  analystTargetHigh?: number | null
  numAnalysts?: number | null
  userModelFairValue?: number | null
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
  forwardPE?: number | null
  pegRatioValue?: number | null
  // sparkline history for evolving ratios (values newest→oldest, reversed internally)
  peHistory?: number[]
  evHistory?: number[]
  high52: number
  low52: number
  nextEarningsDate?: string | null
  onViewValuation?: () => void
  onViewConviction?: () => void
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
  if (Math.abs(v) >= 1_000) return prefix + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return prefix + v.toFixed(2)
}

function initials(name: string): string {
  if (!name) return '?'
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

type Sentiment = 'positive' | 'negative' | 'neutral'

function MetricRow({
  label, value, last, sentiment, spark, sparkColor,
}: {
  label: string; value: string; last?: boolean; sentiment?: Sentiment
  spark?: number[]; sparkColor?: string
}) {
  const valueColor = sentiment === 'positive' ? 'text-[#11875D]' : sentiment === 'negative' ? 'text-[#D83B3B]' : 'text-[#111111]'
  return (
    <div className={`flex items-center justify-between py-2 gap-2 ${last ? '' : 'border-b border-[#F0F0F0]'}`}>
      <span className="text-[11.5px] text-[#6B6B6B] leading-none min-w-0 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        {spark && spark.length >= 2 && (
          <TinySparkline values={spark} color={sparkColor ?? '#5F790B'} />
        )}
        <span className={`text-[11.5px] font-[650] leading-none tabular-nums shrink-0 ${valueColor}`}>{value}</span>
      </div>
    </div>
  )
}

// ─── Horizontal percent bar row ───────────────────────────────────────────────

function PercentBarRow({
  label, valuePct, cap = 100, last, sentiment,
}: {
  label: string
  valuePct: number | null | undefined  // value as a fraction (e.g. 0.42 = 42%)
  cap?: number                          // max % for bar width scaling (e.g. 60 means 60% fills the bar)
  last?: boolean
  sentiment?: Sentiment
}) {
  const displayStr = valuePct != null ? (valuePct * 100).toFixed(1) + '%' : '—'
  const pct = valuePct != null ? Math.max(0, Math.min(100, (Math.abs(valuePct) * 100 / cap) * 100)) : 0
  const isNeg = (valuePct ?? 0) < 0

  // bar fill color based on sign + sentiment
  const barColor = isNeg ? '#D83B3B'
    : sentiment === 'positive' ? '#5F790B'
    : sentiment === 'negative' ? '#D83B3B'
    : '#9B9B9B'

  const valueColor = sentiment === 'positive' ? 'text-[#11875D]'
    : sentiment === 'negative' ? 'text-[#D83B3B]'
    : isNeg ? 'text-[#D83B3B]'
    : 'text-[#111111]'

  return (
    <div className={`py-2 ${last ? '' : 'border-b border-[#F0F0F0]'}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11.5px] text-[#6B6B6B] leading-none shrink-0">{label}</span>
        <span className={`text-[11.5px] font-[650] leading-none tabular-nums shrink-0 ${valueColor}`}>{displayStr}</span>
      </div>
      <div className="h-1 rounded-full bg-[#F0F0F0] overflow-hidden">
        {valuePct != null && (
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: barColor, opacity: 0.85 }}
          />
        )}
      </div>
    </div>
  )
}

function RangeSlider({ low, high, current, currency, fairValue }: { low: number; high: number; current: number; currency: string; fairValue?: number | null }) {
  const range = high - low
  const pct   = range > 0 ? Math.max(0, Math.min(100, ((current   - low) / range) * 100)) : 50
  const fvPct = fairValue != null && range > 0 ? Math.max(0, Math.min(100, ((fairValue - low) / range) * 100)) : null
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-[#E5E5E5]"
        role="meter" aria-label="52-week price range"
        aria-valuemin={low} aria-valuemax={high} aria-valuenow={current}>
        <div className="absolute left-0 top-0 h-1.5 rounded-full bg-[#5F790B]" style={{ width: `${pct}%` }} />
        {fvPct != null && (
          <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-[#9B9B9B] rounded-full opacity-60" style={{ left: `${fvPct}%` }} title="Fair value" />
        )}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white border-2 border-[#5F790B]"
          style={{ left: `${pct}%`, boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] font-mono tabular-nums text-[#9B9B9B]">{fmtPriceValue(low, currency)}</span>
        <span className="text-[10.5px] font-[600] text-[#9B9B9B]">52-week range</span>
        <span className="text-[11px] font-mono tabular-nums text-[#9B9B9B]">{fmtPriceValue(high, currency)}</span>
      </div>
    </div>
  )
}

// ─── Price + Valuation panel (reused in both desktop and mobile) ─────────────

function PriceValuationPanel({
  currency, price, change, changePct,
  marketState, preMarketPrice, preMarketChangePct, postMarketPrice, postMarketChangePct,
  fairValue, analystTargetMean, analystTargetLow, analystTargetHigh, numAnalysts,
  onViewValuation, onViewConviction,
}: Pick<Props,
  'currency' | 'price' | 'change' | 'changePct' |
  'marketState' | 'preMarketPrice' | 'preMarketChangePct' | 'postMarketPrice' | 'postMarketChangePct' |
  'fairValue' | 'analystTargetMean' | 'analystTargetLow' | 'analystTargetHigh' | 'numAnalysts' |
  'onViewValuation' | 'onViewConviction'
>) {
  const isPositive  = change >= 0
  const prefix      = currencyPrefix(currency)
  const upside      = fairValue != null         ? (fairValue        - price) / price * 100 : null
  const analystUpside = analystTargetMean != null ? (analystTargetMean - price) / price * 100 : null

  return (
    <div className="flex flex-col gap-0">
      {/* Price block */}
      <div
        className="rounded-xl px-3.5 py-3 -mx-3.5 mb-1"
        style={{
          background: isPositive
            ? 'linear-gradient(135deg, rgba(17,135,93,0.06) 0%, rgba(17,135,93,0.02) 60%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(216,59,59,0.06) 0%, rgba(216,59,59,0.02) 60%, transparent 100%)',
        }}
      >
        <p className="text-[11px] text-[#9B9B9B] mb-0.5 leading-none">Current price</p>
        <p className="text-[32px] font-bold leading-none text-[#111111] tracking-tight">
          {prefix}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <div className={`mt-1 flex items-center gap-1 text-[13px] font-semibold ${isPositive ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
          <span>{isPositive ? '+' : ''}{change.toFixed(2)}</span>
          <span className="opacity-80">({isPositive ? '+' : ''}{Math.abs(changePct).toFixed(2)}%)</span>
          <span className="text-[11px] font-normal text-[#9B9B9B] ml-0.5">1D</span>
        </div>
      </div>

      {/* Pre/post market */}
      {marketState === 'PRE' && preMarketPrice != null && (
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-[#9B9B9B]">Pre-market</span>
          <span className="text-[11px] font-semibold text-[#111111]">{fmtPriceValue(preMarketPrice, currency)}</span>
          {preMarketChangePct != null && (
            <span className={`text-[11px] font-semibold ${preMarketChangePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
              {preMarketChangePct >= 0 ? '+' : ''}{Math.abs(preMarketChangePct).toFixed(2)}%
            </span>
          )}
        </div>
      )}
      {marketState === 'POST' && postMarketPrice != null && (
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-[#9B9B9B]">After hours</span>
          <span className="text-[11px] font-semibold text-[#111111]">{fmtPriceValue(postMarketPrice, currency)}</span>
          {postMarketChangePct != null && (
            <span className={`text-[11px] font-semibold ${postMarketChangePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
              {postMarketChangePct >= 0 ? '+' : ''}{Math.abs(postMarketChangePct).toFixed(2)}%
            </span>
          )}
        </div>
      )}

      {/* Model estimate + analyst target */}
      {(fairValue != null || analystTargetMean != null) && (
        <div className="mt-4 pt-3 border-t border-[#F0F0F0] flex flex-col gap-1">

          {fairValue != null && upside != null && (
            <button onClick={onViewValuation}
              className="group flex items-center justify-between gap-2 text-left hover:bg-[#F5F5F5] rounded-lg px-2 py-2 -mx-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:rounded-lg"
              aria-label="View valuation details"
            >
              <div>
                <p className="text-[10px] text-[#9B9B9B] leading-none mb-0.5">Model estimate</p>
                <p className="text-[15px] font-[750] text-[#111111] leading-none tabular-nums">
                  {fmtPriceValue(fairValue, currency)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-[650] ${
                  upside > 15  ? 'bg-[#E8F7EF] text-[#11875D]' :
                  upside < -10 ? 'bg-[#FCEAEA] text-[#D83B3B]' :
                  'bg-[#F5F5F5] text-[#6B6B6B]'
                }`}>
                  {upside > 0 ? '+' : ''}{upside.toFixed(1)}%
                </span>
                <span className="text-[10px] text-[#9B9B9B] group-hover:text-[#5F790B] transition-colors">
                  See valuation →
                </span>
              </div>
            </button>
          )}

          {/* Analyst target with range slider when full data available */}
          {analystTargetMean != null && analystTargetLow != null && analystTargetHigh != null && (() => {
            const sym = currencyPrefix(currency)
            const range = analystTargetHigh - analystTargetLow
            const safe = range > 0 ? range : 1
            const curPct  = Math.max(0, Math.min(100, ((price - analystTargetLow) / safe) * 100))
            const meanPct = Math.max(0, Math.min(100, ((analystTargetMean - analystTargetLow) / safe) * 100))
            const isUp = analystTargetMean > price
            const tgtUpside = (analystTargetMean - price) / price * 100
            return (
              <div className="mt-2 rounded-lg bg-[#F9F9F9] border border-[#E5E5E5] px-3 py-2.5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[10px] text-[#9B9B9B] leading-none mb-0.5">Analyst target</p>
                    <p className={`text-[14px] font-[700] leading-none tabular-nums ${isUp ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                      {sym}{analystTargetMean.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[12px] font-[700] ${isUp ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                      {tgtUpside >= 0 ? '+' : ''}{tgtUpside.toFixed(1)}%
                    </p>
                    {numAnalysts != null && numAnalysts > 0 && (
                      <p className="text-[10px] text-[#9B9B9B]">{numAnalysts} analysts</p>
                    )}
                  </div>
                </div>
                <div className="relative h-2 rounded-full bg-[#E5E5E5] mx-0.5">
                  {isUp ? (
                    <div className="absolute top-0 bottom-0 rounded-full bg-[#11875D]/60"
                      style={{ left: `${curPct}%`, width: `${Math.max(0, meanPct - curPct)}%` }} />
                  ) : (
                    <div className="absolute top-0 bottom-0 rounded-full bg-[#D83B3B]/60"
                      style={{ left: `${meanPct}%`, width: `${Math.max(0, curPct - meanPct)}%` }} />
                  )}
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#111111] border-2 border-white shadow-sm z-10"
                    style={{ left: `${curPct}%` }} />
                  <div className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${isUp ? 'bg-[#11875D]' : 'bg-[#D83B3B]'}`}
                    style={{ left: `${meanPct}%` }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[9px] text-[#9B9B9B] tabular-nums">
                  <span>{sym}{analystTargetLow.toFixed(0)}</span>
                  <span>{sym}{analystTargetHigh.toFixed(0)}</span>
                </div>
              </div>
            )
          })()}

          {/* Fallback: plain text when no range data */}
          {analystTargetMean != null && (analystTargetLow == null || analystTargetHigh == null) && analystUpside != null && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div>
                <p className="text-[10px] text-[#9B9B9B] leading-none mb-0.5">Analyst target</p>
                <p className="text-[14px] font-[650] text-[#111111] leading-none tabular-nums">
                  {fmtPriceValue(analystTargetMean, currency)}
                </p>
              </div>
              <span className={`text-[12px] font-[650] ${analystUpside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                {analystUpside >= 0 ? '+' : ''}{analystUpside.toFixed(1)}%
              </span>
            </div>
          )}

          {onViewConviction && (
            <button onClick={onViewConviction}
              className="flex items-center gap-1.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-[#F5F5F5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:rounded-lg">
              <svg className="w-3.5 h-3.5 text-[#5F790B] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[11px] font-[600] text-[#5F790B]">Check conviction score →</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StockIdentityHeader({
  ticker, companyName, description, sector, industry, country, employees: _employees,
  currency, price, change, changePct,
  marketState, preMarketPrice, preMarketChangePct, postMarketPrice, postMarketChangePct,
  fairValue, analystTargetMean, analystTargetLow, analystTargetHigh, numAnalysts, userModelFairValue,
  marketCap, peRatio, evToEbitda, roe, roic, beta, dividendYield,
  fcfMargin, grossMargin, netMargin: _netMargin, revenueGrowth,
  forwardPE, pegRatioValue,
  peHistory, evHistory,
  high52, low52, nextEarningsDate,
  onViewValuation, onViewConviction,
}: Props) {
  const [logoError, setLogoError] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  const logoSrc   = `https://financialmodelingprep.com/image-stock/${ticker}.png`

  const earningsInfo = useMemo(() => {
    if (!nextEarningsDate) return null
    const now = new Date(); now.setHours(0,0,0,0)
    const days = Math.round((new Date(nextEarningsDate).getTime() - now.getTime()) / 86400000)
    if (days < 0 || days > 60) return null
    return { days }
  }, [nextEarningsDate])

  const divYieldStr = dividendYield != null && isFinite(dividendYield) && dividendYield > 0 ? (dividendYield * 100).toFixed(2) + '%' : '—'

  // Tags: sector is already shown in the identity line; show only distinct tags
  const tags = useMemo(() => {
    const r: string[] = []
    if (dividendYield != null && dividendYield > 0.005) r.push('Dividend')
    if (marketCap != null && marketCap >= 200e9) r.push('Large Cap')
    else if (marketCap != null && marketCap >= 10e9) r.push('Mid Cap')
    return r
  }, [dividendYield, marketCap])

  const companyType = industry ?? sector ?? 'Equity'

  const peSentiment: Sentiment        = peRatio      == null ? 'neutral' : peRatio < 15      ? 'positive' : peRatio > 50      ? 'negative' : 'neutral'
  const evSentiment: Sentiment        = evToEbitda   == null ? 'neutral' : evToEbitda < 10   ? 'positive' : evToEbitda > 30   ? 'negative' : 'neutral'
  const revGrowthSentiment: Sentiment = revenueGrowth== null ? 'neutral' : revenueGrowth>.10 ? 'positive' : revenueGrowth < 0 ? 'negative' : 'neutral'
  const grossSentiment: Sentiment     = grossMargin  == null ? 'neutral' : grossMargin > .40 ? 'positive' : 'neutral'
  const fcfSentiment: Sentiment       = fcfMargin    == null ? 'neutral' : fcfMargin > .15   ? 'positive' : fcfMargin  < 0   ? 'negative' : 'neutral'
  const divSentiment: Sentiment       = dividendYield != null && dividendYield > 0            ? 'positive' : 'neutral'
  const roeSentiment: Sentiment       = roe          == null ? 'neutral' : roe  > .15        ? 'positive' : roe  < 0         ? 'negative' : 'neutral'
  const roicSentiment: Sentiment      = roic         == null ? 'neutral' : roic > .12        ? 'positive' : roic < 0         ? 'negative' : 'neutral'

  const priceValuationProps = {
    currency, price, change, changePct,
    marketState, preMarketPrice, preMarketChangePct, postMarketPrice, postMarketChangePct,
    fairValue, analystTargetMean, analystTargetLow, analystTargetHigh, numAnalysts,
    onViewValuation, onViewConviction,
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">

      {/* ══ SECTION A: Company Summary Hero ═══════════════════════════════════ */}
      {/* Two-column on sm+: ~63% left / ~37% right. Single column on mobile. */}
      <div
        className="bg-white border border-[#E3E1DA] rounded-xl p-5 sm:p-6"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,37%)] gap-5 sm:gap-6">

          {/* ── Left: Company identity ── */}
          <div className="min-w-0 flex flex-col gap-3">

            {/* Logo + name row */}
            <div className="flex items-start gap-3.5">
              {!logoError ? (
                <img
                  src={logoSrc}
                  alt={`${companyName} logo`}
                  onError={() => setLogoError(true)}
                  className="flex-shrink-0 w-12 h-12 rounded-xl object-cover border border-[#E3E1DA]"
                />
              ) : (
                <div
                  role="img"
                  aria-label={`${companyName} logo`}
                  className="flex-shrink-0 flex items-center justify-center rounded-xl bg-[#F5F5F5] border border-[#E3E1DA] text-[#6B6B6B] font-bold select-none w-12 h-12 text-base"
                >
                  {initials(companyName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h1 className="text-[20px] sm:text-[22px] font-bold leading-tight text-[#111111] tracking-tight" style={{ textWrap: 'balance' }}>
                  {companyName}
                </h1>
                <p className="mt-0.5 text-[13px] text-[#6B6B6B] truncate">
                  <span className="font-semibold text-[#111111]">{ticker}</span>
                  {companyType ? ` · ${companyType}` : ''}
                  {country ? ` · ${country}` : ''}
                </p>

                {/* Tags */}
                {(tags.length > 0 || earningsInfo) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <span key={tag} className="rounded-full border border-[#E3E1DA] bg-white px-2.5 py-0.5 text-[11px] font-[600] text-[#6B6B6B]">
                        {tag}
                      </span>
                    ))}
                    {earningsInfo && (
                      <span className="rounded-full border border-[#F3D391] bg-[#FFF4DA] px-2.5 py-0.5 text-[11px] font-[600] text-[#B56A00]">
                        Earnings {earningsInfo.days === 0 ? 'today' : earningsInfo.days === 1 ? 'tomorrow' : `in ${earningsInfo.days}d`}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Description — CSS line-clamp (avoids layout shift on expand) */}
            {description && (
              <div>
                <p
                  className={`text-[13.5px] text-[#566174] leading-[1.65] ${descExpanded ? '' : 'line-clamp-4'}`}
                  style={{ overflowWrap: 'break-word' }}
                >
                  {description}
                </p>
                {description.length > 300 && (
                  <button
                    onClick={() => setDescExpanded(v => !v)}
                    aria-expanded={descExpanded}
                    className="mt-1 text-[#5F790B] font-semibold text-[12px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] rounded"
                  >
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            {/* Mobile-only: price + valuation panel (below description) */}
            <div className="sm:hidden border-t border-[#F0F0F0] pt-4">
              <PriceValuationPanel {...priceValuationProps} />
            </div>
          </div>

          {/* ── Right: Price + valuation summary (desktop only) ── */}
          <div className="hidden sm:flex flex-col min-w-0">
            <PriceValuationPanel {...priceValuationProps} />
          </div>

        </div>
      </div>

      {/* ══ SECTION B: Chart (68–72%) + Metrics sidebar (28–32%) ═════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,68%)_minmax(0,32%)] gap-3 sm:gap-4 items-start">

        {/* Chart — fills its grid cell; PriceChart handles its own internal height */}
        <div
          className="bg-white border border-[#E3E1DA] rounded-xl overflow-hidden min-h-0"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <PriceChart
            ticker={ticker}
            isDark={false}
            triangulatedFairValue={fairValue ?? undefined}
            analystTarget={analystTargetMean ?? undefined}
            userModelFairValue={userModelFairValue ?? undefined}
            initialPeriod="3mo"
          />
          {/* Valuation legend below chart */}
          {(fairValue != null || analystTargetMean != null || userModelFairValue != null) && (
            <div className="flex items-center gap-4 px-4 py-2 border-t border-[#F0F0F0]">
              {fairValue != null && (
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                  <span className="w-3 h-0.5 rounded-full inline-block bg-[#8b5cf6]" />
                  Model estimate
                </span>
              )}
              {analystTargetMean != null && (
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                  <span className="w-3 h-0.5 rounded-full inline-block bg-[#f59e0b]" />
                  Analyst target
                </span>
              )}
              {userModelFairValue != null && (
                <span className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                  <span className="w-3 h-0.5 rounded-full inline-block bg-[#10b981]" />
                  Your model
                </span>
              )}
            </div>
          )}
        </div>

        {/* Metrics sidebar */}
        <div
          className="bg-white border border-[#E3E1DA] rounded-xl flex flex-col min-w-0 min-h-0"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          {/* Valuation section */}
          <div className="px-4 pt-4 pb-0">
            <p className="text-[10px] font-[700] text-[#9B9B9B] uppercase tracking-wider mb-1">Valuation</p>
            <MetricRow label="Market Cap"     value={fmtLargeCurrency(marketCap ?? null, currency)} />
            <MetricRow label="P/E (TTM)"      value={peRatio != null ? peRatio.toFixed(1)+'×' : '—'}
              sentiment={peSentiment}
              spark={peHistory}
              sparkColor={peSentiment === 'positive' ? '#11875D' : peSentiment === 'negative' ? '#D83B3B' : '#6B6B6B'}
            />
            {forwardPE != null && (
              <MetricRow label="Fwd P/E"      value={forwardPE.toFixed(1)+'×'}
                sentiment={forwardPE < 15 ? 'positive' : forwardPE > 40 ? 'negative' : 'neutral'}
              />
            )}
            {pegRatioValue != null && (
              <MetricRow label="PEG"          value={pegRatioValue.toFixed(2)}
                sentiment={pegRatioValue < 1.5 ? 'positive' : pegRatioValue > 2.5 ? 'negative' : 'neutral'}
              />
            )}
            <MetricRow label="EV/EBITDA"      value={evToEbitda != null ? evToEbitda.toFixed(1)+'×' : '—'}
              sentiment={evSentiment}
              spark={evHistory}
              sparkColor={evSentiment === 'positive' ? '#11875D' : evSentiment === 'negative' ? '#D83B3B' : '#6B6B6B'}
            />
            <MetricRow label="Beta"           value={beta != null ? beta.toFixed(2) : '—'} />
            {dividendYield != null && dividendYield > 0 && (
              <MetricRow label="Dividend Yield" value={divYieldStr} sentiment={divSentiment} />
            )}
          </div>

          {/* Quality section */}
          <div className="px-4 pt-3 pb-0">
            <p className="text-[10px] font-[700] text-[#9B9B9B] uppercase tracking-wider mb-0.5">Quality</p>
            <PercentBarRow label="Revenue Growth" valuePct={revenueGrowth}    cap={30} sentiment={revGrowthSentiment} />
            <PercentBarRow label="Gross Margin"   valuePct={grossMargin}      cap={80} sentiment={grossSentiment} />
            <PercentBarRow label="FCF Margin"     valuePct={fcfMargin}        cap={40} sentiment={fcfSentiment} />
            <PercentBarRow label="ROE"            valuePct={roe}              cap={50} sentiment={roeSentiment} />
            <PercentBarRow label="ROIC"           valuePct={roic}             cap={40} sentiment={roicSentiment} last />
          </div>

          {/* 52-week range */}
          <div className="px-4 pb-4 pt-4 border-t border-[#F0F0F0] mt-auto">
            <RangeSlider low={low52} high={high52} current={price} currency={currency} fairValue={fairValue} />
          </div>
        </div>

      </div>

    </div>
  )
}
