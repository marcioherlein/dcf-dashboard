'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const SankeyChart = dynamic(() => import('recharts').then(m => m.Sankey), { ssr: false })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFlow(v: number, curr = 'USD'): string {
  const abs = Math.abs(v)
  const sym =
    curr === 'USD' ? '$'
    : curr === 'EUR' ? '€'
    : curr === 'GBP' ? '£'
    : curr === 'JPY' ? '¥'
    : curr === 'CNY' ? '¥'
    : `${curr} `
  if (abs >= 1e12) return `${sym}${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9)  return `${sym}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `${sym}${(abs / 1e6).toFixed(0)}M`
  return `${sym}${Math.round(abs / 1e3)}K`
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const NODE_FILL: Record<string, string> = {
  'Revenue':             '#2563EB',
  'Cost of Revenue':     '#DC2626',
  'Gross Profit':        '#059669',
  'Operating Expenses':  '#DC2626',
  'Operating Income':    '#059669',
  'Tax & Other':         '#8A95A6',
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

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface IncomeFlowCardProps {
  statementsData: AnyRecord | null
  currency?: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IncomeFlowCard({ statementsData, currency = 'USD' }: IncomeFlowCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(640)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setChartWidth(entry.contentRect.width)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const fin = statementsData?.financialCurrency ?? currency
  const ttm: AnyRecord | null = statementsData?.ttm?.incomeStatement ?? null

  const { nodes, links, revenue } = useMemo(() => {
    if (!ttm) return { nodes: [], links: [], revenue: 0 }

    const revenue = Math.max(0, ttm.totalRevenue ?? 0)
    if (!revenue) return { nodes: [], links: [], revenue: 0 }

    const grossProfit    = Math.min(revenue, Math.max(0, ttm.grossProfit ?? 0))
    const cogs           = revenue - grossProfit
    const opIncome       = Math.max(0, Math.min(grossProfit, ttm.operatingIncome ?? 0))
    const opEx           = grossProfit - opIncome
    const clampedNI      = Math.max(0, Math.min(opIncome, ttm.netIncome ?? 0))
    const taxOther       = opIncome - clampedNI

    const nodes: { name: string }[]                              = [{ name: 'Revenue' }]
    const links: { source: number; target: number; value: number }[] = []
    const revIdx = 0

    if (cogs > 0) {
      links.push({ source: revIdx, target: nodes.length, value: cogs })
      nodes.push({ name: 'Cost of Revenue' })
    }

    if (grossProfit > 0) {
      const gpIdx = nodes.length
      links.push({ source: revIdx, target: gpIdx, value: grossProfit })
      nodes.push({ name: 'Gross Profit' })

      if (opEx > 0) {
        links.push({ source: gpIdx, target: nodes.length, value: opEx })
        nodes.push({ name: 'Operating Expenses' })
      }

      if (opIncome > 0) {
        const opIncIdx = nodes.length
        links.push({ source: gpIdx, target: opIncIdx, value: opIncome })
        nodes.push({ name: 'Operating Income' })

        if (taxOther > 0) {
          links.push({ source: opIncIdx, target: nodes.length, value: taxOther })
          nodes.push({ name: 'Tax & Other' })
        }

        if (clampedNI > 0) {
          links.push({ source: opIncIdx, target: nodes.length, value: clampedNI })
          nodes.push({ name: 'Net Income' })
        }
      }
    }

    return { nodes, links, revenue }
  }, [ttm])

  // leaf nodes have no outgoing links — these always get full labels
  const leafSet = useMemo(() => {
    const hasOut = new Set(links.map(l => l.source))
    return new Set(nodes.map((_, i) => i).filter(i => !hasOut.has(i)))
  }, [nodes, links])

  if (!nodes.length || !revenue) return null

  const isNarrow = chartWidth < 540

  // ── Custom renderers ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomNode = ({ x, y, width, height, index, payload }: any) => {
    const name: string  = payload?.name  ?? ''
    const value: number = payload?.value ?? 0
    if (!name || value <= 0) return null

    const fill       = NODE_FILL[name]  ?? '#566174'
    const isRevenue  = name === 'Revenue'
    const isLeaf     = leafSet.has(index as number)
    // on narrow screens, only show full labels for Revenue and leaf nodes
    const fullLabel  = !isNarrow || isRevenue || isLeaf
    const pct        = Math.round((value / revenue) * 100)
    const isProfit   = PROFIT_NODES.has(name)
    const pctLabel   = isRevenue ? null : isProfit ? `${pct}% margin` : `${pct}% of rev`
    const gap        = 10
    const labelX     = isRevenue ? x - gap : x + width + gap
    const anchor     = isRevenue ? 'end'   : 'start'
    // on narrow screens, hide labels entirely for intermediate nodes to prevent overlap
    const showName   = height >= 14 && (!isNarrow || isRevenue || isLeaf)
    const showValue  = fullLabel && height >= 26
    const showPct    = fullLabel && height >= 38

    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(height, 2)} rx={3} ry={3} fill={fill} />

        {showName && (
          <text
            x={labelX}
            y={y + height / 2 - (showValue ? 9 : 0)}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={11}
            fontWeight={600}
            fill="#566174"
          >
            {name}
          </text>
        )}

        {showValue && (
          <text
            x={labelX}
            y={y + height / 2 + (showPct ? 4 : 5)}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontFamily="DM Mono, IBM Plex Mono, monospace"
            fontSize={11}
            fill="#06101F"
          >
            {fmtFlow(value, fin)}
          </text>
        )}

        {showPct && pctLabel && (
          <text
            x={labelX}
            y={y + height / 2 + 18}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={10}
            fill="#566174"
          >
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

    const sy0 = sourceRelativeY
    const ty0 = targetRelativeY
    const sy1 = sourceRelativeY + linkWidth
    const ty1 = targetRelativeY + linkWidth

    const d = [
      `M${sourceX},${sy0}`,
      `C${sourceControlX},${sy0} ${targetControlX},${ty0} ${targetX},${ty0}`,
      `L${targetX},${ty1}`,
      `C${targetControlX},${ty1} ${sourceControlX},${sy1} ${sourceX},${sy1}`,
      'Z',
    ].join(' ')

    return <path d={d} fill={fill} stroke="none" />
  }

  const margin      = isNarrow
    ? { top: 20, right: 120, bottom: 20, left: 120 }
    : { top: 24, right: 152, bottom: 24, left: 152 }
  const chartHeight = isNarrow ? 260 : 300

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E3E1DA] shadow-card">
      <div className="px-5 py-3 bg-white border-b border-[#E3E1DA] flex items-center justify-between">
        <p className="text-[12px] font-[650] text-[#566174]">Income breakdown · TTM</p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-[#8A95A6]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#059669]" />
            Profit
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#8A95A6]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#DC2626]" />
            Cost
          </span>
        </div>
      </div>
      <div className="bg-white" ref={containerRef}>
        {chartWidth > 0 && (
          <SankeyChart
            width={chartWidth}
            height={chartHeight}
            data={{ nodes, links }}
            nodePadding={isNarrow ? 18 : 24}
            nodeWidth={8}
            margin={margin}
            node={CustomNode}
            link={CustomLink}
            iterations={64}
          />
        )}
      </div>
    </div>
  )
}
