'use client'

// ─── helpers ──────────────────────────────────────────────────────────────────

function currSym(c: string): string {
  if (c === 'USD') return '$'
  if (c === 'EUR') return '€'
  if (c === 'GBP') return '£'
  if (c === 'JPY') return '¥'
  if (c === 'CNY') return '¥'
  return c + ' '
}

function fmtDollars(v: number, sym: string): string {
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}T`
  if (abs >= 1e9)  return `${sym}${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `${sym}${(v / 1e6).toFixed(0)}M`
  return `${sym}${Math.round(v / 1e3)}K`
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
}

// ─── types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface FinancialSnapshotBarProps {
  statementsData: AnyRecord | null
  currency?: string
  currentPrice?: number | null
}

// ─── component ────────────────────────────────────────────────────────────────

export default function FinancialSnapshotBar({ statementsData, currency = 'USD', currentPrice }: FinancialSnapshotBarProps) {
  const sym = currSym(statementsData?.financialCurrency ?? currency)

  const ttm: AnyRecord | null = statementsData?.ttm?.incomeStatement ?? null
  const ttmCF: AnyRecord | null = statementsData?.ttm?.cashFlow ?? null
  const annualIS: AnyRecord[] = statementsData?.annual?.incomeStatement ?? []

  // Most recent actual annual for YoY comparison
  const lastActual = [...annualIS]
    .filter(r => r.totalRevenue != null && (r.totalRevenue as number) > 0)
    .pop()

  const ttmRev = ttm?.totalRevenue as number | null
  const ttmNI  = ttm?.netIncome as number | null
  const ttmFCF = ttmCF?.freeCashFlow as number | null
  const ttmMC  = ttmCF?.capitalExpenditure as number | null  // capex (usually negative)

  const prevRev = lastActual?.totalRevenue as number | null
  const prevNI  = lastActual?.netIncome as number | null

  // Compute FCF yield = (TTM FCF / Market Cap) when price and shares not directly available
  // We use FCF / revenue as a proxy metric (FCF margin) instead of FCF yield
  const fcfMargin = ttmRev && ttmRev > 0 && ttmFCF != null
    ? ttmFCF / ttmRev : null

  const revYoY = ttmRev && prevRev && prevRev > 0
    ? (ttmRev - prevRev) / prevRev : null
  const niYoY  = ttmNI != null && prevNI != null && Math.abs(prevNI) > 0
    ? (ttmNI - prevNI) / Math.abs(prevNI) : null

  // Gross margin from TTM
  const ttmGP = ttm?.grossProfit as number | null
  const grossMargin = ttmRev && ttmRev > 0 && ttmGP != null
    ? ttmGP / ttmRev : null

  // Capex as % of revenue (capital intensity)
  const capexPct = ttmRev && ttmRev > 0 && ttmMC != null && ttmMC !== 0
    ? Math.abs(ttmMC) / ttmRev : null

  // Nothing to show
  if (!ttmRev && !ttmNI) return null

  const stats: Array<{
    label: string
    value: string
    badge?: string
    badgePos?: boolean
  }> = []

  if (ttmRev != null) {
    stats.push({
      label: 'Revenue (TTM)',
      value: fmtDollars(ttmRev, sym),
      badge: revYoY != null ? fmtPct(revYoY) : undefined,
      badgePos: revYoY != null ? revYoY >= 0 : undefined,
    })
  }
  if (ttmNI != null) {
    stats.push({
      label: 'Net Income (TTM)',
      value: fmtDollars(ttmNI, sym),
      badge: niYoY != null ? fmtPct(niYoY) : undefined,
      badgePos: niYoY != null ? niYoY >= 0 : undefined,
    })
  }
  if (grossMargin != null) {
    stats.push({
      label: 'Gross Margin',
      value: `${(grossMargin * 100).toFixed(1)}%`,
    })
  }
  if (fcfMargin != null) {
    stats.push({
      label: 'FCF Margin',
      value: `${(fcfMargin * 100).toFixed(1)}%`,
      badgePos: fcfMargin >= 0,
    })
  }

  if (stats.length === 0) return null

  void currentPrice
  void capexPct

  return (
    <div className="rounded-[16px] bg-white border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.06)] px-4 sm:px-5 py-3">
      <div className={`grid gap-x-4 gap-y-2.5 ${stats.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5 truncate">
              {stat.label}
            </p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-[13px] font-bold tabular-nums text-slate-800 leading-tight">{stat.value}</span>
              {stat.badge && (
                <span className={`text-[10px] font-semibold tabular-nums ${stat.badgePos ? 'text-emerald-600' : 'text-red-500'}`}>
                  {stat.badge}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
