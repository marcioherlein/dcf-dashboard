'use client'
import { useMemo } from 'react'
import { computeVerdict, type VerdictInputs, type VerdictSignal, type VerdictDimension } from '@/lib/verdict/computeVerdict'
import type { PiotroskiResult, AltmanResult, BeneishResult, ROICResult } from '@/lib/dcf/calculateScores'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  upsidePct: number | null | undefined
  scores: {
    piotroski: PiotroskiResult
    altman: AltmanResult | null
    beneish: BeneishResult | null
    roic: ROICResult
  } | null | undefined
  analystRecommendation: string | null | undefined
  fcfMargin: number | null | undefined
  grossMargin: number | null | undefined
  netMargin: number | null | undefined
  revenueCAGR: number | null | undefined
}

// ─── Signal row ───────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: VerdictSignal }) {
  const { status, label, value, detail } = signal

  const icon =
    status === 'pass' ? (
      <span className="text-[11px] font-bold text-emerald-600">✓</span>
    ) : status === 'fail' ? (
      <span className="text-[11px] font-bold text-red-500">✗</span>
    ) : (
      <span className="text-[11px] text-slate-300">–</span>
    )

  const valueCls =
    status === 'pass'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
      : status === 'fail'
      ? 'text-red-700 bg-red-50 border-red-100'
      : 'text-slate-400 bg-slate-50 border-slate-100'

  return (
    <div
      className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 last:border-0"
      title={detail}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-4 flex justify-center shrink-0">{icon}</span>
        <span className="text-[12px] text-slate-600 truncate">{label}</span>
      </div>
      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${valueCls}`}>
        {value}
      </span>
    </div>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

const DIMENSION_ICONS: Record<string, string> = {
  valuation:  '💰',
  quality:    '⚙️',
  health:     '🏥',
  integrity:  '🔍',
}

function DimensionCard({ dim }: { dim: VerdictDimension }) {
  const total = dim.signals.filter(s => s.status !== 'na').length
  const passing = dim.passingCount

  const barCls =
    passing === total ? 'bg-emerald-500'
    : passing >= Math.ceil(total / 2) ? 'bg-amber-400'
    : 'bg-red-400'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{DIMENSION_ICONS[dim.id] ?? '•'}</span>
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{dim.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-700">{passing}/{total}</span>
          <div className="flex gap-0.5">
            {dim.signals.map((s, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  s.status === 'pass' ? 'bg-emerald-500'
                  : s.status === 'fail' ? 'bg-red-400'
                  : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 rounded-full bg-slate-100 mb-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barCls}`}
          style={{ width: total > 0 ? `${(passing / total) * 100}%` : '0%' }}
        />
      </div>

      {/* Signals */}
      {dim.signals.map((s, i) => (
        <SignalRow key={i} signal={s} />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InvestmentVerdict({
  upsidePct, scores, analystRecommendation,
  fcfMargin, grossMargin, netMargin, revenueCAGR,
}: Props) {
  const inputs: VerdictInputs = {
    upsidePct,
    roic: scores?.roic,
    analystRecommendation,
    piotroski: scores?.piotroski,
    altman: scores?.altman,
    beneish: scores?.beneish,
    fcfMargin,
    grossMargin,
    netMargin,
    revenueCAGR,
  }

  const verdict = useMemo(() => computeVerdict(inputs), [
    upsidePct, scores, analystRecommendation, fcfMargin, grossMargin, netMargin, revenueCAGR,
  ])

  const headerBg =
    verdict.color === 'green' ? 'bg-emerald-50 border-emerald-200'
    : verdict.color === 'amber' ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200'

  const labelCls =
    verdict.color === 'green' ? 'text-emerald-700'
    : verdict.color === 'amber' ? 'text-amber-700'
    : 'text-red-700'

  const dotCls = (i: number) =>
    i < verdict.totalPassing
      ? verdict.color === 'green' ? 'bg-emerald-500'
        : verdict.color === 'amber' ? 'bg-amber-400'
        : 'bg-red-400'
      : 'bg-slate-200'

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 ${headerBg}`}>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Investment Checklist</span>
          <span className={`text-sm font-semibold ${labelCls}`}>{verdict.label}</span>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`text-xl font-bold tabular-nums ${labelCls}`}>
            {verdict.totalPassing}
            <span className="text-sm font-normal text-slate-400"> / {verdict.totalSignals}</span>
          </span>
          {/* Dot progress */}
          <div className="flex gap-1">
            {Array.from({ length: verdict.totalSignals }).map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${dotCls(i)}`} />
            ))}
          </div>
        </div>
      </div>

      {/* 2×2 dimension grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {verdict.dimensions.map(dim => (
          <DimensionCard key={dim.id} dim={dim} />
        ))}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-slate-400 text-center leading-relaxed">
        Deterministic signals based on Piotroski F-score, Altman Z-score, Beneish M-score, ROIC, and DCF upside.
        N/A signals are excluded from totals.
      </p>
    </div>
  )
}
