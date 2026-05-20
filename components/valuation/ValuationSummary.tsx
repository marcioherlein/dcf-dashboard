'use client'

import { fmtPrice, upsideZone, zoneBadgeClass } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { TrendBadge } from '@/components/ui/trend-badge'
import { NumberDisplay } from '@/components/ui/number-display'
import { NABadge } from '@/components/ui/na-badge'
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

function computeConsensus(methods: MethodResult[], price: number) {
  const valid = methods.filter(m => m.fairValue != null && m.weight > 0)
  if (!valid.length) return { weightedFV: null, weightedUpside: null, zone: null }

  const totalWeight    = valid.reduce((s, m) => s + m.weight, 0)
  const weightedFV     = valid.reduce((s, m) => s + m.fairValue! * m.weight, 0) / totalWeight
  const weightedUpside = price > 0 ? (weightedFV - price) / price : null
  const zone           = upsideZone(weightedUpside)

  return { weightedFV, weightedUpside, zone }
}

// ── Short method labels for chart ─────────────────────────────────────────────
const SHORT_LABELS: Record<string, string> = {
  forward_pe:       'Forward P/E',
  ev_ebitda:        'EV/EBITDA',
  revenue_multiple: 'Rev. Multiple',
  core_dcf:         'Core DCF',
}

// ── SVG Lollipop Chart ────────────────────────────────────────────────────────

