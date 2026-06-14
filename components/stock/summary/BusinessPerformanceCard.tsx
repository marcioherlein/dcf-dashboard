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
  'Revenue':             '#566174',   // neutral — it's not a profit or cost
  'Cost of Revenue':     '#E05252',
  'Gross Profit':        '#059669',
  'Operating Expenses':  '#E05252',
  'Operating Income':    '#059669',
  'Tax & Other':         '#A3ABBA',
  'Net Income':          '#059669',
  'Net Loss':            '#E05252',
}

const LINK_FILL: Record<string, string> = {
  'Cost of Revenue':    'rgba(224,82,82,0.10)',
  'Gross Profit':       'rgba(5,150,105,0.09)',
  'Operating Expenses': 'rgba(224,82,82,0.10)',
  'Operating Income':   'rgba(5,150,105,0.09)',
  'Tax & Other':        'rgba(163,171,186,0.13)',
  'Net Income':         'rgba(5,150,105,0.14)',
  'Net Loss':           'rgba(224,82,82,0.10)',
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
  // Net income has its own scale so bars are readable regardless of margin size
  const niValues = points.map(p => p.netIncome).filter((v): v is number => v != null)
  const maxNiAbs = niValues.length > 0 ? Math.max(...niValues.map(Math.abs)) : 0

  const latestForMargin = [...points].reverse().find(p => !p.isTTM && p.netIncome != null && p.revenue > 0)
  const latestNetMargin = latestForMargin ? (latestForMargin.netIncome! / latestForMargin.revenue) : null

  // Y-axis labels — 3 ticks on the revenue scale
  const yTicks = [0.5, 1].map(f => ({ pct: f * 100, label: fmtDollars(maxRev * f, sym) }))

  return (
    <div className="bg-white px-4 sm:px-5 pt-3 pb-4">
      {/* Chart area */}
      <div className="relative" style={{ height: 148 }}>
        {/* Y-axis gridlines + labels */}
        <div className="absolute inset-0 pointer-events-none" style={{ bottom: 20 }}>
          {yTicks.map(({ pct, label }) => (
            <div
              key={pct}
              className="absolute left-0 right-0 flex items-center"
              style={{ bottom: `${pct}%` }}
            >
              <span className="text-[9px] text-[#C4C4C4] tabular-nums w-8 shrink-0 leading-none">{label}</span>
              <div className="flex-1 border-t border-dashed border-[#E8E8E8]" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-1 sm:gap-1.5 pl-9" style={{ paddingBottom: 20 }}>
          {points.map((p) => {
            const barAreaH = 128 - 20 // total height minus year label area
            const revH  = (p.revenue / maxRev) * 100
            const niH   = p.netIncome != null && maxNiAbs > 0
              ? (Math.abs(p.netIncome) / maxNiAbs) * 70  // NI bars capped at 70% of bar area height
              : null
            const niPos  = p.netIncome != null && p.netIncome >= 0
            const alpha  = p.isTTM ? 'opacity-60' : ''

            return (
              <div
                key={p.year}
                className={cn('group flex-1 min-w-0 flex flex-col items-center gap-0', alpha)}
              >
                {/* YoY growth badge */}
                <div className="h-[16px] flex items-end justify-center">
                  {p.yoyRev != null && (
                    <span className={cn('text-[9px] font-semibold leading-none tabular-nums', p.yoyRev >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                      {p.yoyRev >= 0 ? '+' : ''}{(p.yoyRev * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Bar pair */}
                <div className="relative w-full flex gap-[2px] items-end" style={{ height: barAreaH - 16 }}>
                  {/* Revenue bar */}
                  <div
                    className="relative flex-[3] min-w-0 bg-[#D8E6FF] hover:bg-[#BFCFEE] rounded-t-[3px] transition-colors cursor-default"
                    style={{ height: `${Math.max(3, revH)}%` }}
                  >
                    {/* Value label on hover */}
                    <div className="absolute inset-x-0 -top-5 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="text-[9px] font-semibold text-[#06101F] bg-white border border-[#E3E1DA] rounded px-1 py-0.5 shadow-sm whitespace-nowrap tabular-nums">
                        {fmtDollars(p.revenue, sym)}
                      </span>
                    </div>
                  </div>

                  {/* Net income bar — independent scale */}
                  {niH != null ? (
                    <div
                      className={cn(
                        'relative flex-[2] min-w-0 rounded-t-[3px] transition-colors cursor-default',
                        niPos ? 'bg-[#11875D] hover:bg-[#0E7053]' : 'bg-[#D83B3B] hover:bg-[#BA2F2F]',
                      )}
                      style={{ height: `${Math.max(3, niH)}%` }}
                    >
                      {/* Value label on hover */}
                      <div className="absolute inset-x-0 -top-5 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <span className="text-[9px] font-semibold text-[#06101F] bg-white border border-[#E3E1DA] rounded px-1 py-0.5 shadow-sm whitespace-nowrap tabular-nums">
                          {fmtDollars(p.netIncome!, sym)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-[2]" />
                  )}
                </div>

                {/* Year label */}
                <span className={cn('text-[9px] sm:text-[10px] leading-none mt-1 tabular-nums', p.isTTM ? 'text-[#9B9B9B] font-semibold' : 'text-[#9B9B9B]')}>
                  {p.year}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footnote */}
      {latestNetMargin != null && (
        <p className="mt-1 text-[10px] text-[#9B9B9B] leading-snug">
          {latestForMargin?.year} net margin:{' '}
          <span className={cn('font-semibold', latestNetMargin >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
            {(latestNetMargin * 100).toFixed(1)}%
          </span>
          {' '}· Net income bars use independent scale
        </p>
      )}
    </div>
  )
}

// ─── Income Flow (Sankey) view ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function IncomeFlowView({ statementsData, currency }: { statementsData: AnyRecord; currency: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(0)
  const fin = statementsData?.financialCurrency ?? currency
  const sym = currSym(fin)

  // Use TTM if available, else most-recent annual row
  const ttm: AnyRecord | null =
    statementsData?.ttm?.incomeStatement ??
    (statementsData?.annual?.incomeStatement?.slice(-1)[0] ?? null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Measure immediately then observe changes
    setChartWidth(el.getBoundingClientRect().width)
    const obs = new ResizeObserver(([entry]) => setChartWidth(entry.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const { nodes, links, revenue, hasNegativeNI } = useMemo(() => {
    if (!ttm) return { nodes: [], links: [], revenue: 0, hasNegativeNI: false }

    const revenue = Math.max(0, ttm.totalRevenue ?? ttm.operatingRevenue ?? 0)
    if (!revenue) return { nodes: [], links: [], revenue: 0, hasNegativeNI: false }

    // Derive gross profit: prefer direct field, fallback to revenue - cogs
    const rawGP   = ttm.grossProfit ?? null
    const rawCOGS = ttm.costOfRevenue ?? null
    let grossProfit: number
    let cogs: number
    if (rawGP != null && rawGP > 0) {
      grossProfit = Math.min(revenue, rawGP)
      cogs        = revenue - grossProfit
    } else if (rawCOGS != null && rawCOGS > 0) {
      cogs        = Math.min(revenue, rawCOGS)
      grossProfit = revenue - cogs
    } else {
      // No COGS/GP data — show revenue → operating income directly
      grossProfit = revenue
      cogs        = 0
    }

    // Operating income — can legitimately be null when not reported
    const rawOpIncome = ttm.operatingIncome ?? ttm.ebit ?? null
    const opIncome    = rawOpIncome != null
      ? Math.min(grossProfit, Math.max(0, rawOpIncome))
      : null
    const opEx = opIncome != null ? grossProfit - opIncome : null

    // Net income — allow negative (net loss)
    const rawNI    = ttm.netIncome ?? ttm.netIncomeCommonStockholders ?? null
    const netIncome = rawNI != null ? rawNI : null
    const hasNegativeNI = netIncome != null && netIncome < 0

    // Tax & other: opIncome - NI (only when both positive and NI ≤ opIncome)
    let taxOther: number | null = null
    let clampedNI: number | null = null
    if (opIncome != null && opIncome > 0 && netIncome != null && netIncome > 0) {
      clampedNI = Math.min(opIncome, netIncome)
      taxOther  = opIncome - clampedNI
    } else if (opIncome != null && opIncome > 0 && netIncome != null && netIncome <= 0) {
      // Loss: opIncome all goes to tax & charges
      taxOther = opIncome
    }

    const nodes: { name: string }[] = [{ name: 'Revenue' }]
    const links: { source: number; target: number; value: number }[] = []

    if (cogs > 0) {
      links.push({ source: 0, target: nodes.length, value: cogs })
      nodes.push({ name: 'Cost of Revenue' })
    }
    if (grossProfit > 0) {
      const gpIdx = nodes.length
      links.push({ source: 0, target: gpIdx, value: grossProfit })
      nodes.push({ name: 'Gross Profit' })

      if (opEx != null && opEx > 0) {
        links.push({ source: gpIdx, target: nodes.length, value: opEx })
        nodes.push({ name: 'Operating Expenses' })
      }
      if (opIncome != null && opIncome > 0) {
        const opIdx = nodes.length
        links.push({ source: gpIdx, target: opIdx, value: opIncome })
        nodes.push({ name: 'Operating Income' })

        if (taxOther != null && taxOther > 0) {
          links.push({ source: opIdx, target: nodes.length, value: taxOther })
          nodes.push({ name: 'Tax & Other' })
        }
        if (clampedNI != null && clampedNI > 0) {
          links.push({ source: opIdx, target: nodes.length, value: clampedNI })
          nodes.push({ name: 'Net Income' })
        } else if (hasNegativeNI && taxOther != null && taxOther > 0) {
          // No Net Income node — loss shown via Tax & Other absorbing everything
        }
      } else if (opIncome == null && netIncome != null && netIncome > 0) {
        // No opIncome data: link GP → NI directly
        const niClamped = Math.min(grossProfit, netIncome)
        if (niClamped > 0) {
          links.push({ source: gpIdx, target: nodes.length, value: niClamped })
          nodes.push({ name: 'Net Income' })
          const remainder = grossProfit - niClamped
          if (remainder > revenue * 0.01) {
            links.push({ source: gpIdx, target: nodes.length, value: remainder })
            nodes.push({ name: 'Tax & Other' })
          }
        }
      }
    }

    return { nodes, links, revenue, hasNegativeNI }
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

  // Don't render until measured to avoid 0-width chart
  if (chartWidth < 20) {
    return (
      <div className="bg-white" ref={containerRef} style={{ minHeight: 260 }} />
    )
  }

  const isNarrow = chartWidth < 500
  // Generous margins so labels don't clip on the left edge
  const leftMargin  = isNarrow ? 100 : 140
  const rightMargin = isNarrow ? 110 : 148
  const margin      = { top: 20, right: rightMargin, bottom: 20, left: leftMargin }
  const chartHeight = isNarrow ? 240 : 288

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomNode = ({ x, y, width, height, index, payload }: any) => {
    const name: string  = payload?.name  ?? ''
    const value: number = payload?.value ?? 0
    if (!name || value <= 0) return null

    const fill      = NODE_FILL[name] ?? '#566174'
    const isRevenue = name === 'Revenue'
    const _isLeaf   = leafSet.has(index as number)
    const pct       = Math.round((value / revenue) * 100)
    const isProfit  = PROFIT_NODES.has(name)
    const pctLabel  = isRevenue ? null : isProfit ? `${pct}% margin` : `${pct}% of rev`
    const gap       = 8

    // Revenue label goes left; all others go right — clip guard ensures no negative x
    const labelX    = isRevenue
      ? Math.max(gap, x - gap)
      : x + width + gap
    const anchor    = isRevenue ? 'end' : 'start'

    // Height thresholds for label tiers
    const h         = Math.max(height, 1)
    const showName  = h >= 12
    const showValue = h >= 22
    const showPct   = h >= 34 && pctLabel != null

    const nameY  = showValue ? y + h / 2 - 10 : y + h / 2 - 1
    const valY   = showPct   ? y + h / 2 + 2  : y + h / 2 + 5
    const pctY   = y + h / 2 + 16

    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(h, 2)} rx={3} ry={3} fill={fill} />
        {showName && (
          <text x={labelX} y={nameY} textAnchor={anchor} dominantBaseline="middle"
            fontFamily="Inter, system-ui, sans-serif" fontSize={isNarrow ? 10 : 11}
            fontWeight={600} fill="#566174">
            {name}
          </text>
        )}
        {showValue && (
          <text x={labelX} y={valY} textAnchor={anchor} dominantBaseline="middle"
            fontFamily="DM Mono, IBM Plex Mono, Consolas, monospace"
            fontSize={isNarrow ? 10 : 11} fill="#06101F">
            {fmtFlow(value, sym)}
          </text>
        )}
        {showPct && (
          <text x={labelX} y={pctY} textAnchor={anchor} dominantBaseline="middle"
            fontFamily="Inter, system-ui, sans-serif" fontSize={10} fill="#8A95A6">
            {pctLabel}
          </text>
        )}
      </g>
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomLink = ({ sourceX, sourceControlX, targetX, targetControlX, sourceRelativeY, targetRelativeY, linkWidth, payload }: any) => {
    const tgtName: string = payload?.target?.name ?? ''
    const fill = LINK_FILL[tgtName] ?? 'rgba(148,163,184,0.12)'
    const sy0 = sourceRelativeY, ty0 = targetRelativeY
    const sy1 = sourceRelativeY + linkWidth, ty1 = targetRelativeY + linkWidth
    const d = [
      `M${sourceX},${sy0}`,
      `C${sourceControlX},${sy0} ${targetControlX},${ty0} ${targetX},${ty0}`,
      `L${targetX},${ty1}`,
      `C${targetControlX},${ty1} ${sourceControlX},${sy1} ${sourceX},${sy1}`,
      'Z',
    ].join(' ')
    return <path d={d} fill={fill} stroke="none" />
  }

  return (
    <div className="bg-white" ref={containerRef}>
      {chartWidth > 0 && (
        <>
          <SankeyChart
            width={chartWidth} height={chartHeight}
            data={{ nodes, links }}
            nodePadding={isNarrow ? 16 : 20}
            nodeWidth={7}
            margin={margin}
            node={CustomNode}
            link={CustomLink}
            iterations={32}
          />
          {hasNegativeNI && (
            <p className="px-4 pb-3 text-[10px] text-[#E05252]">
              Net loss period — negative net income not shown in flow
            </p>
          )}
          {!statementsData?.ttm?.incomeStatement && (
            <p className="px-4 pb-3 text-[10px] text-[#9B9B9B]">
              Showing most recent annual period
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Revenue to Profit (horizontal waterfall) ────────────────────────────────

interface WaterfallPeriod {
  label: string   // "Annual" or "Quarterly"
  revenue: number | null
  cogs: number | null
  grossProfit: number | null
  opEx: number | null
  operatingIncome: number | null
  taxOther: number | null
  netIncome: number | null
}

function buildWaterfallPeriod(row: AnyRecord | null, sym: string): WaterfallPeriod | null {
  if (!row) return null
  const revenue = row.totalRevenue ?? row.operatingRevenue ?? null
  if (!revenue || revenue <= 0) return null

  const rawGP   = row.grossProfit ?? null
  const rawCOGS = row.costOfRevenue ?? null
  let grossProfit: number | null = null
  let cogs: number | null = null
  if (rawGP != null && rawGP > 0) {
    grossProfit = Math.min(revenue, rawGP)
    cogs = revenue - grossProfit
  } else if (rawCOGS != null && rawCOGS > 0) {
    cogs = Math.min(revenue, rawCOGS)
    grossProfit = revenue - cogs
  }

  const rawOp = row.operatingIncome ?? row.ebit ?? null
  const operatingIncome = rawOp != null ? rawOp : null
  const opEx = (grossProfit != null && operatingIncome != null)
    ? grossProfit - operatingIncome : null

  const netIncome = row.netIncome ?? row.netIncomeCommonStockholders ?? null
  const taxOther = (operatingIncome != null && operatingIncome > 0 && netIncome != null)
    ? operatingIncome - Math.min(operatingIncome, netIncome)
    : null

  return { label: sym, revenue, cogs, grossProfit, opEx, operatingIncome, taxOther, netIncome }
}

function WaterfallRow({
  name,
  value,
  maxValue,
  isDeduction,
  isProfit,
  isFinal,
  sym,
  showDivider,
}: {
  name: string
  value: number | null
  maxValue: number
  isDeduction?: boolean
  isProfit?: boolean
  isFinal?: boolean
  sym: string
  showDivider?: boolean
}) {
  if (value == null) return null
  const barPct = maxValue > 0 ? Math.max(2, Math.min(100, (Math.abs(value) / maxValue) * 100)) : 2
  const isNeg  = value < 0

  const barColor = isDeduction
    ? 'bg-[#F4A7B9]'          // pink-red for costs (like the screenshot)
    : isProfit || isFinal
      ? value >= 0 ? 'bg-[#34D399]' : 'bg-[#F87171]'  // green profit / red loss
      : 'bg-[#60A5FA]'        // blue for revenue

  return (
    <>
      {showDivider && <div className="my-1.5 border-t border-[#E5E5E5]" />}
      <div className="flex items-center gap-3 group">
        {/* Label */}
        <div className="w-[130px] sm:w-[150px] shrink-0 text-right">
          <span className={cn(
            'text-[11.5px] leading-none',
            isDeduction ? 'text-[#9B9B9B]' : 'text-[#111111]',
            isFinal && 'font-[700]',
          )}>
            {isDeduction && <span className="text-[#D83B3B] font-[600] mr-0.5">−</span>}
            {name}
          </span>
        </div>

        {/* Bar track */}
        <div className="flex-1 min-w-0 h-[22px] bg-[#F5F5F5] rounded-lg overflow-hidden">
          <div
            className={cn('h-full rounded-lg transition-all', barColor)}
            style={{ width: `${barPct}%` }}
          />
        </div>

        {/* Value */}
        <div className="w-[58px] shrink-0 text-right">
          <span className={cn(
            'text-[12px] tabular-nums font-[600]',
            isDeduction ? 'text-[#9B9B9B]' : isNeg ? 'text-[#D83B3B]' : isProfit || isFinal ? 'text-[#11875D]' : 'text-[#111111]',
          )}>
            {isNeg ? '−' : ''}{fmtFlow(Math.abs(value), sym)}
          </span>
        </div>
      </div>
    </>
  )
}

function RevenueToProfitView({
  statementsData,
  currency,
}: {
  statementsData: AnyRecord
  currency: string
}) {
  const [period, setPeriod] = useState<'annual' | 'quarterly'>('annual')
  const sym = currSym(statementsData?.financialCurrency ?? currency)

  const data = useMemo<WaterfallPeriod | null>(() => {
    if (period === 'annual') {
      const rows: AnyRecord[] = statementsData?.annual?.incomeStatement ?? []
      const row = rows[rows.length - 1] ?? null
      return buildWaterfallPeriod(row, sym)
    } else {
      const rows: AnyRecord[] = statementsData?.quarterly?.incomeStatement ?? []
      const row = rows[rows.length - 1] ?? null
      return buildWaterfallPeriod(row, sym)
    }
  }, [statementsData, period, sym])

  if (!data) {
    return (
      <div className="px-5 py-10 flex items-center justify-center">
        <p className="text-[13px] text-[#9B9B9B]">No income data available</p>
      </div>
    )
  }

  // Max value is revenue — everything is relative to it
  const maxValue = data.revenue ?? 0

  return (
    <div className="bg-white px-4 sm:px-5 pt-3 pb-4">
      {/* Period toggle — top right like in the screenshot */}
      <div className="flex items-center justify-end gap-1 mb-3">
        <button
          onClick={() => setPeriod('annual')}
          className={cn(
            'px-3 py-1 text-[12px] font-[600] rounded-full transition-colors',
            period === 'annual'
              ? 'bg-[#E5E5E5] text-[#111111]'
              : 'text-[#9B9B9B] hover:text-[#6B6B6B]'
          )}
        >
          Annual
        </button>
        <button
          onClick={() => setPeriod('quarterly')}
          className={cn(
            'px-3 py-1 text-[12px] font-[600] rounded-full transition-colors',
            period === 'quarterly'
              ? 'bg-[#E5E5E5] text-[#111111]'
              : 'text-[#9B9B9B] hover:text-[#6B6B6B]'
          )}
        >
          Quarterly
        </button>
      </div>

      {/* Waterfall rows */}
      <div className="flex flex-col gap-1.5">
        <WaterfallRow
          name="Revenue"
          value={data.revenue}
          maxValue={maxValue}
          sym={sym}
        />
        <WaterfallRow
          name="Cost of Goods Sold"
          value={data.cogs}
          maxValue={maxValue}
          isDeduction
          sym={sym}
        />
        <WaterfallRow
          name="Gross Profit"
          value={data.grossProfit}
          maxValue={maxValue}
          isProfit
          sym={sym}
          showDivider
        />
        <WaterfallRow
          name="Operating Expenses"
          value={data.opEx}
          maxValue={maxValue}
          isDeduction
          sym={sym}
        />
        <WaterfallRow
          name="Operating Income"
          value={data.operatingIncome}
          maxValue={maxValue}
          isProfit
          sym={sym}
          showDivider
        />
        <WaterfallRow
          name="Taxes & Other"
          value={data.taxOther}
          maxValue={maxValue}
          isDeduction
          sym={sym}
        />
        <WaterfallRow
          name="Net Income"
          value={data.netIncome}
          maxValue={maxValue}
          isFinal
          sym={sym}
          showDivider
        />
      </div>
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
    { id: 'flow',    label: 'Revenue to Profit' },
  ]

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E5E5E5] shadow-card">
      {/* Header with tab toggle */}
      <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-[#E5E5E5] flex items-center justify-between gap-3">
        <p className="text-[13px] font-[700] text-[#111111] leading-tight">Business Performance</p>
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
        {/* Legend */}
        {activeView === 'revenue' && (
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#D8E6FF]" />
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
              <span className="inline-block w-2 h-2 rounded-sm bg-[#34D399]" />
              Profit
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#F4A7B9]" />
              Cost
            </span>
          </div>
        )}
      </div>

      {activeView === 'revenue' && <RevenueView statementsData={statementsData} currency={currency} />}
      {activeView === 'flow'    && <RevenueToProfitView statementsData={statementsData} currency={currency} />}
    </div>
  )
}
