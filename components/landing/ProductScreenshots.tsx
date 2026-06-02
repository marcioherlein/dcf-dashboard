'use client'
// Animated React mockups of the Insic app UI — used as hero screenshots.
// Design matches the real app's visual language exactly.
// Each component self-tracks viewport visibility and animates on entry.

import { useRef, useEffect, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'

const EASE = [0.16, 1, 0.3, 1] as const

// ─── Animated bar fill ────────────────────────────────────────────────────────

function AnimBar({
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
        transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE, delay }}
      />
    </div>
  )
}

// ─── Number count-up ──────────────────────────────────────────────────────────

function Counter({
  target, decimals = 1, inView, delay = 0, reduced,
}: {
  target: number; decimals?: number; inView: boolean; delay?: number; reduced: boolean | null
}) {
  const [value, setValue] = useState(reduced ? target : 0)

  useEffect(() => {
    if (reduced) { setValue(target); return }
    if (!inView) return
    const startTs = performance.now()
    const delayMs = delay * 1000
    const duration = 1100
    let raf: number

    function tick(now: number) {
      const elapsed = now - startTs - delayMs
      if (elapsed < 0) { raf = requestAnimationFrame(tick); return }
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 4)
      setValue(parseFloat((target * eased).toFixed(decimals)))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setValue(target)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, target, delay, decimals, reduced])

  return <>{value.toFixed(decimals)}</>
}

// ─── SummaryMockScreen — Overview tab ─────────────────────────────────────────

