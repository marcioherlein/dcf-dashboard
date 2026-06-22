'use client'

/**
 * PillTabNav — iOS-glass pill-within-pill tab bar.
 *
 * Renders a frosted-glass outer capsule with a spring-animated
 * white/translucent inner pill sliding under the active item.
 *
 * On mobile (<sm) when `scrollable` is true, falls back to a
 * horizontally scrollable underline bar to avoid the pill container
 * clipping on narrow screens.
 *
 * Design: olive + slate brand palette, backdrop-blur glass surface.
 */

import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export interface PillTab {
  id: string
  label: string
  count?: number | null
  /** Optional small badge rendered inside the pill (e.g. Lock icon node) */
  badge?: React.ReactNode
}

interface Props {
  tabs: PillTab[]
  activeId: string
  onChange: (id: string) => void
  /** Aria label for the tablist */
  ariaLabel?: string
  /** Allow horizontal scrolling on mobile instead of wrapping */
  scrollable?: boolean
  /** 'dark' = for dark glass surfaces (stock TabNav, landing nav)
   *  'light' = for light page backgrounds (markets, valuations, ETF) */
  surface?: 'dark' | 'light'
  className?: string
}

const SPRING = { type: 'spring', stiffness: 500, damping: 38, mass: 0.6 } as const

export default function PillTabNav({
  tabs,
  activeId,
  onChange,
  ariaLabel,
  scrollable = false,
  surface = 'light',
  className,
}: Props) {
  const uid    = useId()
  const reduced = useReducedMotion()

  const isDark  = surface === 'dark'

  // Outer capsule styles
  const outerStyle: React.CSSProperties = isDark
    ? {
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
      }
    : {
        background: 'rgba(240,241,246,0.80)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
      }

  // Active pill styles
  const pillStyle: React.CSSProperties = isDark
    ? {
        background: 'rgba(255,255,255,0.14)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.16)',
      }
    : {
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
        border: '1px solid rgba(0,0,0,0.07)',
      }

  const activeTextClass = isDark
    ? 'text-white font-[650]'
    : 'text-[#111111] font-[650]'

  const inactiveTextClass = isDark
    ? 'text-[rgba(255,255,255,0.50)] hover:text-[rgba(255,255,255,0.80)] font-[500]'
    : 'text-[#6B6B6B] hover:text-[#111111] font-[500]'

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-full p-[3px]',
        scrollable ? 'overflow-x-auto scrollbar-hide max-w-full' : 'flex-wrap',
        className,
      )}
      style={outerStyle}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeId
        return (
          <button
            key={tab.id}
            id={`${uid}-tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={`${uid}-panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.6)] focus-visible:ring-offset-0 min-h-[32px]',
              isActive ? activeTextClass : inactiveTextClass,
            )}
          >
            {/* Spring-animated background pill */}
            {isActive && (
              <motion.span
                layoutId={`${uid}-pill`}
                className="absolute inset-0 rounded-full"
                style={pillStyle}
                transition={reduced ? { duration: 0 } : SPRING}
                aria-hidden="true"
              />
            )}

            {/* Label */}
            <span className="relative z-10 leading-none">
              {tab.label}
            </span>

            {/* Count badge */}
            {tab.count != null && (
              <span
                className={cn(
                  'relative z-10 text-[10px] font-[700] tabular-nums rounded-full px-1.5 py-px leading-none min-w-[18px] text-center',
                  isActive
                    ? isDark ? 'bg-white/20 text-white' : 'bg-[#5F790B]/12 text-[#5F790B]'
                    : isDark ? 'bg-white/10 text-white/40' : 'bg-[#E5E5E5] text-[#9B9B9B]',
                )}
              >
                {tab.count}
              </span>
            )}

            {/* Extra badge (icon, lock, PRO chip) */}
            {tab.badge && (
              <span className="relative z-10">{tab.badge}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
