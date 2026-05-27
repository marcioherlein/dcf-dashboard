'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false })
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false })
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false })
const ReferenceLine = dynamic(() => import('recharts').then((m) => m.ReferenceLine), { ssr: false })
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false })
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false })

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
interface HistoricalMultiple {
  fiscalYear: string
  date: string
  pe: number | null
  evEbitda: number | null
  evRevenue: number | null
  ps: number | null
}

interface Props {
  incomeStatement: ISRow[]
  cashFlow: CFRow[]
  currency?: string
  isDark?: boolean
  historicalMultiples?: HistoricalMultiple[]
  currentPE?: number | null
  currentEVEbitda?: number | null
  currentEVRevenue?: number | null
  currentPS?: number | null
}

function fmtM(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}B`
  return `${v.toFixed(0)}M`
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`
}

export default function FinancialCharts({
  incomeStatement, cashFlow, currency = '$', isDark,
  historicalMultiples = [],
  currentPE, currentEVEbitda, currentEVRevenue, currentPS,
}: Props) {
  const [multipleTab, setMultipleTab] = useState<'pe' | 'evEbitda' | 'evRevenue' | 'ps'>('pe')
  const tickFill = isDark ? '#94a3b8' : '#94a3b8'
  const tooltipStyle = isDark
    ? { background: 'rgba(10,22,40,0.95)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: 11, color: '#F1F5F9', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }
    : { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, color: '#0F172A', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }

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

  const sectionTitle = 'text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3'
  const panel = 'rounded-xl card p-5'

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Chart 1 — Revenue & Net Income */}
        <div className={panel}>
          <p className={sectionTitle}>Revenue &amp; Net Income ({currency}M)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtM} width={42} />
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
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
              <Bar dataKey="revenue" name="revenue" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                opacity={undefined}>
                {revenueData.map((entry, i) => (
                  <Cell key={i} opacity={entry.isProjected ? 0.35 : 1} />
                ))}
              </Bar>
              <Bar dataKey="netIncome" name="netIncome" fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {revenueData.map((entry, i) => (
                  <Cell key={i} opacity={entry.isProjected ? 0.35 : 1} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                wrapperStyle={{ zIndex: 50 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [`${currency}${fmtM(Number(v))}`, 'FCF']}
              />
              <Bar dataKey="fcf" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {fcfData.map((entry, i) => {
                  const positive = (entry.fcf ?? 0) >= 0
                  const base = positive ? '#059669' : '#DC2626'
                  return <Cell key={i} fill={base} opacity={entry.isProjected ? 0.35 : 1} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
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
                <Line type="monotone" dataKey="gross" stroke="#2563EB" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="opMgn" stroke="#D97706" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="net" stroke="#059669" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="fcfMgn" stroke="#7C3AED" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} strokeDasharray="2 3" />
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
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
                <Bar dataKey="ebitda" name="ebitda" fill="#7C3AED" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                  {ebitdaData.map((entry, i) => (
                    <Cell key={i} opacity={entry.isProjected ? 0.35 : 1} />
                  ))}
                </Bar>
                <Bar dataKey="opIncome" name="opIncome" fill="#D97706" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                  {ebitdaData.map((entry, i) => (
                    <Cell key={i} opacity={entry.isProjected ? 0.35 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>

      {/* Chart 5 — Historical Valuation Multiples */}
      {historicalMultiples.length >= 2 && (() => {
        type TabKey = 'pe' | 'evEbitda' | 'evRevenue' | 'ps'
        const TABS: { key: TabKey; label: string; color: string; currentVal: number | null | undefined; description: string }[] = [
          { key: 'pe',       label: 'P/E',        color: '#2563EB', currentVal: currentPE,        description: 'Price ÷ Earnings per share' },
          { key: 'evEbitda', label: 'EV/EBITDA',  color: '#7C3AED', currentVal: currentEVEbitda,  description: 'Enterprise value ÷ EBITDA' },
          { key: 'evRevenue',label: 'EV/Revenue', color: '#059669', currentVal: currentEVRevenue, description: 'Enterprise value ÷ Revenue' },
          { key: 'ps',       label: 'P/S',        color: '#D97706', currentVal: currentPS,        description: 'Price ÷ Revenue per share' },
        ]
        const active = TABS.find(t => t.key === multipleTab)!
        const chartData = historicalMultiples
          .filter(r => r[multipleTab] != null)
          .map(r => ({ year: r.fiscalYear, value: r[multipleTab] }))

        if (chartData.length < 2) return null

        const values = chartData.map(r => r.value as number)
        const avg = values.reduce((s, v) => s + v, 0) / values.length
        const current = active.currentVal != null && active.currentVal > 0 ? active.currentVal : null
        const isBelowAvg = current != null && current < avg * 0.9
        const isAboveAvg = current != null && current > avg * 1.1
        const allVals = current != null ? [...values, current] : values
        const yMin = Math.max(0, Math.floor(Math.min(...allVals) * 0.85))
        const yMax = Math.ceil(Math.max(...allVals) * 1.1)

        return (
          <div className={`${panel} col-span-1 sm:col-span-2`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
              <div className="flex-1">
                <p className={sectionTitle} style={{ marginBottom: 0 }}>Valuation History — {active.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{active.description}</p>
              </div>
              {/* Tab bar — scrollable on mobile */}
              <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
                <div className="flex items-center gap-1.5 min-w-max">
                  {TABS.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setMultipleTab(t.key)}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                        multipleTab === t.key
                          ? 'border-transparent text-white'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-transparent'
                      }`}
                      style={multipleTab === t.key ? { background: t.color, borderColor: t.color } : {}}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Context chips */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {current != null && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  isBelowAvg ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isAboveAvg ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}>
                  Today: {current.toFixed(1)}×
                  {isBelowAvg ? ' — below historical avg' : isAboveAvg ? ' — above historical avg' : ' — near historical avg'}
                </span>
              )}
              <span className="text-[10px] text-slate-400">
                {values.length}Y avg: {avg.toFixed(1)}×
                &nbsp;·&nbsp;
                Range: {Math.min(...values).toFixed(1)}× – {Math.max(...values).toFixed(1)}×
              </span>
            </div>

            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false}
                  domain={[yMin, yMax]}
                  tickFormatter={(v: number) => `${v.toFixed(0)}×`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${Number(v).toFixed(1)}×`, active.label]}
                />
                {/* Historical average line */}
                <ReferenceLine
                  y={avg} stroke="rgba(148,163,184,0.5)" strokeDasharray="4 3"
                  label={{ value: `Avg ${avg.toFixed(1)}×`, position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }}
                />
                {/* Current multiple line */}
                {current != null && (
                  <ReferenceLine
                    y={current} stroke={active.color} strokeDasharray="3 3" strokeWidth={1.5}
                    label={{ value: `Now ${current.toFixed(1)}×`, position: 'insideBottomRight', fontSize: 9, fill: active.color }}
                  />
                )}
                <Line
                  type="monotone" dataKey="value" stroke={active.color} strokeWidth={2}
                  dot={{ r: 3, fill: active.color, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[9px] text-slate-400 mt-2">
              Historical ratios from annual filings. Dashed lines: historical average and today&apos;s current multiple.
              A low current multiple relative to history may indicate the stock is cheaper than usual.
            </p>
          </div>
        )
      })()}

      {/* Legend note */}
      <p className="text-[10px] text-slate-400">
        Faded bars = model projections · Solid bars = historical actuals
        {projectedIS.length > 0 && ` · ${historicalIS.length} historical + ${projectedIS.length} projected years`}
      </p>
    </div>
  )
}
