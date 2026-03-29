'use client'
import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import MarketMonitor from '@/components/home/MarketMonitor'
import MorningBrief from '@/components/home/MorningBrief'
import Portfolio from '@/components/home/Portfolio'

type Tab = 'brief' | 'valuation' | 'portfolio'

const TABS: { id: Tab; icon: React.ReactNode; label: string }[] = [
  {
    id: 'brief',
    label: 'Morning Brief',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.36-.71.71M6.34 17.66l-.71.71m12.73 0-.71-.71M6.34 6.34l-.71-.71M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
      </svg>
    ),
  },
  {
    id: 'valuation',
    label: 'Market Monitor',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M9 17V9m4 8V5m4 12v-4" />
      </svg>
    ),
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm0 0V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
]

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('brief')

  return (
    <div className="min-h-screen bg-background text-on-background">
      <Header />

      {/* Tab bar */}
      <div className="sticky top-[57px] z-30 bg-surface-container-lowest border-b border-outline-variant/15 shadow-nav">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-1 scrollbar-hide overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  'relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap',
                  tab === t.id
                    ? 'text-primary'
                    : 'text-on-surface-variant hover:text-on-surface',
                ].join(' ')}
              >
                <span className={tab === t.id ? 'text-primary' : 'text-on-surface-variant'}>{t.icon}</span>
                <span>{t.label}</span>
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-primary" />
                )}
              </button>
            ))}
            <Link
              href="/factor-ranking"
              className="relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap text-on-surface-variant hover:text-on-surface"
            >
              <span className="text-on-surface-variant">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h4l2 10h10l2-10H7M9 17a1 1 0 1 0 2 0 1 1 0 0 0-2 0zm8 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0z" />
                </svg>
              </span>
              <span>Factor Ranking</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {tab === 'brief'     && <MorningBrief />}
        {tab === 'valuation' && <MarketMonitor />}
        {tab === 'portfolio' && <Portfolio />}
      </main>

      <footer className="border-t border-outline-variant/20 px-6 py-8 mt-12">
        <div className="mx-auto max-w-7xl flex flex-col items-center gap-1.5 text-center sm:flex-row sm:justify-between">
          <p className="text-xs text-on-surface-variant/50">Educational use only — not investment advice.</p>
          <p className="text-xs text-on-surface-variant/50">Data via Yahoo Finance · RF rate via FRED · Methodology: Damodaran</p>
        </div>
      </footer>
    </div>
  )
}
