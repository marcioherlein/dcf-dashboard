'use client'
// Real app screenshots wrapped in macOS-style browser chrome with iOS spring animations.
// Images live in /public/screenshots/ — copied from .audit-screenshots/.

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useInView, useReducedMotion } from 'motion/react'

// iOS-grade spring — matches UIKit default spring (damping ratio ~0.86)
const SPRING = { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 } as const

// ─── macOS browser chrome ──────────────────────────────────────────────────────

function BrowserFrame({
  url,
  children,
  className = '',
}: {
  url: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{
        boxShadow:
          '0 2px 0 rgba(255,255,255,0.08) inset, 0 32px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.10)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-0 px-3.5"
        style={{
          height: '38px',
          background: 'linear-gradient(to bottom, #ECECEC 0%, #E0E0E0 100%)',
          borderBottom: '1px solid rgba(0,0,0,0.12)',
        }}
      >
        {/* Traffic lights */}
        <div className="flex items-center gap-2 mr-3">
          <div className="w-3 h-3 rounded-full bg-[#FC605C] border border-[rgba(0,0,0,0.10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
          <div className="w-3 h-3 rounded-full bg-[#FDBC40] border border-[rgba(0,0,0,0.10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
          <div className="w-3 h-3 rounded-full bg-[#34C749] border border-[rgba(0,0,0,0.10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
        </div>
        {/* Address bar */}
        <div
          className="flex-1 flex items-center justify-center"
        >
          <div
            className="flex items-center gap-1.5 px-3 rounded-md text-[11px] text-[#555] max-w-[280px] w-full"
            style={{
              height: '22px',
              background: 'rgba(255,255,255,0.80)',
              border: '1px solid rgba(0,0,0,0.15)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06) inset',
            }}
          >
            <svg className="w-2.5 h-2.5 text-[#999] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="truncate">{url}</span>
          </div>
        </div>
        {/* Right spacer = same width as traffic lights */}
        <div className="w-[52px]" />
      </div>
      {children}
    </div>
  )
}

// ─── SummaryMockScreen — real screenshot ──────────────────────────────────────

export function SummaryMockScreen() {
  const ref     = useRef<HTMLDivElement>(null)
  const inView  = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      initial={reduced ? {} : { opacity: 0, y: 28, scale: 0.96 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={reduced ? { duration: 0 } : { ...SPRING, delay: 0.05 }}
    >
      <BrowserFrame url="insic.app/stock/NOW — Overview">
        <div className="overflow-hidden" style={{ background: '#F0F1F6' }}>
          <Image
            src="/screenshots/summary-desktop.png"
            alt="insic stock summary tab — verdict, fair value, reverse DCF"
            width={1440}
            height={900}
            className="w-full h-auto block"
            priority
          />
        </div>
      </BrowserFrame>
    </motion.div>
  )
}

// ─── ValuationMockScreen — real screenshot ────────────────────────────────────

export function ValuationMockScreen() {
  const ref     = useRef<HTMLDivElement>(null)
  const inView  = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      initial={reduced ? {} : { opacity: 0, y: 28, scale: 0.96 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={reduced ? { duration: 0 } : { ...SPRING, delay: 0.12 }}
    >
      <BrowserFrame url="insic.app/stock/NOW — Valuation">
        <div className="overflow-hidden" style={{ background: '#F0F1F6' }}>
          <Image
            src="/screenshots/valuation-cockpit.png"
            alt="insic valuation cockpit — DCF models, scenarios, assumptions"
            width={1440}
            height={900}
            className="w-full h-auto block"
          />
        </div>
      </BrowserFrame>
    </motion.div>
  )
}

// ─── ScreenshotGallery — stacked perspective for feature sections ─────────────

export function ScreenshotGallery() {
  const ref     = useRef<HTMLDivElement>(null)
  const inView  = useInView(ref, { once: true, margin: '-60px' })
  const reduced = useReducedMotion()

  const shots = [
    {
      src:   '/screenshots/valuation-desktop.png',
      alt:   'Valuation cockpit — verdict hero, fair value chart',
      delay: 0,
      rotate: -2,
      y: 0,
    },
    {
      src:   '/screenshots/summary-desktop.png',
      alt:   'Stock summary — revenue, FCF, growth outlook cards',
      delay: 0.08,
      rotate: 0,
      y: -16,
    },
    {
      src:   '/screenshots/valuation-cockpit.png',
      alt:   'Valuation cockpit — scenario models and assumptions',
      delay: 0.16,
      rotate: 2,
      y: 0,
    },
  ]

  return (
    <div ref={ref} className="relative flex items-end justify-center gap-3 sm:gap-5 px-4">
      {shots.map((shot, i) => (
        <motion.div
          key={shot.src}
          className="flex-1 max-w-[320px] rounded-xl overflow-hidden"
          style={{
            boxShadow: '0 20px 60px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)',
            border: '1px solid rgba(0,0,0,0.08)',
            transformOrigin: 'bottom center',
            rotate: shot.rotate,
          }}
          initial={reduced ? {} : { opacity: 0, y: 40 + i * 12, scale: 0.92 }}
          animate={inView ? { opacity: 1, y: shot.y, scale: 1 } : {}}
          transition={reduced ? { duration: 0 } : { ...SPRING, delay: shot.delay }}
        >
          <Image
            src={shot.src}
            alt={shot.alt}
            width={960}
            height={600}
            className="w-full h-auto block"
          />
        </motion.div>
      ))}
    </div>
  )
}

// ─── MobileScreenshot — iPhone-style frame ────────────────────────────────────

export function MobileScreenshot() {
  const ref     = useRef<HTMLDivElement>(null)
  const inView  = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      className="relative mx-auto"
      style={{ maxWidth: 240 }}
      initial={reduced ? {} : { opacity: 0, y: 32, scale: 0.94 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={reduced ? { duration: 0 } : { ...SPRING, delay: 0.1 }}
    >
      {/* iPhone frame */}
      <div
        className="relative rounded-[40px] overflow-hidden"
        style={{
          background: '#1C1C1E',
          padding: '12px 8px',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px rgba(0,0,0,0.35), 0 8px 16px rgba(0,0,0,0.2)',
        }}
      >
        {/* Dynamic Island */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[#1C1C1E] z-10"
          style={{ top: 18, width: 88, height: 28 }}
        />
        {/* Screen */}
        <div className="rounded-[32px] overflow-hidden">
          <Image
            src="/screenshots/mobile-valuation.png"
            alt="insic on iPhone — mobile valuation view"
            width={390}
            height={844}
            className="w-full h-auto block"
          />
        </div>
        {/* Home indicator */}
        <div
          className="mx-auto mt-2 rounded-full bg-[rgba(255,255,255,0.35)]"
          style={{ width: 100, height: 4 }}
        />
      </div>
    </motion.div>
  )
}

// ─── Legacy counter / bar (kept for backward compat if referenced elsewhere) ──
const LEGACY_EASE = [0.16, 1, 0.3, 1] as const

export function AnimBar({
  pct, color, inView, delay, reduced,
}: {
  pct: number; color: string; inView: boolean; delay: number; reduced: boolean | null
}) {
  return (
    <div className="relative h-2 bg-[#EEF2F7] rounded-full w-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: '0%' }}
        animate={inView ? { width: `${pct}%` } : { width: '0%' }}
        transition={reduced ? { duration: 0 } : { duration: 0.9, ease: LEGACY_EASE, delay }}
      />
    </div>
  )
}
