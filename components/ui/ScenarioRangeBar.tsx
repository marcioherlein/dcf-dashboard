'use client'

interface ScenarioRangeBarProps {
  bear: number | null
  base: number | null
  bull: number | null
  currentPrice: number
  currency: string
  label?: string
}

function fmtShort(v: number, currency: string): string {
  const sym = currency === 'USD' ? '$' : currency
  return v >= 1000 ? `${sym}${(v / 1000).toFixed(1)}k` : `${sym}${v.toFixed(0)}`
}

export default function ScenarioRangeBar({
  bear, base, bull, currentPrice, currency, label = 'Scenario range',
}: ScenarioRangeBarProps) {
  if (bear == null || base == null || bull == null) return null

  const lo = Math.min(bear, currentPrice) * 0.93
  const hi = Math.max(bull, currentPrice) * 1.05
  const span = hi - lo || 1
  const toPos = (v: number) => Math.max(1, Math.min(99, ((v - lo) / span) * 100))

  const bearP  = toPos(bear)
  const baseP  = toPos(base)
  const bullP  = toPos(bull)
  const priceP = toPos(currentPrice)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-[600] text-slate-500">{label}</p>

      <div className="relative h-2 bg-slate-100 rounded-full mx-1" aria-hidden="true">
        {/* Range fill bear → bull */}
        <div
          className="absolute top-0 h-full bg-blue-100 rounded-full"
          style={{ left: `${bearP}%`, width: `${bullP - bearP}%` }}
        />
        {/* Bear */}
        <div
          className="absolute w-1.5 h-1.5 rounded-full bg-red-400 top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${bearP}%` }}
        />
        {/* Base / blended */}
        <div
          className="absolute w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${baseP}%` }}
        />
        {/* Bull */}
        <div
          className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${bullP}%` }}
        />
        {/* Price tick */}
        <div
          className="absolute w-0.5 h-4 bg-slate-500 top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${priceP}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
        <span className="text-red-400 font-[600]">{fmtShort(bear, currency)}</span>
        <span className="text-blue-600 font-[700]">{fmtShort(base, currency)}</span>
        <span className="text-emerald-500 font-[600]">{fmtShort(bull, currency)}</span>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-slate-500 px-1">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
          <span>Bear</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>Base</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Bull</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-slate-500" />
          <span>Price</span>
        </div>
      </div>
    </div>
  )
}
