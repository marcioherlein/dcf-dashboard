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
  analystRec: string
}

const recColor: Record<string, string> = {
  buy:        'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400',
  strongBuy:  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  hold:       'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400',
  sell:       'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
  strongSell: 'bg-red-200 text-red-900 dark:bg-red-500/20 dark:text-red-400',
}

export default function PriceHeader({
  ticker, companyName, price, change, changePct, marketCap, peRatio,
  high52, low52, analystTarget, currency, sector, analystRec,
}: Props) {
  const up = change >= 0
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700 dark:bg-white/10 dark:text-white/80">
              {ticker}
            </span>
            {sector && <span className="text-xs text-gray-400 dark:text-white/30">{sector}</span>}
            {analystRec && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${recColor[analystRec] ?? 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/60'}`}>
                {analystRec}
              </span>
            )}
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>
            {companyName}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.03em' }}>
            {currency} {fmt(price)}
          </div>
          <div className={`mt-1 text-sm font-medium ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
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
          <div key={stat.label} className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/5">
            <p className="text-xs text-gray-400 dark:text-white/30">{stat.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-white/80">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
