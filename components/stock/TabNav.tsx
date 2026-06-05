'use client'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import {
  BarChart2, DollarSign, Table2, ShieldCheck, Newspaper,
} from 'lucide-react'

export type TabId = 'overview' | 'valuation' | 'financials' | 'risks' | 'news'

const TABS = [
  { id: 'overview'   as TabId, label: 'Overview',          Icon: BarChart2,   primary: true  },
  { id: 'valuation'  as TabId, label: 'Valuation',         Icon: DollarSign,  primary: true  },
  { id: 'financials' as TabId, label: 'Financials',        Icon: Table2,      primary: false },
  { id: 'risks'      as TabId, label: 'Risks & Signals',   Icon: ShieldCheck, primary: false },
  { id: 'news'       as TabId, label: 'News',              Icon: Newspaper,   primary: false },
]

interface Props {
  activeTab: TabId
  onChange: (tab: TabId) => void
}

export default function TabNav({ activeTab, onChange }: Props) {
  const reduced = useReducedMotion()
  const tabIds = TABS.map(t => t.id)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll active tab into view on mobile
  useEffect(() => {
    const el = document.getElementById(`tab-${activeTab}`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [activeTab])

  function handleKeyDown(e: React.KeyboardEvent) {
    const idx = tabIds.indexOf(activeTab)
    let next = idx
    if      (e.key === 'ArrowRight') { e.preventDefault(); next = (idx + 1) % tabIds.length }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); next = (idx - 1 + tabIds.length) % tabIds.length }
    else if (e.key === 'Home')       { e.preventDefault(); next = 0 }
    else if (e.key === 'End')        { e.preventDefault(); next = tabIds.length - 1 }
    else return
    const nextId = tabIds[next]
    onChange(nextId)
    document.getElementById(`tab-${nextId}`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Stock sections"
      className="sticky top-[52px] z-20 glass-toolbar"
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div ref={containerRef} className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
          {TABS.map(({ id, label, Icon, primary }, i) => {
            const active = activeTab === id
            const isFirstSecondary = !primary && TABS[i - 1]?.primary
            return (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => onChange(id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-4 py-3.5 whitespace-nowrap transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.55)] focus-visible:ring-offset-2',
                  primary ? 'text-[13px] font-medium' : 'text-[12px] font-normal',
                  isFirstSecondary ? 'ml-2 pl-5 border-l border-[#E3E6E0]' : '',
                  active
                    ? 'border-transparent text-[#5F790B] bg-[#F6FAEA]'
                    : 'border-transparent text-[#536174] hover:text-[#0A1424] hover:border-[#CBD1C4]',
                )}
              >
                <Icon
                  size={primary ? 14 : 13}
                  className={cn('shrink-0', active ? 'text-[#5F790B]' : 'text-[#8A96A8]')}
                />
                {label}

                {active && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#5F790B] rounded-full"
                    transition={reduced ? { duration: 0 } : { type: 'spring', duration: 0.35, bounce: 0.15 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
