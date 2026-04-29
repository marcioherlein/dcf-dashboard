'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase } from '@/lib/simplifier/scoring'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildBusinessSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCircle from '../QuestionCircle'
import BarChart from '../BarChart'

interface BusinessTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

// ── Phase history: derive which growth phase each year best matched ───────────
// Heuristic: map revenue growth rate to a phase label.
// Phase 1=Early, 2=Growth, 3=Expansion, 4=Mature, 5=Decline (or mapped from data)
const GROWTH_PHASES = [
  { id: 1, label: 'Early',     color: '#0969da', threshold: 0.30 },
  { id: 2, label: 'Growth',    color: '#1f6feb', threshold: 0.15 },
  { id: 3, label: 'Expansion', color: '#9a6700', threshold: 0.05 },
  { id: 4, label: 'Mature',    color: '#6B6A72', threshold: -0.05 },
  { id: 5, label: 'Decline',   color: '#cf222e', threshold: -Infinity },
]

function classifyPhase(yoyGrowth: number | null): typeof GROWTH_PHASES[0] {
  if (yoyGrowth == null) return GROWTH_PHASES[3] // default Mature
  for (const p of GROWTH_PHASES) {
    if (yoyGrowth >= p.threshold) return p
  }
  return GROWTH_PHASES[4]
}

