'use client'

import { fmtPrice } from '@/lib/formatters'
import { motion } from 'motion/react'
import type { CockpitMethodResult } from '@/lib/valuation/cockpit'

interface Props {
  methods: CockpitMethodResult[]
  blendedFairValue: number | null
  currentPrice: number
  currency: string
}

const SHORT: Record<string, string> = {
  forward_pe:       'Forward P/E',
  ev_ebitda:        'EV/EBITDA',
  revenue_multiple: 'Rev. Multiple',
  core_dcf:         'Core DCF',
}

export default function FairValueChart({ methods, blendedFairValue, currentPrice, currency }: Props) {
  const valid = methods.filter(m => m.fairValue != null && m.fairValue > 0)
  if (valid.length === 0) return null

  const W       = 540
  const LEFT_W  = 110
  const RIGHT_W = 116
  const CHART_L = LEFT_W
  const CHART_R = W - RIGHT_W
  const ROW_H   = 44
  const HEADER  = 36
  const FOOTER  = blendedFairValue != null ? 40 : 8
  const SVG_H   = HEADER + valid.length * ROW_H + FOOTER

  const allVals = [currentPrice, ...valid.map(m => m.fairValue!)]
  if (blendedFairValue != null) allVals.push(blendedFairValue)
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const pad  = Math.max((maxV - minV) * 0.16, maxV * 0.05)
  const lo   = minV - pad
  const hi   = maxV + pad
  const xFor = (v: number) => CHART_L + ((v - lo) / (hi - lo)) * (CHART_R - CHART_L)
  const xP   = xFor(currentPrice)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Fair Value by Method</p>
      <svg
        viewBox={`0 0 ${W} ${SVG_H}`}
        width="100%"
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        {/* Current price label */}
        <text x={xP} y={14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#475569"
          fontFamily="-apple-system, system-ui, sans-serif">
          {fmtPrice(currentPrice, currency)}
        </text>
        <text x={xP} y={25} textAnchor="middle" fontSize={10} fill="#94a3b8"
          fontFamily="-apple-system, system-ui, sans-serif">
          CURRENT
        </text>
        {/* Thicker, more visible current price dashed line */}
        <line
          x1={xP} y1={HEADER - 2}
          x2={xP} y2={HEADER + valid.length * ROW_H + (blendedFairValue != null ? 22 : 0)}
          stroke="#1e293b" strokeWidth={2} strokeDasharray="5 3"
        />

        {valid.map((m, i) => {
          const y       = HEADER + i * ROW_H + ROW_H / 2
          const xDot    = xFor(m.fairValue!)
          const isUnder = m.fairValue! > currentPrice
          const dotCol  = isUnder ? '#10b981' : '#ef4444'
          const lineCol = isUnder ? '#d1fae5' : '#fee2e2'
          const label   = SHORT[m.id] ?? m.method
          const upSign  = m.upsidePct != null && m.upsidePct >= 0 ? '+' : ''
          return (
            <g key={m.id}>
              <text x={CHART_L - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#374151"
                fontWeight={500} fontFamily="-apple-system, system-ui, sans-serif">
                {label}
              </text>
              <motion.line
                x1={Math.min(xDot, xP)} y1={y} x2={Math.max(xDot, xP)} y2={y}
                stroke={lineCol} strokeWidth={10}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.05 + i * 0.07 }}
              />
              <motion.circle
                cx={xDot} cy={y} r={6} fill={dotCol}
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.1 + i * 0.07 }}
                style={{ transformOrigin: `${xDot}px ${y}px` }}
              />
              <text x={CHART_R + 8} y={y - 1} textAnchor="start" fontSize={11} fontWeight={700}
                fill="#111827" fontFamily="-apple-system, monospace">
                {fmtPrice(m.fairValue, currency)}
              </text>
              {m.upsidePct != null && (
                <text x={CHART_R + 8} y={y + 13} textAnchor="start" fontSize={10}
                  fill={isUnder ? '#059669' : '#dc2626'} fontFamily="-apple-system, system-ui, sans-serif">
                  {upSign}{(m.upsidePct * 100).toFixed(1)}%
                </text>
              )}
            </g>
          )
        })}

        {blendedFairValue != null && (() => {
          const xB     = xFor(blendedFairValue)
          const y      = HEADER + valid.length * ROW_H + 22
          const bUp    = currentPrice > 0 ? (blendedFairValue - currentPrice) / currentPrice : null
          const bColor = bUp != null && bUp >= 0 ? '#059669' : '#dc2626'
          const bSign  = bUp != null && bUp >= 0 ? '+' : ''
          return (
            <g>
              <line x1={CHART_L} y1={y - 14} x2={CHART_R} y2={y - 14} stroke="#e2e8f0" strokeWidth={1} />
              <motion.polygon
                points={`${xB},${y - 9} ${xB + 7},${y + 1} ${xB},${y + 11} ${xB - 7},${y + 1}`}
                fill={bColor}
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 + valid.length * 0.07 }}
                style={{ transformOrigin: `${xB}px ${y}px` }}
              />
              <text x={CHART_L - 8} y={y + 5} textAnchor="end" fontSize={10} fontWeight={700}
                fill={bColor} fontFamily="-apple-system, system-ui, sans-serif">
                BLENDED
              </text>
              <text x={CHART_R + 8} y={y - 1} textAnchor="start" fontSize={11} fontWeight={700}
                fill={bColor} fontFamily="-apple-system, monospace">
                {fmtPrice(blendedFairValue, currency)}
              </text>
              {bUp != null && (
                <text x={CHART_R + 8} y={y + 13} textAnchor="start" fontSize={10}
                  fill={bColor} fontFamily="-apple-system, system-ui, sans-serif">
                  {bSign}{(bUp * 100).toFixed(1)}%
                </text>
              )}
            </g>
          )
        })()}
      </svg>
      <p className="text-xs text-slate-400 mt-2">
        Dot right of price line = undervalued (emerald) · Dot left = overvalued (red) · ◆ = blended estimate
      </p>
    </div>
  )
}
