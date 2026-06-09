'use client'
import { cn } from '@/lib/utils'
import type { ConvictionScore, ConvictionDimension, ConvictionSignal } from '@/lib/stock/computeConvictionScore'

interface Props {
  conviction: ConvictionScore
  ticker?: string
}

// ─── Color maps ───────────────────────────────────────────────────────────────

function scoreNumberColor(grade: ConvictionScore['grade']): string {
  switch (grade) {
    case 'A': return '#11875D'
    case 'B': return '#2563EB'
    case 'C': return '#B56A00'
    default:  return '#D83B3B'
  }
}

function gradeChipCls(grade: string): string {
  const base = grade.replace('+', '')
  if (base === 'A') return 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]'
  if (base === 'B') return 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]'
  if (base === 'C') return 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]'
  if (base === 'D') return 'bg-orange-50 text-orange-700 border-orange-200'
  return 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
}

function dimBarColor(color: ConvictionDimension['color']): string {
  switch (color) {
    case 'green':   return 'bg-[#11875D]'
    case 'amber':   return 'bg-[#B56A00]'
    case 'red':     return 'bg-[#D83B3B]'
    default:        return 'bg-[#9B9B9B]'
  }
}

function signalDotColor(status: ConvictionSignal['status']): string {
  switch (status) {
    case 'pass': return 'bg-[#11875D]'
    case 'fail': return 'bg-[#D83B3B]'
    default:     return 'bg-[#C4C4C4]'
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DimensionCard({ dim }: { dim: ConvictionDimension }) {
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white px-4 py-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <p className="text-[13px] font-[700] text-[#111111] leading-snug">{dim.label}</p>
        <span className="text-[12px] font-bold text-[#6B6B6B] tabular-nums shrink-0">{dim.score}</span>
      </div>

      {/* Question */}
      <p className="text-[11px] text-[#6B6B6B] mb-2.5 leading-snug">{dim.question}</p>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-[#E5E5E5] overflow-hidden mb-3">
        <div
          className={cn('h-full rounded-full transition-all', dimBarColor(dim.color))}
          style={{ width: `${Math.max(3, dim.score)}%` }}
        />
      </div>

      {/* Signals */}
      <div className="space-y-2">
        {dim.signals.map((sig, i) => (
          <div key={i} className="flex items-start gap-2" title={sig.technicalName ? `${sig.technicalName}` : undefined}>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-[4px]', signalDotColor(sig.status))} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-1 flex-wrap">
                <span className="text-[12px] text-[#6B6B6B] leading-snug">{sig.label}</span>
                <span className="text-[12px] font-semibold text-[#111111] leading-snug text-right">{sig.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function ConvictionScoreCard({ conviction, ticker }: Props) {
  const scoreColor = scoreNumberColor(conviction.grade)
  const chipCls    = gradeChipCls(conviction.gradeFull)

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)] overflow-hidden">

      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E5E5E5]">
        {/* Score row */}
        <div className="flex items-center gap-3 mb-1">
          <span
            className="text-[48px] font-[800] leading-none tabular-nums"
            style={{ color: scoreColor, letterSpacing: '-0.035em' }}
          >
            {conviction.score}
          </span>
          <div className="flex flex-col gap-1">
            <span className={cn('text-[14px] font-[700] px-2.5 py-0.5 rounded-full border', chipCls)}>
              {conviction.gradeFull}
            </span>
            <span className="text-[11px] text-[#6B6B6B]">out of 100</span>
          </div>
          <div className="flex-1 min-w-0 ml-1">
            <p className="text-[14px] font-[700] text-[#111111] leading-snug">{conviction.label}</p>
          </div>
        </div>

        {/* Verdict sentence */}
        <p className="text-[13px] text-[#6B6B6B] leading-relaxed mt-1.5">
          {conviction.verdictSentence}
        </p>

        {/* Score label */}
        <p className="text-[11px] font-[700] uppercase tracking-wider text-[#9B9B9B] mt-2">
          Conviction Score{ticker ? ` · ${ticker.toUpperCase()}` : ''}
        </p>
      </div>

      {/* Dimension grid */}
      <div className="p-4 bg-[#FAFAFA]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {conviction.dimensions.map(dim => (
            <DimensionCard key={dim.id} dim={dim} />
          ))}
        </div>

        {/* Footer disclaimer */}
        <p className="mt-3 text-[10px] text-[#9B9B9B] text-center leading-relaxed">
          Based on DCF model, financial ratios, and quality scores. Not investment advice.
        </p>
      </div>

    </div>
  )
}
