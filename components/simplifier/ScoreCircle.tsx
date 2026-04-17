'use client'

interface ScoreCircleProps {
  score: number | null  // 1.0–5.0
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const SIZE = { sm: 64, md: 88, lg: 112 }
const STROKE = { sm: 6, md: 7, lg: 8 }

function scoreColor(score: number): string {
  if (score >= 4.5) return '#1f6feb'
  if (score >= 3.5) return '#0969da'
  if (score >= 2.5) return '#9a6700'
  return '#cf222e'
}

function scoreLabel(score: number): string {
  if (score >= 4.5) return 'EXCELLENT'
  if (score >= 3.5) return 'STRONG'
  if (score >= 2.5) return 'AVERAGE'
  if (score >= 1.5) return 'WEAK'
  return 'POOR'
}

export default function ScoreCircle({ score, size = 'md', label }: ScoreCircleProps) {
  const px      = SIZE[size]
  const stroke  = STROKE[size]
  const radius  = (px - stroke * 2) / 2
  const cx      = px / 2
  const cy      = px / 2
  // Arc spans 270 degrees starting at 135deg (bottom-left) going clockwise
  const circumference = 2 * Math.PI * radius
  const arcLength     = circumference * 0.75  // 270° of 360°

  const fill = score != null ? Math.min(Math.max((score - 1) / 4, 0), 1) : 0
  const dashOffset = arcLength - fill * arcLength

  const color = score != null ? scoreColor(score) : '#E8E6E0'
  const displayScore = score != null ? Math.round(score) : '–'
  const displayLabel = score != null ? (label ?? scoreLabel(score)) : ''

  // Convert 270° arc to SVG path
  // Start at 135° (bottom-left), end at 45° (bottom-right) going clockwise
  const startAngle = 135 * (Math.PI / 180)
  const endAngle   = 45  * (Math.PI / 180)

  const x1 = cx + radius * Math.cos(startAngle)
  const y1 = cy + radius * Math.sin(startAngle)
  const x2 = cx + radius * Math.cos(endAngle)
  const y2 = cy + radius * Math.sin(endAngle)

  const trackPath = `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`

  const fontSize = { sm: 18, md: 26, lg: 34 }[size]
  const labelSize = { sm: 7, md: 8, lg: 9 }[size]

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}>
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#E8E6E0"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Fill */}
        {score != null && (
          <path
            d={trackPath}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arcLength}`}
            strokeDashoffset={dashOffset}
          />
        )}
        {/* Score number */}
        <text
          x={cx}
          y={cy + fontSize * 0.35}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight="700"
          fontFamily="'IBM Plex Mono', monospace"
          fill={score != null ? color : '#6B6A72'}
        >
          {displayScore}
        </text>
        {/* Label */}
        {displayLabel && (
          <text
            x={cx}
            y={cy + fontSize * 0.35 + labelSize + 4}
            textAnchor="middle"
            fontSize={labelSize}
            fontWeight="600"
            fontFamily="'Inter', sans-serif"
            fill="#6B6A72"
            letterSpacing="0.08em"
          >
            {displayLabel}
          </text>
        )}
      </svg>
    </div>
  )
}
