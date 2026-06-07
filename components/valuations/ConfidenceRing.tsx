'use client'

interface ConfidenceRingProps {
  score: number | null  // 0.0–1.0
  size?: number
}

export function ConfidenceRing({ score, size = 40 }: ConfidenceRingProps) {
  if (score == null) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div style={{ width: size, height: size }} className="flex items-center justify-center">
          <span className="text-[13px] text-[#8A95A6]">—</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8A95A6]">N/A</span>
      </div>
    )
  }

  const pct      = Math.round(score * 100)
  const r        = (size - 6) / 2
  const circ     = 2 * Math.PI * r
  const offset   = circ * (1 - pct / 100)
  const color    = pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'
  const bgColor  = pct >= 70 ? '#dcfce7' : pct >= 40 ? '#fef3c7' : '#fee2e2'
  const label    = pct >= 80 ? 'Very High' : pct >= 60 ? 'High' : pct >= 40 ? 'Medium' : 'Low'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="-rotate-90"
          aria-label={`Confidence score: ${pct} — ${label}`}
        >
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bgColor} strokeWidth={3} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={3}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold leading-none tabular-nums" style={{ color }}>
            {pct}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8A95A6]">{label}</span>
    </div>
  )
}
