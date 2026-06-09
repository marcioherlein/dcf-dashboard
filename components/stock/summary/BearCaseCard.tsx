'use client'

import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const CARD =
  'bg-white border border-[#E5E5E5] rounded-xl shadow-card'

const RISK_RE =
  /risk|slow|compet.*threat|compet.*pressure|compet.*tion.*increas|decline|margin.*pressur|debt|regul|geopolit|uncertain|challeng|pressur|headwind|restrict|vola|concern|restrict|expos|saturat|disrupt|commoditi/i

interface Ratings {
  valuation?: { color?: string } | null
  growth?: { score?: number } | null
  moat?: { score?: number } | null
}

function buildRiskBullets(
  drivers: string[],
  upsidePct: number | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ratings: any,
): string[] {
  const risks = drivers.filter((d) => RISK_RE.test(d))
  const bullets: string[] = [...risks.slice(0, 3)]

  // Synthetic bullets from ratings if we still have room
  if (bullets.length < 2 && upsidePct != null && upsidePct < -0.1) {
    bullets.push(
      `At current price, the stock trades ${(Math.abs(upsidePct) * 100).toFixed(0)}% above our intrinsic estimate — limited margin of safety.`,
    )
  }
  if (
    bullets.length < 2 &&
    ratings?.growth?.score != null &&
    ratings.growth.score < 60
  ) {
    bullets.push(
      'Growth metrics are below expectations — watch for narrative reset.',
    )
  }
  if (bullets.length < 2 && ratings?.valuation?.color) {
    const c = ratings.valuation.color
    if (c === 'red' || c === 'orange')
      bullets.push('Valuation elevated relative to underlying fundamentals.')
    else if (c === 'amber')
      bullets.push(
        'Valuation stretched — limited buffer if growth disappoints.',
      )
  }
  if (bullets.length === 0)
    bullets.push('No significant risk signals from available model data.')
  return bullets.slice(0, 5)
}

interface BearCaseCardProps {
  drivers: string[]
  upsidePct: number | null
  ratings: Ratings | null
  onViewDetails: () => void
}

export default function BearCaseCard({
  drivers,
  upsidePct,
  ratings,
  onViewDetails,
}: BearCaseCardProps) {
  const bullets = buildRiskBullets(drivers, upsidePct, ratings)

  return (
    <div className={cn(CARD, 'p-4 sm:p-5 flex flex-col gap-3')}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#FEF2F2] flex items-center justify-center shrink-0">
          <AlertCircle size={15} className="text-[#DC2626]" />
        </div>
        <p className="text-[13px] font-[700] text-[#111111]">
          Risks to Watch
        </p>
      </div>

      {/* Bullets */}
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0 mt-1.5" />
            <span className="text-[13px] text-[#111111] leading-relaxed break-words min-w-0">
              {b.length > 160 ? b.slice(0, 157) + '…' : b}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={onViewDetails}
        className="mt-auto text-[13px] font-[650] text-[#2563EB] hover:text-[#1D4ED8] hover:underline underline-offset-2 transition-colors flex items-center gap-1 min-h-[44px]"
      >
        View full risk analysis <span aria-hidden>→</span>
      </button>
    </div>
  )
}
