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
    chip: '—', heading: 'Insufficient Data',
    description: 'We could not compute an intrinsic value estimate.',
    chipClass: 'bg-slate-100 text-slate-500 border-slate-200',
    headingClass: 'text-slate-500',
  }
  if (upsidePct >= 0.20) return {
    chip: 'BUY', heading: 'Undervalued',
    description: `Trading ${absPct}% below our fair value estimate — a significant margin of safety.`,
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headingClass: 'text-emerald-600',
  }
  if (upsidePct >= 0.05) return {
    chip: 'BUY', heading: 'Fairly Valued',
    description: `Trading ${absPct}% below our estimate — reasonable entry with limited downside.`,
    chipClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    headingClass: 'text-emerald-500',
  }
  if (upsidePct >= -0.10) return {
    chip: 'WATCH', heading: 'Fairly Valued',
    description: 'Trading close to our intrinsic estimate. Patient investors may wait for a better entry.',
    chipClass: 'bg-blue-50 text-blue-700 border-blue-200',
    headingClass: 'text-blue-600',
  }
  if (upsidePct >= -0.25) return {
    chip: 'AVOID', heading: 'Overvalued',
    description: `Trading ${absPct}% above fair value — limited margin of safety at current levels.`,
    chipClass: 'bg-red-50 text-red-600 border-red-200',
    headingClass: 'text-red-600',
  }
  return {
    chip: 'AVOID', heading: 'Overvalued',
    description: `Trading ${absPct}% above our estimate. High execution risk embedded in the price.`,
    chipClass: 'bg-red-50 text-red-700 border-red-200',
    headingClass: 'text-red-700',
  }
}

// ── Shared metric box shell ───────────────────────────────────────────────────

function MetricBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white border border-slate-200 rounded-xl p-4 shadow-sm', className)}>
      {children}
    </div>
  )
}

function BoxLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StockSummaryCard({
  ticker, companyName, sector, industry,
  price, change, changePct, currency,
  high52, low52,
  fairValue, upsidePct, scenarios,
  onViewDetails,
}: StockSummaryCardProps) {
  const isUp = change >= 0
  const verdict = deriveVerdict(upsidePct, fairValue)

  // 52-week range position
  const rangeSpan = high52 - low52
  const pricePct52 = rangeSpan > 0
    ? Math.max(2, Math.min(98, ((price - low52) / rangeSpan) * 100))
    : 50

  return (
    <div className="space-y-3">

      {/* ── Company identity strip ── */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white font-black text-[13px]">
          {companyName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[14px] text-slate-900 leading-tight">{companyName}</span>
          <span className="text-[11px] text-slate-400 font-medium">{ticker}</span>
          {(sector || industry) && (
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              · {[sector, industry].filter(Boolean).join(' / ')}
            </span>
          )}
        </div>
      </div>

      {/* ── 4 metric boxes ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 items-start">

        {/* Box 1: Current Price */}
        <MetricBox>
          <BoxLabel>Current Price</BoxLabel>
          <p className="text-[26px] font-bold tabular-nums text-slate-900 leading-none mb-1">
            {fmtPrice(price, currency)}
          </p>
          <p className={cn('text-[12px] font-semibold tabular-nums', isUp ? 'text-emerald-600' : 'text-red-600')}>
            {isUp ? '+' : ''}{fmtPrice(change, currency)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
          </p>
          <p className="text-[11px] text-slate-400 mb-3">today</p>

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
        </MetricBox>

        {/* Box 2: Fair Value */}
        <MetricBox>
          <BoxLabel>Fair Value (Intrinsic)</BoxLabel>
          {fairValue != null ? (
            <>
              <p className="text-[26px] font-bold tabular-nums text-slate-900 leading-none mb-1">
                {fmtPrice(fairValue, currency)}
              </p>
              {upsidePct != null && (
                <p className={cn('text-[12px] font-semibold tabular-nums mb-1', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {fmtPct(upsidePct)} {upsidePct >= 0 ? 'upside' : 'downside'}
                </p>
              )}
              <p className="text-[11px] text-slate-400 mb-3">Based on blended DCF + multiples</p>

              {scenarios && (
                <>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Scenario Range</p>
                  <div className="flex items-center gap-1">
                    <div className="text-center flex-1">
                      <p className="text-[8px] text-slate-400">Bear</p>
                      <p className="text-[10px] font-semibold text-red-500 tabular-nums">{fmtPrice(scenarios.bear.fairValue, currency)}</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-[8px] text-slate-400">Base</p>
                      <p className="text-[11px] font-bold text-slate-700 tabular-nums">{fmtPrice(scenarios.base.fairValue, currency)}</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-[8px] text-slate-400">Bull</p>
                      <p className="text-[10px] font-semibold text-emerald-600 tabular-nums">{fmtPrice(scenarios.bull.fairValue, currency)}</p>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-1">—</p>
          )}
        </MetricBox>

        {/* Box 3: Investment Verdict */}
        <MetricBox>
          <BoxLabel>Investment Verdict</BoxLabel>
          <span className={cn('inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full border mb-2', verdict.chipClass)}>
            {verdict.chip}
          </span>
          <p className={cn('text-[18px] font-bold leading-tight mb-2', verdict.headingClass)}>
            {verdict.heading}
          </p>
          <p className="text-[12px] text-slate-500 leading-relaxed mb-3">
            {verdict.description}
          </p>
          <button
            onClick={onViewDetails}
            className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            Why? →
          </button>
        </MetricBox>

      </div>
    </div>
  )
}
