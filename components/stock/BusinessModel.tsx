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
  isDark?: boolean
}

function marginColor(v: number | null): string {
  if (v === null) return 'text-gray-400 dark:text-white/25'
  if (v > 0.20) return 'text-emerald-600 dark:text-emerald-400'
  if (v > 0.05) return 'text-blue-600 dark:text-blue-400'
  if (v >= 0) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default function BusinessModel({ businessProfile, historicalRevenues, ticker, isDark }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { description, industry, country, employees, grossMargin, netMargin, fcfMargin } = businessProfile

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

  const tickFill = isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af'
  const tooltipStyle = isDark
    ? { background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, color: '#fff' }
    : { borderRadius: 8, fontSize: 11 }

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70 mb-4">Business Model</h2>

      {pills.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pills.map((p) => (
            <span key={p.label} className="rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-1 text-xs font-medium text-gray-600 dark:text-white/50">
              {p.label}
            </span>
          ))}
        </div>
      )}

      {description ? (
        <div className="mb-5">
          <p className="text-sm text-gray-600 dark:text-white/50 leading-relaxed">
            {expanded ? description : shortDesc}
          </p>
          {description.length > DESC_LIMIT && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      ) : (
        <p className="mb-5 text-sm text-gray-400 dark:text-white/25">No business description available for {ticker}.</p>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/25">Profitability Margins</p>
          <div className="space-y-2">
            {margins.map((m) => (
              <div key={m.label} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-2.5">
                <span className="text-xs text-gray-500 dark:text-white/40">{m.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${marginColor(m.value)}`}>
                  {m.value !== null ? fmtPct(m.value) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {chartData.length >= 2 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/25">Revenue History ($M)</p>
            <div className="overflow-visible">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={chartData} margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => [`$${fmt(Number(v), 0)}M`, 'Revenue']}
                    contentStyle={tooltipStyle}
                    wrapperStyle={{ zIndex: 50 }}
                  />
                  <Bar dataKey="revenue" fill={isDark ? '#818cf8' : '#6366f1'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
