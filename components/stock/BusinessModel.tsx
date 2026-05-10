'use client'
import dynamic from 'next/dynamic'
import { fmt, fmtPct } from '@/lib/utils'
import { buildBusinessSummary } from '@/lib/simplifier/summaryBuilder'

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })

interface BusinessProfile {
  description: string
  industry: string
  country: string
  employees: number | null
  grossMargin: number | null
  netMargin: number | null
  fcfMargin: number | null
  revenueM: number
}

interface IncomeRow {
  year: string; revenue: number | null; grossProfit: number | null
  netIncome: number | null; isProjected: boolean
}
interface CashFlowRow {
  year: string; freeCashFlow: number | null; isProjected: boolean
}

interface Props {
  businessProfile: BusinessProfile
  historicalRevenues: number[]
  ticker: string
  isDark?: boolean
  incomeStatement?: IncomeRow[]
  cashFlow?: CashFlowRow[]
}

export default function BusinessModel({ businessProfile, historicalRevenues, ticker, isDark, incomeStatement, cashFlow }: Props) {
  const { description, industry, country, employees, netMargin, fcfMargin, revenueM } = businessProfile

  const currentYear = new Date().getFullYear()
  const chartData = [...historicalRevenues]
    .slice(0, 4)
    .reverse()
    .map((rev, i, arr) => ({
      year: String(currentYear - arr.length + i),
      revenue: Math.round(rev),
    }))

  const pills = [
    industry && { label: industry },
    country && { label: country },
    employees && { label: `${(employees / 1000).toFixed(0)}K employees` },
  ].filter(Boolean) as { label: string }[]

  const tickFill = isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af'
  const tooltipStyle = isDark
    ? { background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, color: '#fff' }
    : { borderRadius: 8, fontSize: 11 }

  // Margin trend data from financial statements (historical only)
  const marginTrendData = (incomeStatement ?? [])
    .filter((r) => !r.isProjected && r.revenue && r.revenue > 0)
    .map((r) => {
      const cfRow = (cashFlow ?? []).find((c) => c.year === r.year && !c.isProjected)
      return {
        year: r.year,
        gross: r.grossProfit && r.revenue ? Math.round(r.grossProfit / r.revenue * 1000) / 10 : null,
        net: r.netIncome && r.revenue ? Math.round(r.netIncome / r.revenue * 1000) / 10 : null,
        fcf: cfRow?.freeCashFlow && r.revenue ? Math.round(cfRow.freeCashFlow / r.revenue * 1000) / 10 : null,
      }
    })
    .filter((d) => d.gross !== null || d.net !== null)

  // Plain-English stat values
  const revenueB = revenueM >= 1000 ? `$${(revenueM / 1000).toFixed(1)}b` : `$${revenueM.toFixed(0)}m`
  const netMarginKeep = netMargin != null ? `$${(netMargin * 100).toFixed(0)} of every $100` : null
  const fcfB = fcfMargin != null && revenueM > 0
    ? (fcfMargin * revenueM >= 1000 ? `$${((fcfMargin * revenueM) / 1000).toFixed(1)}b` : `$${(fcfMargin * revenueM).toFixed(0)}m`)
    : null

  // Summary callout — build from available financials-like data
  const summaryCallout = buildBusinessSummary(ticker, {
    businessProfile,
    wacc: null,
    cagrAnalysis: null,
    scores: null,
  } as any)

  const statCards = [
    {
      label: 'Annual Revenue',
      value: revenueB,
      sub: 'Last reported year',
      color: 'bg-blue-50 border-blue-100',
    },
    {
      label: 'Profit Margin',
      value: netMarginKeep ?? (netMargin != null ? fmtPct(netMargin) : '—'),
      sub: netMarginKeep ? 'Net income per $100 revenue' : 'Net margin',
      color: netMargin != null && netMargin > 0.10 ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100',
    },
    {
      label: 'Free Cash Flow',
      value: fcfB ?? (fcfMargin != null ? fmtPct(fcfMargin) : '—'),
      sub: fcfB ? 'Generated per year (est.)' : 'FCF margin',
      color: fcfMargin != null && fcfMargin > 0.10 ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100',
    },
  ]

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-6">
      <h2 className="text-base font-semibold text-slate-900 mb-4">The Business</h2>

      {/* Context pills */}
      {pills.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pills.map((p) => (
            <span key={p.label} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {p.label}
            </span>
          ))}
        </div>
      )}

      {/* Full description */}
      {description ? (
        <p className="text-sm text-slate-600 leading-relaxed mb-6">{description}</p>
      ) : (
        <p className="text-sm text-slate-400 mb-6">No business description available for {ticker}.</p>
      )}

      {/* Plain-English stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-xl border px-4 py-3 ${card.color}`}>
            <p className="text-xs text-slate-500 mb-1">{card.label}</p>
            <p className="text-lg font-bold text-slate-900">{card.value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Summary callout */}
      {summaryCallout && summaryCallout !== 'Insufficient data to generate a business quality summary.' && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 mb-5">
          <p className="text-xs text-blue-700 leading-relaxed">{summaryCallout}</p>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {chartData.length >= 2 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Revenue History ($M)</p>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={chartData} margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`$${fmt(Number(v), 0)}M`, 'Revenue']}
                  contentStyle={tooltipStyle}
                  wrapperStyle={{ zIndex: 50 }}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {marginTrendData.length >= 2 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Margin Trends (%)</p>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={marginTrendData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [
                    typeof v === 'number' ? `${v.toFixed(1)}%` : v,
                    name === 'gross' ? 'Gross Margin' : name === 'net' ? 'Net Margin' : 'FCF Margin',
                  ]}
                  contentStyle={tooltipStyle}
                  wrapperStyle={{ zIndex: 50 }}
                />
                <Legend
                  formatter={(v) => v === 'gross' ? 'Gross' : v === 'net' ? 'Net' : 'FCF'}
                  wrapperStyle={{ fontSize: '10px', color: tickFill }}
                />
                <Line type="monotone" dataKey="gross" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="fcf" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
