'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase } from '@/lib/simplifier/scoring'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildGrowthSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCircle from '../QuestionCircle'
import BarChart from '../BarChart'

interface GrowthTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

export default function GrowthTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: GrowthTabProps) {
  const phase = PHASES[2]
  const raw   = scorePhase(answers, phase)
  const score = 1 + raw * 4

  const cagr3y  = data.cagrAnalysis?.historicalCagr3y ?? null
  const analyst = data.cagrAnalysis?.analystEstimate1y ?? null
  const blended = data.cagrAnalysis?.blended ?? null
  const spread  = data.scores?.roic?.spread ?? null

  function pct(v: number | null) { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }

  const isRows = data.financialStatements?.incomeStatement ?? []
  const cfRows = data.financialStatements?.cashFlow ?? []

  // Revenue rows
  const revenueRows = isRows
    .filter(r => r.revenue != null)
    .map(r => ({ year: r.year, value: r.revenue!, isProjected: !!r.isProjected }))

  // EPS rows — store as plain numbers (dollars per share)
  const epsRows = isRows
    .filter(r => r.eps != null)
    .map(r => ({ year: r.year, value: r.eps!, isProjected: !!r.isProjected }))

  // FCF rows
  const fcfRows = cfRows
    .filter(r => r.freeCashFlow != null)
    .map(r => ({ year: r.year, value: r.freeCashFlow!, isProjected: !!r.isProjected }))

  // Operating margin trend
  const opMarginRows = isRows
    .filter(r => r.revenue != null && r.operatingIncome != null && r.revenue! > 0)
    .map(r => ({
      year: r.year,
      value: (r.operatingIncome! / r.revenue!) * 100,
      isProjected: !!r.isProjected,
    }))

  const metrics = [
    { label: '3Y Rev CAGR',  value: pct(cagr3y) },
    { label: 'Analyst Est.', value: pct(analyst) },
    { label: 'Blended CAGR', value: pct(blended) },
    { label: 'ROIC Spread',  value: pct(spread) },
  ]

  const summary = buildGrowthSummary(companyName, data, answers)

  return (
    <div className="flex flex-col gap-6">
      {/* Section header */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 3</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Growth</h2>
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

      {/* Revenue + EPS charts */}
      {(revenueRows.length > 0 || epsRows.length > 0) && (
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
          {epsRows.length > 0 && (
            <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
              <BarChart
                rows={epsRows}
                label="Earnings Per Share ($)"
                color="#0969da"
                unit="$"
                showGrowth
                height={160}
              />
            </div>
          )}
        </div>
      )}

      {/* FCF + Operating Margin charts */}
      {(fcfRows.length > 0 || opMarginRows.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fcfRows.length > 0 && (
            <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
              <BarChart
                rows={fcfRows}
                label="Free Cash Flow ($M)"
                color="#1f6feb"
                unit="B"
                showGrowth
                height={140}
              />
            </div>
          )}
          {opMarginRows.length > 0 && (
            <div className="rounded-xl border border-[#E8E6E0] bg-white p-4">
              <BarChart
                rows={opMarginRows}
                label="Operating Margin %"
                color="#0969da"
                unit="%"
                showGrowth={false}
                height={140}
              />
            </div>
          )}
        </div>
      )}

      <SectionSummary text={summary} label="Growth Analysis" />

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
