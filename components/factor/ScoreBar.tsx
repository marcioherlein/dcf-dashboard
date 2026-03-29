'use client'

interface ScoreBarProps {
  score: number   // 0–100
  size?: 'sm' | 'md'
}

function scoreColor(score: number): string {
  if (score >= 75) return 'bg-secondary'
  if (score >= 55) return 'bg-primary/70'
  if (score >= 40) return 'bg-on-surface-variant/40'
  return 'bg-error/60'
}

function scoreTextColor(score: number): string {
  if (score >= 75) return 'text-secondary'
  if (score >= 55) return 'text-primary'
  if (score >= 40) return 'text-on-surface-variant'
  return 'text-error'
}

export function ScoreBar({ score, size = 'md' }: ScoreBarProps) {
  const h = size === 'sm' ? 'h-1' : 'h-1.5'
  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex-1 ${h} rounded-full bg-surface-container overflow-hidden`}>
        <div
          className={`${h} rounded-full transition-all ${scoreColor(score)}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums w-8 text-right ${scoreTextColor(score)}`}>
        {score.toFixed(0)}
      </span>
    </div>
  )
}

export function ScoreBadge({ score }: { score: number }) {
  let cls = ''
  let label = ''
  if (score >= 75)      { cls = 'bg-secondary-container/40 text-on-secondary-container'; label = 'Strong' }
  else if (score >= 60) { cls = 'bg-primary-fixed/40 text-on-primary-fixed-variant';      label = 'Good' }
  else if (score >= 40) { cls = 'bg-surface-container text-on-surface-variant';           label = 'Neutral' }
  else                  { cls = 'bg-error-container/40 text-on-error-container';           label = 'Weak' }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}
