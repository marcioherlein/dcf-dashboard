'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { fmt, fmtPct } from '@/lib/utils'

const BarChart = dynamic(
  () => import('recharts').then((m) => m.BarChart),
  { ssr: false }
)
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
)

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

interface Props {
  businessProfile: BusinessProfile
  historicalRevenues: number[]
  ticker: string
}

function marginColor(v: number | null): string {
  if (v === null) return 'text-gray-400'
  if (v > 0.20) return 'text-emerald-600'
  if (v > 0.05) return 'text-blue-600'
  if (v >= 0) return 'text-amber-600'
  return 'text-red-600'
}

export default function BusinessModel({ businessProfile, historicalRevenues, ticker }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { description, industry, country, employees, grossMargin, netMargin, fcfMargin } = businessProfile

  // Build bar chart data: revenues are Yahoo-ordered most-recent first → reverse for chart
  const currentYear = new Date().getFullYear()
  const chartData = [...historicalRevenues]
    .slice(0, 4)
    .reverse()
    .map((rev, i, arr) => ({
      year: String(currentYear - arr.length + i),
      revenue: Math.round(rev),
    }))

  const DESC_LIMIT = 280
  const shortDesc = description.length > DESC_LIMIT ? description.slice(0, DESC_LIMIT) + '…' : description

  const margins = [
    { label: 'Gross Margin', value: grossMargin },
    { label: 'Net Margin', value: netMargin },
    { label: 'FCF Margin', value: fcfMargin },
  ]

  const pills = [
    industry && { label: industry },
    country && { label: country },
    employees && { label: `${(employees / 1000).toFixed(0)}K employees` },
  ].filter(Boolean) as { label: string }[]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Business Model</h2>

      {/* Pills */}
      {pills.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pills.map((p) => (
            <span key={p.label} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
              {p.label}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {description ? (
        <div className="mb-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            {expanded ? description : shortDesc}
          </p>
          {description.length > DESC_LIMIT && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      ) : (
        <p className="mb-5 text-sm text-gray-400">No business description available for {ticker}.</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Margin metrics */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Profitability Margins</p>
          <div className="space-y-2">
            {margins.map((m) => (
              <div key={m.label} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
                <span className="text-xs text-gray-500">{m.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${marginColor(m.value)}`}>
                  {m.value !== null ? fmtPct(m.value) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue bar chart */}
        {chartData.length >= 2 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Revenue History ($M)</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`$${fmt(Number(v), 0)}M`, 'Revenue']}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
