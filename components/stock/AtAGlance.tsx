'use client'
import { buildAtAGlanceSummary } from '@/lib/simplifier/summaryBuilder'
import { fmtPrice, fmtMultiple, upsideZone, zoneBadgeClass } from '@/lib/formatters'
import { MetricChip } from '@/components/ui/metric-chip'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StatementRow = Record<string, any>

interface StatementsData {
  ttm: { incomeStatement: StatementRow | null; balanceSheet: StatementRow | null; cashFlow?: StatementRow | null }
}

interface Props {
  companyName: string
  price: number
  high52: number | null
  low52: number | null
  sector: string
  country: string
  currency: string
  fairValue: number | null
  upsidePct: number | null
  marketCap?: number | null
  statementsData?: StatementsData | null
}

export default function AtAGlance({
  companyName, price, high52, low52,
  sector, country, currency, fairValue, upsidePct,
  marketCap, statementsData,
}: Props) {
  const zone    = upsideZone(upsidePct)
  const summary = buildAtAGlanceSummary({ companyName, sector, upsidePct, upsideZone: zone ?? '', fairValue, currentPrice: price })
  const upPct   = upsidePct != null ? (upsidePct * 100).toFixed(1) : null
  const upColor = upsidePct == null ? 'text-slate-400' : upsidePct >= 0.05 ? 'text-emerald-600' : 'text-red-600'
  const upSign  = upsidePct != null && upsidePct >= 0 ? '+' : ''

  const rangePosition = high52 && low52 && high52 > low52
    ? Math.max(0, Math.min(100, ((price - low52) / (high52 - low52)) * 100))
    : null

  // ── Key multiples from TTM statements ───────────────────────────────────────
  const ttmIS = statementsData?.ttm?.incomeStatement
  const ttmBS = statementsData?.ttm?.balanceSheet

  const dilutedEPS = ttmIS?.dilutedEPS as number | null | undefined
  const pe         = (price > 0 && dilutedEPS != null && dilutedEPS > 0) ? price / dilutedEPS : null

  const ebitda    = ttmIS?.EBITDA as number | null | undefined
  const totalDebt = ttmBS?.totalDebt as number | null | undefined
  const cashBS    = (ttmBS?.cashCashEquivalentsAndShortTermInvestments ?? ttmBS?.cash) as number | null | undefined
  const ev        = (marketCap != null && totalDebt != null && cashBS != null) ? marketCap + totalDebt - cashBS : marketCap
  const evEbitda  = (ev != null && ebitda != null && ebitda > 0) ? ev / ebitda : null

  const revenue = ttmIS?.totalRevenue as number | null | undefined
  const ps      = (marketCap != null && marketCap > 0 && revenue != null && revenue > 0) ? marketCap / revenue : null

  const equity = ttmBS?.totalStockholdersEquity as number | null | undefined
  const pb     = (marketCap != null && marketCap > 0 && equity != null && equity > 0) ? marketCap / equity : null

  const showMultiples = pe != null || evEbitda != null || ps != null || pb != null

  const currSymbol = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '

  return (
    <div className="rounded-xl bg-white border border-slate-200 shadow-card p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        {/* Left: price + range */}
        <div className="space-y-3">
          <div>
            <p className="text-label uppercase tracking-wider text-slate-400 mb-1">Current Price</p>
            <p className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
              {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          {rangePosition != null && (
            <div>
              <div className="flex justify-between text-micro text-slate-400 mb-1.5">
                <span>52w Low {fmtPrice(low52, currency)}</span>
                <span>52w High {fmtPrice(high52, currency)}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-slate-100">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-300 via-amber-300 to-emerald-400" />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-blue-500 shadow-sm"
                  style={{ left: `calc(${rangePosition}% - 6px)` }}
                />
              </div>
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap">
            {sector  && <span className="rounded-md bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-medium">{sector}</span>}
            {country && <span className="rounded-md bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-medium">{country}</span>}
          </div>
        </div>

        {/* Right: fair value */}
        <div className="space-y-2 sm:text-right sm:border-l sm:border-slate-100 sm:pl-5">
          <p className="text-label uppercase tracking-wider text-slate-400">Weighted Fair Value Estimate</p>
          {fairValue != null ? (
            <>
              <p className="text-3xl font-bold font-mono tabular-nums text-slate-900">
                {fmtPrice(fairValue, currency)}
              </p>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className={cn('text-lg font-bold font-mono', upColor)}>
                  {upSign}{upPct}%
                </span>
                {zone && (
                  <span className={cn('rounded-full border px-3 py-0.5 text-xs font-semibold', zoneBadgeClass(zone))}>
                    {zone}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="h-9 rounded-lg bg-slate-100 animate-pulse" />
              <div className="h-5 w-24 sm:ml-auto rounded-full bg-slate-100 animate-pulse" />
            </div>
          )}
          <p className="text-xs text-slate-400 leading-relaxed">{summary}</p>
        </div>
      </div>

      {/* Key multiples row */}
      {showMultiples && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-label uppercase tracking-wider text-slate-400 mb-2.5">TTM Multiples</p>
          <div className="flex flex-wrap gap-2">
            <MetricChip label="P/E"       value={fmtMultiple(pe)} />
            <MetricChip label="EV/EBITDA" value={fmtMultiple(evEbitda)} />
            <MetricChip label="P/S"       value={fmtMultiple(ps)} />
            <MetricChip label="P/B"       value={fmtMultiple(pb)} />
          </div>
        </div>
      )}
    </div>
  )
}
