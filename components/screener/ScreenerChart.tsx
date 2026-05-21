'use client'
import MultiTickerChart from '@/components/charts/MultiTickerChart'

interface Props {
  ticker: string
  displayTicker: string
  name: string
  price: number
  change1DPct: number
  currency: string
  onClose: () => void
}

export default function ScreenerChart({ ticker, displayTicker, name, price, change1DPct, currency, onClose }: Props) {
  const isUp = change1DPct >= 0
  const accentColor = isUp ? '#059669' : '#DC2626'

  const fmtPrice = (v: number) => {
    if (currency === 'ARS') return v >= 1000 ? v.toFixed(0) : v.toFixed(2)
    return `$${v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2)}`
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" />

      {/* Panel */}
      <div
        className="w-[520px] bg-[#080F1E] border-l border-white/10 flex flex-col h-full overflow-y-auto shadow-card-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-slate-100">{displayTicker}</span>
              <span className="text-sm font-semibold" style={{ color: accentColor }}>
                {isUp ? '+' : ''}{change1DPct.toFixed(2)}%
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[360px]">{name}</div>
            <div className="text-xl font-bold text-slate-100 mt-1">{fmtPrice(price)}</div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors mt-0.5 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Chart */}
        <div className="px-3 py-4 flex-1">
          <MultiTickerChart
            initialTickers={[ticker]}
            defaultPeriod="3m"
            height={340}
            showMetricSelect={true}
            isDark={true}
            className="border-0 shadow-none !rounded-none"
          />
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-3 border-t border-white/10">
          <a
            href={`/stock/${ticker}`}
            className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Open Full Analysis →
          </a>
        </div>
      </div>
    </div>
  )
}
