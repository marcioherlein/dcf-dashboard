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
  if (validMethods.length === 0) return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm px-3 sm:px-5 py-4 sm:py-5 w-full min-h-[200px] flex flex-col items-center justify-center gap-2">
      <svg className="w-6 h-6 text-[#CDD1C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v4M12 16h.01" />
      </svg>
      <p className="text-[12px] font-semibold text-[#9B9B9B]">Fair Value by Method</p>
      <p className="text-[11px] text-[#9B9B9B]">No models produced a result for this ticker.</p>
    </div>
  )

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
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm px-3 sm:px-5 py-4 sm:py-5 w-full min-h-[200px]">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-[13px] font-[650] text-[#111111]">Fair Value by Method</p>
        <div className="flex items-center gap-4 text-[10px] text-[#9B9B9B]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#11875D] shrink-0" />
            Undervalued
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#D83B3B] shrink-0" />
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
            style={{ left: `${Math.max(5, Math.min(95, pricePct))}%` }}
          >
            <span className="text-[11px] font-bold tabular-nums text-[#111111] bg-white px-0.5 leading-tight">
              {fmtPrice(currentPrice, currency)}
            </span>
            <span className="text-[11px] font-semibold text-[#6B6B6B] leading-tight">
              Current
            </span>
          </div>
        </div>
        <div className={VALUE_COL} />
      </div>

      {/* Method rows — only show available methods */}
      <div className="flex flex-col">
        {methods.filter(m => m.fairValue != null && m.fairValue > 0).map((m, i) => {
          const hasVal = m.fairValue != null && m.fairValue > 0
          const fv = hasVal ? m.fairValue! : null
          const isUnder = fv != null && fv > currentPrice
          const fvPct = fv != null ? toPct(fv) : null
          const barLeft = fv != null ? Math.min(fvPct!, pricePct) : pricePct
          const barWidth = fv != null ? Math.abs(fvPct! - pricePct) : 0

          return (
            <div key={m.id} className="flex items-center h-12">
              {/* Label */}
              <div className={`${LABEL_COL} text-right pr-3 flex flex-col items-end gap-0.5`}>
                <span
                  className={`text-[11px] font-medium leading-none ${
                    hasVal ? 'text-[#6B6B6B]' : 'text-[#9B9B9B]'
                  }`}
                >
                  {LABEL[m.id] ?? m.method}
                </span>
                <span className={`text-[11px] font-semibold leading-none ${
                  !hasVal ? 'text-[#9B9B9B]'
                  : m.confidence === 'high'   ? 'text-[#11875D]'
                  : m.confidence === 'medium' ? 'text-[#B56A00]'
                  :                             'text-red-400'
                }`}>
                  {!hasVal ? 'Unavailable' : m.confidence === 'high' ? 'High conf.' : m.confidence === 'medium' ? 'Med. conf.' : 'Low conf.'}
                </span>
              </div>

              {/* Track */}
              <div className="flex-1 relative flex items-center h-full">
                {/* Gray baseline */}
                <div className="w-full h-[5px] bg-[#F5F5F5] rounded-full" />

                {hasVal && fv != null && fvPct != null && (
                  <>
                    {/* Colored fill — width animates from 0 on mount */}
                    <div
                      className={`absolute h-[5px] rounded-full transition-[width,left] duration-500 ease-out ${
                        isUnder ? 'bg-emerald-200' : 'bg-[#FCEAEA]'
                      }`}
                      style={{
                        left: `${ready ? barLeft : pricePct}%`,
                        width: `${ready ? barWidth : 0}%`,
                      }}
                    />
                    {/* Fair value dot */}
                    <motion.div
                      className={`absolute w-[13px] h-[13px] rounded-full ring-[2.5px] ring-white shadow ${
                        isUnder ? 'bg-[#E8F7EF]0' : 'bg-[#FCEAEA]0'
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
                    <span className="text-xs font-bold tabular-nums text-[#111111] leading-tight">
                      {fmtPrice(fv, currency)}
                    </span>
                    {m.upsidePct != null && (
                      <span
                        className={`text-[10px] font-semibold tabular-nums leading-tight ${
                          isUnder ? 'text-[#11875D]' : 'text-[#D83B3B]'
                        }`}
                      >
                        {m.upsidePct >= 0 ? '+' : ''}
                        {(m.upsidePct * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-[#9B9B9B]">—</span>
                )}
              </div>
            </div>
          )
        })}

        {/* Blended row */}
        {blendedFairValue != null && (() => {
          const bPct = toPct(blendedFairValue)
          const bIsUnder = blendedFairValue > currentPrice
          const visibleCount = methods.filter(m => m.fairValue != null && m.fairValue > 0).length
          return (
            <>
              <div
                className="border-t border-[#E5E5E5] my-0.5 ml-16 sm:ml-[100px]"
              />
              <div className="flex items-center h-10">
                <div className={`${LABEL_COL} text-right pr-3`}>
                  <span className="text-[10px] font-bold text-[#2563EB]">
                    Blended
                  </span>
                </div>

                <div className="flex-1 relative flex items-center h-full">
                  <div className="w-full h-[5px] bg-[#F5F5F5] rounded-full" />

                  {/* Blue diamond */}
                  <motion.div
                    className="absolute w-3.5 h-3.5 bg-[#EAF1FF]0 ring-[2.5px] ring-white shadow"
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
                      delay: 0.1 + visibleCount * 0.07,
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
                    <span className="text-xs font-bold tabular-nums text-[#2563EB] leading-tight">
                      {fmtPrice(blendedFairValue, currency)}
                    </span>
                    {bUpside != null && (
                      <span
                        className={`text-[10px] font-semibold tabular-nums leading-tight ${
                          bIsUnder ? 'text-[#11875D]' : 'text-[#D83B3B]'
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
