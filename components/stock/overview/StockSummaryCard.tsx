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
  confidenceLabel?: 'High' | 'Medium' | 'Low' | null
  scenarios: {
    bear: { fairValue: number }
    base: { fairValue: number }
    bull: { fairValue: number }
  } | null
  onViewDetails: () => void
}

function deriveVerdict(upsidePct: number | null, fv: number | null) {
  const absPct = upsidePct != null ? Math.abs(upsidePct * 100).toFixed(0) : '?'
  if (upsidePct == null || fv == null) return {
    chip: '—', heading: 'Insufficient Data',
    description: 'We could not compute an intrinsic value estimate.',
    chipClass: 'bg-slate-100 text-slate-500 border-slate-200',
    headingClass: 'text-slate-500',
  }
  if (upsidePct > 0.15) return {
    chip: 'BUY', heading: 'Undervalued',
    description: `Price is ${absPct}% below our fair value estimate.`,
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    headingClass: 'text-emerald-600',
  }
  if (upsidePct >= -0.15) return {
    chip: 'WATCH', heading: 'Fairly Valued',
    description: `Trading within ±15% of our estimate — reasonable entry.`,
    chipClass: 'bg-blue-50 text-blue-700 border-blue-200',
    headingClass: 'text-blue-600',
  }
  return {
    chip: 'AVOID', heading: 'Overvalued',
    description: `Price is ${absPct}% above our fair value estimate.`,
    chipClass: 'bg-red-50 text-red-600 border-red-200',
    headingClass: 'text-red-600',
  }
}

function confidenceDot(label: 'High' | 'Medium' | 'Low') {
  if (label === 'High')   return { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' }
  if (label === 'Medium') return { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200'   }
  return                         { dot: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50 border-red-200'       }
}


function zoneLabel(ratio: number): string {
  if (ratio <= 0.70) return 'Deep Value'
  if (ratio <= 0.90) return 'Undervalued'
  if (ratio <= 1.10) return 'Fair Value'
  if (ratio <= 1.40) return 'Premium'
  if (ratio <= 2.00) return 'Expensive'
  return 'Very Expensive'
}

function MetricBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col', className)}>
      {children}
    </div>
  )
}

function BoxLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{children}</p>
}

