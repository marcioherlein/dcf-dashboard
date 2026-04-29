'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Image from 'next/image'
import type { WatchlistEntry, ListTag } from '@/lib/simplifier/types'
import { PHASES } from '@/lib/simplifier/phases'
import { scorePhase, overallScore } from '@/lib/simplifier/scoring'
import { ListTagBadge, cycleTag } from './ListTagSelector'

interface WatchlistTableProps {
  entries:       WatchlistEntry[]
  onDelete:      (ticker: string) => void
  onTagUpdate:   (ticker: string, tag: ListTag) => void
}

// ── Dimension score helpers ───────────────────────────────────────────────────

const RISK_IDS       = ['risk_regulatory', 'risk_competitive_disruption', 'risk_financial_health', 'risk_macro_exposure']
const VALUATION_IDS  = ['val_price_reasonable', 'val_margin_of_safety']

function sliceScore(answers: WatchlistEntry['answers'], ids: string[]): number | null {
  const phase5 = PHASES[4]
  const qs = phase5.questions.filter(q => ids.includes(q.id))
  if (!qs.length) return null
  const answered = qs.filter(q => answers[q.id] != null)
  if (!answered.length) return null
  const raw = answered.reduce((sum, q) => {
    const a = answers[q.id]
    return sum + (a === 'yes' ? 1 : a === 'partial' ? 0.5 : 0)
  }, 0) / qs.length
  return 1 + raw * 4
}

function phaseScore(answers: WatchlistEntry['answers'], phaseIdx: number): number | null {
  const phase = PHASES[phaseIdx]
  const answered = phase.questions.filter(q => answers[q.id] != null)
  if (!answered.length) return null
  const raw = scorePhase(answers, phase)
  return 1 + raw * 4
}

function overallScore1to5(answers: WatchlistEntry['answers']): number | null {
  const phaseScores = {
    1: scorePhase(answers, PHASES[0]),
    2: scorePhase(answers, PHASES[1]),
    3: scorePhase(answers, PHASES[2]),
    4: scorePhase(answers, PHASES[3]),
    5: scorePhase(answers, PHASES[4]),
  }
  const total = Object.values(phaseScores).reduce((a, b) => a + b, 0)
  if (total === 0) return null
  return 1 + overallScore(phaseScores) * 4
}

// ── Mini score circle (32px, inline SVG) ─────────────────────────────────────

function scoreColor(s: number): string {
  if (s >= 4.5) return '#1f6feb'
  if (s >= 3.5) return '#0969da'
  if (s >= 2.5) return '#9a6700'
  return '#cf222e'
}

