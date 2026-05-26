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

  // Range ALWAYS includes current price AND fair value, then expands to bear/bull if available.
  // This prevents the price dot from being clamped to the edge when price << bear case.
  const allValues = [price, fairValue, bearCase, bullCase].filter((v): v is number => v != null)
  const dataLo = Math.min(...allValues)
  const dataHi = Math.max(...allValues)
  const margin = (dataHi - dataLo) * 0.06
  const lo = dataLo - margin
  const hi = dataHi + margin
  const span = hi - lo

  const pct = (v: number) => span > 0 ? Math.max(1, Math.min(99, ((v - lo) / span) * 100)) : 50

  const fvPct    = pct(fairValue)
  const pricePct = pct(price)
  const isAbove  = price > fairValue
  const diff     = ((price - fairValue) / fairValue) * 100

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] font-semibold text-slate-700">Price vs Fair Value</span>
        <span className={cn(
          'text-[12px] font-bold tabular-nums px-2.5 py-0.5 rounded-full border',
          isAbove
            ? 'text-red-600 bg-red-50 border-red-100'
            : 'text-emerald-600 bg-emerald-50 border-emerald-100'
        )}>
          {isAbove ? '+' : ''}{diff.toFixed(1)}%
        </span>
      </div>

      {/* ── Labels row (no absolute positioning — safe at all range positions) ── */}
      <div className="flex items-end gap-4 sm:gap-8 mb-3 flex-wrap">
        <div>
          <p className="text-[14px] sm:text-[16px] font-bold tabular-nums text-slate-900 leading-none">{fmtPrice(price, currency)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Current Price</p>
        </div>
        <div>
          <p className="text-[14px] sm:text-[16px] font-bold tabular-nums text-slate-900 leading-none">{fmtPrice(fairValue, currency)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Fair Value</p>
        </div>
      </div>

      {/* ── Gradient bar ── */}
      <div className="relative h-3 rounded-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" />

        {/* Fair value white line marker */}
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

      {/* ── Bear / Bull case labels ── */}
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

      {/* ── Interpretation ── */}
      <p className="text-[12px] text-slate-500 mt-3 leading-relaxed">
        {isAbove
          ? `Current price is ${Math.abs(diff).toFixed(1)}% above our fair value estimate.`
          : `Current price is ${Math.abs(diff).toFixed(1)}% below our fair value estimate.`}
      </p>
    </div>
  )
}
