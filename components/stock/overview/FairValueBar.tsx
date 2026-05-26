'use client'
import { cn } from '@/lib/utils'
import { fmtPrice } from '@/lib/formatters'

interface FairValueBarProps {
  price: number
  fairValue: number | null
  currency: string
  bearCase?: number | null
  bullCase?: number | null
}

export default function FairValueBar({ price, fairValue, currency, bearCase, bullCase }: FairValueBarProps) {
  if (fairValue == null) return null

  // Range anchors: use bear/bull if available, else extend ~20% either side of min/max
  const lo = bearCase ?? Math.min(price, fairValue) * 0.80
  const hi = bullCase ?? Math.max(price, fairValue) * 1.20
  const span = hi - lo

  const pct = (v: number) => span > 0 ? Math.max(1, Math.min(99, ((v - lo) / span) * 100)) : 50

  const fvPct    = pct(fairValue)
  const pricePct = pct(price)
  const isAbove  = price > fairValue
  const diff     = ((price - fairValue) / fairValue) * 100

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-slate-700">Price vs Fair Value</span>
        </div>
        <span className={cn(
          'text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-md',
          isAbove ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'
        )}>
          {isAbove ? '+' : ''}{diff.toFixed(1)}%
        </span>
      </div>

      {/* Fair Value + Current Price labels above bar */}
      <div className="relative mb-1" style={{ height: '24px' }}>
        {/* Fair value label */}
        <div
          className="absolute text-[10px] text-slate-500 font-medium -translate-x-1/2"
          style={{ left: `${fvPct}%`, top: 0 }}
        >
          <span className="tabular-nums">{fmtPrice(fairValue, currency)}</span>
          <br />
          <span className="text-slate-400">Fair Value</span>
        </div>

        {/* Current price label */}
        <div
          className="absolute text-[10px] font-semibold text-slate-700 -translate-x-1/2"
          style={{ left: `${pricePct}%`, top: 0 }}
        >
          <span className="tabular-nums">{fmtPrice(price, currency)}</span>
          <br />
          <span className="text-slate-400">Current Price</span>
        </div>
      </div>

      {/* Gradient bar */}
      <div className="relative h-3 rounded-full overflow-hidden mt-6">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" />

        {/* Fair value white line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-10"
          style={{ left: `${fvPct}%` }}
        />

        {/* Current price dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow-md z-20"
          style={{ left: `calc(${pricePct}% - 8px)` }}
        />
      </div>

      {/* Bear / Bull labels below bar */}
      <div className="flex justify-between mt-2">
        <div>
          {bearCase != null && (
            <>
              <p className="text-[10px] text-slate-400 tabular-nums">{fmtPrice(bearCase, currency)}</p>
              <p className="text-[9px] text-slate-300">Bear Case</p>
            </>
          )}
        </div>
        <div className="text-right">
          {bullCase != null && (
            <>
              <p className="text-[10px] text-slate-400 tabular-nums">{fmtPrice(bullCase, currency)}</p>
              <p className="text-[9px] text-slate-300">Bull Case</p>
            </>
          )}
        </div>
      </div>

      {/* Interpretation sentence */}
      <p className="text-[12px] text-slate-500 mt-3 leading-relaxed">
        {isAbove
          ? `Current price is ${Math.abs(diff).toFixed(1)}% above our fair value estimate.`
          : `Current price is ${Math.abs(diff).toFixed(1)}% below our fair value estimate.`}
      </p>
    </div>
  )
}
