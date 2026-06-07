'use client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { NABadge } from '@/components/ui/na-badge'

interface Props {
  symbol: string
  name: string
  price: number | null
  change: number | null
  changePct: number | null
  priceDecimals?: number
}

function fmtNum(v: number | null, decimals = 2): string {
  if (v == null || !isFinite(v)) return '—'
  return Math.abs(v) >= 1000
    ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : v.toFixed(decimals)
}

function fmtPct(v: number | null): string {
  if (v == null || !isFinite(v)) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function changeCls(v: number | null) {
  if (v == null) return 'text-[#8A95A6]'
  return v > 0 ? 'text-[#11875D]' : v < 0 ? 'text-[#D83B3B]' : 'text-[#566174]'
}

function badgeCls(v: number | null) {
  if (v == null) return 'bg-[#E3E1DA] text-[#566174]'
  return v > 0 ? 'bg-[#E8F7EF] text-[#11875D]' : v < 0 ? 'bg-[#FCEAEA] text-[#D83B3B]' : 'bg-[#E3E1DA] text-[#566174]'
}

function displaySymbol(symbol: string): string {
  return symbol.replace(/=X$/, '').replace(/^[\^]/, '').replace(/-USD$/, 'USD').replace(/=F$/, '')
}

export default function MarketInstrumentRow({ symbol, name, price, change, changePct, priceDecimals = 2 }: Props) {
  const href = `/markets/${encodeURIComponent(symbol)}`

  return (
    <Link
      href={href}
      aria-label={`${name} — ${price != null ? fmtNum(price, priceDecimals) : 'N/A'}`}
      className={cn(
        'grid grid-cols-[1fr_60px_56px_60px] sm:grid-cols-[1fr_72px_68px_68px] items-center px-2 sm:px-3 py-2.5',
        'hover:bg-indigo-50/60 cursor-pointer transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
      )}
    >
      <div className="min-w-0 pr-2">
        <div className="text-[13px] font-semibold text-[#06101F] leading-tight tracking-tight truncate">
          {displaySymbol(symbol)}
        </div>
        <div className="text-[11px] text-[#566174] leading-tight truncate" title={name}>
          {name}
        </div>
      </div>

      <div className="text-right tabular-nums">
        <span className="text-[13px] font-semibold text-[#06101F] font-mono">
          {price != null && isFinite(price) ? fmtNum(price, priceDecimals) : <NABadge reason="no-data" />}
        </span>
      </div>

      <div className={cn('text-right tabular-nums', changeCls(changePct))}>
        <span className="text-[12px] font-mono">
          {change != null && isFinite(change)
            ? (change >= 0 ? '+' : '') + fmtNum(change, priceDecimals)
            : <NABadge reason="no-data" />}
        </span>
      </div>

      <div className="flex justify-end">
        <span className={cn(
          'inline-block text-right text-[11.5px] font-semibold font-mono tabular-nums',
          'px-1.5 py-0.5 rounded min-w-[62px] text-center',
          badgeCls(changePct),
        )}>
          {fmtPct(changePct)}
        </span>
      </div>
    </Link>
  )
}
