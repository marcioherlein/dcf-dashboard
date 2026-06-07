'use client'

import { useState, useEffect, useRef } from 'react'
import { HelpCircle, X } from 'lucide-react'

const FIRST_VISIT_KEY = 'etf_help_seen'

export function ETFHelpButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Auto-open once on first visit
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(FIRST_VISIT_KEY)) {
      setOpen(true)
      try { localStorage.setItem(FIRST_VISIT_KEY, '1') } catch {}
    }
  }, [])

  // Close on click-outside
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="How the Value Score works"
        aria-expanded={open}
        className="w-7 h-7 flex items-center justify-center rounded-full text-[#8A95A6] hover:text-olive-700 hover:bg-olive-50 border border-[#E3E1DA] hover:border-[#BFD2A1] transition-colors focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:outline-none"
      >
        <HelpCircle size={14} />
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-50 w-80 bg-white border border-[#BFD2A1] rounded-xl shadow-lg p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[13px] font-bold text-[#06101F]">How the Value Score works</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-[#8A95A6] hover:text-[#566174] hover:bg-[#F4F3EF] transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          <p className="text-[12px] text-[#566174] leading-relaxed">
            Each ETF is scored <strong className="text-[#06101F]">0–100</strong> across four inputs:
          </p>
          <ul className="mt-2 space-y-1 text-[12px] text-[#566174]">
            <li className="flex justify-between"><span>P/E ratio</span><span className="font-semibold text-[#06101F]">+30 pts</span></li>
            <li className="flex justify-between"><span>P/B ratio</span><span className="font-semibold text-[#06101F]">+25 pts</span></li>
            <li className="flex justify-between"><span>Trailing yield</span><span className="font-semibold text-[#06101F]">+25 pts</span></li>
            <li className="flex justify-between"><span>Expense ratio penalty</span><span className="font-semibold text-[#D83B3B]">−20 pts</span></li>
          </ul>
          <div className="mt-3 pt-3 border-t border-[#E3E1DA] text-[12px] text-[#566174] leading-relaxed">
            <span className="font-bold text-[#11875D]">70+</span> = Deep Value &nbsp;·&nbsp;
            <span className="font-bold text-[#2563EB]">50–69</span> = Fair Value &nbsp;·&nbsp;
            <span className="font-bold text-[#B56A00]">30–49</span> = Stretched &nbsp;·&nbsp;
            <span className="font-bold text-[#D83B3B]">&lt;30</span> = Expensive
          </div>
          <p className="mt-2 text-[11px] text-[#8A95A6]">Scores update daily from Yahoo Finance.</p>
        </div>
      )}
    </div>
  )
}
