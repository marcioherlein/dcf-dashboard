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

// Fixed zones on a 0–2.5× ratio scale
const ZONES = [
  { label: 'Deep Value',  max: 0.70, color: 'bg-emerald-500' },
  { label: 'Undervalued', max: 0.90, color: 'bg-emerald-400' },
  { label: 'Fair Value',  max: 1.10, color: 'bg-blue-400'    },
  { label: 'Premium',     max: 1.40, color: 'bg-amber-400'   },
  { label: 'Expensive',   max: 2.50, color: 'bg-red-400'     },
]

function zoneFor(ratio: number) {
  return ZONES.find(z => ratio <= z.max) ?? ZONES[ZONES.length - 1]
}

function ratioLabel(ratio: number): string {
  if (ratio <= 0.70) return 'Deep Value'
  if (ratio <= 0.90) return 'Undervalued'
  if (ratio <= 1.10) return 'Fair Value'
  if (ratio <= 1.40) return 'Premium'
  if (ratio <= 2.00) return 'Expensive'
  return 'Significantly Overvalued'
}

export default function FairValueBar({ price, fairValue, currency, bearCase, bullCase }: FairValueBarProps) {
  if (fairValue == null) return null

  const ratio   = price / fairValue
  const isAbove = price > fairValue
  const diff    = ((price - fairValue) / fairValue) * 100
  const zone    = zoneFor(ratio)

  // Clamp dot position to 1–99% on a 0–2.5× scale
  const SCALE_MAX = 2.5
  const dotPct = Math.max(1, Math.min(99, (ratio / SCALE_MAX) * 100))
  // Fair value is always at 1× = 40% of the 0–2.5× scale
  const fvPct = (1.0 / SCALE_MAX) * 100  // 40%

  const chipClass = isAbove
    ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-emerald-600 bg-emerald-50 border-emerald-200'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
            Price vs Fair Value
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-extrabold tabular-nums text-slate-900 leading-none">
              {ratio.toFixed(2)}×
            </span>
            <span className="text-[13px] font-semibold text-slate-400">Price / Intrinsic</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full border block mb-1', chipClass)}>
            {ratioLabel(ratio)}
          </span>
          <span className={cn('text-[12px] font-semibold tabular-nums', isAbove ? 'text-red-600' : 'text-emerald-600')}>
            {isAbove ? '+' : ''}{diff.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ── Ratio meter bar ── */}
      <div className="mb-1">
        {/* Zone segments */}
        <div className="relative h-3 rounded-full overflow-hidden flex">
          {/* Deep Value 0–0.7× = 28% */}
          <div className="bg-emerald-500 h-full" style={{ width: '28%' }} />
          {/* Undervalued 0.7–0.9× = 8% */}
          <div className="bg-emerald-400 h-full" style={{ width: '8%' }} />
          {/* Fair Value 0.9–1.1× = 8% */}
          <div className="bg-blue-400 h-full" style={{ width: '8%' }} />
          {/* Premium 1.1–1.4× = 12% */}
          <div className="bg-amber-400 h-full" style={{ width: '12%' }} />
          {/* Expensive 1.4–2.5× = remaining */}
          <div className="bg-red-400 h-full flex-1" />
        </div>

        {/* Overlays: FV line + price dot */}
        <div className="relative h-3 -mt-3 pointer-events-none">
          {/* Fair value tick at 40% */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-10"
            style={{ left: `${fvPct}%` }}
          />
          {/* Price dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow-md z-20"
            style={{ left: `calc(${dotPct}% - 8px)` }}
          />
        </div>
      </div>

      {/* ── Axis labels ── */}
      <div className="flex justify-between mt-1.5 mb-3">
        <span className="text-[10px] text-slate-400">0×</span>
        <span className="text-[10px] text-slate-400 font-medium" style={{ marginLeft: `${fvPct - 4}%` }}>1× FV</span>
        <span className="text-[10px] text-slate-400">2.5×</span>
      </div>

      {/* ── Zone legend ── */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {ZONES.map(z => (
          <div key={z.label} className="flex items-center gap-1">
            <span className={cn('w-2 h-2 rounded-full shrink-0', z.color)} />
            <span className={cn(
              'text-[10px]',
              zone.label === z.label ? 'font-bold text-slate-700' : 'text-slate-400'
            )}>{z.label}</span>
          </div>
        ))}
      </div>

      {/* ── Price / FV numbers ── */}
      <div className="flex items-end gap-6 border-t border-slate-100 pt-3">
        <div>
          <p className="text-[15px] font-bold tabular-nums text-slate-900 leading-none">{fmtPrice(price, currency)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Current Price</p>
        </div>
        <div>
          <p className="text-[15px] font-bold tabular-nums text-slate-900 leading-none">{fmtPrice(fairValue, currency)}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Fair Value (Base)</p>
        </div>
        {bearCase != null && (
          <div>
            <p className="text-[13px] font-semibold tabular-nums text-red-500 leading-none">{fmtPrice(bearCase, currency)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Bear</p>
          </div>
        )}
        {bullCase != null && (
          <div>
            <p className="text-[13px] font-semibold tabular-nums text-emerald-600 leading-none">{fmtPrice(bullCase, currency)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Bull</p>
          </div>
        )}
      </div>

    </div>
  )
}
