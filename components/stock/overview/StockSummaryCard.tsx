'use client'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct } from '@/lib/formatters'
import InfoTooltip from '@/components/ui/InfoTooltip'
import { deriveVerdict, buildVerdictSentence } from '@/lib/stock/verdict'

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

function confidenceDot(label: 'High' | 'Medium' | 'Low') {
  if (label === 'High')   return { dot: 'bg-[#11875D]', text: 'text-[#11875D]', bg: 'bg-[#E8F7EF] border-[#A3D9BE]' }
  if (label === 'Medium') return { dot: 'bg-[#B56A00]', text: 'text-[#B56A00]', bg: 'bg-[#FFF4DA] border-[#F3D391]' }
  return                         { dot: 'bg-[#D83B3B]', text: 'text-[#D83B3B]', bg: 'bg-[#FCEAEA] border-[#F0B8B8]' }
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
    <div className={cn('bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 shadow-card flex flex-col', className)}>
      {children}
    </div>
  )
}

function BoxLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6B6B6B] mb-2 flex items-center gap-0.5">
      {children}
      {tooltip && <InfoTooltip content={tooltip} />}
    </p>
  )
}

function ActionLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-auto min-h-[44px] flex items-end pb-0.5 text-[12px] font-semibold text-olive-700 hover:text-olive-600 transition-colors"
    >
      {children}
    </button>
  )
}

