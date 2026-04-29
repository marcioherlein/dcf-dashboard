'use client'

import type { ListTag } from '@/lib/simplifier/types'

interface ListTagSelectorProps {
  value: ListTag
  onChange: (tag: ListTag) => void
  size?: 'sm' | 'md'
}

const TAG_CONFIG: Record<NonNullable<ListTag>, { label: string; color: string; bg: string; border: string; dot: string }> = {
  buy:   { label: 'Buy',   color: '#0d7c3d', bg: '#dcfce7', border: '#86efac', dot: '#22c55e' },
  watch: { label: 'Watch', color: '#9a6700', bg: '#fef9c3', border: '#fde047', dot: '#eab308' },
  pass:  { label: 'Pass',  color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444' },
}

const TAG_ORDER: ListTag[] = ['buy', 'watch', 'pass', null]

/** Cycle through buy → watch → pass → null */
export function cycleTag(current: ListTag): ListTag {
  const idx = TAG_ORDER.indexOf(current)
  return TAG_ORDER[(idx + 1) % TAG_ORDER.length]
}

export function ListTagBadge({ tag, onClick }: { tag: ListTag; onClick?: () => void }) {
  if (!tag) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B6A72] hover:text-[#2D2C31] transition-colors"
        title="Click to set a list tag"
      >
        <span className="size-1.5 rounded-full bg-[#D1D5DB]" />
        Untagged
      </button>
    )
  }
  const cfg = TAG_CONFIG[tag]
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-all hover:opacity-80"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
      title="Click to change tag"
    >
      <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </button>
  )
}

/**
 * Full three-button toggle — used in ScoreTab when saving.
 */
export default function ListTagSelector({ value, onChange, size = 'md' }: ListTagSelectorProps) {
  const btnBase = size === 'sm'
    ? 'px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all'
    : 'px-4 py-2 text-[12px] font-semibold rounded-xl border transition-all'

  return (
    <div className="flex items-center gap-2">
      {(['buy', 'watch', 'pass'] as NonNullable<ListTag>[]).map((tag) => {
        const cfg = TAG_CONFIG[tag]
        const isActive = value === tag
        return (
          <button
            key={tag}
            onClick={() => onChange(isActive ? null : tag)}
            className={`${btnBase} flex items-center gap-1.5`}
            style={
              isActive
                ? { color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }
                : { color: '#6B6A72', backgroundColor: 'white', borderColor: '#E8E6E0' }
            }
          >
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: isActive ? cfg.dot : '#D1D5DB' }}
            />
            {cfg.label}
          </button>
        )
      })}
    </div>
  )
}
