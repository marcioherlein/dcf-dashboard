'use client'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct } from '@/lib/formatters'

interface StockSummaryCardProps {
  ticker: string
  companyName: string
  sector: string
  industry: string
  description: string
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

// ── Verdict derivation (same logic as before) ─────────────────────────────────

interface Verdict {
  chip: string
  heading: string
  description: string
  chipClass: string
  headingClass: string
}

function deriveVerdict(upsidePct: number | null, fv: number | null): Verdict {
  const absPct = upsidePct != null ? Math.abs(upsidePct * 100).toFixed(0) : '?'
  if (upsidePct == null || fv == null) return {
    chip: 'N/A', heading: 'Insufficient Data',
    description: 'We could not compute an intrinsic value estimate.',
    chipClass: 'bg-slate-100 text-slate-500 border-slate-200',
    headingClass: 'text-slate-500',
  }
  if (upsidePct >= 0.25) return {
    chip: 'BUY', heading: 'Attractive',
    description: `Trades ${absPct}% below our fair value estimate — a significant margin of safety.`,
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headingClass: 'text-emerald-600',
  }
  if (upsidePct >= 0.05) return {
    chip: 'BUY', heading: 'Fairly Valued',
    description: `Modest ${absPct}% upside to our estimate — reasonable entry with limited downside.`,
    chipClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    headingClass: 'text-emerald-500',
  }
  if (upsidePct >= -0.10) return {
    chip: 'WATCH', heading: 'Near Fair Value',
    description: 'Trading close to our intrinsic estimate. Patient investors may wait for a better entry.',
    chipClass: 'bg-amber-50 text-amber-700 border-amber-200',
    headingClass: 'text-amber-600',
  }
  if (upsidePct >= -0.25) return {
    chip: 'AVOID', heading: 'Overvalued',
    description: `Trading ${absPct}% above fair value — limited margin of safety at current levels.`,
    chipClass: 'bg-red-50 text-red-600 border-red-200',
    headingClass: 'text-red-600',
  }
  return {
    chip: 'AVOID', heading: 'Significantly Overvalued',
    description: `Priced ${absPct}% above our estimate. High execution risk embedded in the price.`,
    chipClass: 'bg-red-50 text-red-700 border-red-200',
    headingClass: 'text-red-700',
  }
}

// ── Column separator ──────────────────────────────────────────────────────────

function ColDivider() {
  return <div className="hidden sm:block w-px bg-slate-100 self-stretch shrink-0 mx-1" />
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StockSummaryCard({
  ticker, companyName, sector, industry, description,
  price, change, changePct, currency,
  high52, low52,
  fairValue, upsidePct, scenarios,
  onViewDetails,
}: StockSummaryCardProps) {
  const isUp = change >= 0
  const verdict = deriveVerdict(upsidePct, fairValue)
  const marginOfSafety = upsidePct  // positive = price below FV = good

  // 52-week range position (0–100)
  const rangeSpan = high52 - low52
  const pricePct52 = rangeSpan > 0
    ? Math.max(2, Math.min(98, ((price - low52) / rangeSpan) * 100))
    : 50

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100">

        {/* ── Left: Company identity ── */}
        <div className="flex-shrink-0 sm:w-[260px] p-5 flex flex-col gap-3">
          {/* Logo + name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white font-black text-[16px]">
              {companyName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[14px] text-slate-900 truncate leading-tight">{companyName}</p>
              <p className="text-[11px] text-slate-400 font-medium">{ticker}</p>
            </div>
          </div>

          {/* Sector breadcrumb */}
          {(sector || industry) && (
            <p className="text-[11px] text-slate-500">
              {[sector, industry].filter(Boolean).join(' / ')}
            </p>
          )}

          {/* Description */}
          {description && (
            <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-3">
              {description}
            </p>
          )}

          <button
            onClick={onViewDetails}
            className="mt-auto text-[12px] font-semibold text-blue-600 hover:text-blue-700 text-left transition-colors"
          >
            View company profile →
          </button>
        </div>

        {/* ── Right: 4 metric columns ── */}
        <div className="flex-1 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100">

          {/* Current Price */}
          <div className="flex-1 p-5 flex flex-col gap-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Current Price</p>
            <p className="text-[28px] font-bold tabular-nums text-slate-900 leading-none">
              {fmtPrice(price, currency)}
            </p>
            <p className={cn('text-[13px] font-semibold tabular-nums', isUp ? 'text-emerald-600' : 'text-red-600')}>
              {isUp ? '+' : ''}{fmtPrice(change, currency)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
            </p>
            <p className="text-[11px] text-slate-400">today</p>

            {/* 52W mini bar */}
            <div className="mt-auto pt-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">52-Week Range</p>
              <div className="relative h-1.5 rounded-full overflow-hidden bg-slate-100">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-[1.5px] border-slate-700 shadow-sm"
                  style={{ left: `calc(${pricePct52}% - 5px)` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-400 tabular-nums">{fmtPrice(low52, currency)}</span>
                <span className="text-[9px] text-slate-400 tabular-nums">{fmtPrice(high52, currency)}</span>
              </div>
            </div>
          </div>

          <ColDivider />

          {/* Fair Value */}
          <div className="flex-1 p-5 flex flex-col gap-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Fair Value (Intrinsic)</p>
            {fairValue != null ? (
              <>
                <p className="text-[28px] font-bold tabular-nums text-slate-900 leading-none">
                  {fmtPrice(fairValue, currency)}
                </p>
                {upsidePct != null && (
                  <p className={cn('text-[13px] font-semibold tabular-nums', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {fmtPct(upsidePct)} {upsidePct >= 0 ? 'upside' : 'downside'}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 leading-snug">Based on blended DCF + multiples</p>

                {scenarios && (
                  <div className="mt-auto pt-3">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Scenario Range</p>
                    <div className="flex items-center gap-1.5">
                      <div className="text-center">
                        <p className="text-[8px] text-slate-400">Bear</p>
                        <p className="text-[10px] font-semibold text-red-500 tabular-nums">{fmtPrice(scenarios.bear.fairValue, currency)}</p>
                      </div>
                      <div className="flex-1 h-px bg-slate-200" />
                      <div className="text-center">
                        <p className="text-[8px] text-slate-400">Base</p>
                        <p className="text-[11px] font-bold text-slate-700 tabular-nums">{fmtPrice(scenarios.base.fairValue, currency)}</p>
                      </div>
                      <div className="flex-1 h-px bg-slate-200" />
                      <div className="text-center">
                        <p className="text-[8px] text-slate-400">Bull</p>
                        <p className="text-[10px] font-semibold text-emerald-600 tabular-nums">{fmtPrice(scenarios.bull.fairValue, currency)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-1">Not available</p>
            )}
          </div>

          <ColDivider />

          {/* Margin of Safety */}
          <div className="flex-1 p-5 flex flex-col gap-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Margin of Safety</p>
            {marginOfSafety != null ? (
              <>
                <p className={cn(
                  'text-[28px] font-bold tabular-nums leading-none',
                  marginOfSafety >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {marginOfSafety >= 0 ? '+' : ''}{(marginOfSafety * 100).toFixed(1)}%
                </p>
                <p className={cn(
                  'text-[13px] font-semibold',
                  marginOfSafety >= 0.15 ? 'text-emerald-600'
                  : marginOfSafety >= -0.05 ? 'text-amber-600'
                  : 'text-red-600'
                )}>
                  {marginOfSafety >= 0.15 ? 'Undervalued'
                    : marginOfSafety >= -0.05 ? 'Near Fair Value'
                    : 'Overvalued'}
                </p>
                <p className="text-[11px] text-slate-400">vs. Fair Value</p>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-1">—</p>
            )}
          </div>

          <ColDivider />

          {/* Investment Verdict */}
          <div className="flex-1 p-5 flex flex-col gap-2 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Investment Verdict</p>
            <span className={cn('self-start text-[10px] font-bold px-2.5 py-0.5 rounded-full border', verdict.chipClass)}>
              {verdict.chip}
            </span>
            <p className={cn('text-[18px] font-bold leading-tight', verdict.headingClass)}>
              {verdict.heading}
            </p>
            <p className="text-[12px] text-slate-500 leading-relaxed flex-1">
              {verdict.description}
            </p>
            <button
              onClick={onViewDetails}
              className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 text-left transition-colors mt-auto"
            >
              Why? →
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
