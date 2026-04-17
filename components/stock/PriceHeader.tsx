'use client'
import { fmt, fmtLarge } from '@/lib/utils'

interface Props {
  ticker: string
  companyName: string
  price: number
  change: number
  changePct: number
  marketCap: number
  peRatio: number
  high52: number
  low52: number
  analystTarget: number
  currency: string
  sector: string
  analystRec: string  // kept in props for future use (e.g. ratings tab)
}

export default function PriceHeader({
  ticker, companyName, price, change, changePct, marketCap, peRatio,
  high52, low52, analystTarget, currency, sector,
}: Props) {
  const up = change >= 0
  return (
    <div className="rounded-xl bg-white shadow-card border border-slate-200 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
              {ticker}
            </span>
            {sector && (
              <span className="text-xs text-slate-400">{sector}</span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900" style={{ letterSpacing: '-0.02em' }}>
            {companyName}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-4xl font-extrabold text-slate-900 tabular-nums" style={{ letterSpacing: '-0.03em' }}>
            {currency} {fmt(price)}
          </div>
          <div className={`mt-1.5 text-sm font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`}>
            {up ? '+' : ''}{fmt(change)} ({up ? '+' : ''}{fmt(changePct, 2)}%)
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: 'Market Cap',     value: fmtLarge(marketCap) },
          { label: 'P/E Ratio',      value: peRatio ? fmt(peRatio, 1) + 'x' : '—' },
          { label: '52-wk High',     value: `$${fmt(high52)}` },
          { label: '52-wk Low',      value: `$${fmt(low52)}` },
          { label: 'Analyst Target', value: analystTarget ? `$${fmt(analystTarget)}` : '—' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-medium text-slate-400">{stat.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
