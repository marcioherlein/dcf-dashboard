'use client'

import Image from 'next/image'
import { useState } from 'react'

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

export default function TickerTab({
  ticker, companyName, price, upsidePct, sector, industry, country,
  marketCap, peRatio, beta, grossMargin, fcfMargin, description, wikiBio,
}: TickerTabProps) {
  const [logoErr, setLogoErr] = useState(false)

  const metrics = [
    { label: 'Market Cap',   value: fmtCap(marketCap) },
    { label: 'Price',        value: fmt(price, '$', '', 2) },
    { label: 'P/E',          value: fmt(peRatio, '', 'x') },
    { label: 'Beta',         value: fmt(beta, '', '', 2) },
    { label: 'Gross Margin', value: fmtPct(grossMargin) },
    { label: 'FCF Margin',   value: fmtPct(fcfMargin) },
    { label: 'DCF Upside',   value: upsidePct != null ? `${upsidePct >= 0 ? '+' : ''}${(upsidePct * 100).toFixed(1)}%` : '—' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
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
              <span className={`text-sm font-semibold ${upsidePct >= 0 ? 'text-[#1f6feb]' : 'text-[#cf222e]'}`}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}% upside
              </span>
            )}
          </div>
          <p className="text-[#6B6A72] text-sm mt-0.5">{companyName}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {sector && <span className="text-[11px] bg-[#EEF4FF] text-[#1f6feb] px-2 py-0.5 rounded-full border border-[#DCE6F5]">{sector}</span>}
            {industry && <span className="text-[11px] bg-[#F7F6F1] text-[#6B6A72] px-2 py-0.5 rounded-full border border-[#E8E6E0]">{industry}</span>}
            {country && <span className="text-[11px] bg-[#F7F6F1] text-[#6B6A72] px-2 py-0.5 rounded-full border border-[#E8E6E0]">{country}</span>}
          </div>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map(m => (
          <div key={m.label} className="rounded-xl border border-[#E8E6E0] bg-white px-4 py-3">
            <p className="text-[11px] text-[#6B6A72] uppercase tracking-wider mb-1">{m.label}</p>
            <p className="text-base font-semibold font-mono text-[#2D2C31]">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Business description */}
      {(description || wikiBio) && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-2">Business Overview</p>
          <p className="text-sm text-[#2D2C31] leading-relaxed">
            {wikiBio || description}
          </p>
        </div>
      )}
    </div>
  )
}
