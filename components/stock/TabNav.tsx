'use client'
import { useEffect, useRef, useId } from 'react'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'motion/react'
import {
  BarChart2, DollarSign, Table2, Award, Newspaper, Lock,
} from 'lucide-react'

export type TabId = 'overview' | 'valuation' | 'conviction' | 'financials' | 'news'

const TABS = [
  { id: 'overview'   as TabId, label: 'Overview',    Icon: BarChart2,  primary: true,  gated: false },
  { id: 'valuation'  as TabId, label: 'Valuation',   Icon: DollarSign, primary: true,  gated: true  },
  { id: 'conviction' as TabId, label: 'Conviction',  Icon: Award,      primary: true,  gated: true  },
  { id: 'financials' as TabId, label: 'Financials',  Icon: Table2,     primary: false, gated: false },
  { id: 'news'       as TabId, label: 'News',        Icon: Newspaper,  primary: false, gated: true  },
]

interface Props {
  activeTab: TabId
  onChange: (tab: TabId) => void
  isAuthed?: boolean
}

const SPRING = { type: 'spring', stiffness: 500, damping: 38, mass: 0.6 } as const

export default function TabNav({ activeTab, onChange, isAuthed = true }: Props) {
  const reduced  = useReducedMotion()
  const pillId   = useId()
  const tabIds   = TABS.map(t => t.id)
  const containerRef = useRef<HTMLDivElement>(null)

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
      className="sticky z-20"
      style={{
        top: 'calc(52px + env(safe-area-inset-top, 0px))',
        background: 'rgba(10,16,28,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto max-w-5xl px-3 sm:px-6 lg:px-8 py-2">
        {/* Pill container */}
        <div
          ref={containerRef}
          className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide rounded-full p-[3px]"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {TABS.map(({ id, label, Icon, primary, gated }) => {
            const active   = activeTab === id
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
                  'group relative flex items-center gap-1.5 rounded-full px-3 py-1.5 whitespace-nowrap transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.7)] focus-visible:ring-offset-0 min-h-[32px]',
                  primary ? 'text-[13px]' : 'text-[12px]',
                  active ? 'text-white font-[650]' : 'text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.80)] font-[500]',
                )}
              >
                {/* Animated pill background */}
                {active && (
                  <motion.span
                    layoutId={`${pillId}-tab-pill`}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'rgba(255,255,255,0.14)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.14)',
                    }}
                    transition={reduced ? { duration: 0 } : SPRING}
                    aria-hidden="true"
                  />
                )}

                <Icon
                  size={primary ? 13 : 12}
                  className={cn('relative z-10 shrink-0', active ? 'text-[#7CB518]' : 'text-[rgba(255,255,255,0.30)] group-hover:text-[rgba(255,255,255,0.60)]')}
                  aria-hidden="true"
                />
                <span className="relative z-10">{label}</span>
                {showLock && (
                  <Lock size={9} className="relative z-10 ml-0.5 text-[rgba(255,255,255,0.25)] shrink-0" aria-label="requires sign in" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
