'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import type { WatchlistEntry } from '@/lib/simplifier/types'
import { PHASES } from '@/lib/simplifier/phases'
import { scoreAll, overallScore } from '@/lib/simplifier/scoring'

interface WatchlistCardProps {
  entry: WatchlistEntry
  onDelete: (ticker: string) => void
}

function scoreColor(s: number): string {
  if (s >= 4.5) return '#1f6feb'
  if (s >= 3.5) return '#0969da'
  if (s >= 2.5) return '#9a6700'
  return '#cf222e'
}
function scoreLabel(s: number): string {
  if (s >= 4.5) return 'Excellent'
  if (s >= 3.5) return 'Strong'
  if (s >= 2.5) return 'Average'
  return 'Weak'
}

export default function WatchlistCard({ entry, onDelete }: WatchlistCardProps) {
  const router  = useRouter()
  const [imgErr, setImgErr] = useState(false)

  const logoUrl = `https://logo.clearbit.com/${entry.ticker.toLowerCase()}.com`

  const phasesComplete = PHASES.filter(
    (p) => p.questions.every((q) => entry.answers[q.id] != null)
  ).length

  const updatedLabel = entry.updatedAt
    ? new Date(entry.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  // Convert 0–1 overall score to 1–5 scale
  const phaseScores = scoreAll(entry.answers)
  const raw = entry.overallScore ?? overallScore(phaseScores)
  const score1to5 = 1 + raw * 4
  const color = scoreColor(score1to5)

  return (
    <div
      className="rounded-xl border border-[#E8E6E0] bg-white p-4 flex flex-col gap-3 hover:border-[#1f6feb]/40 hover:shadow-sm transition-all cursor-pointer group"
      onClick={() => router.push(`/simplifier/${entry.ticker}`)}
    >
      {/* Header: logo + ticker + company + delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {!imgErr ? (
            <Image
              src={logoUrl}
              alt={entry.ticker}
              width={32}
              height={32}
              className="rounded-lg object-contain bg-white border border-[#E8E6E0] p-0.5"
              onError={() => setImgErr(true)}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#EEF4FF] border border-[#DCE6F5] flex items-center justify-center text-[11px] font-bold text-[#1f6feb] font-mono">
              {entry.ticker.slice(0, 2)}
            </div>
          )}

          <div>
            <p className="text-[#2D2C31] font-semibold text-sm font-mono">{entry.ticker}</p>
            <p className="text-[#6B6A72] text-[11px] leading-tight line-clamp-1">{entry.companyName}</p>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(entry.ticker) }}
          className="opacity-0 group-hover:opacity-100 text-[#6B6A72] hover:text-[#cf222e] transition-all p-1 rounded hover:bg-[#FEE2E2]"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/>
          </svg>
        </button>
      </div>

      {/* Phase completion dots */}
      <div className="flex items-center gap-1">
        {PHASES.map((p) => {
          const answered = p.questions.filter((q) => entry.answers[q.id] != null).length
          const total    = p.questions.length
          const complete = answered === total
          const started  = answered > 0

          return (
            <div
              key={p.id}
              title={`${p.name} (${answered}/${total})`}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                complete ? 'bg-[#1f6feb]'
                : started ? 'bg-[#1f6feb]/40'
                : 'bg-[#E8E6E0]'
              }`}
            />
          )
        })}
      </div>

      {/* Score + progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-bold font-mono"
            style={{ color }}
          >
            {score1to5.toFixed(1)}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded border"
            style={{
              color,
              backgroundColor: color + '15',
              borderColor: color + '40',
            }}
          >
            {scoreLabel(score1to5)}
          </span>
          <span className="text-[11px] text-[#6B6A72]">{phasesComplete}/5</span>
        </div>
        {updatedLabel && (
          <span className="text-[10px] text-[#6B6A72]">{updatedLabel}</span>
        )}
      </div>

      {/* Key snapshot metrics */}
      {entry.snapshot && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {entry.snapshot.upsidePct != null && (
            <span className={`text-[11px] font-mono font-semibold ${entry.snapshot.upsidePct >= 0 ? 'text-[#1f6feb]' : 'text-[#cf222e]'}`}>
              {entry.snapshot.upsidePct >= 0 ? '+' : ''}{(entry.snapshot.upsidePct * 100).toFixed(0)}% upside
            </span>
          )}
          {entry.snapshot.moatScore != null && (
            <span className="text-[11px] text-[#6B6A72] font-mono">Moat {entry.snapshot.moatScore.toFixed(1)}/5</span>
          )}
          {entry.snapshot.price != null && (
            <span className="text-[11px] text-[#6B6A72] font-mono">${entry.snapshot.price.toFixed(2)}</span>
          )}
        </div>
      )}
    </div>
  )
}
