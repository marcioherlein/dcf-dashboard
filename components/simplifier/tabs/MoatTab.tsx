'use client'

import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase } from '@/lib/simplifier/scoring'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildMoatSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCircle from '../QuestionCircle'

interface MoatTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

// ── Moat Size: derived from moatScore + ROIC spread ──────────────────────────
type MoatSize = 'Wide' | 'Narrow' | 'None'

function deriveMoatSize(moatScore: number | null, spread: number | null): MoatSize {
  // Primary signal: moat rating
  if (moatScore != null) {
    if (moatScore >= 4.0) return 'Wide'
    if (moatScore >= 2.5) return 'Narrow'
    return 'None'
  }
  // Fallback: ROIC spread
  if (spread != null) {
    if (spread >= 0.08) return 'Wide'
    if (spread >= 0.02) return 'Narrow'
    return 'None'
  }
  return 'Narrow' // insufficient data — default neutral
}

const MOAT_SIZE_STYLES: Record<MoatSize, { bg: string; text: string; border: string; desc: string }> = {
  Wide:   { bg: 'bg-[#EEF4FF]', text: 'text-[#1f6feb]', border: 'border-[#DCE6F5]', desc: 'Durable, multi-decade competitive barriers' },
  Narrow: { bg: 'bg-[#FEF9C3]', text: 'text-[#9a6700]', border: 'border-[#FDE68A]', desc: 'Some advantage but faces competitive pressure' },
  None:   { bg: 'bg-[#FEE2E2]', text: 'text-[#cf222e]', border: 'border-[#FECACA]', desc: 'No measurable structural advantage' },
}

// ── Moat Direction: derived from ROIC spread magnitude + answers ─────────────
type MoatDirection = 'Improving' | 'Stable' | 'Deteriorating'

function deriveMoatDirection(
  spread: number | null,
  answers: AllAnswers,
): MoatDirection {
  // Use spread as the primary quantitative signal
  // A strong positive spread + positive qualitative signals → Improving
  // Near-zero spread → Stable
  // Negative spread → Deteriorating
  const positiveAnswers = ['moat_switching_costs', 'moat_network_effects', 'moat_intangibles', 'moat_cost_advantage', 'moat_efficient_scale']
    .filter(id => answers[id] === 'yes').length
  const negativeAnswers = ['moat_switching_costs', 'moat_network_effects', 'moat_intangibles', 'moat_cost_advantage', 'moat_efficient_scale']
    .filter(id => answers[id] === 'no').length

  if (spread != null) {
    if (spread >= 0.08 && positiveAnswers >= 3) return 'Improving'
    if (spread >= 0.03 && negativeAnswers <= 2) return 'Stable'
    if (spread < 0) return 'Deteriorating'
    if (spread < 0.03 && negativeAnswers >= 3) return 'Deteriorating'
    return 'Stable'
  }
  // No spread data — rely purely on answers
  if (positiveAnswers >= 4) return 'Improving'
  if (negativeAnswers >= 4) return 'Deteriorating'
  return 'Stable'
}

const DIRECTION_STYLES: Record<MoatDirection, { icon: string; color: string; bg: string; border: string }> = {
  Improving:    { icon: '↑', color: 'text-[#1f6feb]', bg: 'bg-[#EEF4FF]', border: 'border-[#DCE6F5]' },
  Stable:       { icon: '→', color: 'text-[#9a6700]', bg: 'bg-[#FEF9C3]', border: 'border-[#FDE68A]' },
  Deteriorating:{ icon: '↓', color: 'text-[#cf222e]', bg: 'bg-[#FEE2E2]', border: 'border-[#FECACA]' },
}

