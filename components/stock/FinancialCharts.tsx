'use client'
import dynamic from 'next/dynamic'

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false })

interface ISRow {
  year: string
  revenue: number | null
  grossProfit: number | null
  operatingIncome: number | null
  ebitda: number | null
  netIncome: number | null
  isProjected: boolean
}
interface CFRow {
  year: string
  operatingCF: number | null
  capex: number | null
  freeCashFlow: number | null
  isProjected: boolean
}

interface Props {
  incomeStatement: ISRow[]
  cashFlow: CFRow[]
  currency?: string
  isDark?: boolean
}

function fmtM(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}B`
  return `${v.toFixed(0)}M`
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

export default function FinancialCharts({ incomeStatement, cashFlow, currency = '$', isDark }: Props) {
  const tickFill = isDark ? 'rgba(255,255,255,0.25)' : '#9ca3af'
  const tooltipStyle = isDark
    ? { background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, color: '#fff' }
    : { background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 8, fontSize: 11, color: '#111' }

  const historicalIS = incomeStatement.filter((r) => !r.isProjected)
  const projectedIS = incomeStatement.filter((r) => r.isProjected)

  // Chart 1: Revenue & Net Income — all years, projected dimmed
  const revenueData = incomeStatement.map((r) => ({
    year: r.year,
    revenue: r.revenue,
    netIncome: r.netIncome,
    isProjected: r.isProjected,
  }))

  // Chart 2: Free Cash Flow — historical + projected
  const fcfData = cashFlow.map((r) => ({
    year: r.year,
    fcf: r.freeCashFlow,
    isProjected: r.isProjected,
  }))

  // Chart 3: Margin Trends — historical only (projected margins are constant averages, not useful as a trend)
  const marginData = historicalIS
    .filter((r) => r.revenue && r.revenue > 0)
    .map((r) => {
      const cfRow = cashFlow.find((c) => c.year === r.year && !c.isProjected)
      return {
        year: r.year,
        gross: r.grossProfit && r.revenue ? Math.round(r.grossProfit / r.revenue * 1000) / 10 : null,
        net: r.netIncome && r.revenue ? Math.round(r.netIncome / r.revenue * 1000) / 10 : null,
        fcfMgn: cfRow?.freeCashFlow != null && r.revenue ? Math.round(cfRow.freeCashFlow / r.revenue * 1000) / 10 : null,
        opMgn: r.operatingIncome && r.revenue ? Math.round(r.operatingIncome / r.revenue * 1000) / 10 : null,
      }
    })

  // Chart 4: EBITDA & Operating Income — historical + projected
  const ebitdaData = incomeStatement
    .filter((r) => r.ebitda !== null || r.operatingIncome !== null)
    .map((r) => ({
      year: r.year,
      ebitda: r.ebitda,
      opIncome: r.operatingIncome,
      isProjected: r.isProjected,
    }))

  if (historicalIS.length < 2) return null

  const sectionTitle = 'text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/25 mb-3'
  const panel = 'rounded-xl bg-surface-container-lowest dark:bg-[#111] shadow-card border border-outline-variant/10 dark:border-white/8 p-5'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Chart 1 — Revenue & Net Income */}
        <div className={panel}>
          <p className={sectionTitle}>Revenue &amp; Net Income ({currency}M)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtM} width={42} />
              <Tooltip
                contentStyle={tooltipStyle}
                wrapperStyle={{ zIndex: 50 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [
                  `${currency}${fmtM(Number(v))}`,
                  name === 'revenue' ? 'Revenue' : 'Net Income',
                ]}
              />
              <Legend
                formatter={(v) => v === 'revenue' ? 'Revenue' : 'Net Income'}
                wrapperStyle={{ fontSize: '10px', color: tickFill }}
              />
              <Bar dataKey="revenue" name="revenue" fill={isDark ? '#818cf8' : '#6366f1'} radius={[3, 3, 0, 0]} isAnimationActive={false}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                opacity={undefined}>
                {revenueData.map((entry, i) => (
                  <Cell key={i} opacity={entry.isProjected ? 0.4 : 1} />
                ))}
              </Bar>
              <Bar dataKey="netIncome" name="netIncome" fill={isDark ? '#34d399' : '#10b981'} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {revenueData.map((entry, i) => (
                  <Cell key={i} opacity={entry.isProjected ? 0.4 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2 — Free Cash Flow */}
        <div className={panel}>
          <p className={sectionTitle}>Free Cash Flow ({currency}M)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={fcfData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtM} width={42} />
              <Tooltip
                contentStyle={tooltipStyle}
                wrapperStyle={{ zIndex: 50 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`${currency}${fmtM(Number(v))}`, 'FCF']}
              />
              <Bar dataKey="fcf" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {fcfData.map((entry, i) => {
                  const positive = (entry.fcf ?? 0) >= 0
                  const base = positive
                    ? (isDark ? '#34d399' : '#10b981')
                    : (isDark ? '#f87171' : '#ef4444')
                  return <Cell key={i} fill={base} opacity={entry.isProjected ? 0.4 : 1} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3 — Margin Trends */}
        {marginData.length >= 2 && (
          <div className={panel}>
            <p className={sectionTitle}>Margin Trends (%) — Historical</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={marginData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtPct} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [
                    typeof v === 'number' ? fmtPct(v) : v,
                    name === 'gross' ? 'Gross Margin' : name === 'net' ? 'Net Margin' : name === 'fcfMgn' ? 'FCF Margin' : 'Op Margin',
                  ]}
                />
                <Legend
                  formatter={(v) => v === 'gross' ? 'Gross' : v === 'net' ? 'Net' : v === 'fcfMgn' ? 'FCF' : 'Operating'}
                  wrapperStyle={{ fontSize: '10px', color: tickFill }}
                />
                <Line type="monotone" dataKey="gross" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="opMgn" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="fcfMgn" stroke="#f97316" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} strokeDasharray="2 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chart 4 — EBITDA & Operating Income */}
        {ebitdaData.length >= 2 && (
          <div className={panel}>
            <p className={sectionTitle}>EBITDA &amp; Operating Income ({currency}M)</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={ebitdaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtM} width={42} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [
                    `${currency}${fmtM(Number(v))}`,
                    name === 'ebitda' ? 'EBITDA' : 'Operating Income',
                  ]}
                />
                <Legend
                  formatter={(v) => v === 'ebitda' ? 'EBITDA' : 'Operating Income'}
                  wrapperStyle={{ fontSize: '10px', color: tickFill }}
                />
                <Bar dataKey="ebitda" name="ebitda" fill={isDark ? '#c084fc' : '#a855f7'} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {ebitdaData.map((entry, i) => (
                    <Cell key={i} opacity={entry.isProjected ? 0.4 : 1} />
                  ))}
                </Bar>
                <Bar dataKey="opIncome" name="opIncome" fill={isDark ? '#fbbf24' : '#f59e0b'} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {ebitdaData.map((entry, i) => (
                    <Cell key={i} opacity={entry.isProjected ? 0.4 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>

      {/* Legend note */}
      <p className="text-[10px] text-gray-400 dark:text-white/20">
        Faded bars = model projections · Solid bars = historical actuals
        {projectedIS.length > 0 && ` · ${historicalIS.length} historical + ${projectedIS.length} projected years`}
      </p>
    </div>
  )
}
