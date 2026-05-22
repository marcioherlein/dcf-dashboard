'use client'
import { cn } from '@/lib/utils'
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
  return (
    <div
      role="tablist"
      aria-label="Stock sections"
      className="sticky top-[52px] z-20 bg-white border-b border-slate-200"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide -mb-px">
          {TABS.map(({ id, label, Icon, primary }, i) => {
            const active = activeTab === id
            const isFirstSecondary = !primary && TABS[i - 1]?.primary
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                aria-controls={`tabpanel-${id}`}
                onClick={() => onChange(id)}
                className={cn(
                  'relative flex items-center gap-1.5 px-4 py-3.5 whitespace-nowrap transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                  primary ? 'text-[13px] font-medium' : 'text-[12px] font-normal',
                  isFirstSecondary ? 'ml-2 pl-5 border-l border-slate-200' : '',
                  active
                    ? 'border-blue-600 text-blue-600 bg-blue-50/60'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300',
                )}
              >
                <Icon
                  size={primary ? 14 : 13}
                  className={cn('shrink-0', active ? 'text-blue-600' : 'text-slate-400')}
                />
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
