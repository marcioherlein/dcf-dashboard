'use client'
import { useMemo } from 'react'
import { computeVerdict, type VerdictInputs, type VerdictSignal, type VerdictDimension } from '@/lib/verdict/computeVerdict'
import type { PiotroskiResult, AltmanResult, BeneishResult, ROICResult } from '@/lib/dcf/calculateScores'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  ticker: string
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

// ─── Design tokens (DESIGN.md) ────────────────────────────────────────────────
// Financial semantics: positive=#11875D soft=#E8F7EF border=#A3D9BE
//                      negative=#D83B3B soft=#FCEAEA border=#F0B8B8
//                      warn=#B56A00 soft=#FFF4DA border=#F3D391
//                      neutral bg=#F5F5F5 text=#6B6B6B border=#E5E5E5

const TOKEN = {
  pass:       { text: '#11875D', bg: '#E8F7EF', border: '#A3D9BE' },
  fail:       { text: '#D83B3B', bg: '#FCEAEA', border: '#F0B8B8' },
  warn:       { text: '#B56A00', bg: '#FFF4DA', border: '#F3D391' },
  neutral:    { text: '#6B6B6B', bg: '#F5F5F5', border: '#E5E5E5' },
  brand:      { text: '#5F790B', bg: '#F6FAEA', border: '#d4e2a1' },
}

// ─── Signal row ───────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: VerdictSignal }) {
  const { status, label, value, detail } = signal

  const tok = status === 'pass' ? TOKEN.pass : status === 'fail' ? TOKEN.fail : TOKEN.neutral

  return (
    <div
      className="flex items-center justify-between gap-2 py-[7px] border-b last:border-0"
      style={{ borderColor: '#F5F5F5' }}
      title={detail}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-[14px] text-center text-[10px] font-bold shrink-0 leading-none"
          style={{ color: status === 'na' ? TOKEN.neutral.text : tok.text }}
          aria-hidden="true"
        >
          {status === 'pass' ? '✓' : status === 'fail' ? '✗' : '–'}
        </span>
        <span className="text-[12px] truncate" style={{ color: '#111111' }}>{label}</span>
      </div>
      <span
        className="text-[11px] font-medium px-[6px] py-[2px] rounded border shrink-0"
        style={{ color: tok.text, background: tok.bg, borderColor: tok.border }}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

const DIMENSION_LABELS: Record<string, string> = {
  valuation:  'Valuation',
  quality:    'Business Quality',
  health:     'Financial Health',
  integrity:  'Earnings Integrity',
}

function DimensionCard({ dim }: { dim: VerdictDimension }) {
  const total = dim.signals.filter(s => s.status !== 'na').length
  const passing = dim.passingCount
  const ratio = total > 0 ? passing / total : 0

  const barColor = ratio === 1 ? TOKEN.pass.text : ratio >= 0.5 ? TOKEN.warn.text : TOKEN.fail.text
  const dotColor = (s: VerdictSignal) =>
    s.status === 'pass' ? TOKEN.pass.text : s.status === 'fail' ? TOKEN.fail.text : TOKEN.neutral.border

  return (
    <div
      className="rounded-xl p-[14px] flex flex-col gap-0"
      style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.06em]"
          style={{ color: '#6B6B6B' }}
        >
          {DIMENSION_LABELS[dim.id] ?? dim.label}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#111111' }}>
            {passing}/{total}
          </span>
          <div className="flex gap-[3px]">
            {dim.signals.map((s, i) => (
              <span
                key={i}
                className="w-[6px] h-[6px] rounded-full"
                style={{ background: dotColor(s) }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] rounded-full mb-[10px] overflow-hidden" style={{ background: '#F5F5F5' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: total > 0 ? `${ratio * 100}%` : '0%', background: barColor }}
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
  ticker, upsidePct, scores, analystRecommendation,
  fcfMargin, grossMargin, netMargin, revenueCAGR,
}: Props) {
  const inputs: VerdictInputs = {
    ticker,
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
    ticker, upsidePct, scores, analystRecommendation, fcfMargin, grossMargin, netMargin, revenueCAGR,
  ])

  // Header palette from DESIGN.md chips
  const headerTok =
    verdict.color === 'green' ? TOKEN.pass
    : verdict.color === 'amber' ? TOKEN.warn
    : TOKEN.fail

  const labelChipStyle = {
    color: headerTok.text,
    background: headerTok.bg,
    border: `1px solid ${headerTok.border}`,
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: '#FAFAFA', border: '1px solid #E5E5E5' }}
    >
      {/* ── Verdict headline ─────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-4 py-3 flex items-start justify-between gap-3"
        style={{ background: headerTok.bg, border: `1px solid ${headerTok.border}` }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          {/* Label eyebrow */}
          <span
            className="text-[10px] font-bold uppercase tracking-[0.06em]"
            style={{ color: TOKEN.neutral.text }}
          >
            Investment Checklist
          </span>
          {/* The headline sentence — "MSFT passes 9 of 11 checks — strong fundamentals." */}
          <p
            className="text-[13px] font-semibold leading-snug"
            style={{ color: '#111111' }}
          >
            {verdict.headline}
          </p>
        </div>

        {/* Score chip + dot bar */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="text-[11px] font-bold px-[8px] py-[3px] rounded-full"
            style={labelChipStyle}
          >
            {verdict.label}
          </span>
          <div className="flex gap-[3px]">
            {Array.from({ length: verdict.totalSignals }).map((_, i) => (
              <span
                key={i}
                className="w-[5px] h-[5px] rounded-full"
                style={{
                  background: i < verdict.totalPassing ? headerTok.text : TOKEN.neutral.border,
                }}
              />
            ))}
          </div>
          <span className="text-[11px] tabular-nums" style={{ color: TOKEN.neutral.text }}>
            {verdict.totalPassing} / {verdict.totalSignals} checks
          </span>
        </div>
      </div>

      {/* ── 2×2 dimension grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {verdict.dimensions.map(dim => (
          <DimensionCard key={dim.id} dim={dim} />
        ))}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <p className="text-[10px] text-center leading-relaxed" style={{ color: '#9B9B9B' }}>
        Piotroski F-score · Altman Z-score · Beneish M-score · ROIC spread · DCF upside.
        N/A signals excluded from totals.
      </p>
    </div>
  )
}
