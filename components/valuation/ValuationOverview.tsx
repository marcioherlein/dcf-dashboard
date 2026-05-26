'use client'

interface Props {
  ticker: string
  currentPrice: number | null
  changePct: number | null
  currency: string
  weightedFairValue: number | null
}

function fmt(n: number, currency: string): string {
  return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getVerdict(upsidePct: number): { label: string; bg: string; text: string } {
  if (upsidePct >= 0.15) return { label: 'Attractive', bg: 'bg-emerald-50', text: 'text-emerald-700' }
  if (upsidePct >= -0.1) return { label: 'Fair Value', bg: 'bg-amber-50', text: 'text-amber-700' }
  return { label: 'Expensive', bg: 'bg-red-50', text: 'text-red-700' }
}

export default function ValuationOverview({ ticker, currentPrice, changePct, currency, weightedFairValue }: Props) {
  const upsidePct = (weightedFairValue != null && currentPrice != null && currentPrice > 0)
    ? (weightedFairValue - currentPrice) / currentPrice
    : null

  const verdict = upsidePct != null ? getVerdict(upsidePct) : null

  const changePositive = changePct != null && changePct >= 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Current Price */}
      <div className="rounded-2xl border border-slate-100 bg-white/80 px-5 py-4 space-y-1">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Current Price</p>
        <p className="text-[22px] font-bold text-slate-900 leading-none tabular-nums">
          {currentPrice != null ? fmt(currentPrice, currency) : '—'}
        </p>
        {changePct != null && (
          <p className={`text-[12px] font-semibold ${changePositive ? 'text-emerald-600' : 'text-red-500'}`}>
            {changePositive ? '+' : ''}{changePct.toFixed(2)}% today
          </p>
        )}
      </div>

      {/* Blended Fair Value */}
      <div className="rounded-2xl border border-slate-100 bg-white/80 px-5 py-4 space-y-1">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Blended Fair Value</p>
        {weightedFairValue != null ? (
          <p className="text-[22px] font-bold text-slate-900 leading-none tabular-nums">
            {fmt(weightedFairValue, currency)}
          </p>
        ) : (
          <div className="h-[28px] w-24 bg-slate-100 rounded animate-pulse" />
        )}
        <p className="text-[11px] text-slate-400">Weighted model estimate</p>
      </div>

      {/* Upside / Downside */}
      <div className="rounded-2xl border border-slate-100 bg-white/80 px-5 py-4 space-y-1">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Upside / Downside</p>
        {upsidePct != null ? (
          <p className={`text-[22px] font-bold leading-none tabular-nums ${upsidePct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
          </p>
        ) : (
          <div className="h-[28px] w-16 bg-slate-100 rounded animate-pulse" />
        )}
        <p className="text-[11px] text-slate-400">vs. current price</p>
      </div>

      {/* Investment Verdict */}
      <div className="rounded-2xl border border-slate-100 bg-white/80 px-5 py-4 space-y-1">
        <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Investment Verdict</p>
        {verdict != null ? (
          <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[14px] font-bold ${verdict.bg} ${verdict.text}`}>
            {verdict.label}
          </div>
        ) : (
          <div className="h-[28px] w-20 bg-slate-100 rounded animate-pulse" />
        )}
        <p className="text-[11px] text-slate-400">{ticker} vs. intrinsic value</p>
      </div>
    </div>
  )
}
