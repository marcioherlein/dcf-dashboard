'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface ChartTooltipEntry {
  name: string
  value?: number | string | null
  formatted?: string
  color?: string
  unit?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | null; color?: string; payload?: Record<string, unknown> }>
  label?: string
  /** Pre-mapped entries (preferred — use instead of raw payload) */
  entries?: ChartTooltipEntry[]
  isDark?: boolean
  /** Show color dots beside each series name */
  renderLegend?: boolean
  /** Override the label shown at the top */
  title?: string
  className?: string
}

/**
 * Universal Recharts tooltip for the financial dashboard.
 * Consistent border, shadow, font, and colorblind-safe legend dots across all charts.
 *
 * Usage:
 *   <Tooltip content={<ChartTooltip />} />
 *
 *   // With pre-mapped entries for full control:
 *   <Tooltip content={(props) => (
 *     <ChartTooltip
 *       {...props}
 *       entries={payload.map(p => ({ name: 'Revenue', formatted: fmtB(p.value), color: '#2563EB' }))}
 *     />
 *   )} />
 */
export function ChartTooltip({
  active,
  payload,
  label,
  entries,
  isDark = false,
  renderLegend = true,
  title,
  className,
}: ChartTooltipProps) {
  if (!active) return null

  // Use pre-mapped entries if provided, otherwise map raw payload
  const rows: ChartTooltipEntry[] = entries ?? (payload ?? []).map((p) => ({
    name: p.name ?? '',
    value: p.value,
    formatted: p.value != null ? String(p.value) : '—',
    color: p.color,
  }))

  if (rows.length === 0) return null

  const displayLabel = title ?? label

  return (
    <div
      role="tooltip"
      className={cn(
        'rounded-[10px] border px-3 py-2.5 text-[12px]',
        'max-w-[min(90vw,200px)]',
        isDark
          ? 'bg-[rgba(10,22,40,0.95)] border-[rgba(59,130,246,0.2)] text-[#F4F3EF] shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
          : 'bg-white border-[#E3E1DA] text-[#111111] shadow-[0_8px_24px_rgba(0,0,0,0.09)]',
        className,
      )}
    >
      {displayLabel && (
        <p className={cn('text-[11px] font-[600] mb-1.5 leading-snug', isDark ? 'text-[#8A95A6]' : 'text-[#6B6B6B]')}>
          {displayLabel}
        </p>
      )}
      <div className="space-y-1">
        {rows.map((entry, i) => (
          <div key={`${entry.name}-${i}`} className="flex items-center justify-between gap-3">
            {renderLegend && entry.color && (
              // Colorblind-safe: filled dot + outline ring so shape+color both signal
              <span className="flex items-center gap-1 shrink-0" aria-hidden="true">
                <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                <span className="w-2 h-2 rounded-full border-2 -ml-2.5" style={{ borderColor: entry.color }} />
              </span>
            )}
            <span className={cn('text-[11px] min-w-0 truncate', isDark ? 'text-[#8A95A6]' : 'text-[#6B6B6B]')}>
              {entry.name}
            </span>
            <span
              className="text-[11px] font-[600] tabular-nums shrink-0"
              aria-label={`${entry.name}: ${entry.formatted ?? entry.value}`}
              style={entry.color ? { color: entry.color } : undefined}
            >
              {entry.formatted ?? (entry.value != null ? String(entry.value) : '—')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ChartTooltip
