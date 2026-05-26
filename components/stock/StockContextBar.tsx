'use client'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { ChevronLeft, BarChart2, DollarSign, Table2, ShieldCheck, Newspaper, type LucideIcon } from 'lucide-react'
import type { TabId } from './TabNav'

const TABS: Array<{ id: TabId; label: string; Icon: LucideIcon }> = [
  { id: 'overview',   label: 'Overview',   Icon: BarChart2   },
  { id: 'valuation',  label: 'Valuation',  Icon: DollarSign  },
  { id: 'financials', label: 'Financials', Icon: Table2      },
  { id: 'risks',      label: 'Risks',      Icon: ShieldCheck },
  { id: 'news',       label: 'News',       Icon: Newspaper   },
]

interface Props {
  ticker: string
  companyName: string
  price: number | null
  change: number | null
  changePct: number | null
  currency: string
  activeTab: TabId
  onChange: (tab: TabId) => void
}

export default function StockContextBar({
  ticker, companyName, price, change, changePct, currency, activeTab, onChange,
}: Props) {
  const router  = useRouter()
  const reduced = useReducedMotion()

  const up = (change ?? 0) >= 0

  return (
    <div
      className="sticky top-[52px] z-30 glass-toolbar"
      role="navigation"
      aria-label="Stock analysis navigation"
    >
      <div
        className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 flex items-center gap-3"
        style={{ height: '48px' }}
      >

        {/* ── Left: back + stock identity + price ── */}
        <button
          onClick={() => router.push('/')}
          aria-label="Back to home"
          className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors shrink-0"
        >
          <ChevronLeft size={15} strokeWidth={2.5} />
        </button>

        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <span className="font-mono font-bold text-[13px] text-slate-900 tracking-tight">{ticker}</span>
          <span className="text-slate-300 text-[11px] hidden sm:block select-none">·</span>
          <span className="text-[12px] text-slate-500 truncate hidden sm:block max-w-[140px] lg:max-w-[200px]">
            {companyName}
          </span>
        </div>

        {price != null && (
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="font-mono font-semibold text-[13px] text-slate-900 tabular-nums">
              {currency}{price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {changePct != null && (
              <span className={cn(
                'text-[11px] font-medium tabular-nums',
                up ? 'text-emerald-600' : 'text-red-500',
              )}>
                {up ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            )}
          </div>
        )}

        {/* ── Spacer ── */}
        <div className="flex-1 min-w-0" />

        {/* ── Right: iOS-style pill segmented control ── */}
        <div
          role="tablist"
          aria-label="Stock sections"
          className="flex items-center rounded-[10px] shrink-0 overflow-x-auto scrollbar-hide"
          style={{
            background: 'rgba(0, 0, 0, 0.06)',
            padding: '3px',
            gap: '1px',
          }}
        >
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${id}`}
                onClick={() => onChange(id)}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  active ? 'text-blue-700' : 'text-slate-500 hover:text-slate-800',
                )}
                style={{ zIndex: 1 }}
              >
                {active && (
                  <motion.span
                    layoutId="stock-tab-pill"
                    className="absolute inset-0 rounded-[7px] bg-white"
                    style={{
                      zIndex: -1,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.05)',
                    }}
                    transition={reduced
                      ? { duration: 0 }
                      : { type: 'spring', duration: 0.32, bounce: 0.18 }
                    }
                  />
                )}
                <Icon size={12} className="shrink-0" />
                {label}
              </button>
            )
          })}
        </div>

      </div>
    </div>
  )
}
