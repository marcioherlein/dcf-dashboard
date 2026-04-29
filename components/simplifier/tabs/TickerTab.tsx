'use client'

import Image from 'next/image'
import { useState } from 'react'
import PriceChart from '../PriceChart'
import {
  extractFoundedYear,
  deriveCustomerProfile,
  extractKeyOfferings,
  getSegmentAvailability,
} from '@/lib/simplifier/companyMetadata'

interface TickerTabProps {
  ticker: string
  companyName: string
  price: number | null
  upsidePct: number | null
  sector: string
  industry: string
  country: string
  marketCap: number | null
  peRatio: number | null
  beta: number | null
  grossMargin: number | null
  fcfMargin: number | null
  description: string
  wikiBio: string | null
}

function fmt(v: number | null, prefix = '', suffix = '', decimals = 1) {
  if (v == null) return '—'
  return `${prefix}${v.toFixed(decimals)}${suffix}`
}
function fmtPct(v: number | null) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}
function fmtCap(v: number | null) {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toFixed(0)}`
}

// ── Customer profile pill colors ──────────────────────────────────────────────
const profileColors: Record<string, { bg: string; text: string; border: string }> = {
  'B2C':       { bg: 'bg-[#EEF4FF]', text: 'text-[#1f6feb]', border: 'border-[#DCE6F5]' },
  'B2B':       { bg: 'bg-[#F0FDF4]', text: 'text-[#15803d]', border: 'border-[#BBF7D0]' },
  'B2B & B2C': { bg: 'bg-[#FEF9C3]', text: 'text-[#9a6700]', border: 'border-[#FDE68A]' },
  'Government':{ bg: 'bg-[#FEE2E2]', text: 'text-[#cf222e]', border: 'border-[#FECACA]' },
  'Mixed':     { bg: 'bg-[#F7F6F1]', text: 'text-[#6B6A72]', border: 'border-[#E8E6E0]' },
}

export default function TickerTab({
  ticker, companyName, price, upsidePct, sector, industry, country,
  marketCap, peRatio, beta, grossMargin, fcfMargin, description, wikiBio,
}: TickerTabProps) {
  const [logoErr, setLogoErr] = useState(false)

  // ── Derived metadata ──────────────────────────────────────────────────────
  const descText = description || wikiBio || ''
  const foundedYear   = extractFoundedYear(descText)
  const customerProfile = deriveCustomerProfile(sector, industry)
  const keyOfferings    = extractKeyOfferings(descText, sector, industry)
  const segmentInfo     = getSegmentAvailability()
  const profileStyle    = profileColors[customerProfile] ?? profileColors['Mixed']

  const upsideColor = upsidePct == null ? 'text-[#6B6A72]'
    : upsidePct >= 0.25 ? 'text-[#1f6feb]'
    : upsidePct >= 0.05 ? 'text-[#9a6700]'
    : 'text-[#cf222e]'

  const metrics = [
    { label: 'Market Cap',   value: fmtCap(marketCap) },
    { label: 'Price',        value: fmt(price, '$', '', 2) },
    { label: 'P/E',          value: fmt(peRatio, '', 'x') },
    { label: 'Beta',         value: fmt(beta, '', '', 2) },
    { label: 'Gross Margin', value: fmtPct(grossMargin) },
    { label: 'FCF Margin',   value: fmtPct(fcfMargin) },
    { label: 'DCF Upside',   value: upsidePct != null ? `${upsidePct >= 0 ? '+' : ''}${(upsidePct * 100).toFixed(1)}%` : '—' },
    ...(foundedYear ? [{ label: 'Founded', value: foundedYear }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header: logo + name + tags ────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        {!logoErr ? (
          <Image
            src={`https://logo.clearbit.com/${ticker.toLowerCase()}.com`}
            alt={ticker}
            width={56}
            height={56}
            className="rounded-xl object-contain bg-white border border-[#E8E6E0] p-1 shrink-0"
            onError={() => setLogoErr(true)}
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-[#EEF4FF] border border-[#DCE6F5] flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-[#1f6feb] font-mono">{ticker.slice(0, 2)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-[#2D2C31] font-mono">{ticker}</h1>
            {price != null && (
              <span className="text-xl font-semibold text-[#2D2C31]">${price.toFixed(2)}</span>
            )}
            {upsidePct != null && (
              <span className={`text-sm font-semibold ${upsideColor}`}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}% upside
              </span>
            )}
          </div>
          <p className="text-[#6B6A72] text-sm mt-0.5">{companyName}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {sector   && <span className="text-[11px] bg-[#EEF4FF] text-[#1f6feb] px-2 py-0.5 rounded-full border border-[#DCE6F5]">{sector}</span>}
            {industry && <span className="text-[11px] bg-[#F7F6F1] text-[#6B6A72] px-2 py-0.5 rounded-full border border-[#E8E6E0]">{industry}</span>}
            {country  && <span className="text-[11px] bg-[#F7F6F1] text-[#6B6A72] px-2 py-0.5 rounded-full border border-[#E8E6E0]">{country}</span>}
            {/* Customer profile badge */}
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${profileStyle.bg} ${profileStyle.text} ${profileStyle.border}`}>
              {customerProfile}
            </span>
          </div>
        </div>
      </div>

      {/* ── Key metrics grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="rounded-xl border border-[#E8E6E0] bg-white px-4 py-3">
            <p className="text-[11px] text-[#6B6A72] uppercase tracking-wider mb-1">{m.label}</p>
            <p className={`text-base font-semibold font-mono ${m.label === 'DCF Upside' ? upsideColor : 'text-[#2D2C31]'}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── S&P 500 performance chart ─────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">
          Performance vs S&amp;P 500 (rebased to 100)
        </p>
        <PriceChart ticker={ticker} defaultRange="1Y" height={220} />
      </div>

      {/* ── Business overview ─────────────────────────────────────────────── */}
      {descText && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-2">Business Overview</p>
          <p className="text-sm text-[#2D2C31] leading-relaxed">
            {wikiBio || description}
          </p>
        </div>
      )}

      {/* ── Key Offerings + Customer Profile ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Key offerings */}
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">Key Offerings</p>
          <div className="flex flex-col gap-1.5">
            {keyOfferings.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1f6feb] shrink-0" />
                <span className="text-sm text-[#2D2C31]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Customer profile */}
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">Customer Profile</p>
          <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 ${profileStyle.bg} ${profileStyle.border}`}>
            <span className={`text-2xl font-bold ${profileStyle.text}`}>{customerProfile}</span>
          </div>
          <p className="text-xs text-[#6B6A72] mt-3 leading-relaxed">
            {customerProfile === 'B2C'
              ? 'Products or services sold directly to consumers. Revenue driven by brand, reach, and repeat purchase.'
              : customerProfile === 'B2B'
              ? 'Products or services sold to businesses. Revenue driven by contracts, switching costs, and enterprise relationships.'
              : customerProfile === 'Government'
              ? 'Primary revenue from government contracts and procurement. Subject to budget cycles and policy risk.'
              : 'Revenue from both business and consumer customers. Diversified demand base across segments.'}
          </p>
        </div>
      </div>

      {/* ── Revenue Segments / Geography (not available from Yahoo) ──────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-2">
          Revenue Breakdown — Segments &amp; Geography
        </p>
        <div className="rounded-lg bg-[#F7F6F1] border border-[#E8E6E0] px-4 py-3 flex items-start gap-3">
          <span className="text-[#9a6700] text-sm mt-0.5 shrink-0">ⓘ</span>
          <p className="text-sm text-[#6B6A72]">
            {segmentInfo.reason}{' '}
            {/* Link to Yahoo Finance earnings page as a helpful fallback */}
            <a
              href={`https://finance.yahoo.com/quote/${ticker}/financials/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1f6feb] underline underline-offset-2"
            >
              View on Yahoo Finance →
            </a>
          </p>
        </div>
      </div>

    </div>
  )
}
