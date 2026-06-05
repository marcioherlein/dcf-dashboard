'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const DISMISS_KEY = 'etf_intro_dismissed'

export function ETFOnboardBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(DISMISS_KEY)) setVisible(true)
  }, [])

  function dismiss() {
    setVisible(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* silent */ }
  }

  if (!visible) return null

  return (
    <div className="relative glass-card-light rounded-xl border border-[#BFD2A1] bg-[#F6FAEA]/60 p-4 pr-10">
      <p className="text-sm font-semibold text-slate-700 mb-1">How the Value Score works</p>
      <p className="text-sm text-slate-500 leading-relaxed">
        Each ETF is scored 0–100 based on four inputs: P/E ratio (30 pts), P/B ratio (25 pts), trailing yield (25 pts), and an expense ratio penalty (up to 20 pts deducted).
        A score of 70+ means the basket is deeply valued relative to historical norms. Scores update from Yahoo Finance data.
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:outline-none"
      >
        <X size={14} />
      </button>
    </div>
  )
}
