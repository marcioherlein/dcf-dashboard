'use client'
import { fmtPct } from '@/lib/utils'

interface CAGRAnalysis {
  historicalCagr3y: number
  analystEstimate1y: number
  analystEstimate2y: number
  fundamentalGrowth: number | null
  blended: number
  rawBlended: number
  cagrCap: number
  weights: { historical: number; analyst: number; fundamental: number }
  confidence: number
  confidenceLabel: 'High' | 'Medium' | 'Low'
  numAnalysts: number
  drivers: string[]
}

interface Props {
  cagrAnalysis: CAGRAnalysis
  isNegativeFCF: boolean
  growthModel?: 'two-stage' | 'three-stage'
  terminalG?: number
}

const confColor: Record<string, string> = {
  High:   'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  Low:    'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
}

function WeightBar({ label, weight, color }: { label: string; weight: number; color: string }) {
  const pct = Math.round(weight * 100)
  if (pct === 0) return null
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[10px] text-gray-400 dark:text-white/30">{label}</span>
      <div className="flex-1 rounded-full bg-gray-100 dark:bg-white/8 h-1.5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-[10px] font-semibold text-gray-500 dark:text-white/40">{pct}%</span>
    </div>
  )
}

export default function CAGRAnalysis({ cagrAnalysis: ca, isNegativeFCF, growthModel = 'two-stage', terminalG }: Props) {
  const convergenceApplied = ca.rawBlended > 0.20 && Math.abs(ca.rawBlended - ca.blended) > 0.001
  const capApplied = ca.rawBlended > ca.cagrCap + 0.001 || ca.blended >= ca.cagrCap - 0.001

  const rows = [
    {
      label: 'Historical 3Y CAGR',
      value: ca.historicalCagr3y,
      note: ca.weights.historical > 0
        ? `${Math.round(ca.weights.historical * 100)}% weight`
        : 'excluded (currency/inflation)',
      muted: ca.weights.historical === 0,
    },
    {
      label: ca.numAnalysts > 0 ? `Analyst Consensus +1Y (${ca.numAnalysts})` : 'Analyst +1Y',
      value: ca.analystEstimate1y,
      note: ca.weights.analyst > 0
        ? `${Math.round(ca.weights.analyst * 100)}% weight`
        : 'no coverage',
      muted: ca.weights.analyst === 0,
    },
    {
      label: 'Analyst +2Y (est.)',
      value: ca.analystEstimate2y,
      note: 'fade estimate',
      muted: true,
    },
    ...(ca.fundamentalGrowth != null ? [{
      label: 'Fundamental (ROE × Retention)',
      value: ca.fundamentalGrowth,
      note: `${Math.round(ca.weights.fundamental * 100)}% weight · Damodaran`,
      muted: false,
    }] : []),
    ...(convergenceApplied ? [{
      label: 'After Convergence Discount',
      value: ca.rawBlended,
      note: `→ ${fmtPct(ca.blended)} (25% haircut on excess >20%)`,
      muted: true,
    }] : []),
    {
      label: 'Blended CAGR — DCF Input',
      value: ca.blended,
      note: capApplied ? `capped at ${fmtPct(ca.cagrCap)}` : 'final',
      bold: true,
    },
  ]

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70">CAGR Analysis</h2>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${confColor[ca.confidenceLabel]}`}>
          {ca.confidenceLabel} confidence · {Math.round(ca.confidence * 100)}%
        </span>
      </div>

      {isNegativeFCF && (() => {
        const ocfProxy = ca.drivers.some((d) => d.toLowerCase().includes('capex'))
        return (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
            {ocfProxy ? (
              <><span className="font-semibold">ℹ FCF negative (growth investments).</span>{' '}Operating cash flow is positive — FCF suppressed by CapEx. OCF × 0.6 used as distributable proxy.</>
            ) : (
              <><span className="font-semibold">⚠ Negative operating cash flow.</span>{' '}Pre-profitability stage — FCF seeded from revenue base (2% margin).</>
            )}
          </div>
        )
      })()}

      {/* Sources table */}
      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/8">
              <th className="pb-2 text-left text-xs font-medium text-gray-400 dark:text-white/25">Source</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-400 dark:text-white/25">Rate</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-400 dark:text-white/25">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={`border-b border-gray-50 dark:border-white/5 ${
                  (row as { bold?: boolean }).bold ? 'bg-gray-50 dark:bg-white/5' : ''
                }`}
              >
                <td className={`py-2 ${
                  (row as { bold?: boolean }).bold
                    ? 'font-semibold text-gray-800 dark:text-white'
                    : (row as { muted?: boolean }).muted
                      ? 'text-gray-400 dark:text-white/25'
                      : 'text-gray-600 dark:text-white/50'
                }`}>
                  {row.label}
                </td>
                <td className={`py-2 text-right tabular-nums ${
                  (row as { bold?: boolean }).bold
                    ? 'font-bold text-gray-900 dark:text-white'
                    : (row as { muted?: boolean }).muted
                      ? 'text-gray-400 dark:text-white/25'
                      : 'text-gray-700 dark:text-white/60'
                }`}>
                  {fmtPct(row.value)}
                </td>
                <td className="py-2 text-right text-xs text-gray-400 dark:text-white/25">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Blending weights visual */}
      {(ca.weights.historical > 0 || ca.weights.analyst > 0 || ca.weights.fundamental > 0) && (
        <div className="mb-4 rounded-xl border border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/5 px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-white/25">Blending Weights</p>
          <div className="space-y-1.5">
            <WeightBar label="Analyst"     weight={ca.weights.analyst}     color="#6366f1" />
            <WeightBar label="Fundamental" weight={ca.weights.fundamental} color="#10b981" />
            <WeightBar label="Historical"  weight={ca.weights.historical}  color="#f59e0b" />
          </div>
        </div>
      )}

      {/* DCF Growth Model */}
      <div className="mb-4 rounded-xl border border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-white/50">DCF Growth Model</p>
          {growthModel === 'three-stage' ? (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">Three-Stage (Damodaran)</span>
          ) : (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/40">Two-Stage (Standard)</span>
          )}
        </div>
        {growthModel === 'three-stage' ? (
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/25 leading-relaxed">
            <span className="text-gray-600 dark:text-white/50">Years 1–5</span> at {fmtPct(ca.blended)}.{' '}
            <span className="text-violet-500 dark:text-violet-400">Years 6–10</span> fade linearly to terminal
            {terminalG != null ? ` ${fmtPct(terminalG)}` : ''}.
            Three-stage applied because CAGR exceeds 15% — prevents growth-cliff artifact.
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/25 leading-relaxed">
            Constant {fmtPct(ca.blended)} for 10 years, then terminal value.
            Growth is near sustainable levels — no deceleration phase needed.
          </p>
        )}
      </div>

      {/* Growth drivers */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/25">Assumptions &amp; Adjustments</p>
      <ul className="space-y-1.5">
        {ca.drivers.map((driver, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-white/40">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-white/25" />
            {driver}
          </li>
        ))}
      </ul>
    </div>
  )
}