export default function StockSummaryCard({
  price, change, changePct, currency,
  high52, low52,
  fairValue, upsidePct, confidenceLabel, scenarios,
  onViewDetails,
}: StockSummaryCardProps) {
  const isUp = change >= 0
  const verdict = deriveVerdict(upsidePct, fairValue)
  const sentence = buildVerdictSentence(upsidePct)
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
  const dotPct    = ratio != null ? Math.max(1, Math.min(99, (ratio / SCALE_MAX) * 100)) : 50
  const fvLinePct = (1.0 / SCALE_MAX) * 100  // always 40%
  const ratioIsAbove = ratio != null && ratio > 1
  const ratioChipClass = ratioIsAbove
    ? 'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]'
    : 'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

      {/* ── Card 1: Current Price ── */}
      <MetricBox>
        <BoxLabel>Current Price</BoxLabel>
        <p className="text-[28px] sm:text-[24px] font-bold tabular-nums text-ink-900 leading-none mb-1">
          {fmtPrice(price, currency)}
        </p>
        <p className={cn('text-[13px] sm:text-[12px] font-semibold tabular-nums', isUp ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
          {isUp ? '+' : ''}{fmtPrice(change, currency)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
        </p>
        <p className="text-[10px] text-[#6B6B6B] mb-3">today</p>

        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] mb-1.5">52-Week Range</p>
        <div className="relative h-1.5 rounded-full overflow-hidden bg-[#F5F5F5]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#11875D] via-[#B56A00] to-[#D83B3B]" />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-[1.5px] border-ink-900 shadow-sm"
            style={{ left: `calc(${pricePct52}% - 5px)` }}
          />
        </div>
        <div className="flex justify-between mt-1 mb-3">
          <span className="text-[11px] text-[#6B6B6B] tabular-nums">{fmtPrice(low52, currency)}</span>
          <span className="text-[11px] text-[#6B6B6B] tabular-nums">{fmtPrice(high52, currency)}</span>
        </div>
        <ActionLink onClick={onViewDetails}>View valuation →</ActionLink>
      </MetricBox>

      {/* ── Card 2: Intrinsic Value ── */}
      <MetricBox>
        <BoxLabel tooltip="An estimate of what the stock may be worth based on our valuation models and assumptions. May differ from the Valuation tab's full analysis if assumptions have been adjusted.">Intrinsic Value</BoxLabel>
        {fairValue != null ? (
          <>
            <p className="text-[28px] sm:text-[24px] font-bold tabular-nums text-ink-900 leading-none mb-1">
              {fmtPrice(fairValue, currency)}
            </p>
            {upsidePct != null && (
              <p className={cn('text-[12px] font-semibold tabular-nums mb-1', upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                {upsidePct >= 0 ? '+' : ''}{fmtPct(upsidePct)} {upsidePct >= 0 ? 'upside' : 'downside'}
              </p>
            )}
            <p className="text-[10px] text-[#6B6B6B] mb-3">Blended DCF + multiples</p>

            {scenarios && (() => {
              const lo = scenarios.bear.fairValue
              const hi = scenarios.bull.fairValue
              const isInRange = fairValue >= lo * 0.9 && fairValue <= hi * 1.1
              return isInRange ? (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B] mb-1.5">DCF Scenario Range</p>
                  <div className="relative h-1.5 rounded-full bg-[#F5F5F5] overflow-hidden mb-1">
                    {(() => {
                      const span = hi - lo
                      const basePct = span > 0 ? Math.max(2, Math.min(98, ((scenarios.base.fairValue - lo) / span) * 100)) : 50
                      return <>
                        <div className="absolute inset-0 bg-gradient-to-r from-[#FCEAEA] via-[#EAF1FF] to-[#E8F7EF]" />
                        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#2563EB] border border-white shadow-sm" style={{ left: `calc(${basePct}% - 4px)` }} />
                      </>
                    })()}
                  </div>
                  <div className="flex justify-between mb-3">
                    <span className="text-[11px] text-[#D83B3B] tabular-nums">{fmtPrice(scenarios.bear.fairValue, currency)}</span>
                    <span className="text-[11px] text-[#6B6B6B]">bear → bull</span>
                    <span className="text-[11px] text-[#11875D] tabular-nums">{fmtPrice(scenarios.bull.fairValue, currency)}</span>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-[#6B6B6B] mb-3 leading-snug">
                  Scenario range available in Valuation tab.
                </p>
              )
            })()}
            <ActionLink onClick={onViewDetails}>View valuation →</ActionLink>
          </>
        ) : (
          <p className="text-sm text-[#6B6B6B] mt-1">—</p>
        )}
      </MetricBox>

      {/* ── Card 3: Verdict ── */}
      <MetricBox>
        <div className="flex items-start justify-between gap-2 mb-2">
          <BoxLabel tooltip="The model-based conclusion on whether the stock appears undervalued, fairly valued, or overvalued at today's price, based on intrinsic value estimates.">Verdict</BoxLabel>
          {conf && confidenceLabel && (
            <span className={cn('flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0', conf.bg, conf.text)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', conf.dot)} />
              {confidenceLabel} Confidence
            </span>
          )}
        </div>
        <span className={cn('inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full border mb-2', verdict.chipClass)}>
          {verdict.chip}
        </span>
        <p className={cn('text-[22px] sm:text-[20px] font-bold leading-tight mb-2', verdict.headingClass)}>
          {verdict.word}
        </p>
        {sentence && (
          <p className="text-[12px] text-[#6B6B6B] leading-relaxed mb-3">
            {sentence}
          </p>
        )}
        {upsidePct != null && (
          <div className="flex items-center gap-3 mb-3">
            <div>
              <p className="text-[10px] text-[#6B6B6B] mb-0.5 flex items-center gap-0.5">
                Margin of Safety
                <InfoTooltip content="The gap between the current price and our fair value estimate. A positive margin means the stock trades below fair value. Negative means you're paying a premium." />
              </p>
              <p className={cn('text-[13px] font-bold tabular-nums', upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        )}
        <ActionLink onClick={onViewDetails}>View valuation →</ActionLink>
      </MetricBox>

      {/* ── Card 4: Price vs Fair Value ── */}
      <MetricBox>
        <BoxLabel tooltip="Compares the current price to our intrinsic value estimate as a ratio. 1.0× = fairly priced. Above 1.0× = trading at a premium. Below 1.0× = potential discount.">Price vs Fair Value</BoxLabel>
        {ratio != null ? (
          <>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[30px] sm:text-[28px] font-extrabold tabular-nums text-ink-900 leading-none">{ratio.toFixed(2)}×</span>
              <span className="text-[11px] text-[#6B6B6B]">Price / Intrinsic</span>
            </div>
            <span className={cn('inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full border mb-3', ratioChipClass)}>
              {ratioZoneLabel}
            </span>

            {/* Mini zone bar */}
            <div className="relative h-2 rounded-full overflow-hidden flex mb-0.5">
              <div className="bg-[#11875D] h-full" style={{ width: '28%' }} />
              <div className="bg-olive-700 h-full" style={{ width: '8%' }} />
              <div className="bg-[#2563EB] h-full" style={{ width: '8%' }} />
              <div className="bg-[#B56A00] h-full" style={{ width: '12%' }} />
              <div className="bg-[#D83B3B] h-full flex-1" />
            </div>
            <div className="relative h-2 -mt-2 pointer-events-none mb-1">
              <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10" style={{ left: `${fvLinePct}%` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-ink-900 border-2 border-white shadow z-20" style={{ left: `calc(${dotPct}% - 6px)` }} />
            </div>
            <div className="flex justify-between mb-3">
              <span className="text-[10px] text-[#6B6B6B]">0×</span>
              <span className="text-[10px] text-[#2563EB]">1× FV</span>
              <span className="text-[10px] text-[#6B6B6B]">2.5×</span>
            </div>

            {upsidePct != null && (
              <p className="text-[10px] text-[#6B6B6B] leading-relaxed mb-3">
                {ratioIsAbove
                  ? `At ${ratio.toFixed(2)}×, price is ${Math.abs(upsidePct * 100).toFixed(0)}% above our estimate.`
                  : `At ${ratio.toFixed(2)}×, price is ${Math.abs(upsidePct * 100).toFixed(0)}% below our estimate.`}
              </p>
            )}
            <ActionLink onClick={onViewDetails}>View valuation →</ActionLink>
          </>
        ) : (
          <p className="text-sm text-[#6B6B6B] mt-1">—</p>
        )}
      </MetricBox>

    </div>
  )
}
