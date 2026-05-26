'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { fmtPrice } from '@/lib/formatters'
import type { CockpitMethodResult } from '@/lib/valuation/cockpit'

interface Props {
  methods: CockpitMethodResult[]
  blendedFairValue: number | null
  currentPrice: number
  currency: string
}

const LABEL: Record<string, string> = {
  forward_pe:       'Forward P/E',
  ev_ebitda:        'EV/EBITDA',
  revenue_multiple: 'Rev. Multiple',
  core_dcf:         'Core DCF',
}

// Responsive Tailwind classes for the fixed columns
const LABEL_COL = 'w-16 sm:w-[100px] shrink-0'
const VALUE_COL = 'w-20 sm:w-[116px] shrink-0'

export default function FairValueChart({ methods, blendedFairValue, currentPrice, currency }: Props) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80)
    return () => clearTimeout(t)
  }, [])

  const validMethods = methods.filter(m => m.fairValue != null && m.fairValue > 0)
  if (validMethods.length === 0) return null

  const all = [currentPrice, ...validMethods.map(m => m.fairValue!)]
  if (blendedFairValue != null) all.push(blendedFairValue)
  const minV = Math.min(...all)
  const maxV = Math.max(...all)
  const pad = Math.max((maxV - minV) * 0.13, maxV * 0.04)
  const lo = Math.max(0, minV - pad)
  const hi = maxV + pad
  const range = hi - lo
  const toPct = (v: number) => Math.max(0.5, Math.min(99.5, ((v - lo) / range) * 100))
  const pricePct = toPct(currentPrice)

  const bUpside =
    blendedFairValue != null && currentPrice > 0
      ? (blendedFairValue - currentPrice) / currentPrice
      : null

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-5">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Fair Value by Method</p>
        <div className="flex items-center gap-4 text-[10px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            Undervalued
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            Overvalued
          </span>
        </div>
      </div>

      {/* Current price label — floats above the track at the right position */}
      <div className="flex items-end h-8 mb-1.5">
        <div className={LABEL_COL} />
        <div className="flex-1 relative">
          <div
            className="absolute bottom-0 flex flex-col items-center gap-px -translate-x-1/2"
            style={{ left: `${pricePct}%` }}
          >
            <span className="text-[11px] font-bold tabular-nums text-slate-800 bg-white px-0.5 leading-tight">
              {fmtPrice(currentPrice, currency)}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-tight">
              Current
            </span>
          </div>
        </div>
        <div className={VALUE_COL} />
      </div>

      {/* Method rows — no gap so per-row price ticks form one continuous vertical line */}
      <div className="flex flex-col">
        {methods.map((m, i) => {
          const hasVal = m.fairValue != null && m.fairValue > 0
          const fv = hasVal ? m.fairValue! : null
          const isUnder = fv != null && fv > currentPrice
          const fvPct = fv != null ? toPct(fv) : null
          const barLeft = fv != null ? Math.min(fvPct!, pricePct) : pricePct
          const barWidth = fv != null ? Math.abs(fvPct! - pricePct) : 0

          return (
            <div key={m.id} className="flex items-center h-10">
              {/* Label */}
              <div className={`${LABEL_COL} text-right pr-3`}>
                <span
                  className={`text-[11px] font-medium leading-none ${
                    hasVal ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  {LABEL[m.id] ?? m.method}
                </span>
              </div>

              {/* Track */}
              <div className="flex-1 relative flex items-center h-full">
                {/* Gray baseline */}
                <div className="w-full h-[5px] bg-slate-100 rounded-full" />

                {hasVal && fv != null && fvPct != null && (
                  <>
                    {/* Colored fill — width animates from 0 on mount */}
                    <div
                      className={`absolute h-[5px] rounded-full transition-[width,left] duration-500 ease-out ${
                        isUnder ? 'bg-emerald-200' : 'bg-red-100'
                      }`}
                      style={{
                        left: `${ready ? barLeft : pricePct}%`,
                        width: `${ready ? barWidth : 0}%`,
                      }}
                    />
                    {/* Fair value dot */}
                    <motion.div
                      className={`absolute w-[13px] h-[13px] rounded-full ring-[2.5px] ring-white shadow ${
                        isUnder ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                      style={{ left: `${fvPct}%`, transform: 'translateX(-50%)' }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 480,
                        damping: 20,
                        delay: 0.1 + i * 0.07,
                      }}
                    />
                  </>
                )}

                {/* Current price tick — all rows so they form one continuous line */}
                <div
                  className="absolute h-6 w-[1.5px] bg-slate-700/60 rounded-full -translate-x-1/2"
                  style={{ left: `${pricePct}%` }}
                />
              </div>

              {/* Value */}
              <div className={`${VALUE_COL} pl-3`}>
                {hasVal && fv != null ? (
                  <div className="flex flex-col gap-[1px]">
                    <span className="text-xs font-bold tabular-nums text-slate-900 leading-tight">
                      {fmtPrice(fv, currency)}
                    </span>
                    {m.upsidePct != null && (
                      <span
                        className={`text-[10px] font-semibold tabular-nums leading-tight ${
                          isUnder ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {m.upsidePct >= 0 ? '+' : ''}
                        {(m.upsidePct * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-300">—</span>
                )}
              </div>
            </div>
          )
        })}

        {/* Blended row */}
        {blendedFairValue != null && (() => {
          const bPct = toPct(blendedFairValue)
          const bIsUnder = blendedFairValue > currentPrice
          return (
            <>
              <div
                className="border-t border-slate-100 my-0.5 ml-16 sm:ml-[100px]"
              />
              <div className="flex items-center h-10">
                <div className={`${LABEL_COL} text-right pr-3`}>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
                    Blended
                  </span>
                </div>

                <div className="flex-1 relative flex items-center h-full">
                  <div className="w-full h-[5px] bg-slate-100 rounded-full" />

                  {/* Blue diamond */}
                  <motion.div
                    className="absolute w-3.5 h-3.5 bg-blue-500 ring-[2.5px] ring-white shadow"
                    style={{
                      left: `${bPct}%`,
                      transform: 'translateX(-50%) rotate(45deg)',
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 400,
                      damping: 20,
                      delay: 0.1 + methods.length * 0.07,
                    }}
                  />

                  {/* Current price tick */}
                  <div
                    className="absolute h-6 w-[1.5px] bg-slate-700/60 rounded-full -translate-x-1/2"
                    style={{ left: `${pricePct}%` }}
                  />
                </div>

                <div className={`${VALUE_COL} pl-3`}>
                  <div className="flex flex-col gap-[1px]">
                    <span className="text-xs font-bold tabular-nums text-blue-600 leading-tight">
                      {fmtPrice(blendedFairValue, currency)}
                    </span>
                    {bUpside != null && (
                      <span
                        className={`text-[10px] font-semibold tabular-nums leading-tight ${
                          bIsUnder ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {bUpside >= 0 ? '+' : ''}
                        {(bUpside * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}
