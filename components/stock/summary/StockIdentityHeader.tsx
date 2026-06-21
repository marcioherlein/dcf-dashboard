'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { fmtLargeCurrency as _fmtLargeCurrency } from '@/lib/formatters'

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
  /** Last 4 quarters of EPS beat/miss data */
  earningsSurprises?: Array<{ surprisePercent: number | null; quarter: string | null }> | null
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

// ─── Price + Valuation panel ─────────────────────────────────────────────────

function PriceValuationPanel({
  currency, price, change, changePct,
  marketState, preMarketPrice, preMarketChangePct, postMarketPrice, postMarketChangePct,
  fairValue, analystTargetMean: _analystTargetMean, analystTargetLow: _analystTargetLow, analystTargetHigh: _analystTargetHigh, numAnalysts: _numAnalysts,
  onViewValuation, onViewConviction,
}: Pick<Props,
  'currency' | 'price' | 'change' | 'changePct' |
  'marketState' | 'preMarketPrice' | 'preMarketChangePct' | 'postMarketPrice' | 'postMarketChangePct' |
  'fairValue' | 'analystTargetMean' | 'analystTargetLow' | 'analystTargetHigh' | 'numAnalysts' |
  'onViewValuation' | 'onViewConviction'
>) {
  const isPositive  = change >= 0
  const prefix      = currencyPrefix(currency)
  const upside      = fairValue != null ? (fairValue - price) / price * 100 : null

  return (
    <div className="flex flex-col gap-0">
      {/* Price block — tighter padding */}
      <div
        className="rounded-xl px-3 py-2 -mx-3 mb-1"
        style={{
          background: isPositive
            ? 'linear-gradient(135deg, rgba(17,135,93,0.06) 0%, rgba(17,135,93,0.02) 60%, transparent 100%)'
            : 'linear-gradient(135deg, rgba(216,59,59,0.06) 0%, rgba(216,59,59,0.02) 60%, transparent 100%)',
        }}
      >
        <p className="text-[11px] text-[#9B9B9B] mb-0.5 leading-none">Current price</p>
        <p className="text-[26px] font-bold leading-none text-[#111111] tracking-tight">
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

      {/* Model estimate only — analyst target moved to Market Signals section */}
      {fairValue != null && upside != null && (
        <div className="mt-2 pt-2 border-t border-[#F0F0F0]">
          <button onClick={onViewValuation}
            className="group w-full flex items-center justify-between gap-2 text-left hover:bg-[#F5F5F5] rounded-lg px-2 py-2 -mx-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:rounded-lg"
            aria-label="View valuation details"
          >
            <div>
              <p className="text-[10px] text-[#9B9B9B] leading-none mb-0.5">Fair value estimate</p>
              <p className="text-[18px] font-[750] text-[#111111] leading-none tabular-nums">
                {fmtPriceValue(fairValue, currency)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[13px] font-[700] ${
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
        </div>
      )}

      {onViewConviction && (
        <button onClick={onViewConviction}
          className="mt-2 flex items-center gap-1.5 px-2 py-1.5 -mx-2 rounded-lg hover:bg-[#F5F5F5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:rounded-lg">
          <svg className="w-3.5 h-3.5 text-[#5F790B] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[11px] font-[600] text-[#5F790B]">Check conviction score →</span>
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StockIdentityHeader({
  ticker, companyName, description, sector, industry, country, employees: _employees,
  currency, price, change, changePct,
  marketState, preMarketPrice, preMarketChangePct, postMarketPrice, postMarketChangePct,
  fairValue, analystTargetMean, analystTargetLow, analystTargetHigh, numAnalysts, userModelFairValue: _userModelFairValue,
  marketCap: _marketCap, peRatio: _peRatio, evToEbitda: _evToEbitda, roe: _roe, roic: _roic, beta: _beta, dividendYield: _dividendYield,
  fcfMargin: _fcfMargin, grossMargin: _grossMargin, netMargin: _netMargin, revenueGrowth: _revenueGrowth,
  forwardPE: _forwardPE, pegRatioValue: _pegRatioValue,
  peHistory: _peHistory, evHistory: _evHistory,
  earningsSurprises: _earningsSurprises,
  high52: _high52, low52: _low52, nextEarningsDate,
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

  const companyType = industry ?? sector ?? 'Equity'

  const tags = useMemo(() => {
    const r: string[] = []
    if (_dividendYield != null && _dividendYield > 0.005) r.push('Dividend')
    if (_marketCap != null && _marketCap >= 200e9) r.push('Large Cap')
    else if (_marketCap != null && _marketCap >= 10e9) r.push('Mid Cap')
    return r
  }, [_dividendYield, _marketCap])

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
        className="bg-white border border-[#E3E1DA] rounded-xl p-3 sm:p-4"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,37%)] gap-4 items-start">

          {/* ── Left: Company identity ── */}
          <div className="min-w-0 flex flex-col gap-2">

            {/* Logo + name row */}
            <div className="flex items-start gap-3.5">
              {!logoError ? (
                <Image
                  src={logoSrc}
                  alt={`${companyName} logo`}
                  onError={() => setLogoError(true)}
                  width={48}
                  height={48}
                  className="flex-shrink-0 w-12 h-12 rounded-xl object-cover border border-[#E3E1DA]"
                  unoptimized
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
                <div className={`relative ${!descExpanded ? 'overflow-hidden' : ''}`}>
                  <p
                    className={`text-[13px] text-[#374151] leading-[1.6] max-w-[56ch] ${descExpanded ? '' : 'line-clamp-3'}`}
                    style={{ overflowWrap: 'break-word' }}
                  >
                    {description}
                  </p>
                  {!descExpanded && description.length > 300 && (
                    <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                  )}
                </div>
                {description.length > 300 && (
                  <button
                    onClick={() => setDescExpanded(v => !v)}
                    aria-expanded={descExpanded}
                    className="mt-0.5 flex items-center text-[#5F790B] font-semibold text-[12px] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] rounded py-1"
                  >
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}

            {/* Mobile-only: price + valuation panel (below description) */}
            <div className="sm:hidden border-t border-[#F0F0F0] pt-3">
              <PriceValuationPanel {...priceValuationProps} />
            </div>
          </div>

          {/* ── Right: Price + valuation summary (desktop only) ── */}
          <div className="hidden sm:flex flex-col min-w-0">
            <PriceValuationPanel {...priceValuationProps} />
          </div>

        </div>
      </div>
    </div>
  )
}
