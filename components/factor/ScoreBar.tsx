'use client'

interface ScoreBarProps {
  score: number   // 0–100
  size?: 'sm' | 'md'
}

function scoreColor(score: number): string {
  if (score >= 75) return 'bg-secondary dark:bg-secondary-container'
  if (score >= 55) return 'bg-primary/70 dark:bg-primary-fixed-dim/70'
  if (score >= 40) return 'bg-on-surface-variant/40 dark:bg-white/20'
  return 'bg-error/60 dark:bg-error-container/60'
}

function scoreBg(score: number): string {
  if (score >= 75) return 'text-secondary dark:text-secondary-container'
  if (score >= 55) return 'text-primary dark:text-primary-fixed-dim'
  if (score >= 40) return 'text-on-surface-variant dark:text-white/50'
  return 'text-error dark:text-error-container'
}

export function ScoreBar({ score, size = 'md' }: ScoreBarProps) {
  const h = size === 'sm' ? 'h-1' : 'h-1.5'
  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex-1 ${h} rounded-full bg-surface-container dark:bg-white/10 overflow-hidden`}>
        <div
          className={`${h} rounded-full transition-all ${scoreColor(score)}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums w-8 text-right ${scoreBg(score)}`}>
        {score.toFixed(0)}
      </span>
    </div>
  )
}

export function ScoreBadge({ score }: { score: number }) {
  let cls = ''
  let label = ''
  if (score >= 75) { cls = 'bg-secondary-container/40 text-on-secondary-container dark:bg-secondary/20 dark:text-secondary-container'; label = 'Strong' }
  else if (score >= 60) { cls = 'bg-primary-fixed/40 text-on-primary-fixed-variant dark:bg-primary-fixed/20 dark:text-primary-fixed-dim'; label = 'Good' }
  else if (score >= 40) { cls = 'bg-surface-container text-on-surface-variant dark:bg-white/8 dark:text-white/50'; label = 'Neutral' }
  else { cls = 'bg-error-container/40 text-on-error-container dark:bg-error/20 dark:text-error-container'; label = 'Weak' }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  )
}
