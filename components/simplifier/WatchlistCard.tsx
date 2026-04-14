'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import type { WatchlistEntry } from '@/lib/simplifier/types'
import { PHASES } from '@/lib/simplifier/phases'
import PhaseScoreBadge from './PhaseScoreBadge'

interface WatchlistCardProps {
  entry: WatchlistEntry
  onDelete: (ticker: string) => void
}

export default function WatchlistCard({ entry, onDelete }: WatchlistCardProps) {
  const router  = useRouter()
  const [imgErr, setImgErr] = useState(false)

  const logoUrl = entry.snapshot.price != null
    ? `https://logo.clearbit.com/${entry.ticker.toLowerCase()}.com`
    : null

  const phasesComplete = PHASES.filter(
    (p) => p.questions.every((q) => entry.answers[q.id] != null)
  ).length

  const updatedLabel = entry.updatedAt
    ? new Date(entry.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      className="rounded-xl border border-[#21262d] bg-[#0d1117] p-4 flex flex-col gap-3 hover:border-[#388bfd]/40 transition-all cursor-pointer group"
      onClick={() => router.push(`/simplifier/${entry.ticker}`)}
    >
      {/* Header: logo + ticker + company + delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Logo */}
          {!imgErr && logoUrl ? (
            <Image
              src={logoUrl}
              alt={entry.ticker}
              width={32}
              height={32}
              className="rounded-lg object-contain bg-white p-0.5"
              onError={() => setImgErr(true)}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-center text-[11px] font-bold text-[#8b949e] font-mono">
              {entry.ticker.slice(0, 2)}
            </div>
          )}

          <div>
            <p className="text-[#e6edf3] font-semibold text-sm font-mono">{entry.ticker}</p>
            <p className="text-[#8b949e] text-[11px] leading-tight line-clamp-1">{entry.companyName}</p>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(entry.ticker) }}
          className="opacity-0 group-hover:opacity-100 text-[#8b949e] hover:text-[#f85149] transition-all p-1 rounded hover:bg-[#2d0a0a]"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/>
          </svg>
        </button>
      </div>

      {/* Phase dots */}
      <div className="flex items-center gap-1">
        {PHASES.map((p) => {
          const answered  = p.questions.filter((q) => entry.answers[q.id] != null).length
          const total     = p.questions.length
          const complete  = answered === total
          const started   = answered > 0

          return (
            <div
              key={p.id}
              title={`Phase ${p.id}: ${p.name} (${answered}/${total})`}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                complete ? 'bg-[#388bfd]'
                : started ? 'bg-[#388bfd]/40'
                : 'bg-[#21262d]'
              }`}
            />
          )
        })}
      </div>

      {/* Score + progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PhaseScoreBadge score={entry.overallScore} size="sm" showLabel />
          <span className="text-[11px] text-[#8b949e]">{phasesComplete}/5 phases</span>
        </div>
        {updatedLabel && (
          <span className="text-[10px] text-[#484f58]">{updatedLabel}</span>
        )}
      </div>

      {/* Key snapshot metrics */}
      {entry.snapshot && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {entry.snapshot.upsidePct != null && (
            <span className={`text-[11px] font-mono ${entry.snapshot.upsidePct >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
              {entry.snapshot.upsidePct >= 0 ? '+' : ''}{(entry.snapshot.upsidePct * 100).toFixed(0)}% upside
            </span>
          )}
          {entry.snapshot.moatScore != null && (
            <span className="text-[11px] text-[#8b949e] font-mono">Moat {entry.snapshot.moatScore.toFixed(1)}/5</span>
          )}
        </div>
      )}
    </div>
  )
}
