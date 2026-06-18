'use client'
import { cn } from '@/lib/utils'

interface Props {
  // Drivers for "What supports"
  drivers: string[]
  // Ratings for risk bullets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ratings: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cagrAnalysis: any
  /** Upside % (positive = undervalued, negative = overvalued) */
  upsidePct?: number | null
  // Callbacks
  onViewValuation: () => void
  onViewConviction: () => void
  onSave?: () => void
}

// Positive-language keywords that indicate support / strength
const POSITIVE_RE = /strong|grow|profit|margin|cash\s*gen|moat|leader|dominan|innovat|compet.*advan|pric.*power|market.*share|expand|increas|high.*return|quality|best.in.class|track.record|breadth|diversif|solid|robust|effici|resilient|premium/i

// Risk-language keywords that indicate a genuine concern
const RISK_RE = /risk|slow|compet.*threat|compet.*pressure|compet.*tion.*increas|decline|margin.*pressur|debt|regul|geopolit|uncertain|challeng|pressur|headwind|restrict|vola|concern|restrict|expos|saturat|disrupt|commoditi/i

function buildSupportBullets(drivers: string[]): string[] {
  const positive = drivers.filter(d => POSITIVE_RE.test(d) && !RISK_RE.test(d))
  // Fall back to first 2 drivers if none match (they're usually listed best-first)
  return (positive.length > 0 ? positive : drivers.slice(0, 2)).slice(0, 4)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRiskBullets(ratings: any, cagrAnalysis: any, upsidePct?: number | null): string[] {
  const bullets: string[] = []

  if (cagrAnalysis?.drivers) {
    const riskDrivers = (cagrAnalysis.drivers as string[]).filter(d => RISK_RE.test(d))
    bullets.push(...riskDrivers.slice(0, 2))
  }

  const cats = ['growth', 'profitability', 'moat', 'liquidity', 'valuation'] as const
  for (const key of cats) {
    if (bullets.length >= 4) break
    const cat = ratings?.[key]
    if (!cat) continue
    if (cat.score < 55 && cat.summary) bullets.push(cat.summary)
  }

  // Valuation-based risk when overvalued and no other risk bullets generated
  if (bullets.length < 2 && upsidePct != null && upsidePct < -0.15) {
    const downPct = Math.abs(upsidePct * 100).toFixed(0)
    bullets.push(`Current price is ${downPct}% above our intrinsic estimate — limited margin of safety.`)
  }

  // Generic fallback — never shows bullish content
  if (bullets.length === 0) {
    const valColor = ratings?.valuation?.color
    if (valColor === 'red' || valColor === 'orange') {
      bullets.push('Valuation is elevated relative to fundamentals — limited downside protection.')
    } else if (valColor === 'amber') {
      bullets.push('Valuation is stretched — limited buffer if growth disappoints.')
    } else {
      bullets.push('No significant risk signals from available financial data.')
    }
  }

  return bullets.slice(0, 4)
}

export default function OverviewBottomStrip({ drivers, ratings, cagrAnalysis, upsidePct, onViewValuation, onViewConviction, onSave }: Props) {
  const riskBullets    = buildRiskBullets(ratings, cagrAnalysis, upsidePct)
  const supportBullets = buildSupportBullets(drivers ?? [])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">

      {/* ── Column 1: What supports ── */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-[#E8F7EF] flex items-center justify-center shrink-0">
            <span className="text-[#11875D] text-[12px] leading-none">✓</span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8A95A6]">What Supports the Valuation?</p>
        </div>
        {supportBullets.length > 0 ? (
          <ul className="space-y-2.5">
            {supportBullets.map((d, i) => (
              <li key={i} className="flex items-start gap-2 py-0.5">
                <span className="text-[#11875D] mt-0.5 shrink-0 text-[13px]">✓</span>
                <span className="text-[13px] text-[#566174] leading-relaxed">{d}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[#8A95A6]">Support factors unavailable.</p>
        )}
      </div>

      {/* ── Column 2: What could go wrong ── */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-[#FCEAEA] flex items-center justify-center shrink-0">
            <span className="text-[#D83B3B] text-[12px] leading-none">!</span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8A95A6]">What Could Go Wrong?</p>
        </div>
        {riskBullets.length > 0 ? (
          <ul className="space-y-2.5">
            {riskBullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D83B3B] mt-[7px] shrink-0" />
                <span className="text-[13px] text-[#566174] leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[#8A95A6]">No risk signals from available data.</p>
        )}
        <button
          onClick={onViewConviction}
          className="mt-3.5 min-h-[44px] flex items-center text-[13px] font-medium text-olive-700 hover:text-[#2563EB] transition-colors"
        >
          View full risk analysis →
        </button>
      </div>

      {/* ── Column 3: Next step ── */}
      <div className={cn(
        'bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 shadow-card',
        'flex flex-col'
      )}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-[#EAF1FF] flex items-center justify-center shrink-0">
            <span className="text-[#2563EB] text-[12px] leading-none">→</span>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8A95A6]">Next Step</p>
        </div>
        <p className="text-[13px] text-[#566174] leading-relaxed mb-4">
          Use the Valuation tab to test whether your assumptions support the current price.
        </p>
        <div className="space-y-2 mt-auto">
          <button
            onClick={onViewValuation}
            className={cn(
              'w-full rounded-xl py-3 min-h-[44px] text-[14px] font-semibold text-white transition-all',
              'bg-olive-700 hover:bg-olive-600 active:scale-95 shadow-sm'
            )}
          >
            View valuation →
          </button>
          <button
            onClick={onViewValuation}
            className="w-full rounded-xl py-3 min-h-[44px] text-[14px] font-semibold text-olive-700 border border-[#C8C8C8] hover:bg-olive-50 transition-colors"
          >
            Review assumptions
          </button>
          {onSave && (
            <button
              onClick={onSave}
              className="w-full rounded-xl py-3 min-h-[44px] text-[14px] font-semibold text-[#566174] border border-[#E5E5E5] hover:bg-[#F0F1F6] transition-colors"
            >
              Add to watchlist
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
