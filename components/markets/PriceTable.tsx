'use client'
import MarketInstrumentRow from './MarketInstrumentRow'
import type { MarketInstrument } from '@/app/api/markets/data/route'

interface Props {
  title: string
  items: MarketInstrument[]
  priceDecimals?: number
}

export default function PriceTable({ title, items, priceDecimals = 2 }: Props) {
  return (
    <div className="rounded-xl glass-card border border-[rgba(59,130,246,0.15)] overflow-hidden">
      {/* Header — same grid-cols as rows ensures pixel-perfect column alignment */}
      <div className="grid grid-cols-[1fr_72px_68px_68px] items-center px-3 py-2 border-b border-[rgba(59,130,246,0.15)]">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate pr-2">
          {title}
        </span>
        <span className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Price</span>
        <span className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Chg</span>
        <span className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider pr-0.5">%</span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {items.map(item => (
          <MarketInstrumentRow
            key={item.symbol}
            symbol={item.symbol}
            name={item.name}
            price={item.price}
            change={item.change}
            changePct={item.changePct}
            priceDecimals={priceDecimals}
          />
        ))}
      </div>
    </div>
  )
}
