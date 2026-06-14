'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface VerdictData {
  ticker: string
  companyName: string
  currentPrice: number | null
  fairValue: number | null
  upside: number | null
  verdict: 'Undervalued' | 'Fairly Valued' | 'Overvalued' | null
}

const TICKERS = ['AAPL', 'MSFT', 'NVDA']

function verdictChipStyle(verdict: VerdictData['verdict']): string {
  if (verdict === 'Undervalued')
    return 'bg-[#EEF3D8] text-[#5F790B] border border-[#C8D98A]'
  if (verdict === 'Overvalued')
    return 'bg-[#FDE8E8] text-[#B91C1C] border border-[#FECACA]'
  return 'bg-[#F3F4F6] text-[#6B6B6B] border border-[#E5E5E5]'
}

function upsideColor(upside: number | null): string {
  if (upside === null) return 'text-[#9B9B9B]'
  if (upside > 0) return 'text-[#5F790B]'
  if (upside < 0) return 'text-[#B91C1C]'
  return 'text-[#6B6B6B]'
}

function formatPrice(val: number | null): string {
  if (val === null) return '—'
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function formatUpside(val: number | null): string {
  if (val === null) return '—'
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(1)}%`
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 shadow-sm animate-pulse">
      <div className="h-6 w-16 bg-[#F5F5F5] rounded-full mb-3" />
      <div className="h-4 w-32 bg-[#F5F5F5] rounded mb-4" />
      <div className="h-7 w-24 bg-[#F5F5F5] rounded mb-2" />
      <div className="h-4 w-20 bg-[#F5F5F5] rounded mb-3" />
      <div className="h-5 w-24 bg-[#F5F5F5] rounded-full" />
    </div>
  )
}

function ErrorCard({ ticker }: { ticker: string }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 shadow-sm">
      <span className="inline-block bg-[#F5F5F5] text-[#9B9B9B] text-[11px] font-bold px-2 py-0.5 rounded-full mb-3">
        {ticker}
      </span>
      <p className="text-[#9B9B9B] text-[13px]">Data unavailable</p>
    </div>
  )
}

function VerdictCard({ data }: { data: VerdictData }) {
  return (
    <Link
      href={`/stock/${data.ticker}`}
      className="block bg-white border border-[#E5E5E5] rounded-xl p-5 shadow-sm flex flex-col gap-2 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-95"
    >
      <span className="inline-flex w-fit items-center bg-[#EEF3D8] text-[#5F790B] text-[11px] font-bold px-2 py-0.5 rounded-full">
        {data.ticker}
      </span>
      <p className="text-[#6B6B6B] text-[13px] leading-tight">{data.companyName || data.ticker}</p>
      <div className="mt-1">
        <p className="text-[22px] font-bold text-[#111111] leading-none">
          {formatPrice(data.currentPrice)}
        </p>
        <p className="text-[13px] text-[#6B6B6B] mt-0.5">
          Fair value: <span className="text-[#111111] font-medium">{formatPrice(data.fairValue)}</span>
        </p>
      </div>
      <p className={`text-[14px] font-semibold ${upsideColor(data.upside)}`}>
        {formatUpside(data.upside)} upside
      </p>
      {data.verdict && (
        <span className={`inline-flex w-fit text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 ${verdictChipStyle(data.verdict)}`}>
          {data.verdict}
        </span>
      )}
    </Link>
  )
}

function deriveVerdict(currentPrice: number | null, fairValue: number | null): VerdictData['verdict'] {
  if (currentPrice === null || fairValue === null || fairValue === 0) return null
  const upside = ((fairValue - currentPrice) / currentPrice) * 100
  if (upside > 10) return 'Undervalued'
  if (upside < -10) return 'Overvalued'
  return 'Fairly Valued'
}

function deriveUpside(currentPrice: number | null, fairValue: number | null): number | null {
  if (currentPrice === null || fairValue === null || currentPrice === 0) return null
  return ((fairValue - currentPrice) / currentPrice) * 100
}

type CardState = 'loading' | 'error' | 'done'

interface CardEntry {
  ticker: string
  state: CardState
  data: VerdictData | null
}

export default function LiveVerdictStrip() {
  const [cards, setCards] = useState<CardEntry[]>(
    TICKERS.map((t) => ({ ticker: t, state: 'loading', data: null }))
  )

  useEffect(() => {
    TICKERS.forEach((ticker, idx) => {
      fetch(`/api/financials?ticker=${ticker}`)
        .then((r) => r.json())
        .then((json) => {
          // Defensively read multiple possible field paths
          const currentPrice: number | null =
            json?.currentPrice ?? json?.price ?? json?.quote?.price ?? null
          const fairValue: number | null =
            json?.fairValue?.fairValuePerShare ?? json?.intrinsicValue ?? json?.dcfValue ?? null
          const companyName: string =
            json?.companyName ?? json?.name ?? ticker

          const upside = deriveUpside(currentPrice, fairValue)
          const verdict = deriveVerdict(currentPrice, fairValue)

          setCards((prev) => {
            const next = [...prev]
            next[idx] = {
              ticker,
              state: 'done',
              data: { ticker, companyName, currentPrice, fairValue, upside, verdict },
            }
            return next
          })
        })
        .catch(() => {
          setCards((prev) => {
            const next = [...prev]
            next[idx] = { ticker, state: 'error', data: null }
            return next
          })
        })
    })
  }, [])

  return (
    <section className="bg-[#F5F5F5] py-16">
      <div className="max-w-5xl mx-auto px-6">
        <h2 className="text-[28px] font-bold text-[#111111] text-center mb-2">
          Live model output — right now
        </h2>
        <p className="text-[14px] text-[#6B6B6B] text-center mb-10">
          Three stocks, three verdicts, computed fresh.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {cards.map((card) => {
            if (card.state === 'loading') return <SkeletonCard key={card.ticker} />
            if (card.state === 'error' || !card.data) return <ErrorCard key={card.ticker} ticker={card.ticker} />
            return <VerdictCard key={card.ticker} data={card.data} />
          })}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/analyze"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#5F790B] hover:underline"
          >
            Analyze any stock →
          </Link>
        </div>
      </div>
    </section>
  )
}
