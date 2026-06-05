'use client'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct } from '@/lib/formatters'
import { deriveVerdict } from '@/lib/stock/verdict'

interface StockHeroCardsProps {
  price: number
  change: number
  changePct: number
  currency: string
  high52: number
  low52: number
  fairValue: number | null
  upsidePct: number | null
  scenarios: {
    bear: { fairValue: number }
    base: { fairValue: number }
    bull: { fairValue: number }
  } | null
  onViewDetails: () => void
}

// ── Card shell ────────────────────────────────────────────────────────────────

function HeroCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white border border-[#E3E6E0] rounded-2xl p-4 sm:p-5 shadow-card flex flex-col', className)}>
      {children}
    </div>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-semibold text-[#8A96A8] mb-2.5">{children}</p>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StockHeroCards({
  price,
  change,
  changePct,
  currency,
  high52,
  low52,
  fairValue,
  upsidePct,
  scenarios,
  onViewDetails,
}: StockHeroCardsProps) {
  const isUp = change >= 0

  // 52-week range position
  const rangeSpan = high52 - low52
  const pricePct52 = rangeSpan > 0 ? Math.max(0, Math.min(100, ((price - low52) / rangeSpan) * 100)) : 50

  // Verdict
  const verdict = deriveVerdict(upsidePct, fairValue)

  // Price vs FV bar position
  const maxVal = Math.max(price, fairValue ?? price) * 1.15
  const minVal = Math.min(price, fairValue ?? price) * 0.85
  const span   = maxVal - minVal
  const fvPct    = fairValue != null && span > 0 ? Math.max(2, Math.min(98, ((fairValue - minVal) / span) * 100)) : 35
  const pricePct = span > 0 ? Math.max(2, Math.min(98, ((price - minVal) / span) * 100)) : 65

  // Discount/premium relative to FV
  const discountPct = upsidePct != null ? -upsidePct * 100 : null  // positive = price above FV

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

      {/* ── Card 1: Current Price ── */}
      <HeroCard>
        <CardLabel>Current Price</CardLabel>
        <p className="text-[22px] sm:text-3xl font-bold tabular-nums text-[#0A1424] leading-none">
          {fmtPrice(price, currency)}
        </p>
        <p className={cn('text-[12px] sm:text-sm font-semibold mt-1.5 tabular-nums', isUp ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
          {isUp ? '+' : ''}{fmtPrice(change, currency)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%) today
        </p>

        <div className="mt-auto pt-4">
          <p className="text-[11px] font-semibold text-[#8A96A8] mb-2">52-Week Range</p>
          <div className="relative h-2 rounded-full overflow-hidden bg-[#F3F2EC]">
            <div className="absolute inset-0 bg-gradient-to-r from-[#11875D] via-[#B56A00] to-[#D83B3B] opacity-60" />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#0A1424] shadow-sm"
              style={{ left: `calc(${pricePct52}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[11px] text-[#8A96A8] tabular-nums">{fmtPrice(low52, currency)}</span>
            <span className="text-[11px] text-[#8A96A8] tabular-nums">{fmtPrice(high52, currency)}</span>
          </div>
        </div>
      </HeroCard>

      {/* ── Card 2: Intrinsic Value ── */}
      <HeroCard>
        <CardLabel>Intrinsic Value</CardLabel>
        {fairValue != null ? (
          <>
            <p className="text-[22px] sm:text-3xl font-bold tabular-nums text-[#0A1424] leading-none">
              {fmtPrice(fairValue, currency)}
            </p>
            {upsidePct != null && (
              <span className={cn(
                'inline-flex items-center mt-1.5 text-[12px] sm:text-sm font-bold tabular-nums',
                upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'
              )}>
                {fmtPct(upsidePct)} {upsidePct >= 0 ? 'upside' : 'downside'}
              </span>
            )}
            <p className="text-[11px] text-[#8A96A8] mt-1.5 leading-snug">
              Based on blended DCF + multiples
            </p>

            {scenarios && (
              <div className="mt-auto pt-4">
                <p className="text-[11px] font-semibold text-[#8A96A8] mb-1.5">Scenario Range</p>
                <div className="flex items-center justify-between rounded-lg bg-[#F8F7F2] border border-[#E3E6E0] px-2 py-2">
                  <div className="text-center">
                    <p className="text-[11px] text-[#8A96A8] mb-0.5">Bear</p>
                    <p className="text-[12px] font-semibold text-[#D83B3B] tabular-nums">{fmtPrice(scenarios.bear.fairValue, currency)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-[#8A96A8] mb-0.5">Base</p>
                    <p className="text-[12px] font-bold text-[#0A1424] tabular-nums">{fmtPrice(scenarios.base.fairValue, currency)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] text-[#8A96A8] mb-0.5">Bull</p>
                    <p className="text-[12px] font-semibold text-[#11875D] tabular-nums">{fmtPrice(scenarios.bull.fairValue, currency)}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-[13px] text-[#8A96A8] mt-2">Valuation not available for this instrument.</p>
        )}
      </HeroCard>

      {/* ── Card 3: Investment Verdict ── */}
      <HeroCard>
        <CardLabel>Investment Verdict</CardLabel>
        <span className={cn('self-start text-[11px] font-bold px-3 py-1 rounded-full border', verdict.chipClass)}>
          {verdict.chip}
        </span>
        <p className={cn('text-[20px] sm:text-2xl font-bold mt-3 leading-tight', verdict.headingClass)}>
          {verdict.word}
        </p>
        <p className="text-[13px] text-[#536174] leading-relaxed mt-2">
          {verdict.descVerb.charAt(0).toUpperCase() + verdict.descVerb.slice(1)} — {
            upsidePct != null
              ? `${Math.abs(upsidePct * 100).toFixed(0)}% ${upsidePct >= 0 ? 'below' : 'above'} our fair value estimate.`
              : 'fair value estimate unavailable.'
          }
        </p>
        <button
          onClick={onViewDetails}
          className="mt-auto pt-3 min-h-[44px] flex items-end text-[13px] font-semibold text-[#5F790B] hover:text-[#526A08] transition-colors"
        >
          View valuation →
        </button>
      </HeroCard>

      {/* ── Card 4: Price vs Fair Value ── */}
      <HeroCard>
        <CardLabel>Price vs Fair Value</CardLabel>
        {fairValue != null && discountPct != null ? (
          <>
            <span className={cn(
              'self-start text-[18px] sm:text-xl font-bold tabular-nums px-3 py-1 rounded-full border',
              discountPct > 0
                ? 'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]'
                : 'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]'
            )}>
              {discountPct > 0 ? '+' : ''}{discountPct.toFixed(1)}%
            </span>

            <div className="mt-4 relative h-2.5 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#11875D] via-[#B56A00] to-[#D83B3B]" />
              {/* Fair value marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/90"
                style={{ left: `${fvPct}%` }}
              />
              {/* Current price dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#0A1424] shadow"
                style={{ left: `calc(${pricePct}% - 7px)` }}
              />
            </div>

            <div className="flex justify-between mt-2.5">
              <div>
                <p className="text-[11px] text-[#8A96A8]">Fair Value</p>
                <p className="text-[13px] font-semibold text-[#0A1424] tabular-nums mt-0.5">{fmtPrice(fairValue, currency)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#8A96A8]">Current Price</p>
                <p className="text-[13px] font-semibold text-[#0A1424] tabular-nums mt-0.5">{fmtPrice(price, currency)}</p>
              </div>
            </div>

            <p className="text-[12px] text-[#536174] mt-3 leading-snug">
              {discountPct > 0
                ? `Current price is ${discountPct.toFixed(1)}% above our fair value estimate.`
                : `Current price is ${Math.abs(discountPct).toFixed(1)}% below our fair value estimate.`}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-[#8A96A8] mt-2">Fair value estimate not available.</p>
        )}
      </HeroCard>

    </div>
  )
}
