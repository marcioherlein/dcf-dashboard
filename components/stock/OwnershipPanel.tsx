'use client'
import dynamic from 'next/dynamic'

const PieChart = dynamic(() => import('recharts').then((m) => m.PieChart), { ssr: false })
const Pie = dynamic(() => import('recharts').then((m) => m.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })

interface Props {
  ownership: {
    insiderPct: number | null
    institutionalPct: number | null
    shortPct: number | null
    shortRatio: number | null
    sharesShort: number | null
  }
}

const fmtPct = (n: number | null, decimals = 1) =>
  n == null ? 'N/A' : `${(n * 100).toFixed(decimals)}%`

const fmtShares = (n: number | null) => {
  if (n == null) return 'N/A'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  return n.toLocaleString()
}

export default function OwnershipPanel({ ownership }: Props) {
  const { insiderPct, institutionalPct, shortPct, shortRatio, sharesShort } = ownership

  const hasOwnershipData = insiderPct != null || institutionalPct != null

  const insider = insiderPct ?? 0
  const institutional = institutionalPct ?? 0
  const retail = Math.max(0, 1 - insider - institutional)

  const donutData = [
    { name: 'Institutional', value: Math.round(institutional * 1000) / 10, color: '#6366f1' },
    { name: 'Insider', value: Math.round(insider * 1000) / 10, color: '#f59e0b' },
    { name: 'Retail / Float', value: Math.round(retail * 1000) / 10, color: '#d1d5db' },
  ].filter((d) => d.value > 0)

  const shortLevel = shortPct == null ? 'neutral' : shortPct > 0.10 ? 'high' : shortPct > 0.05 ? 'medium' : 'low'
  const shortBarColor = shortLevel === 'high' ? 'bg-red-500' : shortLevel === 'medium' ? 'bg-amber-500' : 'bg-gray-400 dark:bg-white/20'
  const shortTextColor = shortLevel === 'high' ? 'text-red-600 dark:text-red-400' : shortLevel === 'medium' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-white/40'

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-white/70">Ownership &amp; Short Interest</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

        {/* ── Ownership Donut ── */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/25">Shareholder Breakdown</p>

          {hasOwnershipData ? (
            <div className="flex items-center gap-4">
              <div className="h-[120px] w-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={56}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [typeof v === 'number' ? `${v.toFixed(1)}%` : v]}
                      contentStyle={{
                        background: 'rgba(15,15,15,0.9)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1 space-y-2">
                {[
                  { label: 'Institutional', pct: institutional, color: 'bg-indigo-500' },
                  { label: 'Insider', pct: insider, color: 'bg-amber-500' },
                  { label: 'Retail / Float', pct: retail, color: 'bg-gray-300 dark:bg-white/20' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.color}`} />
                    <span className="flex-1 text-xs text-gray-600 dark:text-white/50">{row.label}</span>
                    <span className="tabular-nums text-xs font-semibold text-gray-800 dark:text-white/70">
                      {fmtPct(row.pct)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-white/30">Ownership data unavailable</p>
          )}
        </div>

        {/* ── Short Interest ── */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/25">Short Interest</p>

          <div className="space-y-3">
            {/* Short % of Float bar */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-white/40">% of Float Shorted</span>
                <span className={`text-sm font-bold tabular-nums ${shortTextColor}`}>
                  {fmtPct(shortPct)}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-white/10">
                <div
                  className={`h-full rounded-full transition-all ${shortBarColor}`}
                  style={{ width: shortPct != null ? `${Math.min(shortPct * 100 * 5, 100)}%` : '0%' }}
                />
              </div>
              <div className="mt-0.5 flex justify-between text-[9px] text-gray-300 dark:text-white/20">
                <span>Low</span>
                <span>5%</span>
                <span>10%+</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="rounded-xl border border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/5 px-3 py-2.5 space-y-1.5">
              {[
                { label: 'Days to Cover', value: shortRatio != null ? `${shortRatio.toFixed(1)} days` : 'N/A' },
                { label: 'Shares Short', value: fmtShares(sharesShort) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-white/40">{row.label}</span>
                  <span className="tabular-nums font-medium text-gray-700 dark:text-white/60">{row.value}</span>
                </div>
              ))}
            </div>

            {shortLevel === 'high' && (
              <p className="text-[11px] text-red-600 dark:text-red-400">
                High short interest (&gt;10%) — significant bearish positioning or squeeze risk.
              </p>
            )}
            {shortLevel === 'medium' && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Moderate short interest (5–10%) — elevated but not extreme.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
