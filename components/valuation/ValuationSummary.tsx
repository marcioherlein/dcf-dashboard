'use client'

import { fmtPrice } from '@/lib/formatters'
import { motion } from 'motion/react'

export interface MethodResult {
  id: string
  label: string
  fairValue: number | null
  bullFairValue?: number | null
  bearFairValue?: number | null
  upsidePct: number | null
  weight: number
}

interface Props {
  methods: MethodResult[]
  currentPrice: number
  currency?: string
}

function computeConsensus(methods: MethodResult[]) {
  const valid = methods.filter(m => m.fairValue != null && m.weight > 0)
  if (!valid.length) return { weightedFV: null }
  const totalWeight = valid.reduce((s, m) => s + m.weight, 0)
  const weightedFV  = valid.reduce((s, m) => s + m.fairValue! * m.weight, 0) / totalWeight
  return { weightedFV }
}

const SHORT_LABELS: Record<string, string> = {
  forward_pe:       'Forward P/E',
  ev_ebitda:        'EV/EBITDA',
  revenue_multiple: 'Rev. Multiple',
  core_dcf:         'Core DCF',
}

function MethodDotsChart({ methods, currentPrice, blendedFV, currency }: {
  methods: MethodResult[]
  currentPrice: number
  blendedFV: number | null
  currency: string
}) {
  const valid = methods.filter(m => m.fairValue != null)
  if (valid.length === 0) return null

  const W        = 560
  const LEFT_W   = 100
  const RIGHT_W  = 110
  const CHART_L  = LEFT_W
  const CHART_R  = W - RIGHT_W
  const ROW_H    = 38
  const HEADER_H = 30
  const FOOTER_H = blendedFV != null ? 32 : 8
  const SVG_H    = HEADER_H + valid.length * ROW_H + FOOTER_H

  const allVals = [currentPrice, ...valid.map(m => m.fairValue!)]
  if (blendedFV != null) allVals.push(blendedFV)
  const minV     = Math.min(...allVals)
  const maxV     = Math.max(...allVals)
  const pad      = Math.max((maxV - minV) * 0.14, maxV * 0.04)
  const domainMin = minV - pad
  const domainMax = maxV + pad
  const xFor = (v: number) => CHART_L + ((v - domainMin) / (domainMax - domainMin)) * (CHART_R - CHART_L)
  const xPrice = xFor(currentPrice)

  return (
    <svg viewBox={`0 0 ${W} ${SVG_H}`} width="100%" style={{ display: 'block' }} aria-label="Fair value lollipop chart">
      <text x={xPrice} y={12} textAnchor="middle" fontSize={9} fontWeight={700} fill="#566174" fontFamily="Inter, system-ui, sans-serif">
        {fmtPrice(currentPrice, currency)}
      </text>
      <text x={xPrice} y={22} textAnchor="middle" fontSize={8} fill="#8A95A6" fontFamily="Inter, system-ui, sans-serif">
        CURRENT
      </text>
      <line
        x1={xPrice} y1={HEADER_H - 2}
        x2={xPrice} y2={HEADER_H + valid.length * ROW_H + (blendedFV != null ? 14 : 0)}
        stroke="#1e293b" strokeWidth={1.5} strokeDasharray="4 3"
      />

      {valid.map((m, i) => {
        const y          = HEADER_H + i * ROW_H + ROW_H / 2
        const xDot       = xFor(m.fairValue!)
        const isUnder    = m.fairValue! > currentPrice
        const dotColor   = isUnder ? '#10b981' : '#ef4444'
        const lineColor  = isUnder ? '#d1fae5' : '#fee2e2'
        const shortLabel = SHORT_LABELS[m.id] ?? m.label
        const upPct      = m.upsidePct != null ? (m.upsidePct * 100).toFixed(1) : null
        const upSign     = m.upsidePct != null && m.upsidePct >= 0 ? '+' : ''
        return (
          <g key={m.id}>
            <text x={CHART_L - 6} y={y + 4} textAnchor="end" fontSize={10.5} fill="#374151" fontWeight={500} fontFamily="Inter, system-ui, sans-serif">
              {shortLabel}
            </text>
            <motion.line
              x1={Math.min(xDot, xPrice)} y1={y} x2={Math.max(xDot, xPrice)} y2={y}
              stroke={lineColor} strokeWidth={8}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.05 + i * 0.07 }}
            />
            <motion.circle
              cx={xDot} cy={y} r={5} fill={dotColor}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.1 + i * 0.07 }}
              style={{ transformOrigin: `${xDot}px ${y}px` }}
            />
            <text x={CHART_R + 6} y={y - 1} textAnchor="start" fontSize={10} fontWeight={700} fill="#111827" fontFamily="'DM Mono', 'IBM Plex Mono', monospace">
              {fmtPrice(m.fairValue, currency)}
            </text>
            {upPct != null && (
              <text x={CHART_R + 6} y={y + 11} textAnchor="start" fontSize={9} fill={isUnder ? '#059669' : '#dc2626'} fontFamily="Inter, system-ui, sans-serif">
                {upSign}{upPct}%
              </text>
            )}
          </g>
        )
      })}

      {blendedFV != null && (() => {
        const xBlend     = xFor(blendedFV)
        const y          = HEADER_H + valid.length * ROW_H + 16
        const blendUp    = currentPrice > 0 ? (blendedFV - currentPrice) / currentPrice : null
        const blendColor = blendUp != null && blendUp >= 0 ? '#059669' : '#dc2626'
        const blendUpPct = blendUp != null ? (blendUp * 100).toFixed(1) : null
        const blendSign  = blendUp != null && blendUp >= 0 ? '+' : ''
        return (
          <g>
            <line x1={CHART_L} y1={y - 10} x2={CHART_R} y2={y - 10} stroke="#E3E1DA" strokeWidth={1} />
            <motion.polygon
              points={`${xBlend},${y - 7} ${xBlend + 6},${y} ${xBlend},${y + 7} ${xBlend - 6},${y}`}
              fill={blendColor}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 + valid.length * 0.07 }}
              style={{ transformOrigin: `${xBlend}px ${y}px` }}
            />
            <text x={CHART_L - 6} y={y + 4} textAnchor="end" fontSize={9} fontWeight={700} fill={blendColor} fontFamily="Inter, system-ui, sans-serif">
              BLENDED
            </text>
            <text x={CHART_R + 6} y={y - 1} textAnchor="start" fontSize={10} fontWeight={700} fill={blendColor} fontFamily="'DM Mono', 'IBM Plex Mono', monospace">
              {fmtPrice(blendedFV, currency)}
            </text>
            {blendUpPct != null && (
              <text x={CHART_R + 6} y={y + 11} textAnchor="start" fontSize={9} fill={blendColor} fontFamily="Inter, system-ui, sans-serif">
                {blendSign}{blendUpPct}%
              </text>
            )}
          </g>
        )
      })()}
    </svg>
  )
}

export default function ValuationSummary({ methods, currentPrice, currency = 'USD' }: Props) {
  const { weightedFV } = computeConsensus(methods)
  if (!methods.some(m => m.fairValue != null)) return null

  return (
    <div className="rounded-xl glass-card-light p-5">
      <p className="text-label uppercase tracking-wider text-[#8A95A6] font-bold mb-4">Fair Value by Method</p>
      <MethodDotsChart
        methods={methods}
        currentPrice={currentPrice}
        blendedFV={weightedFV ?? null}
        currency={currency}
      />
      <p className="text-micro text-[#566174] mt-3">
        Dot right of price line = undervalued (emerald). Left = overvalued (red). ◆ = weighted blended estimate.
      </p>
    </div>
  )
}
