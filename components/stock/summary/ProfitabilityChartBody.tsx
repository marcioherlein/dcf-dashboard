'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartPoint {
  period: string
  grossMargin: number | null
  ebitMargin: number | null
  netMargin: number | null
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string
  value: number | null
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const rows: { label: string; value: number | null; color: string }[] = [
    {
      label: 'Gross Margin',
      value: payload.find((p) => p.name === 'grossMargin')?.value ?? null,
      color: '#5F790B',
    },
    {
      label: 'EBIT Margin',
      value: payload.find((p) => p.name === 'ebitMargin')?.value ?? null,
      color: '#B56A00',
    },
    {
      label: 'Net Margin',
      value: payload.find((p) => p.name === 'netMargin')?.value ?? null,
      color: '#6B6B6B',
    },
  ]

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg shadow-lg px-3 py-2 min-w-[140px]">
      <p className="text-[10px] font-[700] text-[#111111] mb-1.5">{label}</p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 mb-0.5">
          <span className="flex items-center gap-1 text-[10px] text-[#6B6B6B]">
            <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
              <line
                x1="0" y1="4" x2="16" y2="4"
                stroke={row.color}
                strokeWidth="2"
                strokeDasharray={
                  row.label === 'EBIT Margin' ? '6 3' :
                  row.label === 'Net Margin' ? '2 3' :
                  undefined
                }
                strokeLinecap="round"
              />
            </svg>
            {row.label}
          </span>
          <span
            className="text-[10px] font-[600] tabular-nums"
            style={{ color: row.color }}
          >
            {fmtPct(row.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── X-axis tick ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function XTick(props: Record<string, any>) {
  const x: number = props.x ?? 0
  const y: number = props.y ?? 0
  const raw: string = props.payload?.value ?? ''

  // For YYYY-MM format, show quarter-style label; for YYYY show year
  let label = raw
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const month = parseInt(raw.slice(5, 7), 10)
    const quarter = Math.ceil(month / 3)
    label = `Q${quarter}'${raw.slice(2, 4)}`
  }

  return (
    <text
      x={x}
      y={y + 10}
      textAnchor="middle"
      fill="#9B9B9B"
      fontSize={11}
      fontWeight={500}
    >
      {label}
    </text>
  )
}

// ─── Chart body ───────────────────────────────────────────────────────────────

export default function ProfitabilityChartBody({ points }: { points: ChartPoint[] }) {
  const tickInterval = points.length > 10 ? Math.ceil(points.length / 8) - 1 : 0

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart
        data={points}
        margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#F0F0F0"
          vertical={false}
        />

        <XAxis
          dataKey="period"
          tick={XTick}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />

        <YAxis
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          tick={{ fill: '#9B9B9B', fontSize: 11, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
          width={34}
        />

        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: '#E5E5E5', strokeWidth: 1 }}
        />

        {/* Gross Margin — solid olive */}
        <Line
          type="monotone"
          dataKey="grossMargin"
          name="grossMargin"
          stroke="#5F790B"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0, fill: '#5F790B' }}
          connectNulls
        />

        {/* EBIT Margin — dashed amber */}
        <Line
          type="monotone"
          dataKey="ebitMargin"
          name="ebitMargin"
          stroke="#B56A00"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0, fill: '#B56A00' }}
          connectNulls
        />

        {/* Net Margin — dotted grey */}
        <Line
          type="monotone"
          dataKey="netMargin"
          name="netMargin"
          stroke="#6B6B6B"
          strokeWidth={2}
          strokeDasharray="2 3"
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0, fill: '#6B6B6B' }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
