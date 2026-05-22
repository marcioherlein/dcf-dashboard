'use client'
import { fmtPrice, fmtMultiple } from '@/lib/formatters'
import { MetricChip } from '@/components/ui/metric-chip'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StatementRow = Record<string, any>

interface StatementsData {
  ttm: { incomeStatement: StatementRow | null; balanceSheet: StatementRow | null; cashFlow?: StatementRow | null }
}

interface Props {
  price: number
  high52: number | null
  low52: number | null
  sector: string
  country: string
  currency: string
  marketCap?: number | null
  statementsData?: StatementsData | null
}

export default function AtAGlance({
  price, high52, low52, sector, country, currency, marketCap, statementsData,
}: Props) {
  const rangePosition = high52 && low52 && high52 > low52
    ? Math.max(0, Math.min(100, ((price - low52) / (high52 - low52)) * 100))
    : null

  // ── Key multiples from TTM statements ───────────────────────────────────────
  const ttmIS = statementsData?.ttm?.incomeStatement
  const ttmBS = statementsData?.ttm?.balanceSheet

  // P/E — use dilutedEPS average; dilutedEPS is already TTM-averaged in statements route
  const dilutedEPS = ttmIS?.dilutedEPS as number | null | undefined
  const pe         = (price > 0 && dilutedEPS != null && dilutedEPS > 0) ? price / dilutedEPS : null

  // EV/EBITDA — try EBITDA first, then compute from EBIT + D&A if missing
  const ebitdaRaw    = ttmIS?.EBITDA ?? ttmIS?.normalizedEBITDA
  const ebitComputed = ttmIS?.EBIT != null && ttmIS?.reconciledDepreciation != null
    ? (ttmIS.EBIT as number) + (ttmIS.reconciledDepreciation as number) : null
  const ebitda = (ebitdaRaw as number | null | undefined) ?? ebitComputed

  // Balance sheet fields — Yahoo fundamentalsTimeSeries uses camelCase with specific names
  const totalDebt = (ttmBS?.totalDebt ?? ttmBS?.longTermDebtAndCapitalLeaseObligation ?? ttmBS?.longTermDebt) as number | null | undefined
  const cashBS    = (ttmBS?.cashCashEquivalentsAndShortTermInvestments ?? ttmBS?.cashAndCashEquivalents) as number | null | undefined
  const ev        = (marketCap != null && totalDebt != null && cashBS != null)
    ? marketCap + totalDebt - cashBS
    : marketCap
  const evEbitda  = (ev != null && ebitda != null && ebitda > 0) ? ev / ebitda : null

  // P/S
  const revenue = ttmIS?.totalRevenue as number | null | undefined
  const ps      = (marketCap != null && marketCap > 0 && revenue != null && revenue > 0) ? marketCap / revenue : null

  // P/B — Yahoo time series uses commonStockEquity, NOT totalStockholdersEquity
  const equity = (
    ttmBS?.commonStockEquity
    ?? ttmBS?.totalEquityGrossMinorityInterest
    ?? ttmBS?.stockholdersEquity
    ?? ttmBS?.totalStockholdersEquity
  ) as number | null | undefined
  const pb = (marketCap != null && marketCap > 0 && equity != null && equity > 0) ? marketCap / equity : null

  const showMultiples = pe != null || evEbitda != null || ps != null || pb != null

  return (
    <div className="rounded-xl card p-5 space-y-4">
      {/* 52-week range */}
      {rangePosition != null && (
        <div>
          <div className="flex justify-between text-micro text-slate-500 mb-1.5">
            <span>52w Low {fmtPrice(low52, currency)}</span>
            <span>52w High {fmtPrice(high52, currency)}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-slate-200">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400/70 via-amber-400/70 to-emerald-500/80" />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-blue-600 shadow-sm"
              style={{ left: `calc(${rangePosition}% - 6px)` }}
            />
          </div>
        </div>
      )}

      {/* Sector / country pills */}
      <div className="flex gap-1.5 flex-wrap">
        {sector  && <span className="rounded-md bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 text-xs font-medium">{sector}</span>}
        {country && <span className="rounded-md bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 text-xs font-medium">{country}</span>}
      </div>

      {/* TTM Multiples */}
      {showMultiples && (
        <div className="pt-3 border-t border-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">TTM Multiples</p>
          <div className="flex flex-wrap gap-2">
            <MetricChip label="P/E"       value={fmtMultiple(pe)}       tooltip="Price-to-Earnings: how much you're paying for each dollar of profit. Lower = cheaper relative to earnings. Compare to sector peers for context." />
            <MetricChip label="EV/EBITDA" value={fmtMultiple(evEbitda)} tooltip="Enterprise Value to EBITDA: compares the company's total value (including debt) to its operating earnings. Useful for comparing companies with different debt levels." />
            <MetricChip label="P/S"       value={fmtMultiple(ps)}       tooltip="Price-to-Sales: how much you're paying per dollar of revenue. Useful when a company isn't yet profitable. Lower generally means cheaper." />
            <MetricChip label="P/B"       value={fmtMultiple(pb)}       tooltip="Price-to-Book: compares market price to the company's net assets. A P/B above 1 means you're paying a premium over accounting book value." />
          </div>
        </div>
      )}
    </div>
  )
}
