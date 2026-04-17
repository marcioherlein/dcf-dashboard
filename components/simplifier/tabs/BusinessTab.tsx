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

  // Revenue chart rows (actuals + projected)
  const isRows = data.financialStatements?.incomeStatement ?? []
  const revenueRows = isRows
    .filter(r => r.revenue != null)
    .map(r => ({ year: r.year, value: r.revenue!, isProjected: !!r.isProjected }))

  // FCF chart rows
  const cfRows = data.financialStatements?.cashFlow ?? []
  const fcfRows = cfRows
    .filter(r => r.freeCashFlow != null)
    .map(r => ({ year: r.year, value: r.freeCashFlow!, isProjected: !!r.isProjected }))

  // Gross margin trend
  const gmRows = isRows
    .filter(r => r.revenue != null && r.grossProfit != null)
    .map(r => ({
      year: r.year,
      value: r.revenue! > 0 ? (r.grossProfit! / r.revenue!) * 100 : null,
      isProjected: !!r.isProjected,
    }))
    .filter(r => r.value != null) as { year: string; value: number; isProjected: boolean }[]

  const summary = buildBusinessSummary(companyName, data, answers)

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
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

      {/* Revenue + FCF charts side by side */}
      {(revenueRows.length > 0 || fcfRows.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {revenueRows.length > 0 && (
            <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
              <BarChart
                rows={revenueRows}
                label="Revenue ($M)"
                color="#1f6feb"
                unit="B"
                showGrowth
                height={160}
              />
            </div>
          )}
          {fcfRows.length > 0 && (
            <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
              <BarChart
                rows={fcfRows}
                label="Free Cash Flow ($M)"
                color="#0969da"
                unit="B"
                showGrowth
                height={160}
              />
            </div>
          )}
        </div>
      )}

      {/* Gross margin trend */}
      {gmRows.length > 1 && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
          <BarChart
            rows={gmRows}
            label="Gross Margin %"
            color="#1f6feb"
            unit="%"
            showGrowth={false}
            height={130}
          />
        </div>
      )}

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
