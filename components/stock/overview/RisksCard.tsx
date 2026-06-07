'use client'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

interface StockRatingsCategory {
  score?: number
  grade?: string
  label?: string
  color?: 'emerald' | 'green' | 'blue' | 'amber' | 'orange' | 'red'
  summary?: string
}

interface StockRatings {
  profitability?: StockRatingsCategory
  liquidity?: StockRatingsCategory
  growth?: StockRatingsCategory
  moat?: StockRatingsCategory
  valuation?: StockRatingsCategory
}

interface CAGRAnalysis {
  drivers?: string[]
}

interface RisksCardProps {
  ratings: StockRatings
  cagrAnalysis: CAGRAnalysis | null
  onViewRisks: () => void
}

// ── Risk level logic (mirrors existing OverviewMetricGrid logic) ───────────────

function deriveRiskLevel(ratings: StockRatings): { label: string; color: string; badgeClass: string } {
  const valuation = ratings.valuation
  const growth    = ratings.growth
  const moat      = ratings.moat

  const isElevated =
    (valuation?.color === 'red' || valuation?.color === 'orange') ||
    (growth?.score != null && growth.score < 60) ||
    (moat?.score != null   && moat.score < 60)

  const isModerate =
    !isElevated && (
      (growth?.score != null && growth.score < 75) ||
      (moat?.score  != null && moat.score  < 75) ||
      valuation?.color === 'amber'
    )

  if (isElevated) return {
    label: 'Elevated',
    color: 'red',
    badgeClass: 'bg-[#FCEAEA] text-[#D83B3B] border border-[#F0B8B8]',
  }
  if (isModerate) return {
    label: 'Moderate',
    color: 'amber',
    badgeClass: 'bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391]',
  }
  return {
    label: 'Low',
    color: 'emerald',
    badgeClass: 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]',
  }
}

function buildBullets(ratings: StockRatings, cagrAnalysis: CAGRAnalysis | null): string[] {
  const bullets: string[] = []

  // Pull risk-flavored driver sentences
  if (cagrAnalysis?.drivers) {
    const negDrivers = cagrAnalysis.drivers.filter(d =>
      /compet|risk|challeng|declin|uncertain|pressur|headwind|vola|concern|restrict|slow|expos|regulat/i.test(d)
    )
    bullets.push(...negDrivers.slice(0, 3))
  }

  // Synthetic sentences for weak rating categories
  const weakMap: Record<string, string> = {
    profitability: 'Profitability is under pressure — margins warrant close monitoring.',
    growth:        'Growth trajectory is slowing or inconsistent relative to expectations.',
    moat:          'Competitive advantage is limited, increasing long-term earnings risk.',
    valuation:     'Current valuation leaves limited margin of safety for new buyers.',
    liquidity:     'Balance sheet liquidity is stretched — short-term solvency requires attention.',
  }

  for (const key of ['profitability', 'liquidity', 'growth', 'moat', 'valuation'] as const) {
    const cat = ratings[key]
    if (cat && (cat.color === 'red' || cat.color === 'orange' || cat.color === 'amber') && bullets.length < 5) {
      if (weakMap[key]) bullets.push(weakMap[key])
    }
  }

  if (bullets.length === 0) {
    bullets.push('No major red flags identified from available financial data.')
  }

  return bullets.slice(0, 5)
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function RisksCard({ ratings, cagrAnalysis, onViewRisks }: RisksCardProps) {
  const risk    = deriveRiskLevel(ratings)
  const bullets = buildBullets(ratings, cagrAnalysis)

  return (
    <div className="bg-white border border-[#E3E1DA] rounded-2xl px-4 py-4 sm:p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className={cn(
            risk.color === 'red'    ? 'text-[#D83B3B]'   :
            risk.color === 'amber'  ? 'text-[#B56A00]' :
            'text-[#11875D]'
          )} />
          <p className="text-[14px] font-semibold text-[#06101F]">Risks to Thesis</p>
        </div>
        <span className={cn('text-[12px] font-semibold px-2.5 py-1 rounded-full', risk.badgeClass)}>
          {risk.label}
        </span>
      </div>

      {/* Bullet list */}
      <ul className="space-y-2.5 mb-4">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5 py-0.5">
            <span className={cn(
              'mt-[7px] w-1.5 h-1.5 rounded-full shrink-0',
              risk.color === 'red'   ? 'bg-[#D83B3B]'   :
              risk.color === 'amber' ? 'bg-[#B56A00]' :
              'bg-[#11875D]'
            )} />
            <span className="text-[13px] text-[#566174] leading-snug">{b}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={onViewRisks}
        className="text-[13px] font-semibold text-[#2563EB] hover:text-[#2563EB] transition-colors min-h-[44px] flex items-center"
      >
        View all risks →
      </button>
    </div>
  )
}
