'use client'

interface PhaseScoreBadgeProps {
  score: number | null   // 0.0–1.0
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export default function PhaseScoreBadge({ score, size = 'md', showLabel = false }: PhaseScoreBadgeProps) {
  if (score === null) {
    return (
      <span className={`inline-flex items-center rounded font-mono font-semibold ${size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-1'} bg-[#21262d] text-[#8b949e]`}>
        —
      </span>
    )
  }

  const pct = Math.round(score * 100)

  const { bg, text } =
    pct >= 70 ? { bg: 'bg-[#0d2b14]', text: 'text-[#3fb950]' }
    : pct >= 40 ? { bg: 'bg-[#2b2000]', text: 'text-[#e3b341]' }
    : { bg: 'bg-[#2d0a0a]', text: 'text-[#f85149]' }

  return (
    <span className={`inline-flex items-center gap-1 rounded font-mono font-semibold ${size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-1'} ${bg} ${text}`}>
      {pct}%
      {showLabel && (
        <span className="font-normal opacity-70">
          {pct >= 70 ? 'Strong' : pct >= 40 ? 'Mixed' : 'Weak'}
        </span>
      )}
    </span>
  )
}
