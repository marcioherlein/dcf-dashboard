'use client'

import type { RankedInstrument } from '@/app/api/factor-ranking/route'

interface Props {
  instruments: RankedInstrument[]
}

// Show major index-like tickers first, then top movers by absolute change
function buildMarqueeItems(instruments: RankedInstrument[]) {
  const sorted = [...instruments].sort((a, b) => Math.abs(b.change1DPct) - Math.abs(a.change1DPct))
  return sorted.slice(0, 40)
}

export default function TickerMarquee({ instruments }: Props) {
  if (instruments.length === 0) {
    return (
      <div className="h-9 bg-white border-b border-slate-200 flex items-center px-4">
        <span className="text-slate-400 text-xs">Loading market data…</span>
      </div>
    )
  }

  const items = buildMarqueeItems(instruments)
  // Duplicate for seamless loop
  const doubled = [...items, ...items]

  return (
    <div className="h-9 bg-white border-b border-slate-200 overflow-hidden flex items-center select-none">
      <div className="animate-marquee">
        {doubled.map((inst, idx) => {
          const isPositive = inst.change1DPct >= 0
          const changeColor = isPositive ? '#059669' : '#DC2626'
          const arrow = isPositive ? '▲' : '▼'
          return (
            <span
              key={`${inst.ticker}-${idx}`}
              className="inline-flex items-center gap-1.5 px-4 border-r border-slate-100 text-xs whitespace-nowrap"
            >
              <span className="font-semibold text-slate-800">{inst.displayTicker}</span>
              <span className="text-slate-400">{formatPrice(inst.price, inst.currency)}</span>
              <span style={{ color: changeColor }} className="font-semibold">
                {arrow} {Math.abs(inst.change1DPct).toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function formatPrice(price: number, currency: string): string {
  if (currency === 'ARS') {
    if (price >= 1000) return price.toFixed(0)
    return price.toFixed(2)
  }
  return `$${price.toFixed(2)}`
}
