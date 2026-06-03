'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const BarChart        = dynamic(() => import('recharts').then((m) => m.BarChart),        { ssr: false })
const Bar             = dynamic(() => import('recharts').then((m) => m.Bar),             { ssr: false })
const LineChart       = dynamic(() => import('recharts').then((m) => m.LineChart),       { ssr: false })
const Line            = dynamic(() => import('recharts').then((m) => m.Line),            { ssr: false })
const ReferenceLine   = dynamic(() => import('recharts').then((m) => m.ReferenceLine),   { ssr: false })
const XAxis           = dynamic(() => import('recharts').then((m) => m.XAxis),           { ssr: false })
const YAxis           = dynamic(() => import('recharts').then((m) => m.YAxis),           { ssr: false })
const Tooltip         = dynamic(() => import('recharts').then((m) => m.Tooltip),         { ssr: false })
const Legend          = dynamic(() => import('recharts').then((m) => m.Legend),          { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })
const Cell            = dynamic(() => import('recharts').then((m) => m.Cell),            { ssr: false })
const CartesianGrid   = dynamic(() => import('recharts').then((m) => m.CartesianGrid),   { ssr: false })

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

type ChartKey = 'revNI' | 'fcf' | 'margins' | 'ebitda' | 'revGrowth' | 'fcfGrowth' | 'multiples' | 'multiGrowth' | 'multiAbsolute'

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
  chartsToShow?: ChartKey[]
}

function fmtM(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1000) return `${v < 0 ? '−' : ''}${(abs / 1000).toFixed(1)}B`
  return `${v < 0 ? '−' : ''}${abs.toFixed(0)}M`
}

function fmtPct(v: number): string { return `${v.toFixed(1)}%` }

function yoy(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null
  return ((curr - prev) / Math.abs(prev)) * 100
}

// Recharts custom bar shape to paint individual bars per-datum inside a Bar
// We use Cell instead and handle color logic via getBarFill helpers.

