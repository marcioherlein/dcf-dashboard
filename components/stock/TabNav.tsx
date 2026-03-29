'use client'

export type TabId = 'summary' | 'financials' | 'valuation' | 'quality' | 'ownership' | 'news'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  {
    id: 'summary',
    label: 'Summary',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V9m4 8V5m4 12v-4M3 17v-2" />
      </svg>
    ),
  },
  {
    id: 'financials',
    label: 'Financials',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l-4-4 4-4m6 8l4-4-4-4" />
      </svg>
    ),
  },
  {
    id: 'valuation',
    label: 'Valuation',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    id: 'quality',
    label: 'Quality',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 'ownership',
    label: 'Ownership',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
      </svg>
    ),
  },
  {
    id: 'news',
    label: 'News',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
  },
]

interface Props {
  activeTab: TabId
  onChange: (tab: TabId) => void
}

export default function TabNav({ activeTab, onChange }: Props) {
  return (
    <div className="sticky top-[57px] z-10 bg-surface-container-lowest border-b border-outline-variant/15 shadow-nav">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="flex gap-0.5 overflow-x-auto scrollbar-hide py-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={[
                'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-xl transition-colors',
                activeTab === tab.id
                  ? 'text-primary bg-primary-fixed/60'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low',
              ].join(' ')}
            >
              <span className={activeTab === tab.id ? 'text-primary' : 'text-on-surface-variant'}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
