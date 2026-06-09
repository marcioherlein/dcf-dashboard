'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { Compass, X } from 'lucide-react'

const STORAGE_KEY = 'insic_onboarded'

export default function FirstRunBanner() {
  const [visible, setVisible] = useState(false)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  const variants = prefersReduced
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        hidden: { opacity: 0, y: -10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
        exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' as const } },
      }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="region"
          aria-label="Getting started"
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 bg-[#F6FAEA] border border-[#BFD2A1] rounded-xl px-4 py-3"
        >
          {/* Icon */}
          <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-[#5F790B]/10">
            <Compass className="w-5 h-5 text-[#5F790B]" aria-hidden="true" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#111111] leading-snug mb-0.5">
              Start your analysis
            </p>
            <p className="text-[12px] text-[#6B6B6B] leading-relaxed">
              <span>1. Search a stock</span>
              <span className="mx-1.5 text-[#BFD2A1]">→</span>
              <span>2. See the fair value</span>
              <span className="mx-1.5 text-[#BFD2A1]">→</span>
              <span>3. Save to My Valuations</span>
            </p>
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss getting started banner"
            className="shrink-0 self-start sm:self-center inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-1 rounded-lg text-[#6B6B6B] hover:text-[#111111] hover:bg-[#BFD2A1]/30 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
