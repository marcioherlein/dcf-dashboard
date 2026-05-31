'use client'

import { CheckCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const CARD =
  'bg-white border border-[#E6ECF5] rounded-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]'

const POSITIVE_RE =
  /strong|grow|profit|margin|cash\s*gen|moat|leader|dominan|innovat|compet.*advan|pric.*power|market.*share|expand|increas|high.*return|quality|best.in.class|track.record|breadth|diversif|solid|robust|effici|resilient|premium/i
const RISK_RE =
  /risk|slow|compet.*threat|compet.*pressure|compet.*tion.*increas|decline|margin.*pressur|debt|regul|geopolit|uncertain|challeng|pressur|headwind|restrict|vola|concern|restrict|expos|saturat|disrupt|commoditi/i

function buildSupportBullets(
  drivers: string[],
  upsidePct: number | null,
): string[] {
  const positives = drivers.filter(
    (d) => POSITIVE_RE.test(d) && !RISK_RE.test(d),
  )
  if (positives.length >= 2) return positives.slice(0, 5)
  // fallback: use first 3 drivers (anything not obviously a risk)
  const nonRisks = drivers.filter((d) => !RISK_RE.test(d))
  if (nonRisks.length >= 1) return nonRisks.slice(0, 3)
  // last resort
  if (upsidePct != null && upsidePct > 0)
    return [
      `Model estimates ${(upsidePct * 100).toFixed(0)}% upside to fair value at current price.`,
    ]
  return []
}

interface BullCaseCardProps {
  drivers: string[]
  upsidePct: number | null
  onViewDetails: () => void
}

export default function BullCaseCard({
  drivers,
  upsidePct,
  onViewDetails,
}: BullCaseCardProps) {
  const bullets = buildSupportBullets(drivers, upsidePct)

  return (
    <div className={cn(CARD, 'p-5 flex flex-col gap-3')}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#ECFDF3] flex items-center justify-center shrink-0">
          <CheckCircle size={15} className="text-[#16A34A]" />
        </div>
        <p className="text-[14px] font-[750] text-[#0F172A]">
          What Supports the Valuation
        </p>
      </div>

      {/* Bullets */}
      {bullets.length > 0 ? (
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check size={13} className="text-[#16A34A] shrink-0 mt-0.5" />
              <span className="text-[13px] text-[#334155] leading-relaxed">
                {b}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-[#94A3B8] italic">
          Support factors unavailable for this stock.
        </p>
      )}

      {/* CTA */}
      <button
        onClick={onViewDetails}
        className="mt-auto text-[13px] font-[650] text-[#2563EB] hover:text-[#1D4ED8] hover:underline underline-offset-2 transition-colors flex items-center gap-1 min-h-[36px]"
      >
        View full risk &amp; thesis <span aria-hidden>→</span>
      </button>
    </div>
  )
}