export function SummaryMockScreen() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  // Demo stock: MSFT — undervalued scenario
  // Bars normalized relative to max value (14.2%)
  const bars = [
    { label: 'Implied 5Y CAGR', dot: '#10B981', pct: 79.6, color: '#10B981', val: '11.3%', delay: 0.5 },
    { label: '3Y Historical',   dot: '#3B82F6', pct: 100,  color: '#3B82F6', val: '14.2%', delay: 0.6 },
    { label: 'Analyst Est.',    dot: '#7C3AED', pct: 88.0, color: '#7C3AED', val: '12.5%', delay: 0.65 },
  ]

  return (
    <div
      ref={ref}
      className="rounded-[20px] overflow-hidden bg-white w-full"
      style={{
        border: '1px solid #E6ECF5',
        boxShadow: '0 24px 70px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.05)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-100" style={{ background: '#F8FAFC' }}>
        <div className="w-3 h-3 rounded-full bg-[#FC605C]" />
        <div className="w-3 h-3 rounded-full bg-[#FDBC40]" />
        <div className="w-3 h-3 rounded-full bg-[#34C749]" />
        <div className="flex-1 mx-3 rounded-md bg-white border border-slate-200 px-3 py-1 text-[11px] text-slate-400 font-mono">
          insic.app/stock/MSFT
        </div>
      </div>

      {/* App header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-slate-800 font-mono">MSFT</span>
          <span className="text-[11px] text-slate-400">Microsoft Corporation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-slate-900 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>$388.20</span>
          <span className="text-[11px] font-semibold text-emerald-500">+0.82%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 border-b border-slate-100 bg-white">
        {['Overview', 'Valuation', 'Financials', 'Risk', 'News'].map((tab, i) => (
          <span
            key={tab}
            className="py-2 px-3 text-[11px] font-semibold"
            style={{
              color: i === 0 ? '#2563EB' : '#94A3B8',
              borderBottom: i === 0 ? '2px solid #2563EB' : '2px solid transparent',
            }}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3" style={{ background: '#F8FAFC' }}>

        {/* Verdict hero card */}
        <motion.div
          className="rounded-[16px] p-4 border border-[#BBF7D0]"
          style={{ background: '#F0FDF4' }}
          initial={reduced ? {} : { opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
        >
          <p className="text-[14px] font-[800] text-[#0F172A] leading-tight mb-1.5">
            MSFT looks <span className="text-[#16A34A]">Undervalued</span>
          </p>
          <span
            className="text-[10px] font-[650] px-2 py-0.5 rounded-full border"
            style={{ background: '#ECFDF3', borderColor: '#BBF7D0', color: '#047857' }}
          >
            High Confidence · 4/4 models
          </span>
          <div className="flex items-end gap-4 mt-3">
            <div>
              <p className="text-[10px] text-[#64748B] mb-0.5">Fair value</p>
              <p className="text-[18px] font-[750] text-[#0F172A] leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
                $<Counter target={445.60} decimals={2} inView={inView} reduced={reduced} delay={0.3} />
              </p>
            </div>
            <div className="w-px h-6 self-end mb-0.5" style={{ background: '#BBF7D0' }} />
            <div>
              <p className="text-[10px] text-[#64748B] mb-0.5">vs current price</p>
              <p className="text-[18px] font-[750] text-[#16A34A] leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
                +<Counter target={14.8} decimals={1} inView={inView} reduced={reduced} delay={0.4} />%
              </p>
            </div>
          </div>
        </motion.div>

        {/* Reverse DCF card */}
        <motion.div
          className="rounded-[16px] bg-white border border-[#E6ECF5] p-3"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
          initial={reduced ? {} : { opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-[700] text-[#0F172A]">What the market is pricing in</p>
            <span className="text-[9px] font-[600] text-[#64748B]">Reverse DCF ⓘ</span>
          </div>

          {/* Chips */}
          <div className="flex gap-1 mb-2.5 flex-wrap">
            {['Conservative', 'Moderate', 'Aggressive', 'Very Aggressive'].map((chip, i) => (
              <span
                key={chip}
                className="rounded-full px-1.5 py-0.5 text-[9px] font-[600] border"
                style={i === 0
                  ? { background: '#ECFDF3', borderColor: '#BBF7D0', color: '#047857' }
                  : { background: '#F8FAFC', borderColor: '#E2E8F0', color: '#94A3B8' }}
              >
                {chip}
              </span>
            ))}
          </div>

          <div className="flex gap-3">
            {/* Left: big CAGR number */}
            <div className="flex-none min-w-0">
              <p className="text-[9px] font-[650] text-[#64748B] mb-0.5">Implied 5Y Revenue CAGR</p>
              <p className="text-[22px] font-[800] leading-none text-[#047857]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <Counter target={11.3} decimals={1} inView={inView} reduced={reduced} delay={0.5} />%
              </p>
              <div className="mt-2">
                <p className="text-[9px] font-[650] text-[#64748B] mb-0.5">3Y Historical CAGR</p>
                <p className="text-[12px] font-[700] text-[#334155]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <Counter target={14.2} decimals={1} inView={inView} reduced={reduced} delay={0.6} />% ↗
                </p>
              </div>
            </div>

            {/* Right: comparison bars */}
            <div className="flex-1 min-w-0 flex flex-col gap-2 justify-center">
              {bars.map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.dot }} />
                      <span className="text-[9px] text-[#64748B] truncate">{row.label}</span>
                    </div>
                    <span className="text-[9px] font-[700] text-[#334155] ml-1 shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.val}
                    </span>
                  </div>
                  <AnimBar pct={row.pct} color={row.color} inView={inView} delay={row.delay} reduced={reduced} />
                </div>
              ))}
            </div>
          </div>

          {/* Takeaway callout */}
          <motion.div
            className="mt-2.5 rounded-[8px] px-2.5 py-2 border border-[#BFDBFE]"
            style={{ background: '#EFF6FF' }}
            initial={reduced ? {} : { opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: 0.95 }}
          >
            <p className="text-[9px] text-[#334155] leading-relaxed">
              The market assumes <strong>11.3%</strong> — 2.9pp below the 3-year track record of 14.2%.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

// ─── ValuationMockScreen — Valuation tab ──────────────────────────────────────

export function ValuationMockScreen() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduced = useReducedMotion()

  const methods = [
    { label: 'Forward P/E',  fill: '#3B82F6', pct: 35 },
    { label: 'EV/EBITDA',    fill: '#6366F1', pct: 30 },
    { label: 'Revenue Mult', fill: '#8B5CF6', pct: 25 },
    { label: 'Core DCF',     fill: '#A855F7', pct: 10 },
  ]

  return (
    <div
      ref={ref}
      className="rounded-[20px] overflow-hidden bg-white w-full"
      style={{
        border: '1px solid #E6ECF5',
        boxShadow: '0 16px 48px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.04)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-100" style={{ background: '#F8FAFC' }}>
        <div className="w-2.5 h-2.5 rounded-full bg-[#FC605C]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FDBC40]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#34C749]" />
        <div className="flex-1 mx-3 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
          insic.app/stock/MSFT — Valuation
        </div>
      </div>

      {/* App header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-800 font-mono">MSFT</span>
          <span className="text-[10px] text-slate-400">Microsoft Corporation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-900 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>$388.20</span>
          <span className="text-[10px] font-semibold text-emerald-500">+0.82%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 border-b border-slate-100 bg-white">
        {['Overview', 'Valuation', 'Financials', 'Risk', 'News'].map((tab, i) => (
          <span
            key={tab}
            className="py-2 px-2.5 text-[10px] font-semibold"
            style={{
              color: i === 1 ? '#2563EB' : '#94A3B8',
              borderBottom: i === 1 ? '2px solid #2563EB' : '2px solid transparent',
            }}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Summary cards strip */}
      <motion.div
        className="grid grid-cols-4 gap-px border-b border-[#F1F5F9]"
        style={{ background: '#F1F5F9' }}
        initial={reduced ? {} : { opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {[
          { label: 'Current Price',      value: '$388.20', sub: '+0.82% today',     subColor: '#16A34A', accent: false },
          { label: 'Blended Fair Value', value: null,      sub: '4 of 4 models',    accent: true },
          { label: 'Upside / Downside',  value: null,      sub: 'vs current price', valueColor: '#16A34A', accent: false },
          { label: 'Investment Verdict', value: 'Undervalued', sub: '4/4 models',   valueColor: '#16A34A', accent: false },
        ].map((cell, i) => (
          <div
            key={cell.label}
            className="bg-white px-3 py-2.5 flex flex-col gap-0.5"
            style={cell.accent ? { borderTop: '2px solid #2563EB' } : {}}
          >
            <p className="text-[9px] font-[650] text-[#64748B]">{cell.label}</p>
            <p
              className="text-[13px] font-[750] leading-none"
              style={{ color: cell.valueColor ?? '#0F172A', fontVariantNumeric: 'tabular-nums' }}
            >
              {i === 1
                ? <>$<Counter target={445.60} decimals={2} inView={inView} reduced={reduced} delay={0.35} /></>
                : i === 2
                  ? <>+<Counter target={14.8} decimals={1} inView={inView} reduced={reduced} delay={0.45} />%</>
                  : cell.value}
            </p>
            <p className="text-[9px]" style={{ color: cell.subColor ?? '#64748B' }}>{cell.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Sidebar content */}
      <div className="p-4 space-y-3.5" style={{ background: '#F8FAFC' }}>

        {/* Model verdict */}
        <motion.div
          className="bg-white rounded-[14px] border border-[#E6ECF5] p-3"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
          initial={reduced ? {} : { opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: EASE, delay: 0.2 }}
        >
          <p className="text-[10px] font-[650] text-[#64748B] mb-2">Model Summary</p>
          <span
            className="text-[11px] font-[700] px-3 py-1 rounded-full border"
            style={{ background: '#ECFDF3', borderColor: '#BBF7D0', color: '#16A34A' }}
          >
            Undervalued
          </span>
          <p className="text-[9px] text-[#64748B] mt-1.5">High conviction · 4 of 4 models</p>
        </motion.div>

        {/* Model range bar */}
        <motion.div
          className="bg-white rounded-[14px] border border-[#E6ECF5] p-3"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
          initial={reduced ? {} : { opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: EASE, delay: 0.28 }}
        >
          <p className="text-[10px] font-[650] text-[#64748B] mb-2">Model Range</p>
          <div className="flex justify-between text-[9px] text-[#64748B] mb-1.5 tabular-nums">
            <span>$380.21</span><span>$512.40</span>
          </div>
          <div className="relative h-3 bg-[#F1F5F9] rounded-full">
            {/* Current price tick */}
            <div
              className="absolute top-0 h-full w-0.5 bg-[#94A3B8] rounded-full"
              style={{ left: '3%' }}
            />
            {/* Blended fair value dot — animates in from left */}
            <motion.div
              className="absolute w-4 h-4 bg-white rounded-full border-2 border-[#2563EB]"
              style={{ top: '50%', transform: 'translate(-50%, -50%)', boxShadow: '0 1px 4px rgba(37,99,235,0.3)' }}
              initial={{ left: '3%' }}
              animate={inView ? { left: '50%' } : { left: '3%' }}
              transition={reduced ? { duration: 0 } : { duration: 0.85, ease: EASE, delay: 0.45 }}
            />
          </div>
          <p className="text-[9px] text-[#64748B] mt-1.5 tabular-nums">Current $388.20</p>
        </motion.div>

        {/* Effective blend weights */}
        <motion.div
          className="bg-white rounded-[14px] border border-[#E6ECF5] p-3"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}
          initial={reduced ? {} : { opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: EASE, delay: 0.35 }}
        >
          <p className="text-[10px] font-[650] text-[#64748B] mb-2.5">Effective Blend Weights</p>
          <div className="space-y-2">
            {methods.map((m, i) => (
              <div key={m.label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: m.fill }} />
                <span className="text-[9px] text-[#475569] flex-1 min-w-0">{m.label}</span>
                <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden shrink-0">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: m.fill }}
                    initial={{ width: '0%' }}
                    animate={inView ? { width: `${m.pct}%` } : { width: '0%' }}
                    transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE, delay: 0.4 + i * 0.08 }}
                  />
                </div>
                <span className="text-[9px] font-[650] font-mono text-[#64748B] w-5 text-right shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {m.pct}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
