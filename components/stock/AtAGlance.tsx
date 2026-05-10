'use client'
import { buildAtAGlanceSummary } from '@/lib/simplifier/summaryBuilder'

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
  overallGrade: string
  overallLabel: string
}

function ZoneBadge({ upsidePct }: { upsidePct: number | null }) {
  if (upsidePct == null) return null
  if (upsidePct >= 0.25)  return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-3 py-0.5 text-xs font-semibold">Attractive</span>
  if (upsidePct >= 0.05)  return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 px-3 py-0.5 text-xs font-semibold">Fair Value</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-3 py-0.5 text-xs font-semibold">Expensive</span>
}

function GradeBadge({ grade, label }: { grade: string; label: string }) {
  const color =
    grade.startsWith('A') ? 'text-green-700 bg-green-50 border-green-200' :
    grade.startsWith('B') ? 'text-blue-700 bg-blue-50 border-blue-200' :
    grade.startsWith('C') ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-red-700 bg-red-50 border-red-200'

  return (
    <div className={`inline-flex flex-col items-center rounded-xl border px-5 py-3 ${color}`}>
      <span className="text-3xl font-black leading-none">{grade}</span>
      <span className="text-xs font-medium mt-0.5">{label}</span>
    </div>
  )
}

export default function AtAGlance({
  companyName, price, high52, low52,
  sector, country, currency, fairValue, upsidePct,
  overallGrade, overallLabel,
}: Props) {
  const zone = upsidePct == null ? '' : upsidePct >= 0.25 ? 'Attractive' : upsidePct >= 0.05 ? 'Fair Value' : 'Expensive'
  const summary = buildAtAGlanceSummary({ companyName, sector, upsidePct, upsideZone: zone, fairValue, currentPrice: price })

  const upPct = upsidePct != null ? (upsidePct * 100).toFixed(1) : null
  const upColor = upsidePct == null ? 'text-slate-500' : upsidePct >= 0.05 ? 'text-green-600' : 'text-red-600'
  const upSign  = upsidePct != null && upsidePct >= 0 ? '+' : ''

  const rangePosition = high52 && low52 && high52 > low52
    ? Math.max(0, Math.min(100, ((price - low52) / (high52 - low52)) * 100))
    : null

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

        {/* Left: price + range */}
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Current Price</p>
            <p className="text-3xl font-bold text-slate-900">{currency}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          {rangePosition != null && (
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>52w Low {currency}{low52!.toFixed(0)}</span>
                <span>52w High {currency}{high52!.toFixed(0)}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-slate-100">
                <div
                  className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-green-400"
                  style={{ width: `${rangePosition}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-blue-500 shadow"
                  style={{ left: `calc(${rangePosition}% - 6px)` }}
                />
              </div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <span className="rounded-md bg-slate-100 text-slate-600 px-2.5 py-1 text-xs font-medium">{sector || 'N/A'}</span>
            <span className="rounded-md bg-slate-100 text-slate-600 px-2.5 py-1 text-xs font-medium">{country || 'N/A'}</span>
          </div>
        </div>

        {/* Center: fair value */}
        <div className="space-y-2 sm:text-center sm:border-x sm:border-slate-100 sm:px-6">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Fair Value Estimate</p>
          {fairValue != null ? (
            <>
              <p className="text-3xl font-bold text-slate-900">{currency}{fairValue.toFixed(2)}</p>
              <div className="flex items-center gap-2 sm:justify-center">
                <span className={`text-lg font-bold ${upColor}`}>{upSign}{upPct}%</span>
                <ZoneBadge upsidePct={upsidePct} />
              </div>
            </>
          ) : (
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          )}
          <p className="text-[11px] text-slate-400 leading-snug">{summary}</p>
        </div>

        {/* Right: health grade */}
        <div className="space-y-2 sm:text-right flex flex-col sm:items-end">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Financial Health</p>
          <GradeBadge grade={overallGrade} label={overallLabel} />
          <p className="text-[11px] text-slate-400 max-w-[180px]">
            Overall score across profitability, liquidity, growth, moat, and valuation.
          </p>
        </div>
      </div>
    </div>
  )
}
