'use client'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import {
  BarChart2, DollarSign, Table2, Award, Newspaper, Lock,
} from 'lucide-react'

export type TabId = 'overview' | 'valuation' | 'conviction' | 'financials' | 'news'

const TABS = [
  { id: 'overview'   as TabId, label: 'Overview',    Icon: BarChart2,  step: '01', primary: true,  gated: false },
  { id: 'valuation'  as TabId, label: 'Valuation',   Icon: DollarSign, step: '02', primary: true,  gated: true  },
  { id: 'conviction' as TabId, label: 'Conviction',  Icon: Award,      step: '03', primary: true,  gated: true  },
  { id: 'financials' as TabId, label: 'Financials',  Icon: Table2,     step: '04', primary: false, gated: false },
  { id: 'news'       as TabId, label: 'News',        Icon: Newspaper,  step: '05', primary: false, gated: true  },
]

interface Props {
  activeTab: TabId
  onChange: (tab: TabId) => void
  isAuthed?: boolean
}

export default function TabNav({ activeTab, onChange, isAuthed = true }: Props) {
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
      className="sticky z-20 glass-toolbar"
      style={{
        top: "calc(52px + env(safe-area-inset-top, 0px))",
        background: 'rgba(26, 37, 52, 0.82)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div ref={containerRef} className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
          {TABS.map(({ id, label, Icon, step, primary, gated }, i) => {
            const active = activeTab === id
            const isFirstSecondary = !primary && TABS[i - 1]?.primary
            const showLock = gated && !isAuthed
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
                  'group relative flex items-center gap-1.5 px-4 py-3.5 whitespace-nowrap transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.7)] focus-visible:ring-offset-0',
                  primary ? 'text-[13px] font-medium' : 'text-[12px] font-normal',
                  isFirstSecondary ? 'ml-2 pl-5 border-l border-white/10' : '',
                  active
                    ? 'border-transparent text-white bg-white/8'
                    : 'border-transparent text-white/50 hover:text-white/85 hover:border-white/20',
                )}
              >
                {/* Step number */}
                <span
                  className={cn(
                    'text-[8px] font-bold tabular-nums transition-opacity leading-none',
                    active
                      ? 'text-[#7CB518] opacity-100'
                      : 'text-white/30 opacity-80 group-hover:opacity-60',
                  )}
                  aria-hidden="true"
                >
                  {step}
                </span>

                <Icon
                  size={primary ? 14 : 13}
                  className={cn('shrink-0', active ? 'text-[#7CB518]' : 'text-white/40')}
                />
                {label}
                {showLock && (
                  <Lock
                    size={10}
                    className="ml-0.5 text-white/25 shrink-0"
                    aria-label="requires sign in"
                  />
                )}

                {active && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#7CB518] rounded-full"
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