function MiniScore({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center justify-center size-8 rounded-full bg-[#F3F4F6] text-[11px] font-bold text-[#9CA3AF]">
        —
      </span>
    )
  }
  const color = scoreColor(score)
  const pct   = Math.min(Math.max((score - 1) / 4, 0), 1)
  const r = 12, stroke = 3
  const circ = 2 * Math.PI * r
  const arc  = circ * 0.75
  const offset = arc - pct * arc
  const cx = 16, cy = 16
  const startAngle = 135 * (Math.PI / 180)
  const endAngle   = 45  * (Math.PI / 180)
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const trackPath = `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2}`

  return (
    <svg width={32} height={32} viewBox="0 0 32 32">
      <path d={trackPath} fill="none" stroke="#E8E6E0" strokeWidth={stroke} strokeLinecap="round" />
      <path d={trackPath} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${arc}`} strokeDashoffset={offset} />
      <text x={16} y={20} textAnchor="middle" fontSize={10} fontWeight="700"
        fontFamily="'IBM Plex Mono', monospace" fill={color}>
        {score.toFixed(1)}
      </text>
    </svg>
  )
}

// ── Table header ──────────────────────────────────────────────────────────────

const HEADERS = ['TICKER', 'DATE', 'PRICE', 'PHASE', 'BUSINESS', 'MOAT', 'GROWTH', 'MANAGEMENT', 'RISK', 'VALUATION', 'SCORE', '']

// ── Row ───────────────────────────────────────────────────────────────────────

function TableRow({ entry, onDelete, onTagUpdate }: {
  entry: WatchlistEntry
  onDelete: (ticker: string) => void
  onTagUpdate: (ticker: string, tag: ListTag) => void
}) {
  const router = useRouter()
  const [imgErr, setImgErr] = useState(false)
  const logoUrl = `https://logo.clearbit.com/${entry.ticker.toLowerCase()}.com`

  const updatedLabel = entry.updatedAt
    ? new Date(entry.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'

  const business    = phaseScore(entry.answers, 0)
  const moat        = phaseScore(entry.answers, 1)
  const growth      = phaseScore(entry.answers, 2)
  const management  = phaseScore(entry.answers, 3)
  const risk        = sliceScore(entry.answers, RISK_IDS)
  const valuation   = sliceScore(entry.answers, VALUATION_IDS)
  const overall     = overallScore1to5(entry.answers)

  return (
    <tr
      className="border-b border-[#E8E6E0] hover:bg-[#F9F9F7] cursor-pointer transition-colors group"
      onClick={() => router.push(`/simplifier/${entry.ticker}`)}
    >
      {/* Ticker + logo + tag */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          {!imgErr ? (
            <Image src={logoUrl} alt={entry.ticker} width={28} height={28}
              className="rounded-md object-contain bg-white border border-[#E8E6E0] p-0.5 shrink-0"
              onError={() => setImgErr(true)} />
          ) : (
            <div className="w-7 h-7 rounded-md bg-[#EEF4FF] border border-[#DCE6F5] flex items-center justify-center text-[10px] font-bold text-[#1f6feb] font-mono shrink-0">
              {entry.ticker.slice(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#2D2C31] font-mono leading-none">{entry.ticker}</p>
            <div className="mt-0.5" onClick={e => e.stopPropagation()}>
              <ListTagBadge tag={entry.listTag} onClick={() => onTagUpdate(entry.ticker, cycleTag(entry.listTag))} />
            </div>
          </div>
        </div>
      </td>

      {/* DATE */}
      <td className="px-3 py-3 text-[12px] text-[#6B6A72] whitespace-nowrap">{updatedLabel}</td>

      {/* PRICE */}
      <td className="px-3 py-3 text-[12px] font-mono font-semibold text-[#2D2C31] whitespace-nowrap">
        {entry.snapshot?.price != null ? `$${entry.snapshot.price.toFixed(2)}` : '—'}
      </td>

      {/* PHASE */}
      <td className="px-3 py-3">
        <span className="inline-flex items-center justify-center size-7 rounded-full bg-[#EEF4FF] text-[12px] font-bold text-[#1f6feb] font-mono">
          {entry.currentPhase}
        </span>
      </td>

      {/* Score circles */}
      <td className="px-2 py-3"><MiniScore score={business} /></td>
      <td className="px-2 py-3"><MiniScore score={moat} /></td>
      <td className="px-2 py-3"><MiniScore score={growth} /></td>
      <td className="px-2 py-3"><MiniScore score={management} /></td>
      <td className="px-2 py-3"><MiniScore score={risk} /></td>
      <td className="px-2 py-3"><MiniScore score={valuation} /></td>

      {/* SCORE — overall, slightly bigger */}
      <td className="px-2 py-3">
        {overall != null ? (
          <div className="flex items-center gap-1.5">
            <MiniScore score={overall} />
          </div>
        ) : (
          <span className="text-[11px] text-[#9CA3AF]">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onDelete(entry.ticker)}
            className="p-1.5 rounded hover:bg-[#FEE2E2] text-[#9CA3AF] hover:text-[#cf222e] transition-colors"
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── WatchlistTable ────────────────────────────────────────────────────────────

export default function WatchlistTable({ entries, onDelete, onTagUpdate }: WatchlistTableProps) {
  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-[#EEF4FF] border border-[#DCE6F5] flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="#1f6feb">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.5h2.5a.75.75 0 0 1 0 1.5H8.5v2.5a.75.75 0 0 1-1.5 0V8.75H4.75a.75.75 0 0 1 0-1.5H7v-2.5a.75.75 0 0 1 1.5 0Z"/>
          </svg>
        </div>
        <p className="text-[#2D2C31] font-semibold text-sm mb-1">No stocks in this list</p>
        <p className="text-[#6B6A72] text-xs max-w-xs">
          Search for a ticker above to start your guided analysis.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="bg-[#1A1917] text-white">
            {HEADERS.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2.5 text-left text-[10px] font-semibold tracking-wider uppercase ${
                  i === 0 ? 'pl-4' : ''
                } ${i === HEADERS.length - 1 ? 'w-10' : ''}`}
              >
                {h === 'DATE' ? (
                  <span className="flex items-center gap-1">
                    {h}
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="opacity-60">
                      <path d="M4 6L0 2h8z"/>
                    </svg>
                  </span>
                ) : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {entries.map(entry => (
            <TableRow
              key={entry.ticker}
              entry={entry}
              onDelete={onDelete}
              onTagUpdate={onTagUpdate}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
