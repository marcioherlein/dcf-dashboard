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
    <div className="rounded-xl glass-card-light overflow-hidden">
      <div className="grid grid-cols-[1fr_60px_56px_60px] sm:grid-cols-[1fr_72px_68px_68px] items-center px-2 sm:px-3 py-2 border-b border-[#E3E1DA]">
        <span className="text-[11px] font-bold text-[#566174] uppercase tracking-wider truncate pr-2">
          {title}
        </span>
        <span className="text-right text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider">Price</span>
        <span className="text-right text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider">Chg</span>
        <span className="text-right text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider pr-0.5">%</span>
      </div>

      <div className="divide-y divide-[#E3E1DA]">
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
