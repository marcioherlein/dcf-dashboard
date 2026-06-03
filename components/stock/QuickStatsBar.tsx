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
  evToEbitda?: number | null
  dividendYield?: number | null
  nextEarningsDate?: string | null
}

function fmt(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + 'M'
  return n.toLocaleString()
}

export default function QuickStatsBar({
  marketCap, peRatio, beta, high52, low52, currentPrice, currency,
  pegRatio, evToEbitda, dividendYield, nextEarningsDate,
}: QuickStatsBarProps) {
  const stats: Stat[] = []

  if (marketCap != null) {
    stats.push({ label: 'Market Cap', value: currency + fmt(marketCap) })
  }

  if (peRatio != null && peRatio > 0 && peRatio < 9999) {
    stats.push({ label: 'P/E (TTM)', value: peRatio.toFixed(1) + '×', sub: pegRatio != null ? `PEG ${pegRatio.toFixed(2)}` : undefined })
  } else {
    stats.push({ label: 'P/E (TTM)', value: '—' })
  }

  if (evToEbitda != null && evToEbitda > 0 && evToEbitda < 999) {
    stats.push({ label: 'EV/EBITDA', value: evToEbitda.toFixed(1) + '×' })
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

  if (dividendYield != null && dividendYield > 0) {
    stats.push({ label: 'Div. Yield', value: (dividendYield * 100).toFixed(2) + '%' })
  }

  // Earnings date — only show when within 45 days
  if (nextEarningsDate) {
    const d = new Date(nextEarningsDate)
    const daysUntil = Math.ceil((d.getTime() - Date.now()) / 86400000)
    if (daysUntil >= 0 && daysUntil <= 45) {
      const label = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil}d`
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      stats.push({ label: 'Next Earnings', value: label, sub: dateStr })
    }
  }

  if (stats.length === 0) return null

  // On mobile (2 cols): show first 4. On sm (4 cols): show first 4. On lg (up to 7 cols): show all.
  return (
    <div className="rounded-[16px] bg-white border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)] px-4 sm:px-5 py-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-3">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={i >= 4 ? 'hidden lg:block' : i >= 2 ? 'hidden sm:block' : undefined}
          >
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5 truncate">{stat.label}</p>
            <p className={`text-[13px] font-semibold tabular-nums leading-tight truncate ${stat.label === 'Next Earnings' ? 'text-amber-700' : 'text-slate-800'}`}>{stat.value}</p>
            {stat.sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{stat.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
