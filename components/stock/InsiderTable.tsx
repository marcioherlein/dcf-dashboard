'use client'
import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { fmtLarge } from '@/lib/utils'

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false })

interface Transaction {
  filerName: string; transactionText: string; shares: number
  value?: number; startDate?: string; filerRelation?: string
}

const isBuy = (t: Transaction) => /purchase|buy/i.test(t.transactionText ?? '')

export default function InsiderTable({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/insiders?ticker=${ticker}`)
      .then((r) => r.json())
      .then((d) => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  // Aggregate transactions by month for bar chart
  const chartData = useMemo(() => {
    const monthly: Record<string, { month: string; buy: number; sell: number }> = {}
    for (const t of data) {
      const month = t.startDate?.slice(0, 7) ?? 'Unknown'
      if (!monthly[month]) monthly[month] = { month, buy: 0, sell: 0 }
      const v = Math.abs(t.value ?? 0)
      if (isBuy(t)) monthly[month].buy += v
      else monthly[month].sell += v
    }
    return Object.values(monthly)
      .filter((d) => d.month !== 'Unknown')
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)
      .map((d) => ({
        ...d,
        buy: Math.round(d.buy / 1e6 * 10) / 10,
        sell: Math.round(d.sell / 1e6 * 10) / 10,
        label: d.month.slice(2),   // "YYYY-MM" → "YY-MM"
      }))
  }, [data])

  const hasBuys = chartData.some((d) => d.buy > 0)
  const hasSells = chartData.some((d) => d.sell > 0)
  const showChart = chartData.length >= 2 && (hasBuys || hasSells)

  const tooltipStyle = {
    background: 'rgba(15,15,15,0.9)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '11px',
    color: '#fff',
  }

  return (
    <div className="rounded-xl bg-surface-container-lowest dark:bg-[#111] shadow-card border border-outline-variant/10 dark:border-white/8 p-6">
      <h2 className="mb-4 text-sm font-headline font-semibold text-on-surface dark:text-white/70">Insider Transactions</h2>

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-white/25">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-white/25">No insider transactions available.</p>
      ) : (
        <>
          {/* Buy / Sell Activity Chart */}
          {showChart && (
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/25">Activity ($M) — Last 12 Months</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }} barCategoryGap="30%">
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [typeof v === 'number' ? `$${v.toFixed(1)}M` : v, name === 'buy' ? 'Buys' : 'Sells']}
                    contentStyle={tooltipStyle}
                    wrapperStyle={{ zIndex: 50 }}
                  />
                  <Legend
                    formatter={(v) => v === 'buy' ? 'Buys' : 'Sells'}
                    wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }}
                  />
                  {hasBuys && <Bar dataKey="buy" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={18} />}
                  {hasSells && <Bar dataKey="sell" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={18} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Transactions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/15 dark:border-white/8">
                  {['Name', 'Relation', 'Transaction', 'Shares', 'Value', 'Date'].map((h, i) => (
                    <th key={h} className={`pb-2 text-xs font-medium text-gray-400 dark:text-white/25 ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((t, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-white/5">
                    <td className="py-2 font-medium text-gray-800 dark:text-white/70">{t.filerName}</td>
                    <td className="py-2 text-xs text-gray-400 dark:text-white/25">{t.filerRelation ?? '—'}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isBuy(t) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                        {t.transactionText ?? '—'}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-600 dark:text-white/50">{t.shares?.toLocaleString() ?? '—'}</td>
                    <td className="py-2 text-right text-gray-600 dark:text-white/50">{t.value ? fmtLarge(t.value) : '—'}</td>
                    <td className="py-2 text-right text-xs text-gray-400 dark:text-white/25">
                      {t.startDate ? new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
