'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  grossMargin?: number | null
  netMargin?: number | null
  fcfMargin?: number | null
  roe?: number | null
  roic?: number | null
  ratingsGrade?: string
  ratingsSummary?: string
  ratingsLabel?: string
  cagrDrivers?: string[]
  isLoading?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a one-sentence history blurb from ratingsSummary or margin thresholds. */
function deriveHistorySentence(
  ratingsSummary: string | undefined | null,
  grossMargin: number | undefined | null,
  netMargin: number | undefined | null,
  fcfMargin: number | undefined | null,
): string {
  // Prefer the first sentence of the provided summary
  if (ratingsSummary) {
    const first = ratingsSummary.split(/(?<=[.!?])\s+/)[0].trim()
    if (first.length > 0) return first
  }

  // Fallback: derive from margins
  if (grossMargin != null && grossMargin > 0.4)
    return 'Gross margin above 40% indicates strong pricing power.'
  if (grossMargin != null && grossMargin > 0.25)
    return 'Gross margin above 25% reflects a healthy product or service mix.'
  if (grossMargin != null && grossMargin > 0)
    return 'Gross margin below 25% — cost structure is a meaningful constraint on profitability.'

  if (netMargin != null && netMargin > 0.2)
    return 'Net margin above 20% points to efficient cost management and durable earnings power.'
  if (netMargin != null && netMargin > 0.08)
    return 'Net margin in the mid-single digits reflects a competitive but viable earnings base.'
  if (netMargin != null && netMargin <= 0)
    return 'Negative net margin — the business is not yet translating revenue into profit.'

  if (fcfMargin != null && fcfMargin > 0.15)
    return 'Free cash flow margin above 15% signals strong cash generation relative to revenue.'
  if (fcfMargin != null && fcfMargin > 0)
    return 'Positive free cash flow margin, though modest — watch for conversion consistency.'
  if (fcfMargin != null && fcfMargin <= 0)
    return 'Negative free cash flow — capital needs are currently exceeding operating cash inflows.'

  return 'Insufficient margin data to characterise historical profitability.'
}

/**
 * Build the verdict string from label and grade.
 * e.g. label="Strong profitability" + grade="A" → "Strong profitability — Grade A"
 */
function buildVerdict(
  ratingsLabel: string | undefined | null,
  ratingsGrade: string | undefined | null,
): string {
  const label = ratingsLabel?.trim()
  const grade = ratingsGrade?.trim()

  if (label && grade) return `${label} — Grade ${grade}`
  if (label)          return label
  if (grade)          return `Profitability grade: ${grade}`
  return 'Profitability assessment unavailable'
}

/** Classify the trend from ratingsLabel. */
type Trend = 'improving' | 'stable' | 'declining'

function classifyTrend(ratingsLabel: string | undefined | null): Trend {
  const lc = ratingsLabel?.toLowerCase() ?? ''
  if (lc.includes('improv')) return 'improving'
  if (lc.includes('stable') || lc.includes('steady') || lc.includes('consist'))
    return 'stable'
  return 'declining'
}

/** Pick the first item from cagrDrivers that reads as a positive signal. */
const POSITIVE_RE =
  /grow|improv|expand|increas|margin|profit|strong|robust|solid|gain|higher|effici|premium|leader|innovat/i
const RISK_RE =
  /risk|decline|slow|pressur|headwind|challeng|uncertain|compress|contract|weak|lower|reduc/i

function pickPositiveDriver(drivers: string[] | undefined | null): string | null {
  if (!drivers?.length) return null
  const match = drivers.find((d) => POSITIVE_RE.test(d) && !RISK_RE.test(d))
  return match ?? null
}

// ─── Trend badge ──────────────────────────────────────────────────────────────

const TREND_STYLES: Record<Trend, { dot: string; text: string; label: string; icon: string }> = {
  improving: {
    dot:   'bg-[#11875D]',
    text:  'text-[#11875D]',
    label: 'Improving',
    icon:  '↑',
  },
  stable: {
    dot:   'bg-[#6B6B6B]',
    text:  'text-[#6B6B6B]',
    label: 'Stable',
    icon:  '—',
  },
  declining: {
    dot:   'bg-[#D83B3B]',
    text:  'text-[#D83B3B]',
    label: 'Declining',
    icon:  '↓',
  },
}

