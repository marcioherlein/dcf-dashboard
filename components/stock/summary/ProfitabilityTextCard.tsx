'use client'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  grossMargin?: number | null
  netMargin?: number | null
  fcfMargin?: number | null
  ratingsGrade?: string
  ratingsSummary?: string
  ratingsLabel?: string
  cagrDrivers?: string[]
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

const TREND_STYLES: Record<Trend, { dot: string; text: string; label: string }> = {
  improving: {
    dot:   'bg-[#16A34A]',
    text:  'text-[#16A34A]',
    label: 'Improving',
  },
  stable: {
    dot:   'bg-[#9B9B9B]',
    text:  'text-[#6B6B6B]',
    label: 'Stable',
  },
  declining: {
    dot:   'bg-[#DC2626]',
    text:  'text-[#DC2626]',
    label: 'Declining',
  },
}

// ─── Bullet component ─────────────────────────────────────────────────────────

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {/* Olive dot */}
      <div className="w-1.5 h-1.5 rounded-full bg-[#5F790B] shrink-0 mt-[6px]" />
      <span className="text-[13px] text-[#111111] leading-relaxed break-words min-w-0">
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
  ratingsGrade,
  ratingsSummary,
  ratingsLabel,
  cagrDrivers,
}: Props) {
  const verdict        = buildVerdict(ratingsLabel, ratingsGrade)
  const historySentence = deriveHistorySentence(ratingsSummary, grossMargin, netMargin, fcfMargin)
  const trend          = classifyTrend(ratingsLabel)
  const trendStyle     = TREND_STYLES[trend]
  const positiveDriver = pickPositiveDriver(cagrDrivers)

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4">
      {/* Header */}
      <p className="text-[12px] font-bold text-[#6B6B6B] tracking-wider uppercase mb-3">
        PROFITABILITY
      </p>

      {/* Bullet list */}
      <ul className="space-y-2.5">
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
        <li className="flex items-start gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-[6px]', trendStyle.dot)} />
          <span className="text-[13px] leading-relaxed">
            <span className="text-[#111111] font-[500]">Trend: </span>
            <span className={cn('font-[650]', trendStyle.text)}>{trendStyle.label}</span>
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
      </ul>
    </div>
  )
}
