'use client'

export type TabId = 'summary' | 'financials' | 'valuation' | 'quality' | 'ownership' | 'news'

interface Tab {
  id: TabId
  label: string
}

const TABS: Tab[] = [
  { id: 'summary',    label: 'Summary'    },
  { id: 'financials', label: 'Financials' },
  { id: 'valuation',  label: 'Valuation'  },
  { id: 'quality',    label: 'Quality'    },
  { id: 'ownership',  label: 'Ownership'  },
  { id: 'news',       label: 'News'       },
]

interface Props {
  activeTab: TabId
  onChange: (tab: TabId) => void
}

export default function TabNav({ activeTab, onChange }: Props) {
  return (
    <div className="sticky top-[53px] z-10 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/8 dark:bg-black/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="flex gap-1 overflow-x-auto py-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={[
                'rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-black'
                  : 'text-gray-500 hover:bg-black/5 hover:text-gray-800 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
