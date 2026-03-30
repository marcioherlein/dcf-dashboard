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
      <div className="h-9 bg-[#0d1117] border-b border-[#30363d] flex items-center px-4">
        <span className="text-[#8b949e] text-xs">Loading market data…</span>
      </div>
    )
  }

  const items = buildMarqueeItems(instruments)
  // Duplicate for seamless loop
  const doubled = [...items, ...items]

  return (
    <div className="h-9 bg-[#0d1117] border-b border-[#30363d] overflow-hidden flex items-center select-none">
      <div className="animate-marquee">
        {doubled.map((inst, idx) => {
          const isPositive = inst.change1DPct >= 0
          const changeColor = isPositive ? '#3fb950' : '#f85149'
          const arrow = isPositive ? '▲' : '▼'
          return (
            <span
              key={`${inst.ticker}-${idx}`}
              className="inline-flex items-center gap-1.5 px-4 border-r border-[#21262d] text-xs whitespace-nowrap"
            >
              <span className="font-bold text-[#e6edf3]">{inst.displayTicker}</span>
              <span className="text-[#8b949e]">{formatPrice(inst.price, inst.currency)}</span>
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
