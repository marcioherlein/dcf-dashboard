'use client'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct } from '@/lib/formatters'

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

// ── Verdict derivation ────────────────────────────────────────────────────────

interface Verdict {
  chip: string
  heading: string
  description: (ticker?: string) => string
  chipClass: string
  headingClass: string
}

function deriveVerdict(upsidePct: number | null, price: number, fv: number | null): Verdict {
  const absPct = upsidePct != null ? Math.abs(upsidePct * 100).toFixed(0) : '?'
  if (upsidePct == null || fv == null) return {
    chip: '—', heading: 'Insufficient Data',
    description: () => 'We could not compute an intrinsic value estimate with the available data.',
    chipClass: 'bg-slate-100 text-slate-500 border-slate-200',
    headingClass: 'text-slate-500',
  }
  if (upsidePct >= 0.20) return {
    chip: 'BUY', heading: 'Undervalued',
    description: () => `Trading ${absPct}% below our fair value estimate — a significant margin of safety.`,
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headingClass: 'text-emerald-600',
  }
  if (upsidePct >= 0.05) return {
    chip: 'BUY', heading: 'Fairly Valued',
    description: () => `Trading ${absPct}% below our estimate — reasonable entry with limited downside.`,
    chipClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    headingClass: 'text-emerald-500',
  }
  if (upsidePct >= -0.10) return {
    chip: 'WATCH', heading: 'Fairly Valued',
    description: () => 'Trading close to our intrinsic estimate. Patient investors may wait for a better entry.',
    chipClass: 'bg-blue-50 text-blue-700 border-blue-200',
    headingClass: 'text-blue-600',
  }
  if (upsidePct >= -0.25) return {
    chip: 'AVOID', heading: 'Overvalued',
    description: () => `Trading ${absPct}% above fair value — limited margin of safety at current levels.`,
    chipClass: 'bg-red-50 text-red-600 border-red-200',
    headingClass: 'text-red-600',
  }
  return {
    chip: 'AVOID', heading: 'Overvalued',
    description: () => `Trading ${absPct}% above our estimate. High execution risk embedded in the price.`,
    chipClass: 'bg-red-50 text-red-700 border-red-200',
    headingClass: 'text-red-700',
  }
}

// ── Card shell ────────────────────────────────────────────────────────────────

function HeroCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col', className)}>
      {children}
    </div>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">{children}</p>
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
  const verdict = deriveVerdict(upsidePct, price, fairValue)

  // Price vs FV bar position
  const maxVal = Math.max(price, fairValue ?? price) * 1.15
  const minVal = Math.min(price, fairValue ?? price) * 0.85
  const span   = maxVal - minVal
  const fvPct    = fairValue != null && span > 0 ? Math.max(2, Math.min(98, ((fairValue - minVal) / span) * 100)) : 35
  const pricePct = span > 0 ? Math.max(2, Math.min(98, ((price - minVal) / span) * 100)) : 65

  // Discount/premium relative to FV
  const discountPct = upsidePct != null ? -upsidePct * 100 : null  // positive = price above FV

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

      {/* ── Card 1: Current Price ── */}
      <HeroCard>
        <CardLabel>Current Price</CardLabel>
        <p className="text-3xl font-bold tabular-nums text-slate-900 leading-none">
          {fmtPrice(price, currency)}
        </p>
        <p className={cn('text-sm font-semibold mt-1.5 tabular-nums', isUp ? 'text-emerald-600' : 'text-red-600')}>
          {isUp ? '+' : ''}{fmtPrice(change, currency)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%) today
        </p>

        <div className="mt-auto pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">52-Week Range</p>
          <div className="relative h-2 rounded-full overflow-hidden bg-slate-100">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 opacity-60" />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-slate-700 shadow-sm"
              style={{ left: `calc(${pricePct52}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-slate-400 tabular-nums">{fmtPrice(low52, currency)}</span>
            <span className="text-[10px] text-slate-400 tabular-nums">{fmtPrice(high52, currency)}</span>
          </div>
        </div>
      </HeroCard>

      {/* ── Card 2: Intrinsic Value ── */}
      <HeroCard>
        <CardLabel>Intrinsic Value</CardLabel>
        {fairValue != null ? (
          <>
            <p className="text-3xl font-bold tabular-nums text-slate-900 leading-none">
              {fmtPrice(fairValue, currency)}
            </p>
            {upsidePct != null && (
              <span className={cn(
                'inline-flex items-center mt-1.5 text-sm font-bold tabular-nums',
                upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}>
                {fmtPct(upsidePct)} {upsidePct >= 0 ? 'upside' : 'downside'}
              </span>
            )}
            <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
              Based on blended DCF + multiples
            </p>

            {scenarios && (
              <div className="mt-auto pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Scenario Range</p>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 mb-0.5">Bear</p>
                    <p className="text-[11px] font-semibold text-red-500 tabular-nums">{fmtPrice(scenarios.bear.fairValue, currency)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 mb-0.5">Base</p>
                    <p className="text-[12px] font-bold text-slate-700 tabular-nums">{fmtPrice(scenarios.base.fairValue, currency)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-slate-400 mb-0.5">Bull</p>
                    <p className="text-[11px] font-semibold text-emerald-600 tabular-nums">{fmtPrice(scenarios.bull.fairValue, currency)}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400 mt-2">Valuation not available for this instrument.</p>
        )}
      </HeroCard>

      {/* ── Card 3: Investment Verdict ── */}
      <HeroCard>
        <CardLabel>Investment Verdict</CardLabel>
        <span className={cn('self-start text-[11px] font-bold px-3 py-1 rounded-full border', verdict.chipClass)}>
          {verdict.chip}
        </span>
        <p className={cn('text-2xl font-bold mt-3 leading-tight', verdict.headingClass)}>
          {verdict.heading}
        </p>
        <p className="text-[13px] text-slate-500 leading-relaxed mt-2">
          {verdict.description()}
        </p>
        <button
          onClick={onViewDetails}
          className="mt-auto pt-4 text-[13px] font-semibold text-blue-600 hover:text-blue-700 text-left transition-colors"
        >
          See full valuation →
        </button>
      </HeroCard>

      {/* ── Card 4: Price vs Fair Value ── */}
      <HeroCard>
        <CardLabel>Price vs Fair Value</CardLabel>
        {fairValue != null && discountPct != null ? (
          <>
            <span className={cn(
              'self-start text-xl font-bold tabular-nums px-3 py-1 rounded-full border',
              discountPct > 0
                ? 'text-red-600 bg-red-50 border-red-200'
                : 'text-emerald-600 bg-emerald-50 border-emerald-200'
            )}>
              {discountPct > 0 ? '+' : ''}{discountPct.toFixed(1)}%
            </span>

            <div className="mt-4 relative h-2.5 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" />
              {/* Fair value marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/90"
                style={{ left: `${fvPct}%` }}
              />
              {/* Current price dot */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-800 shadow"
                style={{ left: `calc(${pricePct}% - 7px)` }}
              />
            </div>

            <div className="flex justify-between mt-2.5">
              <div>
                <p className="text-[10px] text-slate-400">Fair Value</p>
                <p className="text-[12px] font-semibold text-slate-700 tabular-nums mt-0.5">{fmtPrice(fairValue, currency)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400">Current Price</p>
                <p className="text-[12px] font-semibold text-slate-700 tabular-nums mt-0.5">{fmtPrice(price, currency)}</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-3 leading-snug">
              {discountPct > 0
                ? `Current price is ${discountPct.toFixed(1)}% above our fair value estimate.`
                : `Current price is ${Math.abs(discountPct).toFixed(1)}% below our fair value estimate.`}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400 mt-2">Fair value estimate not available.</p>
        )}
      </HeroCard>

    </div>
  )
}
