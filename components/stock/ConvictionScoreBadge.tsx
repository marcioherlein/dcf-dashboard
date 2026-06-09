'use client'
import { cn } from '@/lib/utils'

interface Props {
  score: number
  grade: string
  size?: 'sm' | 'md'
}

function chipColors(gradeFull: string): string {
  const base = gradeFull.replace('+', '').replace('-', '')
  if (base === 'A') return 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]'
  if (base === 'B') return 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]'
  if (base === 'C') return 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]'
  if (base === 'D') return 'bg-orange-50 text-orange-700 border-orange-200'
  return 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
}

function barColor(gradeFull: string): string {
  const base = gradeFull.replace('+', '').replace('-', '')
  if (base === 'A') return 'bg-[#11875D]'
  if (base === 'B') return 'bg-[#2563EB]'
  if (base === 'C') return 'bg-[#B56A00]'
  return 'bg-[#D83B3B]'
}

export default function ConvictionScoreBadge({ score, grade, size = 'md' }: Props) {
  const chipCls  = chipColors(grade)
  const barCls   = barColor(grade)
  const barWidth = `${Math.max(4, Math.min(100, score))}%`

  if (size === 'sm') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-[700]',
        chipCls,
      )}>
        {score} · {grade}
      </span>
    )
  }

  // md
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-[700] text-[#6B6B6B] uppercase tracking-wide">Conviction Score</span>
        <span className={cn('text-[12px] font-[700] px-2 py-0.5 rounded-full border', chipCls)}>
          {score}/100 · {grade}
        </span>
      </div>
      {/* Thin progress bar */}
      <div className="h-1.5 rounded-full bg-[#E5E5E5] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barCls)}
          style={{ width: barWidth }}
        />
      </div>
    </div>
  )
}