// ── Moat Sources ──────────────────────────────────────────────────────────────
const MOAT_SOURCES = [
  {
    id: 'moat_switching_costs',
    label: 'Switching Costs',
    icon: '🔗',
    description: 'Customers locked in via contracts, data, or integrations',
    counterFactor: 'If product is easily replaceable',
  },
  {
    id: 'moat_network_effects',
    label: 'Network Effects',
    icon: '🕸',
    description: 'Value increases as more users join the platform',
    counterFactor: 'If the network is thin or multi-homing is easy',
  },
  {
    id: 'moat_intangibles',
    label: 'Intangible Assets',
    icon: '💡',
    description: 'Patents, brand equity, or regulatory licenses',
    counterFactor: 'If patents expire or brand loyalty is weak',
  },
  {
    id: 'moat_cost_advantage',
    label: 'Cost Advantage',
    icon: '⚡',
    description: 'Structural cost leadership vs. competitors (ROIC spread)',
    counterFactor: 'If cost advantage is from scale only (replicable)',
  },
  {
    id: 'moat_efficient_scale',
    label: 'Efficient Scale',
    icon: '⚖️',
    description: 'Niche large enough to be profitable, small enough to deter entry',
    counterFactor: 'If market grows and attracts new entrants',
  },
]

export default function MoatTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: MoatTabProps) {
  const phase = PHASES[1]
  const raw   = scorePhase(answers, phase)
  const score = 1 + raw * 4

  const roic      = data.scores?.roic?.roic ?? null
  const spread    = data.scores?.roic?.spread ?? null
  const moatScore = data.ratings?.moat?.score ?? null

  const moatSize      = deriveMoatSize(moatScore, spread)
  const moatDirection = deriveMoatDirection(spread, answers)
  const sizeStyle     = MOAT_SIZE_STYLES[moatSize]
  const dirStyle      = DIRECTION_STYLES[moatDirection]

  function pct(v: number | null) { return v == null ? '—' : `${(v * 100).toFixed(1)}%` }
  function num(v: number | null, d = 1) { return v == null ? '—' : v.toFixed(d) }

  const metrics = [
    { label: 'ROIC',        value: pct(roic) },
    { label: 'ROIC Spread', value: pct(spread) },
    { label: 'Moat Rating', value: moatScore != null ? `${num(moatScore)}/5` : '—' },
  ]

  const summary = buildMoatSummary(companyName, data, answers)

  return (
    <div className="flex flex-col gap-6">

      {/* ── Section header ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 2</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Competitive Moat</h2>
          <p className="text-sm text-[#6B6A72] mt-0.5">{phase.description}</p>
        </div>
        <div className="hidden sm:grid grid-cols-3 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="text-right">
              <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider">{m.label}</p>
              <p className="text-sm font-semibold font-mono text-[#2D2C31]">{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Moat Size + Direction ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Moat Size */}
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">Moat Size</p>
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-2xl font-bold px-4 py-1.5 rounded-lg border ${sizeStyle.bg} ${sizeStyle.text} ${sizeStyle.border}`}>
              {moatSize}
            </span>
          </div>
          <p className="text-xs text-[#6B6A72] leading-relaxed">{sizeStyle.desc}</p>
          {/* Three-bucket track */}
          <div className="flex gap-1 mt-3">
            {(['None', 'Narrow', 'Wide'] as MoatSize[]).map(s => (
              <div
                key={s}
                className="flex-1 h-1.5 rounded-full transition-all"
                style={{
                  background: s === moatSize
                    ? (s === 'Wide' ? '#1f6feb' : s === 'Narrow' ? '#9a6700' : '#cf222e')
                    : '#E8E6E0',
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-[#6B6A72]">None</span>
            <span className="text-[9px] text-[#6B6A72]">Narrow</span>
            <span className="text-[9px] text-[#6B6A72]">Wide</span>
          </div>
        </div>

        {/* Moat Direction */}
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">Moat Trend</p>
          <div className="flex items-center gap-3 mb-3">
            <span
              className={`text-2xl font-bold px-4 py-1.5 rounded-lg border flex items-center gap-2 ${dirStyle.bg} ${dirStyle.color} ${dirStyle.border}`}
            >
              <span className="text-xl">{dirStyle.icon}</span>
              <span>{moatDirection}</span>
            </span>
          </div>
          <p className="text-xs text-[#6B6A72] leading-relaxed">
            {moatDirection === 'Improving'
              ? 'Competitive barriers appear to be strengthening over time.'
              : moatDirection === 'Deteriorating'
              ? 'Competitive advantage shows signs of erosion.'
              : 'Moat appears broadly stable with no clear trend.'}
          </p>
          <p className="text-[10px] text-[#6B6A72] mt-3 border-t border-[#F0EEE8] pt-2">
            Derived from ROIC spread and qualitative answers below.
          </p>
        </div>
      </div>

      {/* ── ROIC vs WACC visual ─────────────────────────────────────────────── */}
      {roic != null && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">ROIC vs Cost of Capital</p>
          <div className="flex items-end gap-4">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-16 rounded-t-md"
                style={{
                  height: `${Math.max(8, Math.min(100, (roic * 100) * 2))}px`,
                  background: (spread ?? 0) >= 0 ? '#1f6feb' : '#cf222e',
                }}
              />
              <p className="text-[11px] font-mono text-[#2D2C31]">{pct(roic)}</p>
              <p className="text-[10px] text-[#6B6A72]">ROIC</p>
            </div>
            {spread != null && (
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-16 rounded-t-md bg-[#DCE6F5]"
                  style={{ height: `${Math.max(8, Math.min(100, ((roic - spread) * 100) * 2))}px` }}
                />
                <p className="text-[11px] font-mono text-[#2D2C31]">{pct(roic - spread)}</p>
                <p className="text-[10px] text-[#6B6A72]">WACC</p>
              </div>
            )}
            {spread != null && (
              <div className="ml-4">
                <p className="text-[11px] text-[#6B6A72] uppercase tracking-wider mb-1">Spread</p>
                <p className={`text-xl font-bold font-mono ${spread >= 0 ? 'text-[#1f6feb]' : 'text-[#cf222e]'}`}>
                  {spread >= 0 ? '+' : ''}{pct(spread)}
                </p>
                <p className="text-[11px] text-[#6B6A72]">{spread >= 0.05 ? 'Durable advantage' : spread >= 0 ? 'Modest advantage' : 'Below cost of capital'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Moat Sources grid ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-4">Moat Sources</p>
        <div className="flex flex-col gap-3">
          {MOAT_SOURCES.map(source => {
            const ans = answers[source.id]
            const isYes     = ans === 'yes'
            const isPartial = ans === 'partial'
            const isNo      = ans === 'no'
            const unanswered = ans == null

            const statusColor = isYes ? '#1f6feb' : isPartial ? '#9a6700' : isNo ? '#cf222e' : '#C5C3BD'
            const statusIcon  = isYes ? '✓' : isPartial ? '◑' : isNo ? '✗' : '○'
            const statusLabel = isYes ? 'Present' : isPartial ? 'Partial' : isNo ? 'Absent' : 'Unassessed'
            const rowBg = isYes ? 'bg-[#F0F7FF]' : isPartial ? 'bg-[#FFFBEB]' : isNo ? 'bg-[#FFF5F5]' : 'bg-[#F7F6F1]'
            const rowBorder = isYes ? 'border-[#DCE6F5]' : isPartial ? 'border-[#FDE68A]' : isNo ? 'border-[#FECACA]' : 'border-[#E8E6E0]'

            return (
              <div
                key={source.id}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${rowBg} ${rowBorder}`}
              >
                {/* Status circle */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border-2 border-white"
                  style={{ background: statusColor, color: '#fff', boxShadow: `0 0 0 1px ${statusColor}40` }}
                >
                  {statusIcon}
                </div>
                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-[#2D2C31]">{source.icon} {source.label}</span>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: `${statusColor}20`, color: statusColor }}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6A72]">{source.description}</p>
                  {/* Counter-factor shown for 'no' answers */}
                  {isNo && (
                    <p className="text-[11px] text-[#cf222e] mt-1 flex items-center gap-1">
                      <span>⚠</span> {source.counterFactor}
                    </p>
                  )}
                  {unanswered && (
                    <p className="text-[11px] text-[#9a6700] mt-1">Answer the question below to assess this source.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-[#6B6A72] mt-4 border-t border-[#F0EEE8] pt-3">
          Source assessment reflects your answers to the questions below.
        </p>
      </div>

      <SectionSummary text={summary} label="Moat Analysis" />

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
