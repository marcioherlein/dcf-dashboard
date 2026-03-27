'use client'
import { useState } from 'react'
import Header from '@/components/layout/Header'
import MarketMonitor from '@/components/home/MarketMonitor'
import MorningBrief from '@/components/home/MorningBrief'
import Portfolio from '@/components/home/Portfolio'

type Tab = 'brief' | 'valuation' | 'portfolio'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'brief',     icon: '☀️', label: 'Morning Brief' },
  { id: 'valuation', icon: '📊', label: 'Valuation'     },
  { id: 'portfolio', icon: '💼', label: 'Portfolio'     },
]

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('brief')

  return (
    <div
      className="min-h-screen bg-[#080808] text-white"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
    >
      <Header />

      {/* Tab bar */}
      <div className="sticky top-[53px] z-30 border-b border-white/[0.06] bg-[#080808]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'text-white'
                  : 'text-white/30 hover:text-white/55'
              }`}
            >
              <span className="text-[15px] leading-none">{t.icon}</span>
              <span>{t.label}</span>
              {/* Active indicator */}
              {tab === t.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full bg-white/90" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <main>
        {tab === 'brief'     && <MorningBrief />}
        {tab === 'valuation' && <MarketMonitor />}
        {tab === 'portfolio' && <Portfolio />}
      </main>

      <footer className="border-t border-white/[0.04] px-4 py-8">
        <div className="mx-auto max-w-5xl flex flex-col items-center gap-1.5 text-center sm:flex-row sm:justify-between">
          <p className="text-[11px] text-white/15">Educational use only — not investment advice.</p>
          <p className="text-[11px] text-white/15">Data via Yahoo Finance · RF rate via FRED · Methodology: Damodaran</p>
        </div>
      </footer>
    </div>
  )
}
