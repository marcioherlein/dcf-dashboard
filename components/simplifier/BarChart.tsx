'use client'

export interface BarChartRow {
  year: string
  value: number | null
  isProjected?: boolean
}

interface BarChartProps {
  rows: BarChartRow[]
  label?: string
  color?: string
  unit?: 'M' | 'B' | '$B' | '$M' | '%' | '$'
  showGrowth?: boolean
  height?: number
}

function formatVal(v: number, unit: string): string {
  if (unit === 'B' || unit === '$B') {
    return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(0)}M`
  }
  if (unit === 'M' || unit === '$M') return `$${v.toFixed(0)}M`
  if (unit === '%') return `${v.toFixed(1)}%`
  if (unit === '$') return `$${v.toFixed(2)}`
  return v.toFixed(1)
}

export default function BarChart({
  rows,
  label,
  color = '#1f6feb',
  unit = 'B',
  showGrowth = true,
  height = 140,
}: BarChartProps) {
  if (!rows.length) return null

  const values = rows.map(r => r.value ?? 0)
  const maxVal  = Math.max(...values, 0.001)
  const minVal  = Math.min(...values, 0)
  const range   = maxVal - minVal || 1

  const PAD_LEFT   = 44
  const PAD_RIGHT  = 8
  const PAD_TOP    = 28   // room for growth label above bars
  const PAD_BOTTOM = 24   // room for x-axis labels
  const chartH     = height - PAD_TOP - PAD_BOTTOM
  const svgW       = 500  // viewBox width; scales with container

  const barW = Math.max(18, Math.floor((svgW - PAD_LEFT - PAD_RIGHT) / rows.length - 4))
  const gap  = Math.floor((svgW - PAD_LEFT - PAD_RIGHT - rows.length * barW) / (rows.length + 1))

  // Y-axis: 3 gridlines
  const gridLines = [0, 0.5, 1].map(t => {
    const v = minVal + t * range
    const y = PAD_TOP + chartH - ((v - minVal) / range) * chartH
    return { y, label: formatVal(v, unit) }
  })

  // Zero line (if minVal < 0)
  const zeroY = PAD_TOP + chartH - ((0 - minVal) / range) * chartH

  return (
    <div>
      {label && (
        <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-2">{label}</p>
      )}
      <svg
        viewBox={`0 0 ${svgW} ${height}`}
        className="w-full"
        style={{ height }}
        aria-hidden="true"
      >
        {/* Gridlines */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              x2={svgW - PAD_RIGHT}
              y1={g.y}
              y2={g.y}
              stroke="#E8E6E0"
              strokeWidth="1"
            />
            <text
              x={PAD_LEFT - 4}
              y={g.y + 4}
              textAnchor="end"
              fontSize="9"
              fill="#6B6A72"
              fontFamily="'IBM Plex Mono', monospace"
            >
              {g.label}
            </text>
          </g>
        ))}

        {/* Zero line if negative values exist */}
        {minVal < 0 && (
          <line
            x1={PAD_LEFT}
            x2={svgW - PAD_RIGHT}
            y1={zeroY}
            y2={zeroY}
            stroke="#9a6700"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Bars */}
        {rows.map((row, i) => {
          const v     = row.value ?? 0
          const x     = PAD_LEFT + gap + i * (barW + gap)
          const barH  = Math.abs((v / range) * chartH)
          const y     = v >= 0
            ? PAD_TOP + chartH - ((v - minVal) / range) * chartH
            : zeroY

          // YoY growth
          const prev    = i > 0 ? (rows[i - 1].value ?? null) : null
          const growth  = prev != null && prev !== 0 ? (v - prev) / Math.abs(prev) : null
          const growthColor = growth == null ? '#6B6A72' : growth >= 0 ? '#1f6feb' : '#cf222e'
          const growthLabel = growth != null
            ? `${growth >= 0 ? '+' : ''}${(growth * 100).toFixed(0)}%`
            : ''

          const isProj = !!row.isProjected
          const fillColor = isProj ? color + '44' : color
          const strokeColor = isProj ? color : 'none'

          return (
            <g key={row.year}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, 2)}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isProj ? 1 : 0}
                strokeDasharray={isProj ? '3 2' : undefined}
                rx="2"
              />

              {/* Growth label above bar */}
              {showGrowth && growthLabel && (
                <text
                  x={x + barW / 2}
                  y={Math.max(y - 4, PAD_TOP - 2)}
                  textAnchor="middle"
                  fontSize="8"
                  fill={growthColor}
                  fontFamily="'IBM Plex Mono', monospace"
                  fontWeight="600"
                >
                  {growthLabel}
                </text>
              )}

              {/* X-axis label */}
              <text
                x={x + barW / 2}
                y={PAD_TOP + chartH + 14}
                textAnchor="middle"
                fontSize="9"
                fill={isProj ? '#6B6A72' : '#2D2C31'}
                fontFamily="'Inter', sans-serif"
              >
                {row.year}
              </text>

              {/* Value label inside/below bar for projected (smaller) */}
              {isProj && (
                <text
                  x={x + barW / 2}
                  y={y + Math.max(barH, 2) + 10}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#6B6A72"
                  fontFamily="'IBM Plex Mono', monospace"
                >
                  {formatVal(v, unit)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
