'use client'
import { useState } from 'react'
import Header from '@/components/layout/Header'
import MarketMonitor from '@/components/home/MarketMonitor'
import MorningBrief from '@/components/home/MorningBrief'
import Portfolio from '@/components/home/Portfolio'

type Tab = 'brief' | 'portfolio'

export default function HomePage() {
  const [tab, setTab] = useState<Tab>('brief')

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}>

      <Header />

      {/* Tab bar */}
      <div className="border-b border-white/8 bg-black">
        <div className="mx-auto flex max-w-6xl gap-1 px-4">
          <button
            onClick={() => setTab('brief')}
            className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 ${
              tab === 'brief'
                ? 'border-white text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            ☀️ Morning Brief
          </button>
          <button
            onClick={() => setTab('portfolio')}
            className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 ${
              tab === 'portfolio'
                ? 'border-white text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            💼 My Portfolio
          </button>
        </div>
      </div>

      {/* Market monitor — always visible */}
      <MarketMonitor />

      {/* Tab content */}
      {tab === 'brief' && <MorningBrief />}
      {tab === 'portfolio' && <Portfolio />}

      <footer className="border-t border-white/5 px-4 py-8">
        <div className="mx-auto max-w-5xl flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between">
          <p className="text-xs text-white/20">Educational use only — not investment advice.</p>
          <p className="text-xs text-white/20">Data via Yahoo Finance · RF rate via FRED · Methodology: Damodaran</p>
        </div>
      </footer>
    </div>
  )
}