// ─── Bullet component ─────────────────────────────────────────────────────────

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#5F790B] shrink-0 mt-[5px]" />
      <span className="text-[12px] text-[#566174] leading-snug break-words min-w-0">
        {children}
      </span>
    </li>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfitabilityTextCard({
  grossMargin,
  netMargin,
  fcfMargin,
  roe,
  roic,
  ratingsGrade,
  ratingsSummary,
  ratingsLabel,
  cagrDrivers,
  isLoading,
}: Props) {
  const derived = useMemo(() => {
    const verdict         = buildVerdict(ratingsLabel, ratingsGrade)
    const historySentence = deriveHistorySentence(ratingsSummary, grossMargin, netMargin, fcfMargin)
    const trend           = classifyTrend(ratingsLabel)
    const trendStyle      = TREND_STYLES[trend]
    const positiveDriver  = pickPositiveDriver(cagrDrivers)
    return { verdict, historySentence, trend, trendStyle, positiveDriver }
  }, [grossMargin, netMargin, fcfMargin, ratingsGrade, ratingsSummary, ratingsLabel, cagrDrivers])

  const { verdict, historySentence, trendStyle, positiveDriver } = derived

  // ─── Rating badge styles ──────────────────────────────────────────────────
  const gradeBadgeClass = useMemo(() => {
    const g = ratingsGrade?.trim().toUpperCase() ?? ''
    if (g === 'A+' || g === 'A')
      return 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]'
    if (g === 'B+' || g === 'B')
      return 'bg-[#EEF4DD] text-[#5F790B] border border-[#C9DC8E]'
    if (g === 'C' || g === 'D' || g === 'F')
      return 'bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391]'
    return null
  }, [ratingsGrade])

  // ─── Margins row value ─────────────────────────────────────────────────────
  const marginsValue = useMemo(() => {
    const parts: string[] = []
    if (grossMargin != null) parts.push(`GM ${(grossMargin * 100).toFixed(1)}%`)
    if (netMargin   != null) parts.push(`NM ${(netMargin   * 100).toFixed(1)}%`)
    if (fcfMargin   != null) parts.push(`FCF ${(fcfMargin  * 100).toFixed(1)}%`)
    return parts.length > 0 ? parts.join(' · ') : null
  }, [grossMargin, netMargin, fcfMargin])

  // ─── Returns row value ─────────────────────────────────────────────────────
  const returnsValue = useMemo(() => {
    const parts: string[] = []
    if (roe  != null) parts.push(`ROE ${(roe  * 100).toFixed(1)}%`)
    if (roic != null) parts.push(`ROIC ${(roic * 100).toFixed(1)}%`)
    return parts.length > 0 ? parts.join(' · ') : null
  }, [roe, roic])

  if (isLoading) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-3 bg-[#E5E5E5] rounded w-24" />
          <div className="h-3 bg-[#E5E5E5] rounded w-full" />
          <div className="h-3 bg-[#E5E5E5] rounded w-5/6" />
          <div className="h-3 bg-[#E5E5E5] rounded w-4/6" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5">
      {/* Header — label left, rating badge right */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-[700] text-[#111111] leading-tight">
          Profitability
        </h3>
        {ratingsGrade && gradeBadgeClass && (
          <span className={cn('text-[11px] font-[600] px-2.5 py-0.5 rounded-full leading-none border', gradeBadgeClass)}>
            {ratingsGrade}
          </span>
        )}
      </div>

      {/* Bullet list — fix [8]: aria-label */}
      <ul className="space-y-2.5" aria-label="Profitability summary">
        {/* Bullet 1 — Verdict */}
        <Bullet>
          <span className="font-[600]">Verdict: </span>
          {verdict}
        </Bullet>

        {/* Bullet 2 — History */}
        <Bullet>
          {historySentence.length > 200
            ? historySentence.slice(0, 197) + '…'
            : historySentence}
        </Bullet>

        {/* Bullet 3 — Trend / Rate */}
        {/* fix [5]: add icon alongside dot for non-color indicator; fix [7]: aria-hidden on dot */}
        <li className="flex items-start gap-2">
          <div aria-hidden="true" className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]', trendStyle.dot)} />
          <span className="text-[12px] leading-snug">
            <span className="text-[#566174] font-medium">Trend: </span>
            <span className={cn('font-semibold', trendStyle.text)}>
              <span aria-hidden="true" className="mr-0.5">{trendStyle.icon}</span>
              {trendStyle.label}
            </span>
          </span>
        </li>

        {/* Bullet 4 — Positive CAGR driver (optional) */}
        {positiveDriver && (
          <Bullet>
            {positiveDriver.length > 160
              ? positiveDriver.slice(0, 157) + '…'
              : positiveDriver}
          </Bullet>
        )}

        {/* Bullet 5 — Margins metrics row */}
        {marginsValue && (
          <li className="flex items-start gap-2">
            <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#5F790B] shrink-0 mt-[5px]" />
            <span className="text-[12px] text-[#566174] leading-snug break-words min-w-0">
              <span className="font-medium">Margins</span>{' '}
              <span className="font-mono">{marginsValue}</span>
            </span>
          </li>
        )}

        {/* Bullet 6 — Returns metrics row */}
        {returnsValue && (
          <li className="flex items-start gap-2">
            <div aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#5F790B] shrink-0 mt-[5px]" />
            <span className="text-[12px] text-[#566174] leading-snug break-words min-w-0">
              <span className="font-medium">Returns</span>{' '}
              <span className="font-mono">{returnsValue}</span>
            </span>
          </li>
        )}
      </ul>
    </div>
  )
}