function MethodDotsChart({
  methods,
  currentPrice,
  blendedFV,
  currency,
}: {
  methods: MethodResult[]
  currentPrice: number
  blendedFV: number | null
  currency: string
}) {
  const valid = methods.filter(m => m.fairValue != null)
  if (valid.length === 0) return null

  // SVG coordinate constants
  const W = 560
  const LEFT_W = 100   // method label area
  const RIGHT_W = 110  // fair value + upside area
  const CHART_L = LEFT_W
  const CHART_R = W - RIGHT_W
  const ROW_H = 38
  const HEADER_H = 30
  const FOOTER_H = blendedFV != null ? 32 : 8
  const SVG_H = HEADER_H + valid.length * ROW_H + FOOTER_H

  // Price domain
  const allVals = [currentPrice, ...valid.map(m => m.fairValue!)]
  if (blendedFV != null) allVals.push(blendedFV)
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const pad = Math.max((maxV - minV) * 0.14, maxV * 0.04)
  const domainMin = minV - pad
  const domainMax = maxV + pad

  const xFor = (v: number) =>
    CHART_L + ((v - domainMin) / (domainMax - domainMin)) * (CHART_R - CHART_L)
  const xPrice = xFor(currentPrice)

  return (
    <svg
      viewBox={`0 0 ${W} ${SVG_H}`}
      width="100%"
      style={{ display: 'block' }}
      aria-label="Fair value lollipop chart"
    >
      {/* Current price header label */}
      <text
        x={xPrice} y={12}
        textAnchor="middle"
        fontSize={9} fontWeight={700} fill="#475569"
        fontFamily="-apple-system, system-ui, sans-serif"
      >
        {fmtPrice(currentPrice, currency)}
      </text>
      <text
        x={xPrice} y={22}
        textAnchor="middle"
        fontSize={8} fill="#94a3b8"
        fontFamily="-apple-system, system-ui, sans-serif"
      >
        CURRENT
      </text>

      {/* Current price dashed vertical line */}
      <line
        x1={xPrice} y1={HEADER_H - 2}
        x2={xPrice} y2={HEADER_H + valid.length * ROW_H + (blendedFV != null ? 14 : 0)}
        stroke="#1e293b" strokeWidth={1.5} strokeDasharray="4 3"
      />

      {/* Method rows */}
      {valid.map((m, i) => {
        const y = HEADER_H + i * ROW_H + ROW_H / 2
        const xDot = xFor(m.fairValue!)
        const isUnder = m.fairValue! > currentPrice
        const dotColor = isUnder ? '#10b981' : '#ef4444'
        const lineColor = isUnder ? '#d1fae5' : '#fee2e2'
        const shortLabel = SHORT_LABELS[m.id] ?? m.label
        const upPct = m.upsidePct != null ? (m.upsidePct * 100).toFixed(1) : null
        const upSign = m.upsidePct != null && m.upsidePct >= 0 ? '+' : ''

        return (
          <g key={m.id}>
            {/* Method name */}
            <text
              x={CHART_L - 6} y={y + 4}
              textAnchor="end"
              fontSize={10.5} fill="#374151" fontWeight={500}
              fontFamily="-apple-system, system-ui, sans-serif"
            >
              {shortLabel}
            </text>

            {/* Horizontal stem: from dot to price line */}
            <motion.line
              x1={Math.min(xDot, xPrice)} y1={y}
              x2={Math.max(xDot, xPrice)} y2={y}
              stroke={lineColor} strokeWidth={8}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, delay: 0.05 + i * 0.07 }}
            />

            {/* Dot */}
            <motion.circle
              cx={xDot} cy={y} r={5} fill={dotColor}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.1 + i * 0.07 }}
              style={{ transformOrigin: `${xDot}px ${y}px` }}
            />

            {/* Right: fair value */}
            <text
              x={CHART_R + 6} y={y - 1}
              textAnchor="start"
              fontSize={10} fontWeight={700} fill="#111827"
              fontFamily="-apple-system, monospace"
            >
              {fmtPrice(m.fairValue, currency)}
            </text>
            {/* Right: upside % */}
            {upPct != null && (
              <text
                x={CHART_R + 6} y={y + 11}
                textAnchor="start"
                fontSize={9} fill={isUnder ? '#059669' : '#dc2626'}
                fontFamily="-apple-system, system-ui, sans-serif"
              >
                {upSign}{upPct}%
              </text>
            )}
          </g>
        )
      })}

      {/* Blended estimate diamond row */}
      {blendedFV != null && (() => {
        const xBlend = xFor(blendedFV)
        const y = HEADER_H + valid.length * ROW_H + 16
        const blendUpside = currentPrice > 0 ? (blendedFV - currentPrice) / currentPrice : null
        const blendColor = blendUpside != null && blendUpside >= 0 ? '#059669' : '#dc2626'
        const blendUpPct = blendUpside != null ? (blendUpside * 100).toFixed(1) : null
        const blendSign = blendUpside != null && blendUpside >= 0 ? '+' : ''
        return (
          <g>
            {/* Divider line */}
            <line x1={CHART_L} y1={y - 10} x2={CHART_R} y2={y - 10} stroke="#e2e8f0" strokeWidth={1} />
            {/* Diamond */}
            <motion.polygon
              points={`${xBlend},${y - 7} ${xBlend + 6},${y} ${xBlend},${y + 7} ${xBlend - 6},${y}`}
              fill={blendColor}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 + valid.length * 0.07 }}
              style={{ transformOrigin: `${xBlend}px ${y}px` }}
            />
            {/* Label left of diamond */}
            <text
              x={CHART_L - 6} y={y + 4}
              textAnchor="end"
              fontSize={9} fontWeight={700} fill={blendColor}
              fontFamily="-apple-system, system-ui, sans-serif"
            >
              BLENDED
            </text>
            {/* Right: blended fair value */}
            <text
              x={CHART_R + 6} y={y - 1}
              textAnchor="start"
              fontSize={10} fontWeight={700} fill={blendColor}
              fontFamily="-apple-system, monospace"
            >
              {fmtPrice(blendedFV, currency)}
            </text>
            {blendUpPct != null && (
              <text
                x={CHART_R + 6} y={y + 11}
                textAnchor="start"
                fontSize={9} fill={blendColor}
                fontFamily="-apple-system, system-ui, sans-serif"
              >
                {blendSign}{blendUpPct}%
              </text>
            )}
          </g>
        )
      })()}
    </svg>
  )
}

// ── Method breakdown helpers ──────────────────────────────────────────────────

const METHOD_DESCRIPTIONS: Record<string, string> = {
  forward_pe:       '5-yr EPS target × exit P/E, discounted to today',
  ev_ebitda:        'Enterprise value using sector EV/EBITDA exit multiple',
  revenue_multiple: 'EV/Revenue exit multiple — useful for growth-stage companies',
  core_dcf:         'FCFF, FCFE & DDM triangulated — intrinsic value from cash flows',
}

function methodUpside(m: MethodResult): 'up' | 'neutral' | 'down' | null {
  if (m.upsidePct == null) return null
  if (m.upsidePct >= 0.10) return 'up'
  if (m.upsidePct >= -0.05) return 'neutral'
  return 'down'
}

