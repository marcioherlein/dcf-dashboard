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
  if (upsidePct >= 0.15) return { label: 'Attractive', bg: 'bg-[#E8F7EF]', text: 'text-[#11875D]' }
  if (upsidePct >= -0.1) return { label: 'Fair Value', bg: 'bg-[#FFF4DA]', text: 'text-[#B56A00]' }
  return { label: 'Expensive', bg: 'bg-[#FCEAEA]', text: 'text-[#D83B3B]' }
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
      <div className="rounded-2xl border border-[#E3E1DA] bg-white/80 px-5 py-4 space-y-1">
        <p className="text-[11px] font-medium text-[#8A95A6] uppercase tracking-wide">Current Price</p>
        <p className="text-[22px] font-bold text-[#06101F] leading-none tabular-nums">
          {currentPrice != null ? fmt(currentPrice, currency) : '—'}
        </p>
        {changePct != null && (
          <p className={`text-[12px] font-semibold ${changePositive ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
            {changePositive ? '+' : ''}{changePct.toFixed(2)}% today
          </p>
        )}
      </div>

      {/* Blended Fair Value */}
      <div className="rounded-2xl border border-[#E3E1DA] bg-white/80 px-5 py-4 space-y-1">
        <p className="text-[11px] font-medium text-[#8A95A6] uppercase tracking-wide">Blended Fair Value</p>
        {weightedFairValue != null ? (
          <p className="text-[22px] font-bold text-[#06101F] leading-none tabular-nums">
            {fmt(weightedFairValue, currency)}
          </p>
        ) : (
          <div className="h-[28px] w-24 bg-[#F0F1F6] rounded animate-pulse" />
        )}
        <p className="text-[11px] text-[#8A95A6]">Weighted model estimate</p>
      </div>

      {/* Upside / Downside */}
      <div className="rounded-2xl border border-[#E3E1DA] bg-white/80 px-5 py-4 space-y-1">
        <p className="text-[11px] font-medium text-[#8A95A6] uppercase tracking-wide">Upside / Downside</p>
        {upsidePct != null ? (
          <p className={`text-[22px] font-bold leading-none tabular-nums ${upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
            {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
          </p>
        ) : (
          <div className="h-[28px] w-16 bg-[#F0F1F6] rounded animate-pulse" />
        )}
        <p className="text-[11px] text-[#8A95A6]">vs. current price</p>
      </div>

      {/* Investment Verdict */}
      <div className="rounded-2xl border border-[#E3E1DA] bg-white/80 px-5 py-4 space-y-1">
        <p className="text-[11px] font-medium text-[#8A95A6] uppercase tracking-wide">Investment Verdict</p>
        {verdict != null ? (
          <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[14px] font-bold ${verdict.bg} ${verdict.text}`}>
            {verdict.label}
          </div>
        ) : (
          <div className="h-[28px] w-20 bg-[#F0F1F6] rounded animate-pulse" />
        )}
        <p className="text-[11px] text-[#8A95A6]">{ticker} vs. intrinsic value</p>
      </div>
    </div>
  )
}
