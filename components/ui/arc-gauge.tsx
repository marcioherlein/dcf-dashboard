'use client'

interface ArcGaugeProps {
  value: number        // 0–100
  size?: number        // SVG dimension (default 120)
  strokeWidth?: number // (default 8)
  color?: string       // stroke color (default '#3B82F6')
  label?: string       // center sub-label
  displayValue?: string // center main text (default: value%)
  glowColor?: string   // glow color (default matches color)
}

export default function ArcGauge({
  value,
  size = 120,
  strokeWidth = 8,
  color = '#3B82F6',
  label,
  displayValue,
  glowColor,
}: ArcGaugeProps) {
  const cx = size / 2
  const cy = size / 2
  const r = (size - strokeWidth * 2) / 2

  // 270° sweep: starts at 135° (bottom-left), ends at 45° (bottom-right)
  const startAngle = 135
  const totalSweep = 270

  const clampedValue = Math.max(0, Math.min(100, value))

  const toRad = (deg: number) => (deg * Math.PI) / 180

  const startX = cx + r * Math.cos(toRad(startAngle))
  const startY = cy + r * Math.sin(toRad(startAngle))

  // Compute the path for a given sweep angle
  const describeArc = (sweep: number) => {
    const endAngle = startAngle + sweep
    const endX = cx + r * Math.cos(toRad(endAngle))
    const endY = cy + r * Math.sin(toRad(endAngle))
    const largeArc = sweep > 180 ? 1 : 0
    return `M ${startX.toFixed(2)},${startY.toFixed(2)} A ${r},${r} 0 ${largeArc},1 ${endX.toFixed(2)},${endY.toFixed(2)}`
  }

  const trackPath = describeArc(totalSweep)
  const fillPath = describeArc(totalSweep * (clampedValue / 100))

  const filterId = `arc-glow-${color.replace('#', '')}`
  const glowStroke = glowColor ?? color

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track */}
      <path
        d={trackPath}
        stroke="rgba(15,23,42,0.08)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />

      {/* Filled arc with glow */}
      {clampedValue > 0 && (
        <path
          d={fillPath}
          stroke={glowStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          filter={`url(#${filterId})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
      )}

      {/* Center display */}
      <text
        x={cx}
        y={cy - (label ? 6 : 0)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#1E293B"
        fontSize={size * 0.22}
        fontWeight="700"
        fontFamily="'IBM Plex Mono', monospace"
      >
        {displayValue ?? `${Math.round(clampedValue)}`}
      </text>

      {label && (
        <text
          x={cx}
          y={cy + size * 0.14}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(148,163,184,0.7)"
          fontSize={size * 0.11}
          fontWeight="500"
          fontFamily="'Inter', system-ui, sans-serif"
        >
          {label}
        </text>
      )}
    </svg>
  )
}
