'use client'
import { fmtPrice, fmtPct, fmtLargeCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Bookmark } from 'lucide-react'

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
  onSave?: () => void
}

function StatBox({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('rounded-xl bg-slate-50 border border-slate-100 px-4 py-3', className)}>
      <p className="text-label uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold font-mono text-slate-800">{value}</p>
    </div>
  )
}

export default function PriceHeader({
  ticker, companyName, price, change, changePct, marketCap, peRatio,
  high52, low52, analystTarget, currency, sector, onSave,
}: Props) {
  const up = change >= 0
  const currSymbol = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '

  return (
    <div className="rounded-xl bg-white shadow-card border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-700 tracking-wide">
              {ticker}
            </span>
            {sector && (
              <span className="text-micro text-slate-400">{sector}</span>
            )}
          </div>
          <h1 className="mt-2 text-xl font-bold text-slate-900 tracking-tight truncate">
            {companyName}
          </h1>
        </div>

        <div className="flex items-start gap-3 shrink-0">
          <div className="text-right">
            <div className="text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
              {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={cn('mt-1 flex items-center justify-end gap-1.5 text-sm font-semibold', up ? 'text-emerald-600' : 'text-red-600')}>
              {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{up ? '+' : ''}{change.toFixed(2)}</span>
              <span className="text-xs opacity-80">({up ? '+' : ''}{fmtPct(changePct / 100)})</span>
            </div>
          </div>
          {onSave && (
            <button
              onClick={onSave}
              title="Save to Watchlist"
              className="mt-1 rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Bookmark size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatBox label="Market Cap"     value={fmtLargeCurrency(marketCap, currency)} />
        <StatBox label="P/E Ratio"      value={peRatio ? peRatio.toFixed(1) + '×' : '—'} />
        <StatBox label="52-wk High"     value={fmtPrice(high52, currency)} />
        <StatBox label="52-wk Low"      value={fmtPrice(low52, currency)} className="hidden sm:block" />
        <StatBox label="Analyst Target" value={analystTarget ? fmtPrice(analystTarget, currency) : '—'} />
      </div>
    </div>
  )
}

