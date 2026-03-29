'use client'

import { useState } from 'react'
import type { FactorAlignment } from '@/lib/strategy/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function directionDot(direction: 'bullish' | 'neutral' | 'bearish') {
  if (direction === 'bullish') return 'bg-secondary'
  if (direction === 'bearish') return 'bg-error'
  return 'bg-tertiary-fixed-dim'
}

function metricColor(label: string, value: number | null): string {
  if (value === null) return 'text-on-surface-variant/50'

  // Higher-is-better metrics
  const higherBetter = ['Ret 12M', 'Ret 6M (skip)', 'RS vs Bench', 'vs 200MA', 'vs 50MA',
    'Slope 200MA', 'Days >50MA', 'EPS Gr YoY', 'Rev Gr YoY', 'EPS Surprise', 'ROE', 'Gross Margin',
    'Ret 1M', 'Ret 3M', 'Trend', 'Vol Trend']
  // Lower-is-better metrics
  const lowerBetter = ['ATR%', 'Max DD 6M', 'Dist 52w Hi', 'Contango', 'Debt/EBITDA']
  // Special: closer to 1 is better (contraction means lower vol which is bad for futures)
  const neutral = ['Vol Contract', 'Vol Exp']

  if (higherBetter.includes(label)) {
    if (value > 10) return 'text-secondary font-bold'
    if (value > 0) return 'text-secondary'
    if (value > -5) return 'text-on-surface-variant'
    return 'text-error'
  }
  if (lowerBetter.includes(label)) {
    if (value < 1) return 'text-secondary font-bold'
    if (value < 3) return 'text-secondary'
    if (value < 7) return 'text-tertiary-fixed-dim'
    return 'text-error'
  }
  if (neutral.includes(label)) return 'text-on-surface-variant'
  return 'text-on-surface'
}

function formatMetricValue(label: string, value: number | null): string {
  if (value === null) return '—'
  const pctLabels = ['Ret 12M', 'Ret 6M (skip)', 'RS vs Bench', 'vs 200MA', 'vs 50MA',
    'Slope 200MA', 'Days >50MA', 'ATR%', 'Max DD 6M', 'Dist 52w Hi',
    'EPS Gr YoY', 'Rev Gr YoY', 'EPS Surprise', 'ROE', 'Gross Margin',
    'Ret 1M', 'Ret 3M', 'Trend']
  const xLabels = ['Contango', 'Debt/EBITDA', 'Vol Contract', 'Vol Exp', 'Vol Trend']

  if (pctLabels.includes(label)) {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }
  if (xLabels.includes(label)) {
    return `${value.toFixed(2)}×`
  }
  return value.toFixed(2)
}

// ── Factor group expandable section ──────────────────────────────────────────

interface FactorSectionProps {
  factor: FactorAlignment
  rawMetrics: Record<string, number | null>
}

const FACTOR_METRIC_GROUPS: Record<string, string[]> = {
  Momentum:       ['Ret 12M', 'Ret 6M (skip)', 'RS vs Bench', 'Dist 52w Hi'],
  Trend:          ['vs 200MA', 'vs 50MA', 'Slope 200MA', 'Days >50MA'],
  Earnings:       ['EPS Gr YoY', 'Rev Gr YoY', 'EPS Surprise'],
  Quality:        ['ROE', 'Gross Margin', 'Debt/EBITDA'],
  Risk:           ['ATR%', 'Max DD 6M', 'Vol Contract'],
  'Term Structure': ['Contango', 'Ret 1M', 'Ret 3M'],
  Volatility:     ['ATR%', 'Vol Exp'],
  Liquidity:      ['Vol Trend'],
}

function FactorSection({ factor, rawMetrics }: FactorSectionProps) {
  const [open, setOpen] = useState(false)
  const metricKeys = FACTOR_METRIC_GROUPS[factor.name] ?? []

  const scoreColor =
    factor.score >= 70 ? 'text-secondary' :
    factor.score >= 50 ? 'text-primary' :
    factor.score >= 35 ? 'text-on-tertiary-fixed-variant' :
    'text-error'

  const scoreBg =
    factor.score >= 70 ? 'bg-secondary' :
    factor.score >= 50 ? 'bg-primary' :
    factor.score >= 35 ? 'bg-tertiary-fixed-dim' :
    'bg-error'

  return (
    <div className="border border-outline-variant/15 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-lowest hover:bg-surface-container/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${directionDot(factor.direction)}`} />
          <span className="text-sm font-bold text-on-surface">{factor.name}</span>
          <span className="text-xs text-on-surface-variant">{(factor.weight * 100).toFixed(0)}% weight</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div className={`${scoreBg} h-full rounded-full`} style={{ width: `${factor.score}%` }} />
          </div>
          <span className={`text-sm font-extrabold w-8 text-right ${scoreColor}`}>
            {Math.round(factor.score)}
          </span>
          <span className={`text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`} style={{ fontSize: 16, fontFamily: 'Material Symbols Outlined' }}>
            expand_more
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 bg-surface-container-low/30">
          {/* Interpretation */}
          <p className="text-xs text-on-surface-variant mt-3 mb-3 leading-relaxed">
            {factor.interpretation}
          </p>

          {/* Raw metrics */}
          {metricKeys.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {metricKeys.map((key) => {
                const val = rawMetrics[key] ?? null
                return (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-[10px] text-on-surface-variant uppercase tracking-wide font-medium">{key}</span>
                    <span className={`text-xs font-bold ${metricColor(key, val)}`}>
                      {formatMetricValue(key, val)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface MetricsDeepDiveProps {
  factorAlignment: FactorAlignment[]
  keyMetrics: Record<string, number | null>
}

export default function MetricsDeepDive({ factorAlignment, keyMetrics }: MetricsDeepDiveProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-extrabold text-on-surface-variant uppercase tracking-widest mb-3">
        Factor Deep Dive
      </h4>
      {factorAlignment.map((f) => (
        <FactorSection key={f.name} factor={f} rawMetrics={keyMetrics} />
      ))}
    </div>
  )
}
