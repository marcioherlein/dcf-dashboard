'use client'

import { useState, useEffect } from 'react'
import { X, Zap } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import Link from 'next/link'

const KEY = 'intrinsico_concept_seen'

const EXAMPLES = [
  {
    ticker: 'NVDA',
    implied: 45,
    historical: 60,
    impliedW: 76,
    historicalW: 100,
    impliedColor: 'bg-red-400',
    note: 'extreme AI bets baked in',
  },
  {
    ticker: 'AAPL',
    implied: 6,
    historical: 8,
    impliedW: 14,
    historicalW: 18,
    impliedColor: 'bg-emerald-400',
    note: 'priced for below-history growth',
  },
]

export default function ConceptBanner() {
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setVisible(true)
    } catch {}
  }, [])

  const dismiss = () => {
    setVisible(false)
    try { localStorage.setItem(KEY, '1') } catch {}
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduced ? {} : { opacity: 0, y: -6 }}
          animate={reduced ? {} : { opacity: 1, y: 0 }}
          exit={reduced ? {} : { opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="rounded-xl bg-blue-50/40 border border-blue-200 overflow-hidden">

            <div className="flex gap-3.5 px-5 py-4">
              {/* Icon */}
              <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Zap size={13} className="text-blue-600" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 leading-snug">
                  Intrinsico reads the growth rate the market is pricing in
                </p>
                <p className="mt-1 text-[12px] text-slate-600 leading-relaxed max-w-xl">
                  Every stock price implies a 5-year revenue growth assumption.
                  Intrinsico makes that number explicit and compares it to the company&apos;s history.
                  The gap is where the signal lives.
                </p>

                {/* Mini CAGR visual */}
                <div className="mt-3 space-y-1.5">
                  {EXAMPLES.map((ex) => (
                    <div key={ex.ticker} className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-slate-400 w-9 shrink-0">
                        {ex.ticker}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <div
                            className={`h-1.5 rounded-full ${ex.impliedColor}`}
                            style={{ width: `${ex.impliedW}px` }}
                          />
                          <span className="text-[10px] font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                            {ex.implied}% implied
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-300">vs</span>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-1.5 rounded-full bg-blue-300"
                            style={{ width: `${ex.historicalW}px` }}
                          />
                          <span className="text-[10px] font-semibold text-slate-400 tabular-nums whitespace-nowrap">
                            {ex.historical}% historical
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          — {ex.note}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 mt-2.5">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] text-slate-400">implied</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-1.5 rounded-full bg-blue-300" />
                      <span className="text-[10px] text-slate-400">3Y historical</span>
                    </div>
                    <Link
                      href="/stock/NVDA"
                      onClick={dismiss}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors ml-1"
                    >
                      See NVDA analysis →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Dismiss */}
              <button
                onClick={dismiss}
                className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors mt-0.5 min-h-[32px] min-w-[32px] flex items-center justify-center -mr-1"
                aria-label="Dismiss introduction"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
