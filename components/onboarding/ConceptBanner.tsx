'use client'

import { useState, useEffect } from 'react'
import { X, Zap, ChevronRight } from 'lucide-react'
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
    note: 'market betting on a slowdown',
  },
]

export default function ConceptBanner() {
  // null = not yet determined (prevents flicker on first paint)
  const [visible, setVisible] = useState<boolean | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    let seen = false
    try { seen = !!localStorage.getItem(KEY) } catch {}
    setVisible(!seen)
  }, [])

  const dismiss = () => {
    setVisible(false)
    try { localStorage.setItem(KEY, '1') } catch {
      // Quota exceeded or private mode: dismiss still works for this session
    }
  }

  // Don't render anything until localStorage has been checked to avoid CLS
  if (visible === null) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label="What Insic measures"
          initial={reduced ? {} : { opacity: 0, height: 0 }}
          animate={reduced ? {} : { opacity: 1, height: 'auto' }}
          exit={reduced ? {} : { opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div className="rounded-xl bg-blue-50/40 border border-blue-200">
            <div className="flex gap-3.5 px-5 py-4">

              {/* Icon */}
              <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Zap size={13} className="text-blue-600" aria-hidden="true" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900 leading-snug">
                  What growth rate is the market betting on?
                </p>
                <p className="mt-1 text-[12px] text-slate-600 leading-relaxed max-w-xl">
                  Every stock price implies a 5-year revenue growth rate. When that implied rate
                  is far above the company&apos;s historical pace, the market is betting on an
                  acceleration it may not deliver.
                </p>

                {/* Mini CAGR visual */}
                <div className="mt-3 space-y-1.5" aria-hidden="true">
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
                          <span className="text-[10px] font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                            {ex.implied}% implied
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-300">vs</span>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-1.5 rounded-full bg-blue-300"
                            style={{ width: `${ex.historicalW}px` }}
                          />
                          <span className="text-[10px] font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                            {ex.historical}% historical
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          — {ex.note}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Legend + CTA */}
                  <div className="flex items-center gap-3 mt-2.5">
                    <div className="flex items-center gap-1">
                      {/* Bicolor swatch: implied bar color varies by expectation level */}
                      <div className="flex items-center gap-px">
                        <div className="w-1.5 h-1.5 rounded-l-full bg-emerald-400" />
                        <div className="w-1.5 h-1.5 rounded-r-full bg-red-400" />
                      </div>
                      <span className="text-[10px] text-slate-400">implied 5Y</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-1.5 rounded-full bg-blue-300" />
                      <span className="text-[10px] text-slate-400">3Y historical</span>
                    </div>
                    <Link
                      href="/stock/NVDA"
                      onClick={dismiss}
                      className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors ml-1"
                    >
                      Open NVDA analysis
                      <ChevronRight size={11} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Dismiss */}
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss introduction"
                className="shrink-0 text-slate-300 hover:text-slate-500 active:scale-90 transition-all mt-0.5 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1"
              >
                <X size={14} aria-hidden="true" />
              </button>

            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
