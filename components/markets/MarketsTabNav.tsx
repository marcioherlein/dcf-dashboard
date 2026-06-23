'use client'
import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export type MarketTab = 'overview' | 'sectors' | 'calendar' | 'valuation'

const TABS: { id: MarketTab; label: string }[] = [
  { id: 'overview',  label: 'Overview'  },
  { id: 'sectors',   label: 'Sectors'   },
  { id: 'calendar',  label: 'Calendar'  },
  { id: 'valuation', label: 'Valuation' },
]

const SPRING = { type: 'spring', stiffness: 500, damping: 38, mass: 0.6 } as const

interface Props {
  active: MarketTab
  onChange: (tab: MarketTab) => void
}

export default function MarketsTabNav({ active, onChange }: Props) {
  const pillId  = useId()
  const reduced = useReducedMotion()

  return (
    <div
      role="tablist"
      aria-label="Markets sections"
      className="flex w-full sm:w-auto sm:inline-flex items-center gap-0.5 rounded-full p-[3px]"
      style={{
        background: 'rgba(240,241,246,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)',
      }}
    >
      {TABS.map(tab => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`markets-panel-${tab.id}`}
            id={`markets-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className="relative flex flex-1 sm:flex-none items-center justify-center rounded-full px-3.5 py-1.5 text-[13px] min-h-[32px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.6)]"
            style={{ color: isActive ? '#111111' : '#6B6B6B', fontWeight: isActive ? 650 : 500 }}
          >
            {isActive && (
              <motion.span
                layoutId={`${pillId}-markets-pill`}
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.95)',
                  border: '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)',
                }}
                transition={reduced ? { duration: 0 } : SPRING}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
