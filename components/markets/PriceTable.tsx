'use client'
import { cn } from '@/lib/utils'
import type { MarketInstrument } from '@/app/api/markets/data/route'

function fmtNum(v: number | null, decimals = 2): string {
  if (v == null) return '—'
  return Math.abs(v) >= 1000
    ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toFixed(decimals)
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function changeCls(v: number | null) {
  if (v == null) return 'text-slate-400'
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-slate-500'
}

function badgeCls(v: number | null) {
  if (v == null) return 'bg-slate-100 text-slate-400'
  return v > 0 ? 'bg-emerald-50 text-emerald-700' : v < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
}

interface Props {
  title: string
  items: MarketInstrument[]
  priceDecimals?: number
  showExpand?: boolean
}

export default function PriceTable({ title, items, priceDecimals = 2 }: Props) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className="grid grid-cols-3 gap-x-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span className="text-right">Price</span>
          <span className="text-right">Chg</span>
          <span className="text-right">%</span>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {items.map(item => (
          <div key={item.symbol} className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
            <div className="min-w-0 flex-1 mr-3">
              <div className="text-[12px] font-bold text-slate-800 leading-tight truncate">{item.symbol.replace('=X', '').replace('^', '').replace('-USD', 'USD').replace('=F', '')}</div>
              <div className="text-[10px] text-slate-400 leading-tight truncate">{item.name}</div>
            </div>
            <div className="grid grid-cols-3 gap-x-3 items-center shrink-0">
              <span className="text-right text-[12px] font-mono font-semibold text-slate-900">
                {fmtNum(item.price, priceDecimals)}
              </span>
              <span className={cn('text-right text-[11px] font-mono', changeCls(item.changePct))}>
                {item.change != null ? (item.change >= 0 ? '+' : '') + fmtNum(item.change, priceDecimals) : '—'}
              </span>
              <span className={cn('text-right text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md', badgeCls(item.changePct))}>
                {fmtPct(item.changePct)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
