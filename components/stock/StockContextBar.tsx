'use client'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Star, BarChart2, DollarSign, Table2, ShieldCheck, Newspaper, type LucideIcon } from 'lucide-react'
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
  sector?: string
  industry?: string
  exchange?: string
  activeTab: TabId
  onChange: (tab: TabId) => void
}

export default function StockContextBar({
  ticker, companyName, price, changePct, currency,
  activeTab, onChange,
}: Props) {
  const router = useRouter()
  const up = (changePct ?? 0) >= 0

  return (
    <div
      className="sticky top-[52px] z-30 bg-white border-b border-slate-200"
      role="navigation"
      aria-label="Stock analysis navigation"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 flex items-center gap-0 min-w-0 overflow-x-auto scrollbar-hide">

        {/* ── Left: back + identity + price ── */}
        <div className="flex items-center gap-2 shrink-0 py-2 pr-4 border-r border-slate-100 mr-1">
          <button
            onClick={() => router.push('/')}
            aria-label="Back to home"
            className="text-slate-400 hover:text-blue-600 transition-colors shrink-0"
          >
            <ChevronLeft size={15} strokeWidth={2.5} />
          </button>

          <button aria-label="Add to watchlist" className="text-slate-300 hover:text-amber-400 transition-colors shrink-0">
            <Star size={14} strokeWidth={1.8} />
          </button>

          <span className="font-mono font-black text-[13px] text-slate-900 tracking-tight shrink-0">{ticker}</span>

          <span className="text-[12px] text-slate-400 hidden sm:block truncate max-w-[140px]">
            {companyName}
          </span>

          {price != null && (
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="font-mono font-semibold text-[13px] text-slate-800 tabular-nums">
                {currency}{price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {changePct != null && (
                <span className={cn('text-[11px] font-medium tabular-nums', up ? 'text-emerald-600' : 'text-red-500')}>
                  {up ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Right: tabs ── */}
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Stock sections">
          {TABS.map(({ id, label }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${id}`}
                onClick={() => onChange(id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-3.5 py-3 text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none shrink-0',
                  active ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-t" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
