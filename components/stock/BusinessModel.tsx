'use client'
import { useState } from 'react'
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

interface TTMLike {
  incomeStatement: { totalRevenue?: number | null; netIncome?: number | null; grossProfit?: number | null } | null
  cashFlow: { freeCashFlow?: number | null } | null
  balanceSheet: Record<string, unknown> | null
}

interface Props {
  businessProfile: BusinessProfile
  historicalRevenues: number[]
  ticker: string
  isDark?: boolean
  incomeStatement?: IncomeRow[]
  cashFlow?: CashFlowRow[]
  statementsData?: { ttm: TTMLike } | null
}

const TRUNCATE_AT = 280

export default function BusinessModel({ businessProfile, historicalRevenues, ticker, isDark, incomeStatement, cashFlow, statementsData }: Props) {
  const { description, industry, country, employees, netMargin, fcfMargin, revenueM } = businessProfile
  const [descExpanded, setDescExpanded] = useState(false)
  const isLongDesc = !!description && description.length > TRUNCATE_AT
  const displayDesc = isLongDesc && !descExpanded ? description.slice(0, TRUNCATE_AT).trimEnd() + '…' : description

  // Override metric cards with TTM data from Yahoo Finance statements when available
  const ttmIS = statementsData?.ttm?.incomeStatement
  const ttmCF = statementsData?.ttm?.cashFlow
  const ttmRev  = typeof ttmIS?.totalRevenue === 'number' ? ttmIS.totalRevenue : null
  const ttmNI   = typeof ttmIS?.netIncome    === 'number' ? ttmIS.netIncome    : null
  const ttmFcf  = typeof ttmCF?.freeCashFlow  === 'number' ? ttmCF.freeCashFlow  : null
  const ttmGM   = typeof ttmIS?.grossProfit  === 'number' && ttmRev != null && ttmRev > 0
    ? ttmIS.grossProfit / ttmRev : null

  const displayRevM   = ttmRev != null ? ttmRev / 1e6  : revenueM
  const displayNetMgn = ttmRev != null && ttmNI  != null && ttmRev > 0 ? ttmNI  / ttmRev : netMargin
  const displayFcfMgn = ttmRev != null && ttmFcf != null && ttmRev > 0 ? ttmFcf / ttmRev : fcfMargin
  const usingTTM      = ttmRev != null

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

  const tickFill = isDark ? 'rgba(255,255,255,0.3)' : '#8A95A6'
  const tooltipStyle = isDark
    ? { background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11, color: '#fff' }
    : { background: '#FFFFFF', border: '1px solid #E3E1DA', borderRadius: 8, fontSize: 11, color: '#06101F', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }

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

  // Plain-English stat values using TTM data when available
  const revenueB = displayRevM >= 1000 ? `$${(displayRevM / 1000).toFixed(1)}b` : `$${displayRevM.toFixed(0)}m`
  const netMarginKeep = displayNetMgn != null ? `$${(displayNetMgn * 100).toFixed(0)} of every $100` : null
  const fcfB = displayFcfMgn != null && displayRevM > 0
    ? (displayFcfMgn * displayRevM >= 1000 ? `$${((displayFcfMgn * displayRevM) / 1000).toFixed(1)}b` : `$${(displayFcfMgn * displayRevM).toFixed(0)}m`)
    : null

  // Summary callout — use TTM overrides when available
  const summaryCallout = buildBusinessSummary(ticker, {
    businessProfile,
    wacc: null,
    cagrAnalysis: null,
    scores: null,
  } as any, { fcfMargin: displayFcfMgn, grossMargin: ttmGM ?? businessProfile.grossMargin })

  const statCards = [
    {
      label: 'Annual Revenue',
      value: revenueB,
      sub: usingTTM ? 'Trailing 12 months' : 'Last reported year',
      color: 'bg-[#EAF1FF] border-[#93B4F5]',
    },
    {
      label: 'Profit Margin',
      value: netMarginKeep ?? (displayNetMgn != null ? fmtPct(displayNetMgn) : '—'),
      sub: netMarginKeep ? `Net income per $100 revenue${usingTTM ? ' (TTM)' : ''}` : 'Net margin',
      color: displayNetMgn != null && displayNetMgn > 0.10 ? 'bg-[#E8F7EF] border-[#A3D9BE]' : 'bg-[#F4F3EF] border-[#E3E1DA]',
    },
    {
      label: 'Free Cash Flow',
      value: fcfB ?? (displayFcfMgn != null ? fmtPct(displayFcfMgn) : '—'),
      sub: fcfB ? `Generated per year (est.)${usingTTM ? ' · TTM' : ''}` : 'FCF margin',
      color: displayFcfMgn != null && displayFcfMgn > 0.10 ? 'bg-[#E8F7EF] border-[#A3D9BE]' : 'bg-[#F4F3EF] border-[#E3E1DA]',
    },
  ]

  return (
    <div className="rounded-xl card px-4 py-4 sm:p-6">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#8A95A6] mb-4">The Business</h2>

      {/* Context pills */}
      {pills.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {pills.map((p) => (
            <span key={p.label} className="rounded-full border border-[#E3E1DA] bg-[#F4F3EF] px-3 py-2 text-[12px] font-medium text-[#566174] min-h-[44px] flex items-center">
              {p.label}
            </span>
          ))}
        </div>
      )}

      {/* Full description */}
      {description ? (
        <div className="mb-6">
          <p className="text-[14px] text-[#566174] leading-relaxed">{displayDesc}</p>
          {isLongDesc && (
            <button
              onClick={() => setDescExpanded(e => !e)}
              className="mt-2 text-[13px] font-medium text-[#2563EB] hover:text-[#2563EB] transition-colors min-h-[44px] flex items-center"
            >
              {descExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[14px] text-[#566174] mb-6">No business description available for {ticker}.</p>
      )}

      {/* Plain-English stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-xl border px-4 py-4 ${card.color}`}>
            <p className="text-[12px] text-[#566174] mb-1">{card.label}</p>
            <p className="text-[18px] font-bold text-[#06101F] tabular-nums">{card.value}</p>
            <p className="text-[12px] text-[#566174] mt-0.5 leading-relaxed">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Summary callout */}
      {summaryCallout && summaryCallout !== 'Insufficient data to generate a business quality summary.' && (
        <div className="rounded-xl bg-[#EAF1FF] border border-[#93B4F5] px-4 py-3 mb-5">
          <p className="text-[13px] text-[#2563EB] leading-relaxed">{summaryCallout}</p>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {chartData.length >= 2 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#8A95A6]">Revenue History ($M)</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`$${fmt(Number(v), 0)}M`, 'Revenue']}
                  contentStyle={tooltipStyle}
                  wrapperStyle={{ zIndex: 50 }}
                />
                <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {marginTrendData.length >= 2 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#8A95A6]">Margin Trends (%)</p>
            <ResponsiveContainer width="100%" height={140}>
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
                <Line type="monotone" dataKey="gross" stroke="#2563EB" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="net" stroke="#059669" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="fcf" stroke="#D97706" strokeWidth={2} dot={false} connectNulls strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