const METHOD_BORDER_CLASS: Record<string, string> = {
  up:      'border-l-emerald-400',
  neutral: 'border-l-blue-300',
  down:    'border-l-red-400',
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ValuationSummary({ methods, currentPrice, currency = 'USD' }: Props) {
  const { weightedFV, weightedUpside, zone } = computeConsensus(methods, currentPrice)

  const effectiveTotalWeight = methods.filter(m => m.fairValue != null && m.weight > 0).reduce((s, m) => s + m.weight, 0)
  const validMethodCount = methods.filter(m => m.fairValue != null && m.weight > 0).length

  const zoneStyle = zone === 'Attractive'
    ? { wrap: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' }
    : zone === 'Fair Value'
    ? { wrap: 'bg-blue-50 border-blue-200', text: 'text-blue-700' }
    : zone === 'Expensive'
    ? { wrap: 'bg-red-50 border-red-200', text: 'text-red-700' }
    : { wrap: 'bg-slate-50 border-slate-200', text: 'text-slate-600' }

  return (
    <div className="space-y-4">

      {/* ── Weighted consensus hero ─────────────────────────────────────────── */}
      {weightedFV != null && (
        <div className={cn('rounded-xl border px-6 py-5', zoneStyle.wrap)}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-label uppercase tracking-wider text-slate-500 mb-1">Weighted Fair Value Estimate</p>
              <NumberDisplay value={fmtPrice(weightedFV, currency)} size="xl" />
              <p className="text-micro text-slate-500 mt-1">
                vs. {fmtPrice(currentPrice, currency)} current price · {validMethodCount} method{validMethodCount !== 1 ? 's' : ''}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 italic">Model estimate, not a prediction</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {zone && (
                <span className={cn('rounded-full border px-4 py-1.5 text-sm font-bold', zoneBadgeClass(zone))}>
                  {zone}
                </span>
              )}
              {weightedUpside != null && (
                <TrendBadge value={weightedUpside} size="lg" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Method dots lollipop chart ──────────────────────────────────────── */}
      {methods.some(m => m.fairValue != null) && (
        <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] p-5">
          <p className="text-label uppercase tracking-wider text-slate-400 mb-4">Fair Value by Method</p>
          <MethodDotsChart
            methods={methods}
            currentPrice={currentPrice}
            blendedFV={weightedFV ?? null}
            currency={currency}
          />
          <p className="text-micro text-slate-400 mt-3">
            Dot right of price line = undervalued by that method (emerald). Left = overvalued (red). ◆ = weighted blended estimate.
          </p>
        </div>
      )}

      {/* ── Method breakdown table ──────────────────────────────────────────── */}
      {methods.length > 0 && (
        <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 border-b border-white/8 bg-white/3">
            <span className="text-label uppercase tracking-wider text-slate-400 font-bold">Method</span>
            <span className="text-label uppercase tracking-wider text-slate-400 font-bold text-right">Fair Value</span>
            <span className="text-label uppercase tracking-wider text-slate-400 font-bold text-right">Upside</span>
            <span className="text-label uppercase tracking-wider text-slate-400 font-bold text-right w-20">Weight</span>
          </div>

          <div className="divide-y divide-white/5">
            {methods.map((m, i) => {
              const side = methodUpside(m)
              const borderClass = side ? METHOD_BORDER_CLASS[side] : 'border-l-slate-700'
              const effectivePct = (m.fairValue != null && effectiveTotalWeight > 0)
                ? (m.weight / effectiveTotalWeight) * 100
                : 0
              const desc = METHOD_DESCRIPTIONS[m.id] ?? ''

              return (
                <div
                  key={m.id}
                  className={cn('grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-3 border-l-4 items-center', borderClass)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-200 leading-snug">{m.label}</p>
                    {desc && <p className="text-[11px] text-slate-500 leading-tight mt-0.5 truncate">{desc}</p>}
                  </div>

                  <div className="text-right">
                    {m.fairValue != null
                      ? <span className="font-semibold tabular-nums text-slate-100 text-sm">{fmtPrice(m.fairValue, currency)}</span>
                      : <NABadge reason="model-unsupported" />
                    }
                  </div>

                  <div className="text-right">
                    {m.upsidePct != null
                      ? <TrendBadge value={m.upsidePct} size="sm" />
                      : <NABadge reason="model-unsupported" />
                    }
                  </div>

                  <div className="w-20 flex flex-col gap-1 items-end">
                    {m.fairValue != null && effectiveTotalWeight > 0 ? (
                      <>
                        <span className="text-[11px] font-mono text-slate-500">{effectivePct.toFixed(0)}%</span>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <motion.div
                            className={cn('h-full rounded-full', side === 'up' ? 'bg-emerald-400' : side === 'down' ? 'bg-red-400' : 'bg-blue-300')}
                            initial={{ width: '0%' }}
                            animate={{ width: `${effectivePct}%` }}
                            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.06 }}
                          />
                        </div>
                      </>
                    ) : (
                      <NABadge reason="model-unsupported" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
            <p className="text-micro text-slate-400">
              Effective weights exclude methods with no available data. Adjust assumptions in each method card to refine.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
