'use client'

import { useState, useEffect } from 'react'
import { X, Target, TrendingUp, BarChart2 } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

const KEY = 'intrinsico_stock_tour_seen'

const CONCEPTS = [
  {
    icon: Target,
    label: 'Fair Value',
    desc: 'DCF model estimate of intrinsic worth per share',
    iconBg: 'bg-olive-50',
    iconColor: 'text-olive-700',
  },
  {
    icon: TrendingUp,
    label: 'Upside %',
    desc: 'How far the current price is from the fair value estimate',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    icon: BarChart2,
    label: 'Implied CAGR',
    desc: '5Y revenue growth rate the current stock price implies via Reverse DCF',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
]

export default function StockOrientationStrip() {
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
          className="rounded-xl bg-[#F8FAFC] border border-slate-200 overflow-hidden"
        >
          <div className="px-4 py-3 flex items-start gap-3">
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-slate-500 mb-2.5">
                Three numbers to orient yourself
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {CONCEPTS.map((c) => {
                  const Icon = c.icon
                  return (
                    <div key={c.label} className="flex items-start gap-2.5 flex-1">
                      <div className={`shrink-0 w-6 h-6 rounded-md ${c.iconBg} flex items-center justify-center mt-0.5`}>
                        <Icon size={12} className={c.iconColor} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-slate-800 leading-snug">{c.label}</p>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{c.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-olive-700 hover:text-olive-600 transition-colors mt-0.5 whitespace-nowrap"
              aria-label="Dismiss orientation"
            >
              Got it
              <X size={11} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
