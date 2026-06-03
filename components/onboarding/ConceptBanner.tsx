'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Zap, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import Link from 'next/link'

const KEY = 'intrinsico_concept_seen'

export interface ConceptBannerCagr {
  ticker: string
  impliedCagr: number
  historicalCagr3y: number
}

interface ConceptBannerProps {
  liveData?: ConceptBannerCagr[]
}

// Editorial notes by ticker — human commentary on WHY, independent of daily numbers
const STATIC_NOTES: Record<string, string> = {
  NVDA: 'extreme AI bets baked in',
  AAPL: 'market betting on a slowdown',
}

// Fallback numbers used only when liveData is not passed (e.g. isolated rendering)
const FALLBACK: ConceptBannerCagr[] = [
  { ticker: 'NVDA', impliedCagr: 45, historicalCagr3y: 60 },
  { ticker: 'AAPL', impliedCagr: 6,  historicalCagr3y: 8  },
]

function impliedBarColor(cagr: number): string {
  if (cagr > 30) return 'bg-red-400'
  if (cagr > 15) return 'bg-amber-400'
  return 'bg-emerald-400'
}

function deriveNote(implied: number, historical: number): string {
  const gap = implied - historical
  if (gap > 15)  return 'implied significantly above historical pace'
  if (gap > 5)   return 'implied above historical pace'
  if (gap > -5)  return 'implied near historical pace'
  if (gap > -15) return 'market pricing in a slowdown'
  return 'implied well below historical pace'
}

export default function ConceptBanner({ liveData }: ConceptBannerProps) {
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

  const examples = useMemo(() => {
    const source = (liveData && liveData.length >= 2) ? liveData : FALLBACK
    const maxCagr = Math.max(...source.map(e => Math.max(e.impliedCagr, e.historicalCagr3y)), 1)

    return source.map(ex => ({
      ticker:        ex.ticker,
      implied:       ex.impliedCagr,
      historical:    ex.historicalCagr3y,
      impliedW:      Math.max(6, Math.round((ex.impliedCagr    / maxCagr) * 100)),
      historicalW:   Math.max(6, Math.round((ex.historicalCagr3y / maxCagr) * 100)),
      impliedColor:  impliedBarColor(ex.impliedCagr),
      note:          STATIC_NOTES[ex.ticker] ?? deriveNote(ex.impliedCagr, ex.historicalCagr3y),
    }))
  }, [liveData])

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
                  {examples.map((ex) => (
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
                            {ex.implied.toFixed(1)}% implied
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-300">vs</span>
                        <div className="flex items-center gap-1">
                          <div
                            className="h-1.5 rounded-full bg-blue-300"
                            style={{ width: `${ex.historicalW}px` }}
                          />
                          <span className="text-[10px] font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                            {ex.historical.toFixed(1)}% historical
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
