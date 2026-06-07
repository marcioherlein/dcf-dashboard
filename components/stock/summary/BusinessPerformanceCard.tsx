'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

const SankeyChart = dynamic(() => import('recharts').then(m => m.Sankey), { ssr: false })

// ─── Shared helpers ───────────────────────────────────────────────────────────

function currSym(c: string): string {
  if (c === 'USD') return '$'
  if (c === 'EUR') return '€'
  if (c === 'GBP') return '£'
  if (c === 'JPY') return '¥'
  if (c === 'CNY') return '¥'
  return c + ' '
}

function fmtDollars(v: number, sym: string): string {
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}T`
  if (abs >= 1e9)  return `${sym}${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `${sym}${(v / 1e6).toFixed(0)}M`
  return `${sym}${Math.round(v / 1e3)}K`
}

function fmtFlow(v: number, sym: string): string {
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${sym}${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9)  return `${sym}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `${sym}${(abs / 1e6).toFixed(0)}M`
  return `${sym}${Math.round(abs / 1e3)}K`
}

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface Props {
  statementsData: AnyRecord | null
  currency?: string
}

// ─── Sankey design tokens ─────────────────────────────────────────────────────

const NODE_FILL: Record<string, string> = {
  'Revenue':             '#2563EB',
  'Cost of Revenue':     '#DC2626',
  'Gross Profit':        '#059669',
  'Operating Expenses':  '#DC2626',
  'Operating Income':    '#059669',
  'Tax & Other':         '#94A3B8',
  'Net Income':          '#059669',
}

const LINK_FILL: Record<string, string> = {
  'Cost of Revenue':    'rgba(220,38,38,0.11)',
  'Gross Profit':       'rgba(5,150,105,0.10)',
  'Operating Expenses': 'rgba(220,38,38,0.11)',
  'Operating Income':   'rgba(5,150,105,0.10)',
  'Tax & Other':        'rgba(148,163,184,0.14)',
  'Net Income':         'rgba(5,150,105,0.16)',
}

const PROFIT_NODES = new Set(['Gross Profit', 'Operating Income', 'Net Income'])

// ─── Revenue & Earnings view ──────────────────────────────────────────────────

interface Point {
  year: string
  revenue: number
  netIncome: number | null
  isTTM: boolean
  yoyRev: number | null
}

function RevenueView({ statementsData, currency }: { statementsData: AnyRecord; currency: string }) {
  const sym = currSym(statementsData?.financialCurrency ?? currency)

  const points = useMemo<Point[]>(() => {
    const annualRows: AnyRecord[] = statementsData?.annual?.incomeStatement ?? []
    const ttmRow: AnyRecord | null = statementsData?.ttm?.incomeStatement ?? null

    const annual: Point[] = annualRows
      .filter(r => r.totalRevenue != null && (r.totalRevenue as number) > 0)
      .slice(-5)
      .map(r => ({
        year:      String(r.endDate ?? '').slice(0, 4),
        revenue:   r.totalRevenue as number,
        netIncome: r.netIncome != null ? (r.netIncome as number) : null,
        isTTM:     false,
        yoyRev:    null,
      }))

    const latestAnnualYear = annual[annual.length - 1]?.year ?? ''
    const ttmRevenue = ttmRow?.totalRevenue as number | null
    let pts: Point[] = annual
    if (ttmRevenue != null && ttmRevenue > 0) {
      const ttmYear = String(ttmRow?.endDate ?? 'TTM').slice(0, 4)
      if (ttmYear !== latestAnnualYear) {
        pts = [...annual, {
          year: 'TTM', revenue: ttmRevenue,
          netIncome: ttmRow?.netIncome != null ? (ttmRow.netIncome as number) : null,
          isTTM: true, yoyRev: null,
        }]
      }
    }

    return pts.map((p, i) => ({
      ...p,
      yoyRev: i > 0 && pts[i - 1].revenue > 0
        ? (p.revenue - pts[i - 1].revenue) / pts[i - 1].revenue
        : null,
    }))
  }, [statementsData])

  if (points.length < 2) {
    return (
      <div className="px-5 py-10 flex items-center justify-center">
        <p className="text-[13px] text-[#9B9B9B]">No revenue data available</p>
      </div>
    )
  }

  const maxRev = Math.max(...points.map(p => p.revenue))
  const latestForMargin = [...points].reverse().find(p => !p.isTTM && p.netIncome != null && p.revenue > 0)
  const latestNetMargin = latestForMargin ? (latestForMargin.netIncome! / latestForMargin.revenue) : null

  return (
    <div className="bg-white px-4 sm:px-5 pt-4 pb-4">
      <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: 120 }}>
        {points.map((p) => {
          const revH  = (p.revenue / maxRev) * 100
          const niH   = p.netIncome != null ? (Math.abs(p.netIncome) / maxRev) * 100 : null
          const niPos = p.netIncome != null && p.netIncome >= 0
          const alpha = p.isTTM ? 'opacity-60' : ''

          return (
            <div key={p.year} className={cn('flex-1 min-w-0 flex flex-col items-center gap-0.5', alpha)}>
              <div className="h-[14px] flex items-end justify-center">
                {p.yoyRev != null && (
                  <span className={cn('text-[8px] font-semibold leading-none', p.yoyRev >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                    {p.yoyRev >= 0 ? '+' : ''}{(p.yoyRev * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="w-full flex gap-0.5 items-end" style={{ height: 88 }}>
                <div
                  className="flex-[2] min-w-0 bg-blue-500 rounded-t-sm transition-all"
                  style={{ height: `${Math.max(2, revH)}%` }}
                  title={`${p.year} Revenue: ${fmtDollars(p.revenue, sym)}`}
                />
                {niH != null ? (
                  <div
                    className={cn('flex-1 min-w-0 rounded-t-sm transition-all', niPos ? 'bg-[#11875D]' : 'bg-[#D83B3B]')}
                    style={{ height: `${Math.max(2, niH)}%` }}
                    title={`${p.year} Net Income: ${fmtDollars(p.netIncome!, sym)}`}
                  />
                ) : (
                  <div className="flex-1" />
                )}
              </div>
              <span className={cn('text-[8px] sm:text-[10px] leading-none mt-0.5', p.isTTM ? 'text-[#C4C4C4] font-semibold' : 'text-[#9B9B9B]')}>
                {p.year}
              </span>
            </div>
          )
        })}
      </div>
      {latestNetMargin != null && (
        <p className="mt-3 text-[10px] text-[#9B9B9B] leading-snug">
          {latestForMargin?.year} net margin:{' '}
          <span className={cn('font-semibold', latestNetMargin >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
            {(latestNetMargin * 100).toFixed(1)}%
          </span>
          {' '}· Net income bars scaled to revenue
        </p>
      )}
    </div>
  )
}

// ─── Income Flow (Sankey) view ────────────────────────────────────────────────

function IncomeFlowView({ statementsData, currency }: { statementsData: AnyRecord; currency: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(640)
  const fin = statementsData?.financialCurrency ?? currency
  const sym = currSym(fin)
  const ttm: AnyRecord | null = statementsData?.ttm?.incomeStatement ?? null

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const { nodes, links, revenue } = useMemo(() => {
    if (!ttm) return { nodes: [], links: [], revenue: 0 }
    const revenue = Math.max(0, ttm.totalRevenue ?? 0)
    if (!revenue) return { nodes: [], links: [], revenue: 0 }

    const grossProfit = Math.min(revenue, Math.max(0, ttm.grossProfit ?? 0))
    const cogs        = revenue - grossProfit
    const opIncome    = Math.max(0, Math.min(grossProfit, ttm.operatingIncome ?? 0))
    const opEx        = grossProfit - opIncome
    const clampedNI   = Math.max(0, Math.min(opIncome, ttm.netIncome ?? 0))
    const taxOther    = opIncome - clampedNI

    const nodes: { name: string }[] = [{ name: 'Revenue' }]
    const links: { source: number; target: number; value: number }[] = []

    if (cogs > 0) { links.push({ source: 0, target: nodes.length, value: cogs }); nodes.push({ name: 'Cost of Revenue' }) }
    if (grossProfit > 0) {
      const gpIdx = nodes.length
      links.push({ source: 0, target: gpIdx, value: grossProfit }); nodes.push({ name: 'Gross Profit' })
      if (opEx > 0) { links.push({ source: gpIdx, target: nodes.length, value: opEx }); nodes.push({ name: 'Operating Expenses' }) }
      if (opIncome > 0) {
        const opIdx = nodes.length
        links.push({ source: gpIdx, target: opIdx, value: opIncome }); nodes.push({ name: 'Operating Income' })
        if (taxOther > 0) { links.push({ source: opIdx, target: nodes.length, value: taxOther }); nodes.push({ name: 'Tax & Other' }) }
        if (clampedNI > 0) { links.push({ source: opIdx, target: nodes.length, value: clampedNI }); nodes.push({ name: 'Net Income' }) }
      }
    }
    return { nodes, links, revenue }
  }, [ttm])

  const leafSet = useMemo(() => {
    const hasOut = new Set(links.map(l => l.source))
    return new Set(nodes.map((_, i) => i).filter(i => !hasOut.has(i)))
  }, [nodes, links])

  if (!nodes.length || !revenue) {
    return (
      <div className="px-5 py-10 flex items-center justify-center">
        <p className="text-[13px] text-[#9B9B9B]">No TTM income data available</p>
      </div>
    )
  }

  const isNarrow = chartWidth < 540
  const margin = isNarrow ? { top: 20, right: 120, bottom: 20, left: 120 } : { top: 24, right: 152, bottom: 24, left: 152 }
  const chartHeight = isNarrow ? 260 : 300

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomNode = ({ x, y, width, height, index, payload }: any) => {
    const name: string  = payload?.name  ?? ''
    const value: number = payload?.value ?? 0
    if (!name || value <= 0) return null
    const fill      = NODE_FILL[name] ?? '#64748B'
    const isRevenue = name === 'Revenue'
    const isLeaf    = leafSet.has(index as number)
    const fullLabel = !isNarrow || isRevenue || isLeaf
    const pct       = Math.round((value / revenue) * 100)
    const isProfit  = PROFIT_NODES.has(name)
    const pctLabel  = isRevenue ? null : isProfit ? `${pct}% margin` : `${pct}% of rev`
    const gap       = 10
    const labelX    = isRevenue ? x - gap : x + width + gap
    const anchor    = isRevenue ? 'end' : 'start'
    const showName  = height >= 14 && (!isNarrow || isRevenue || isLeaf)
    const showValue = fullLabel && height >= 26
    const showPct   = fullLabel && height >= 38
    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(height, 2)} rx={3} ry={3} fill={fill} />
        {showName && (
          <text x={labelX} y={y + height / 2 - (showValue ? 9 : 0)} textAnchor={anchor} dominantBaseline="middle"
            fontFamily="Inter, system-ui, sans-serif" fontSize={11} fontWeight={600} fill="#334155">
            {name}
          </text>
        )}
        {showValue && (
          <text x={labelX} y={y + height / 2 + (showPct ? 4 : 5)} textAnchor={anchor} dominantBaseline="middle"
            fontFamily="DM Mono, IBM Plex Mono, monospace" fontSize={11} fill="#0F172A">
            {fmtFlow(value, sym)}
          </text>
        )}
        {showPct && pctLabel && (
          <text x={labelX} y={y + height / 2 + 18} textAnchor={anchor} dominantBaseline="middle"
            fontFamily="Inter, system-ui, sans-serif" fontSize={10} fill="#64748B">
            {pctLabel}
          </text>
        )}
      </g>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomLink = ({ sourceX, sourceControlX, targetX, targetControlX, sourceRelativeY, targetRelativeY, linkWidth, payload }: any) => {
    const tgtName: string = payload?.target?.name ?? ''
    const fill = LINK_FILL[tgtName] ?? 'rgba(148,163,184,0.14)'
    const sy0 = sourceRelativeY, ty0 = targetRelativeY
    const sy1 = sourceRelativeY + linkWidth, ty1 = targetRelativeY + linkWidth
    const d = [`M${sourceX},${sy0}`, `C${sourceControlX},${sy0} ${targetControlX},${ty0} ${targetX},${ty0}`,
               `L${targetX},${ty1}`, `C${targetControlX},${ty1} ${sourceControlX},${sy1} ${sourceX},${sy1}`, 'Z'].join(' ')
    return <path d={d} fill={fill} stroke="none" />
  }

  return (
    <div className="bg-white" ref={containerRef}>
      {chartWidth > 0 && (
        <SankeyChart
          width={chartWidth} height={chartHeight}
          data={{ nodes, links }}
          nodePadding={isNarrow ? 18 : 24} nodeWidth={8}
          margin={margin} node={CustomNode} link={CustomLink} iterations={64}
        />
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type ViewTab = 'revenue' | 'flow'

export default function BusinessPerformanceCard({ statementsData, currency = 'USD' }: Props) {
  const [activeView, setActiveView] = useState<ViewTab>('revenue')

  if (!statementsData) return null

  const tabs: { id: ViewTab; label: string }[] = [
    { id: 'revenue', label: 'Revenue & Earnings' },
    { id: 'flow',    label: 'Income Breakdown' },
  ]

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E5E5E5] shadow-card">
      {/* Header with tab toggle */}
      <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-[#E5E5E5] flex items-center justify-between gap-3">
        <p className="text-[12px] font-[650] text-[#6B6B6B]">Business Performance</p>
        <div className="flex items-center gap-0.5 bg-[#F5F5F5] rounded-lg p-0.5">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveView(t.id)}
              className={cn(
                'text-[11px] font-[600] px-2.5 py-1 rounded-md transition-colors whitespace-nowrap min-h-[28px]',
                activeView === t.id
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-[#6B6B6B] hover:text-[#111111]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Legend for revenue view */}
        {activeView === 'revenue' && (
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
              <span className="inline-block w-2 h-2 rounded-sm bg-blue-500" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#11875D]" />
              Net Income
            </span>
          </div>
        )}
        {activeView === 'flow' && (
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#059669]" />
              Profit
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#DC2626]" />
              Cost
            </span>
          </div>
        )}
      </div>

      {activeView === 'revenue' && <RevenueView statementsData={statementsData} currency={currency} />}
      {activeView === 'flow'    && <IncomeFlowView statementsData={statementsData} currency={currency} />}
    </div>
  )
}