export default function FinancialCharts({
  incomeStatement, cashFlow, currency = '$', isDark,
  historicalMultiples = [],
  currentPE, currentEVEbitda, currentEVRevenue, currentPS,
  chartsToShow,
}: Props) {
  const [multipleTab, setMultipleTab] = useState<'pe' | 'evEbitda' | 'evRevenue' | 'ps'>('pe')

  const tickFill   = '#94a3b8'
  const gridStroke = 'rgba(148,163,184,0.08)'
  const tooltipStyle = isDark
    ? { background: 'rgba(10,22,40,0.95)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, fontSize: 11, color: '#F1F5F9', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }
    : { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, color: '#0F172A', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }

  const historicalIS = incomeStatement.filter((r) => !r.isProjected)
  const projectedIS  = incomeStatement.filter((r) => r.isProjected)
  if (historicalIS.length < 2) return null

  const CHART_H  = 168
  const show = chartsToShow ?? (['revNI', 'fcf', 'margins', 'ebitda', 'revGrowth', 'fcfGrowth', 'multiples'] as ChartKey[])
  const isSingle = show.length === 1
  const sectionTitle = 'text-[13px] font-semibold text-slate-700 mb-3'
  const panel        = 'rounded-xl card p-4 sm:p-5'

  // ── Chart 1 data: Revenue & Net Income ──────────────────────────────────────
  const revData = incomeStatement.map((r) => ({
    year: r.year,
    revenue:   r.revenue,
    netIncome: r.netIncome,
    isProjected: r.isProjected,
  }))

  // ── Chart 2 data: FCF composition — OpCF + Capex breakdown ──────────────────
  const fcfData = cashFlow.map((r) => ({
    year: r.year,
    opCF:  r.operatingCF,
    capex: r.capex,       // typically negative from Yahoo
    fcf:   r.freeCashFlow,
    isProjected: r.isProjected,
  }))

  // ── Chart 3 data: Margins — historical actuals only ─────────────────────────
  const marginData = historicalIS
    .filter((r) => r.revenue && r.revenue > 0)
    .map((r) => {
      const cfRow = cashFlow.find((c) => c.year === r.year)
      const pct = (num: number | null) => (num != null && r.revenue ? +(num / r.revenue * 100).toFixed(2) : null)
      return {
        year:    r.year,
        gross:   pct(r.grossProfit),
        opMgn:   pct(r.operatingIncome),
        net:     pct(r.netIncome),
        fcfMgn:  cfRow?.freeCashFlow != null && r.revenue ? +(cfRow.freeCashFlow / r.revenue * 100).toFixed(2) : null,
      }
    })

  // ── Chart 4 data: EBITDA & Operating Income ──────────────────────────────────
  const ebitdaData = incomeStatement
    .filter((r) => r.ebitda !== null || r.operatingIncome !== null)
    .map((r) => ({
      year: r.year,
      ebitda:   r.ebitda,
      opIncome: r.operatingIncome,
      isProjected: r.isProjected,
    }))

  // ── Chart 5 data: Revenue YoY Growth ─────────────────────────────────────────
  const revGrowthData = incomeStatement
    .map((r, i) => ({
      year:        r.year,
      growth:      yoy(r.revenue, incomeStatement[i - 1]?.revenue ?? null),
      isProjected: r.isProjected,
    }))
    .slice(1)
    .filter((r) => r.growth != null)

  // ── Chart 6 data: FCF YoY Growth ─────────────────────────────────────────────
  const fcfGrowthData = cashFlow
    .map((r, i) => ({
      year:        r.year,
      growth:      yoy(r.freeCashFlow, cashFlow[i - 1]?.freeCashFlow ?? null),
      isProjected: r.isProjected,
    }))
    .slice(1)
    .filter((r) => r.growth != null)

  // ── Chart 7 data: Multi-metric YoY growth rates (5 lines) ────────────────────
  const multiGrowthData = historicalIS.slice(1).map((r, i) => {
    const prev   = historicalIS[i]
    const cfRow  = cashFlow.find(c => c.year === r.year)
    const prevCf = cashFlow.find(c => c.year === prev.year)
    const pct = (curr: number | null, p: number | null) =>
      curr != null && p != null && p !== 0 ? ((curr - p) / Math.abs(p)) * 100 : null
    return {
      year:    r.year,
      revenue: pct(r.revenue,        prev.revenue),
      ebitda:  pct(r.ebitda,          prev.ebitda),
      ebit:    pct(r.operatingIncome, prev.operatingIncome),
      ni:      pct(r.netIncome,       prev.netIncome),
      fcf:     pct(cfRow?.freeCashFlow ?? null, prevCf?.freeCashFlow ?? null),
    }
  }).filter(d => d.revenue != null || d.ni != null)

  // ── Chart 8 data: Multi-metric absolute values ────────────────────────────────
  const multiAbsData = historicalIS.map(r => {
    const cfRow = cashFlow.find(c => c.year === r.year)
    return {
      year:    r.year,
      revenue: r.revenue,
      ebitda:  r.ebitda,
      ebit:    r.operatingIncome,
      ni:      r.netIncome,
      fcf:     cfRow?.freeCashFlow ?? null,
    }
  })

  return (
    <>
      <div className={`grid grid-cols-1 gap-4 ${isSingle ? '' : 'sm:grid-cols-2'}`}>

        {/* ── Chart 1 — Revenue & Net Income ── */}
        {show.includes('revNI') && (
        <div className={panel}>
          <p className={sectionTitle}>Revenue &amp; Net Income <span className="normal-case font-normal">({currency}M)</span></p>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={revData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtM} width={44} />
              <Tooltip
                contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 50 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [`${currency}${fmtM(Number(v))}`, name === 'revenue' ? 'Revenue' : 'Net Income']}
              />
              <Legend formatter={(v) => v === 'revenue' ? 'Revenue' : 'Net Income'} wrapperStyle={{ fontSize: '10px', color: tickFill }} />
              <Bar dataKey="revenue" name="revenue" fill="#2563EB" radius={[3,3,0,0]} maxBarSize={36} isAnimationActive={false}>
                {revData.map((d, i) => <Cell key={i} opacity={d.isProjected ? 0.3 : 1} />)}
              </Bar>
              <Bar dataKey="netIncome" name="netIncome" fill="#059669" radius={[3,3,0,0]} maxBarSize={36} isAnimationActive={false}>
                {revData.map((d, i) => <Cell key={i} opacity={d.isProjected ? 0.3 : 0.85} fill={(d.netIncome ?? 0) < 0 ? '#DC2626' : '#059669'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* ── Chart 2 — FCF (OpCF + Capex breakdown) ── */}
        {show.includes('fcf') && (
        <div className={panel}>
          <p className={sectionTitle}>Free Cash Flow <span className="normal-case font-normal">({currency}M)</span></p>
          <p className="text-[11px] text-slate-500 -mt-2 mb-2">Operating CF + Capex (capex negative) = FCF · Faded = projected</p>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart data={fcfData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtM} width={44} />
              <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
              <Tooltip
                contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 50 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [
                  `${currency}${fmtM(Number(v))}`,
                  name === 'opCF' ? 'Operating CF' : name === 'capex' ? 'Capex' : 'FCF',
                ]}
              />
              <Legend formatter={(v) => v === 'opCF' ? 'Operating CF' : v === 'capex' ? 'Capex' : 'FCF'} wrapperStyle={{ fontSize: '10px', color: tickFill }} />
              <Bar dataKey="opCF" name="opCF" fill="#2563EB" radius={[3,3,0,0]} maxBarSize={28} isAnimationActive={false}>
                {fcfData.map((d, i) => <Cell key={i} fill={(d.opCF ?? 0) >= 0 ? '#2563EB' : '#DC2626'} opacity={d.isProjected ? 0.3 : 0.85} />)}
              </Bar>
              <Bar dataKey="capex" name="capex" fill="#DC2626" radius={[0,0,3,3]} maxBarSize={28} isAnimationActive={false}>
                {fcfData.map((d, i) => <Cell key={i} fill="#DC2626" opacity={d.isProjected ? 0.25 : 0.6} />)}
              </Bar>
              <Bar dataKey="fcf" name="fcf" fill="#059669" radius={[3,3,0,0]} maxBarSize={16} isAnimationActive={false}>
                {fcfData.map((d, i) => <Cell key={i} fill={(d.fcf ?? 0) >= 0 ? '#059669' : '#DC2626'} opacity={d.isProjected ? 0.3 : 1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* ── Chart 3 — Margin Trends (historical actuals only) ── */}
        {show.includes('margins') && marginData.length >= 2 && (
          <div className={panel}>
            <p className={sectionTitle}>Margin Trends <span className="normal-case font-normal">(%)</span></p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={marginData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtPct} />
                <Tooltip
                  contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [
                    typeof v === 'number' ? fmtPct(v) : v,
                    name === 'gross' ? 'Gross Margin' : name === 'net' ? 'Net Margin' : name === 'fcfMgn' ? 'FCF Margin' : 'Op Margin',
                  ]}
                />
                <Legend
                  formatter={(v) => v === 'gross' ? 'Gross' : v === 'net' ? 'Net' : v === 'fcfMgn' ? 'FCF' : v === 'opMgn' ? 'Operating' : null}
                  wrapperStyle={{ fontSize: '10px', color: tickFill }}
                />
                <Line type="monotone" dataKey="gross"  stroke="#2563EB" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="opMgn"  stroke="#D97706" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} strokeDasharray="5 2" />
                <Line type="monotone" dataKey="net"    stroke="#059669" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="fcfMgn" stroke="#7C3AED" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} strokeDasharray="2 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Chart 4 — EBITDA & Operating Income ── */}
        {show.includes('ebitda') && ebitdaData.length >= 2 && (
          <div className={panel}>
            <p className={sectionTitle}>EBITDA &amp; Operating Income <span className="normal-case font-normal">({currency}M)</span></p>
            <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart data={ebitdaData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtM} width={44} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
                <Tooltip
                  contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [`${currency}${fmtM(Number(v))}`, name === 'ebitda' ? 'EBITDA' : 'Operating Income']}
                />
                <Legend formatter={(v) => v === 'ebitda' ? 'EBITDA' : 'Operating Income'} wrapperStyle={{ fontSize: '10px', color: tickFill }} />
                <Bar dataKey="ebitda" name="ebitda" fill="#7C3AED" radius={[3,3,0,0]} maxBarSize={36} isAnimationActive={false}>
                  {ebitdaData.map((d, i) => <Cell key={i} opacity={d.isProjected ? 0.3 : 0.85} />)}
                </Bar>
                <Bar dataKey="opIncome" name="opIncome" fill="#D97706" radius={[3,3,0,0]} maxBarSize={36} isAnimationActive={false}>
                  {ebitdaData.map((d, i) => <Cell key={i} opacity={d.isProjected ? 0.3 : 0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Chart 5 — Revenue YoY Growth ── */}
        {show.includes('revGrowth') && revGrowthData.length >= 2 && (
          <div className={panel}>
            <p className={sectionTitle}>Revenue YoY Growth <span className="normal-case font-normal">· faded = projected</span></p>
            <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart data={revGrowthData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
                <Tooltip
                  contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)}%`, 'Revenue Growth']}
                />
                <Bar dataKey="growth" radius={[3,3,0,0]} maxBarSize={40} isAnimationActive={false}>
                  {revGrowthData.map((d, i) => (
                    <Cell key={i} fill={(d.growth ?? 0) >= 0 ? '#2563EB' : '#DC2626'} opacity={d.isProjected ? 0.35 : 0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Chart 6 — FCF YoY Growth ── */}
        {show.includes('fcfGrowth') && fcfGrowthData.length >= 2 && (
          <div className={panel}>
            <p className={sectionTitle}>FCF YoY Growth <span className="normal-case font-normal">· faded = projected</span></p>
            <ResponsiveContainer width="100%" height={CHART_H}>
              <BarChart data={fcfGrowthData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} width={48} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
                <Tooltip
                  contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)}%`, 'FCF Growth']}
                />
                <Bar dataKey="growth" radius={[3,3,0,0]} maxBarSize={40} isAnimationActive={false}>
                  {fcfGrowthData.map((d, i) => (
                    <Cell key={i} fill={(d.growth ?? 0) >= 0 ? '#059669' : '#DC2626'} opacity={d.isProjected ? 0.35 : 0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Chart 7 — Multi-metric Growth Rate Trends ── */}
        {show.includes('multiGrowth') && multiGrowthData.length >= 2 && (
          <div className={panel}>
            <p className={sectionTitle}>Growth Rate Trends <span className="normal-case font-normal">· YoY %</span></p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={multiGrowthData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" />
                <Tooltip
                  contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [
                    `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(1)}%`,
                    name === 'revenue' ? 'Revenue' : name === 'ebitda' ? 'EBITDA' : name === 'ebit' ? 'EBIT' : name === 'ni' ? 'Net Income' : 'FCF',
                  ]}
                />
                <Legend
                  formatter={(v) => v === 'revenue' ? 'Revenue' : v === 'ebitda' ? 'EBITDA' : v === 'ebit' ? 'EBIT' : v === 'ni' ? 'Net Income' : 'FCF'}
                  wrapperStyle={{ fontSize: '10px', color: tickFill }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} dot={{ r: 3, fill: '#2563EB', strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="ebitda"  stroke="#7C3AED" strokeWidth={2} dot={{ r: 3, fill: '#7C3AED', strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="ebit"    stroke="#D97706" strokeWidth={2} dot={{ r: 3, fill: '#D97706', strokeWidth: 0 }} connectNulls isAnimationActive={false} strokeDasharray="5 2" />
                <Line type="monotone" dataKey="ni"      stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: '#059669', strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="fcf"     stroke="#06B6D4" strokeWidth={2} dot={{ r: 3, fill: '#06B6D4', strokeWidth: 0 }} connectNulls isAnimationActive={false} strokeDasharray="3 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Chart 8 — Multi-metric Absolute Values ── */}
        {show.includes('multiAbsolute') && multiAbsData.length >= 2 && (
          <div className={panel}>
            <p className={sectionTitle}>Absolute Values <span className="normal-case font-normal">({currency}M)</span></p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={multiAbsData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={fmtM} width={44} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.3)" />
                <Tooltip
                  contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [
                    `${currency}${fmtM(Number(v))}`,
                    name === 'revenue' ? 'Revenue' : name === 'ebitda' ? 'EBITDA' : name === 'ebit' ? 'EBIT' : name === 'ni' ? 'Net Income' : 'FCF',
                  ]}
                />
                <Legend
                  formatter={(v) => v === 'revenue' ? 'Revenue' : v === 'ebitda' ? 'EBITDA' : v === 'ebit' ? 'EBIT' : v === 'ni' ? 'Net Income' : 'FCF'}
                  wrapperStyle={{ fontSize: '10px', color: tickFill }}
                />
                <Bar dataKey="revenue" name="revenue" fill="#2563EB" radius={[3,3,0,0]} maxBarSize={20} isAnimationActive={false} />
                <Bar dataKey="ebitda"  name="ebitda"  fill="#7C3AED" radius={[3,3,0,0]} maxBarSize={20} isAnimationActive={false} />
                <Bar dataKey="ebit"    name="ebit"    fill="#D97706" radius={[3,3,0,0]} maxBarSize={20} isAnimationActive={false} />
                <Bar dataKey="ni" name="ni" radius={[3,3,0,0]} maxBarSize={20} isAnimationActive={false}>
                  {multiAbsData.map((d, i) => <Cell key={i} fill={(d.ni ?? 0) >= 0 ? '#059669' : '#DC2626'} />)}
                </Bar>
                <Bar dataKey="fcf" name="fcf" radius={[3,3,0,0]} maxBarSize={20} isAnimationActive={false}>
                  {multiAbsData.map((d, i) => <Cell key={i} fill={(d.fcf ?? 0) >= 0 ? '#06B6D4' : '#DC2626'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>

      {/* ── Historical Valuation Multiples ── */}
      {show.includes('multiples') && historicalMultiples.length >= 2 && (() => {
        type TabKey = 'pe' | 'evEbitda' | 'evRevenue' | 'ps'
        const TABS: { key: TabKey; label: string; color: string; currentVal: number | null | undefined; description: string }[] = [
          { key: 'pe',        label: 'P/E',        color: '#2563EB', currentVal: currentPE,        description: 'Price ÷ Earnings per share' },
          { key: 'evEbitda',  label: 'EV/EBITDA',  color: '#7C3AED', currentVal: currentEVEbitda,  description: 'Enterprise value ÷ EBITDA' },
          { key: 'evRevenue', label: 'EV/Revenue', color: '#059669', currentVal: currentEVRevenue, description: 'Enterprise value ÷ Revenue' },
          { key: 'ps',        label: 'P/S',        color: '#D97706', currentVal: currentPS,        description: 'Price ÷ Revenue per share' },
        ]
        const active    = TABS.find(t => t.key === multipleTab)!
        const chartData = historicalMultiples
          .filter(r => r[multipleTab] != null)
          .map(r => ({ year: r.fiscalYear, value: r[multipleTab] }))

        if (chartData.length < 2) return null

        const values      = chartData.map(r => r.value as number)
        const avg         = values.reduce((s, v) => s + v, 0) / values.length
        const current     = active.currentVal != null && active.currentVal > 0 ? active.currentVal : null
        const isBelowAvg  = current != null && current < avg * 0.9
        const isAboveAvg  = current != null && current > avg * 1.1
        const allVals     = current != null ? [...values, current] : values
        const yMin        = Math.max(0, Math.floor(Math.min(...allVals) * 0.85))
        const yMax        = Math.ceil(Math.max(...allVals) * 1.1)

        return (
          <div className={panel}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
              <div className="flex-1">
                <p className={sectionTitle} style={{ marginBottom: 0 }}>Valuation History — {active.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{active.description}</p>
              </div>
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
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 9, fill: tickFill }} axisLine={false} tickLine={false}
                  domain={[yMin, yMax]}
                  tickFormatter={(v: number) => `${v.toFixed(0)}×`}
                />
                <Tooltip
                  contentStyle={tooltipStyle} wrapperStyle={{ zIndex: 50 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${Number(v).toFixed(1)}×`, active.label]}
                />
                <ReferenceLine
                  y={avg} stroke="rgba(148,163,184,0.5)" strokeDasharray="4 3"
                  label={{ value: `Avg ${avg.toFixed(1)}×`, position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }}
                />
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
          <p className="text-[11px] text-slate-500 mt-2">
              Historical ratios from annual filings. Dashed lines: historical average and today&apos;s current multiple.
              A low current multiple relative to history may indicate the stock is cheaper than usual.
            </p>
          </div>
        )
      })()}

      {/* Footer note */}
      {!chartsToShow && (
        <p className="text-[11px] text-slate-500">
          Faded bars / dashed lines = DCF model projections &nbsp;·&nbsp; Solid = historical actuals
          {projectedIS.length > 0 && ` · ${historicalIS.length} historical + ${projectedIS.length} projected years`}
        </p>
      )}

    </>
  )
}
