'use client'

interface Stat {
  label: string
  value: string
  sub?: string
}

interface QuickStatsBarProps {
  marketCap: number | null
  peRatio: number | null
  beta: number | null
  high52: number | null
  low52: number | null
  currentPrice: number | null
  currency: string
  pegRatio?: number | null
}

function fmt(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M'
  return n.toLocaleString()
}

export default function QuickStatsBar({
  marketCap, peRatio, beta, high52, low52, currentPrice, currency, pegRatio,
}: QuickStatsBarProps) {
  const stats: Stat[] = []

  if (marketCap != null) {
    stats.push({ label: 'Market Cap', value: currency + fmt(marketCap) })
  }

  if (peRatio != null && peRatio > 0 && peRatio < 9999) {
    stats.push({ label: 'P/E (TTM)', value: peRatio.toFixed(1), sub: pegRatio != null ? `PEG ${pegRatio.toFixed(2)}` : undefined })
  } else {
    stats.push({ label: 'P/E (TTM)', value: '—' })
  }

  if (beta != null) {
    stats.push({ label: 'Beta', value: beta.toFixed(2) })
  }

  if (high52 != null && low52 != null) {
    const pct = currentPrice != null && high52 > low52
      ? ((currentPrice - low52) / (high52 - low52)) * 100
      : null
    stats.push({
      label: '52W Range',
      value: `${currency}${low52.toFixed(2)} – ${currency}${high52.toFixed(2)}`,
      sub: pct != null ? `${pct.toFixed(0)}% from low` : undefined,
    })
  }

  if (stats.length === 0) return null

  return (
    <div className="rounded-[16px] bg-white border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)] px-4 sm:px-5 py-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
        {stats.map(stat => (
          <div key={stat.label} className="min-w-0">
            <p className="text-[11px] font-[600] text-slate-400 uppercase tracking-wide mb-0.5 truncate">{stat.label}</p>
            <p className="text-[13px] font-[650] text-slate-800 tabular-nums leading-tight truncate">{stat.value}</p>
            {stat.sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{stat.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
