'use client'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

export type MarketTab = 'overview' | 'sectors' | 'calendar' | 'valuation'

const TABS: { id: MarketTab; label: string }[] = [
  { id: 'overview',  label: 'Overview'   },
  { id: 'sectors',   label: 'Sectors'    },
  { id: 'calendar',  label: 'Calendar'   },
  { id: 'valuation', label: 'Valuation'  },
]

interface Props {
  active: MarketTab
  onChange: (tab: MarketTab) => void
}

export default function MarketsTabNav({ active, onChange }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Markets sections"
      className="flex items-center gap-0 border-b border-[#E5E5E5] overflow-x-auto scrollbar-hide -mb-px"
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
            className={cn(
              'relative shrink-0 px-4 py-2.5 text-[13px] font-semibold leading-none transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1',
              isActive
                ? 'text-[#111111]'
                : 'text-[#6B6B6B] hover:text-[#111111]',
            )}
          >
            {tab.label}
            {/* active indicator — thin bottom line */}
            <span
              className={cn(
                'absolute bottom-0 left-0 right-0 h-[2px] rounded-full transition-all duration-200',
                isActive ? 'bg-[#5F790B] opacity-100' : 'opacity-0',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
