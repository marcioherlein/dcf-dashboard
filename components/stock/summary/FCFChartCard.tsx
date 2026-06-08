'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'

const BarChart          = dynamic(() => import('recharts').then(m => m.BarChart),          { ssr: false })
const Bar               = dynamic(() => import('recharts').then(m => m.Bar),               { ssr: false })
const XAxis             = dynamic(() => import('recharts').then(m => m.XAxis),             { ssr: false })
const CartesianGrid     = dynamic(() => import('recharts').then(m => m.CartesianGrid),     { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const Cell              = dynamic(() => import('recharts').then(m => m.Cell),              { ssr: false })
const LabelList         = dynamic(() => import('recharts').then(m => m.LabelList),         { ssr: false })
const ReferenceLine     = dynamic(() => import('recharts').then(m => m.ReferenceLine),     { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface Props {
  statementsData: any // { annual: { cashFlow: Array<{year,operatingCashFlow,capitalExpenditures}> }, quarterly: { cashFlow: Array<{...}> } }
  currency?: string
}

type PeriodTab = 'Q' | 'Y'

interface ChartPoint {
  label: string
  fcf: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveFCF(row: AnyRecord): number | null {
  const opCF = row.operatingCashFlow ?? row.totalCashFromOperatingActivities ?? null
  const capex = row.capitalExpenditures ?? row.capitalExpendituresIncludingFinancedLeases ?? null
  if (opCF == null) return null
  const fcf = opCF - Math.abs(capex ?? 0)
  return fcf
}

function fmtValue(v: number, useB: boolean): string {
  if (useB) {
    const b = v / 1e9
    return `${b >= 0 ? '' : '-'}${Math.abs(b).toFixed(1)}B`
  }
  const m = v / 1e6
  return `${m >= 0 ? '' : '-'}${Math.abs(m).toFixed(0)}M`
}

function getUnit(maxAbs: number): { useB: boolean; label: string } {
  const useB = maxAbs >= 500e6
  return { useB, label: useB ? '(B USD)' : '(M USD)' }
}

function buildAnnualPoints(statementsData: any): ChartPoint[] {
  const rows: AnyRecord[] = statementsData?.annual?.cashFlow ?? []
  return rows
    .slice(-6)
    .map(row => {
      const fcf = deriveFCF(row)
      if (fcf == null) return null
      const label = String(row.year ?? row.endDate ?? '').slice(0, 4)
      return { label, fcf }
    })
    .filter((p): p is ChartPoint => p !== null)
}

function buildQuarterlyPoints(statementsData: any): ChartPoint[] {
  const rows: AnyRecord[] = statementsData?.quarterly?.cashFlow ?? []
  return rows
    .slice(-8)
    .map(row => {
      const fcf = deriveFCF(row)
      if (fcf == null) return null
      // Build quarter label like "Q2 '24"
      let label = String(row.quarter ?? '')
      if (!label) {
        const date = String(row.endDate ?? row.date ?? '')
        if (date.length >= 7) {
          const yr = date.slice(2, 4)
          const mo = parseInt(date.slice(5, 7), 10)
          const q = Math.ceil(mo / 3)
          label = `Q${q} '${yr}`
        }
      }
      if (!label) label = String(row.year ?? '').slice(0, 4)
      return { label, fcf }
    })
    .filter((p): p is ChartPoint => p !== null)
}

// ─── Custom label above/below bar ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ValueLabel(props: any) {
  const { x, y, width, value, useB } = props
  if (value == null) return null
  const text = fmtValue(value as number, useB)
  const isNeg = (value as number) < 0
  const labelY = isNeg ? y + 14 : y - 5
  return (
    <text
      x={x + width / 2}
      y={labelY}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={9}
      fontWeight={600}
      fill={isNeg ? '#D83B3B' : '#5F790B'}
      fontFamily="Inter, system-ui, sans-serif"
    >
      {text}
    </text>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FCFChartCard({ statementsData, currency = 'USD' }: Props) {
  const [period, setPeriod] = useState<PeriodTab>('Y')

  const points = useMemo<ChartPoint[]>(() => {
    if (!statementsData) return []
    if (period === 'Y') return buildAnnualPoints(statementsData)
    return buildQuarterlyPoints(statementsData)
  }, [statementsData, period])

  const { useB, label: unitLabel } = useMemo(() => {
    if (points.length === 0) return { useB: false, label: '(M USD)' }
    const maxAbs = Math.max(...points.map(p => Math.abs(p.fcf)))
    return getUnit(maxAbs)
  }, [points])

  const hasNeg = points.some(p => p.fcf < 0)

  if (!statementsData || points.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4">
        <p className="text-[11px] font-[650] tracking-wide text-[#6B6B6B] uppercase mb-2">
          Free Cash Flow Chart
        </p>
        <p className="text-[12px] text-[#9B9B9B]">No cash flow data available.</p>
      </div>
    )
  }

  const tickFill   = '#8A95A6'
  const gridStroke = 'rgba(148,163,184,0.12)'

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-[650] tracking-wide text-[#6B6B6B] uppercase">
            Free Cash Flow Chart
          </span>
          <span className="text-[10px] text-[#9B9B9B]">{unitLabel}</span>
        </div>
        {/* Q / Y toggle */}
        <div className="flex items-center gap-0.5 bg-[#F5F5F5] rounded-lg p-0.5 shrink-0">
          {(['Q', 'Y'] as PeriodTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setPeriod(tab)}
              className={[
                'text-[11px] font-[600] w-7 h-7 rounded-md transition-colors',
                period === tab
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-[#6B6B6B] hover:text-[#111111]',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={168}>
        <BarChart
          data={points}
          margin={{ top: 20, right: 4, left: 0, bottom: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridStroke}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: tickFill }}
            axisLine={false}
            tickLine={false}
          />
          {hasNeg && (
            <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" strokeWidth={1} />
          )}
          <Bar
            dataKey="fcf"
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
            isAnimationActive={false}
          >
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={p.fcf >= 0 ? '#5F790B' : '#D83B3B'}
                fillOpacity={0.88}
              />
            ))}
            <LabelList
              dataKey="fcf"
              content={(props) => <ValueLabel {...props} useB={useB} />}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend row */}
      <div className="flex items-center gap-4 mt-1">
        <span className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
          <span className="inline-block w-2 h-2 rounded-sm bg-[#5F790B]" />
          Positive FCF
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[#9B9B9B]">
          <span className="inline-block w-2 h-2 rounded-sm bg-[#D83B3B]" />
          Negative FCF
        </span>
        <span className="ml-auto text-[9px] text-[#C4C4C4]">
          FCF = Operating CF &minus; |Capex|
        </span>
      </div>
    </div>
  )
}
