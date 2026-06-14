'use client'
import { fmtPrice, fmtPct, fmtLargeCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Bookmark } from 'lucide-react'
import { NABadge } from '@/components/ui/na-badge'

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

function StatBox({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] px-4 py-3', className)}>
      <p className="text-[11px] font-[600] text-[#475569] uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm font-semibold font-mono text-[#0F172A]">{value}</p>
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
    <div className="rounded-xl card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-lg bg-[#EAF1FF] border border-[#93B4F5] px-2.5 py-1 text-xs font-bold text-[#2563EB] tracking-wide shrink-0">
              {ticker}
            </span>
            {sector && (
              <span className="text-micro text-[#566174] truncate">{sector}</span>
            )}
          </div>
          <h1 className="mt-2 text-lg sm:text-xl font-bold text-[#06101F] tracking-tight truncate max-w-[200px] sm:max-w-none">
            {companyName}
          </h1>
        </div>

        <div className="flex items-start gap-2 sm:gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[22px] sm:text-3xl font-bold text-[#06101F] font-mono tabular-nums tracking-tight leading-none">
              {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={cn('mt-1 flex items-center justify-end gap-1.5 text-sm font-semibold', up ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
              {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{up ? '+' : ''}{change.toFixed(2)}</span>
              <span className="text-xs opacity-80">({up ? '+' : ''}{fmtPct(changePct / 100)})</span>
            </div>
          </div>
          {onSave && (
            <button
              onClick={onSave}
              title="Save to Watchlist"
              className="mt-1 rounded-lg border border-[#E3E1DA] p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8A95A6] hover:border-[#5F790B] hover:text-[#2563EB] hover:bg-[#EAF1FF] transition-colors"
            >
              <Bookmark size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatBox label="Market Cap"     value={fmtLargeCurrency(marketCap, currency)} />
        <StatBox label="P/E Ratio"      value={peRatio ? peRatio.toFixed(1) + '×' : <NABadge reason="requires-positive-earnings" />} />
        <StatBox label="52-wk High"     value={fmtPrice(high52, currency)} />
        <StatBox label="52-wk Low"      value={fmtPrice(low52, currency)} className="hidden sm:block" />
        <StatBox label="Analyst Target" value={analystTarget ? fmtPrice(analystTarget, currency) : <NABadge reason="no-coverage" />} />
      </div>
    </div>
  )
}