export default function StockSummaryCard({
  price, change, changePct, currency,
  high52, low52,
  fairValue, upsidePct, confidenceLabel, scenarios,
  onViewDetails,
}: StockSummaryCardProps) {
  const isUp = change >= 0
  const verdict = deriveVerdict(upsidePct, fairValue)
  const conf = confidenceLabel ? confidenceDot(confidenceLabel) : null

  // 52-week range position
  const rangeSpan = high52 - low52
  const pricePct52 = rangeSpan > 0
    ? Math.max(2, Math.min(98, ((price - high52 > 0 ? high52 : price < low52 ? low52 : price) - low52) / rangeSpan * 100))
    : 50

  // Price vs FV ratio
  const ratio = fairValue != null && fairValue > 0 ? price / fairValue : null
  const ratioZoneLabel = ratio != null ? zoneLabel(ratio) : null
  const SCALE_MAX = 2.5
  const dotPct  = ratio != null ? Math.max(1, Math.min(99, (ratio / SCALE_MAX) * 100)) : 50
  const fvLinePct = (1.0 / SCALE_MAX) * 100  // always 40%
  const ratioIsAbove = ratio != null && ratio > 1
  const ratioChipClass = ratioIsAbove
    ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-emerald-600 bg-emerald-50 border-emerald-200'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-start">

      {/* ── Card 1: Current Price ── */}
      <MetricBox>
        <BoxLabel>Current Price</BoxLabel>
        <p className="text-[24px] font-bold tabular-nums text-slate-900 leading-none mb-1">
          {fmtPrice(price, currency)}
        </p>
        <p className={cn('text-[12px] font-semibold tabular-nums', isUp ? 'text-emerald-600' : 'text-red-600')}>
          {isUp ? '+' : ''}{fmtPrice(change, currency)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
        </p>
        <p className="text-[10px] text-slate-400 mb-3">today</p>

        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">52-Week Range</p>
        <div className="relative h-1.5 rounded-full overflow-hidden bg-slate-100">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-[1.5px] border-slate-700 shadow-sm"
            style={{ left: `calc(${pricePct52}% - 5px)` }}
          />
        </div>
        <div className="flex justify-between mt-1 mb-3">
          <span className="text-[9px] text-slate-400 tabular-nums">{fmtPrice(low52, currency)}</span>
          <span className="text-[9px] text-slate-400 tabular-nums">{fmtPrice(high52, currency)}</span>
        </div>
        <button onClick={onViewDetails} className="mt-auto text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          Key Snapshot →
        </button>
      </MetricBox>

      {/* ── Card 2: Intrinsic Value ── */}
      <MetricBox>
        <BoxLabel>Intrinsic Value (Preliminary)</BoxLabel>
        {fairValue != null ? (
          <>
            <p className="text-[24px] font-bold tabular-nums text-slate-900 leading-none mb-1">
              {fmtPrice(fairValue, currency)}
            </p>
            {upsidePct != null && (
              <p className={cn('text-[12px] font-semibold tabular-nums mb-1', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {upsidePct >= 0 ? '' : ''}{fmtPct(upsidePct)} {upsidePct >= 0 ? 'upside' : 'downside'}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mb-3">Blended DCF + multiples</p>

            {scenarios && (
              <>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Fair Value Range</p>
                <div className="relative h-1.5 rounded-full bg-slate-100 overflow-hidden mb-1">
                  {(() => {
                    const lo = scenarios.bear.fairValue
                    const hi = scenarios.bull.fairValue
                    const span = hi - lo
                    const basePct = span > 0 ? Math.max(2, Math.min(98, ((scenarios.base.fairValue - lo) / span) * 100)) : 50
                    return <>
                      <div className="absolute inset-0 bg-gradient-to-r from-red-200 via-blue-300 to-emerald-300" />
                      <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-600 border border-white shadow-sm" style={{ left: `calc(${basePct}% - 4px)` }} />
                    </>
                  })()}
                </div>
                <div className="flex justify-between mb-3">
                  <span className="text-[9px] text-red-400 tabular-nums">{fmtPrice(scenarios.bear.fairValue, currency)}</span>
                  <span className="text-[9px] text-emerald-500 tabular-nums">{fmtPrice(scenarios.bull.fairValue, currency)}</span>
                </div>
              </>
            )}
            <button onClick={onViewDetails} className="mt-auto text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              View valuation →
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-400 mt-1">—</p>
        )}
      </MetricBox>

      {/* ── Card 3: Verdict ── */}
      <MetricBox>
        <div className="flex items-start justify-between gap-2 mb-2">
          <BoxLabel>Verdict (Preliminary)</BoxLabel>
          {conf && confidenceLabel && (
            <span className={cn('flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0', conf.bg, conf.text)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', conf.dot)} />
              {confidenceLabel}
            </span>
          )}
        </div>
        <span className={cn('inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full border mb-2', verdict.chipClass)}>
          {verdict.chip}
        </span>
        <p className={cn('text-[20px] font-bold leading-tight mb-2', verdict.headingClass)}>
          {verdict.heading}
        </p>
        <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
          {verdict.description}
        </p>
        {upsidePct != null && (
          <div className="flex items-center gap-3 mb-3">
            <div>
              <p className="text-[9px] text-slate-400 mb-0.5">Margin of Safety</p>
              <p className={cn('text-[13px] font-bold tabular-nums', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        )}
        <button onClick={onViewDetails} className="mt-auto text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          See why →
        </button>
      </MetricBox>

      {/* ── Card 4: Price vs Fair Value ── */}
      <MetricBox>
        <BoxLabel>Price vs Fair Value</BoxLabel>
        {ratio != null ? (
          <>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[28px] font-extrabold tabular-nums text-slate-900 leading-none">{ratio.toFixed(2)}×</span>
              <span className="text-[11px] text-slate-400">Price / Intrinsic</span>
            </div>
            <span className={cn('inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full border mb-3', ratioChipClass)}>
              {ratioZoneLabel}
            </span>

            {/* Mini zone bar */}
            <div className="relative h-2 rounded-full overflow-hidden flex mb-0.5">
              <div className="bg-emerald-500 h-full" style={{ width: '28%' }} />
              <div className="bg-emerald-400 h-full" style={{ width: '8%' }} />
              <div className="bg-blue-400 h-full" style={{ width: '8%' }} />
              <div className="bg-amber-400 h-full" style={{ width: '12%' }} />
              <div className="bg-red-400 h-full flex-1" />
            </div>
            <div className="relative h-2 -mt-2 pointer-events-none mb-1">
              <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10" style={{ left: `${fvLinePct}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-900 border-2 border-white shadow z-20" style={{ left: `calc(${dotPct}% - 6px)` }} />
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-[9px] text-slate-400">0×</span>
              <span className="text-[9px] text-blue-500">1× FV</span>
              <span className="text-[9px] text-slate-400">2.5×</span>
            </div>

            {upsidePct != null && (
              <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                {ratioIsAbove
                  ? `At ${ratio.toFixed(2)}×, price is ${Math.abs(upsidePct * 100).toFixed(0)}% above our estimate.`
                  : `At ${ratio.toFixed(2)}×, price is ${Math.abs(upsidePct * 100).toFixed(0)}% below our estimate.`}
              </p>
            )}
            <button onClick={onViewDetails} className="mt-auto text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Detailed view →
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-400 mt-1">—</p>
        )}
      </MetricBox>

    </div>
  )
}