// ── Qualitative slider ────────────────────────────────────────────────────────
// Maps a question answer (yes/partial/no/null) to a 0–2 position on a 3-point scale.
function QualSlider({
  label,
  leftLabel,
  rightLabel,
  position, // 0=weak, 1=moderate, 2=strong
}: {
  label: string
  leftLabel: string
  rightLabel: string
  position: 0 | 1 | 2
}) {
  const colors = ['#cf222e', '#9a6700', '#1f6feb']
  const color = colors[position]
  const labels = [leftLabel, 'Moderate', rightLabel]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#2D2C31]">{label}</p>
        <span className="text-[11px] font-semibold" style={{ color }}>{labels[position]}</span>
      </div>
      {/* Track */}
      <div className="relative h-2 rounded-full bg-[#E8E6E0]">
        {/* Filled portion */}
        <div
          className="absolute left-0 top-0 h-2 rounded-full transition-all"
          style={{ width: `${(position / 2) * 100}%`, background: color }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
          style={{ left: `calc(${(position / 2) * 100}% - 7px)`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-[#6B6A72]">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}

// Map answer to slider position
function answerToPosition(answer: import('@/lib/simplifier/types').Answer | undefined): 0 | 1 | 2 {
  if (answer === 'yes') return 2
  if (answer === 'partial') return 1
  return 0
}

export default function BusinessTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: BusinessTabProps) {
  const phase = PHASES[0]
  const raw   = scorePhase(answers, phase)
  const score = 1 + raw * 4

  const gm   = data.businessProfile?.grossMargin ?? null
  const fcfM = data.businessProfile?.fcfMargin ?? null
  const cagr = data.cagrAnalysis?.historicalCagr3y ?? null
  const beta = data.wacc?.inputs?.beta ?? null

  function pct(v: number | null) { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }

  const metrics = [
    { label: 'Gross Margin', value: pct(gm) },
    { label: 'FCF Margin',   value: pct(fcfM) },
    { label: '3Y Rev CAGR',  value: pct(cagr) },
    { label: 'Beta',         value: beta == null ? '—' : beta.toFixed(2) },
  ]

  // ── Chart data ──────────────────────────────────────────────────────────────
  const isRows = data.financialStatements?.incomeStatement ?? []
  const cfRows = data.financialStatements?.cashFlow ?? []

  const revenueRows = isRows
    .filter(r => r.revenue != null)
    .map(r => ({ year: r.year, value: r.revenue!, isProjected: !!r.isProjected }))

  const opIncomeRows = isRows
    .filter(r => r.operatingIncome != null)
    .map(r => ({ year: r.year, value: r.operatingIncome!, isProjected: !!r.isProjected }))

  const fcfRows = cfRows
    .filter(r => r.freeCashFlow != null)
    .map(r => ({ year: r.year, value: r.freeCashFlow!, isProjected: !!r.isProjected }))

  const gmRows = isRows
    .filter(r => r.revenue != null && r.grossProfit != null && r.revenue! > 0)
    .map(r => ({
      year: r.year,
      value: (r.grossProfit! / r.revenue!) * 100,
      isProjected: !!r.isProjected,
    }))

  // Payouts: dividends paid (positive magnitude)
  const dividendRows = cfRows
    .filter(r => r.dividendsPaid != null)
    .map(r => ({ year: r.year, value: Math.abs(r.dividendsPaid!), isProjected: !!r.isProjected }))

  // Buybacks: repurchase of stock (already stored as positive)
  const buybackRows = (cfRows as any[])
    .filter(r => r.buybacks != null && r.buybacks !== 0)
    .map(r => ({ year: r.year, value: r.buybacks as number, isProjected: !!r.isProjected }))

  // ── Phase history ───────────────────────────────────────────────────────────
  // Build YoY revenue growth rates and map to phase labels
  const historicalOnly = isRows.filter(r => !r.isProjected && r.revenue != null)
  const phaseHistory: { year: string; phase: typeof GROWTH_PHASES[0]; growth: number | null }[] = []
  for (let i = 0; i < historicalOnly.length; i++) {
    const curr = historicalOnly[i]
    const prev = historicalOnly[i - 1]
    const growth = prev?.revenue && prev.revenue > 0 && curr.revenue != null
      ? (curr.revenue - prev.revenue) / prev.revenue
      : null
    phaseHistory.push({ year: curr.year, phase: classifyPhase(growth), growth })
  }
  const maxPhaseBarHeight = 64 // px

  // ── Qualitative sliders ────────────────────────────────────────────────────
  const sliders = [
    {
      label: 'Revenue Predictability',
      leftLabel: 'Unpredictable',
      rightLabel: 'Predictable',
      questionId: 'bq_revenue_predictability',
    },
    {
      label: 'Pricing Power',
      leftLabel: 'None',
      rightLabel: 'Strong',
      questionId: 'bq_pricing_power',
    },
    {
      label: 'Demand Resilience',
      leftLabel: 'Weak',
      rightLabel: 'Strong',
      questionId: 'bq_recession_proof',
    },
    {
      label: 'Competitive Position',
      leftLabel: 'Weak',
      rightLabel: 'Dominant',
      questionId: 'bq_unit_economics',
    },
  ]

  const summary = buildBusinessSummary(companyName, data)

  return (
    <div className="flex flex-col gap-6">

      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 1</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Business Quality</h2>
          <p className="text-sm text-[#6B6A72] mt-0.5">{phase.description}</p>
        </div>
        <div className="hidden sm:grid grid-cols-2 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="text-right">
              <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider">{m.label}</p>
              <p className="text-sm font-semibold font-mono text-[#2D2C31]">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Phase history chart ─────────────────────────────────────────────── */}
      {phaseHistory.length > 1 && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-1">Growth Cycle History</p>
          <p className="text-[10px] text-[#6B6A72] mb-4">Based on year-over-year revenue growth rate</p>
          <div className="flex items-end gap-2">
            {phaseHistory.map(h => (
              <div key={h.year} className="flex flex-col items-center gap-1 flex-1">
                {/* Bar */}
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${maxPhaseBarHeight}px`,
                    background: h.phase.color,
                    opacity: h.phase.id >= 4 ? 0.6 : 1,
                  }}
                />
                {/* Phase label */}
                <p className="text-[9px] font-semibold" style={{ color: h.phase.color }}>{h.phase.label}</p>
                {/* Year */}
                <p className="text-[9px] text-[#6B6A72]">{h.year}</p>
                {/* YoY % */}
                {h.growth != null && (
                  <p className="text-[9px] font-mono" style={{ color: h.phase.color }}>
                    {h.growth >= 0 ? '+' : ''}{(h.growth * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-[#F0EEE8]">
            {GROWTH_PHASES.map(p => (
              <div key={p.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
                <span className="text-[10px] text-[#6B6A72]">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Revenue + Operating Profit charts ──────────────────────────────── */}
      {(revenueRows.length > 0 || opIncomeRows.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {revenueRows.length > 0 && (
            <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
              <BarChart rows={revenueRows} label="Revenue" color="#1f6feb" unit="$B" showGrowth height={160} />
            </div>
          )}
          {opIncomeRows.length > 0 && (
            <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
              <BarChart rows={opIncomeRows} label="Operating Profit" color="#0969da" unit="$B" showGrowth height={160} />
            </div>
          )}
        </div>
      )}

      {/* ── FCF + Gross Margin charts ───────────────────────────────────────── */}
      {(fcfRows.length > 0 || gmRows.length > 1) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fcfRows.length > 0 && (
            <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
              <BarChart rows={fcfRows} label="Free Cash Flow" color="#1f6feb" unit="$B" showGrowth height={140} />
            </div>
          )}
          {gmRows.length > 1 && (
            <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
              <BarChart rows={gmRows} label="Gross Margin %" color="#0969da" unit="%" showGrowth={false} height={140} />
            </div>
          )}
        </div>
      )}

      {/* ── Payouts: Dividends + Buybacks ─────────────────────────────────── */}
      {(dividendRows.length > 0 || buybackRows.length > 0) && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">Capital Returns to Shareholders</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dividendRows.length > 0 && (
              <BarChart rows={dividendRows} label="Dividends Paid" color="#9a6700" unit="$M" showGrowth={false} height={130} />
            )}
            {buybackRows.length > 0 && (
              <BarChart rows={buybackRows} label="Share Buybacks" color="#1f6feb" unit="$M" showGrowth={false} height={130} />
            )}
          </div>
          {dividendRows.length === 0 && buybackRows.length === 0 && (
            <p className="text-sm text-[#6B6A72]">No dividend or buyback data available.</p>
          )}
        </div>
      )}

      {/* ── Qualitative sliders ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-4">Business Quality Assessment</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {sliders.map(s => (
            <QualSlider
              key={s.questionId}
              label={s.label}
              leftLabel={s.leftLabel}
              rightLabel={s.rightLabel}
              position={answerToPosition(answers[s.questionId])}
            />
          ))}
        </div>
        <p className="text-[10px] text-[#6B6A72] mt-4 border-t border-[#F0EEE8] pt-3">
          Sliders reflect your answers to the questions below. Answer to update.
        </p>
      </div>

      <SectionSummary text={summary} label="Business Quality Analysis" />

      <div className="flex flex-col gap-3">
        {phase.questions.map(q => (
          <QuestionCircle
            key={q.id}
            questionId={q.id}
            text={q.text}
            answer={answers[q.id] ?? null}
            hint={autoMap[q.id] ?? null}
            note={notes[q.id] ?? ''}
            onChange={onChange}
            onNoteChange={onNoteChange}
          />
        ))}
      </div>
    </div>
  )
}
