'use client'

import { cn } from '@/lib/utils'
import { fmtPrice } from '@/lib/formatters'

const CARD =
  'bg-white border border-[#E6ECF5] rounded-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]'

interface MarketInterpretationCardProps {
  upsidePct: number | null
  confidence: 'High' | 'Medium' | 'Low' | null
  reverseDCFInterpretation:
    | 'conservative'
    | 'reasonable'
    | 'aggressive'
    | 'very_aggressive'
    | 'not_meaningful'
    | null
  reverseDCFText: string | null
  analystRecommendation: string
  analystTargetMean: number | null
  analystTargetLow?: number | null
  analystTargetHigh?: number | null
  currentPrice?: number | null
  currency: string
}

interface InterpBox {
  title: string
  body: string
  bgColor: string
  borderColor: string
}

function buildInterpretation(
  upsidePct: number | null,
  confidence: string | null,
  rdcfInterp: string | null,
): InterpBox {
  let title: string
  let body: string
  let bgColor: string
  let borderColor: string

  // Lead with reverse DCF when available — it's more informative than echoing the verdict
  if (rdcfInterp === 'very_aggressive') {
    title = 'Market pricing in exceptional growth'
    body = 'The current price implies growth that few companies sustain over the long run. Even modest execution shortfalls could prompt significant repricing.'
    bgColor = '#FEF2F2'
    borderColor = '#FECACA'
  } else if (rdcfInterp === 'aggressive') {
    title = 'Market pricing in strong growth'
    body = 'Implied growth expectations are elevated. The price leaves limited room for error — misses on revenue or margin could weigh heavily.'
    bgColor = '#FFFBEB'
    borderColor = '#FDE68A'
  } else if (rdcfInterp === 'reasonable') {
    title = 'Market expectations appear reasonable'
    body = 'Implied growth is consistent with historical trends. The price does not demand heroic assumptions, which supports a more stable risk profile.'
    bgColor = '#EFF6FF'
    borderColor = '#BFDBFE'
  } else if (rdcfInterp === 'conservative') {
    title = 'Market pricing in subdued growth'
    body = 'Implied growth expectations are modest or contractionary — the bar for positive surprise is low. If fundamentals hold, the market may be underestimating the business.'
    bgColor = '#ECFDF3'
    borderColor = '#BBF7D0'
  } else if (upsidePct != null && upsidePct > 0.15 && confidence === 'High') {
    title = 'Models suggest market is underweighting cash flow'
    body = 'Our models show significant upside with high confidence. Current assumptions may not reflect the business\'s earning power relative to its price.'
    bgColor = '#ECFDF3'
    borderColor = '#BBF7D0'
  } else if (upsidePct != null && upsidePct > 0.05) {
    title = 'Models suggest moderate underpricing'
    body = 'Estimated intrinsic value exceeds the current price. Model spread is moderate, so treat this as a range rather than a point estimate.'
    bgColor = '#ECFDF3'
    borderColor = '#BBF7D0'
  } else if (upsidePct != null && upsidePct >= -0.10) {
    title = 'Price and intrinsic value are aligned'
    body = 'The market appears to be pricing in a reasonable long-term path. Limited upside or downside from here based on current model inputs.'
    bgColor = '#EFF6FF'
    borderColor = '#BFDBFE'
  } else if (upsidePct != null && upsidePct < -0.10) {
    title = 'Models suggest market is pricing in strong fundamentals'
    body = 'The current price exceeds our intrinsic estimate. Either the business is improving faster than models reflect, or valuation risk is elevated.'
    bgColor = '#FEF2F2'
    borderColor = '#FECACA'
  } else {
    title = 'Insufficient model data'
    body = 'Fair value estimate is unavailable. Check back when more financial data is accessible.'
    bgColor = '#F1F5F9'
    borderColor = '#E2E8F0'
  }

  return { title, body, bgColor, borderColor }
}

function normalizeRec(raw: string): { label: string; color: string } {
  const r = raw.toLowerCase()
  if (r.includes('strong buy') || r.includes('outperform') || r.includes('overweight'))
    return { label: 'Strong Buy', color: 'text-[#16A34A]' }
  if (r.includes('buy')) return { label: 'Buy', color: 'text-[#16A34A]' }
  if (r.includes('hold') || r.includes('neutral') || r.includes('market perform'))
    return { label: 'Hold', color: 'text-[#D97706]' }
  if (r.includes('sell') || r.includes('underperform') || r.includes('underweight'))
    return { label: 'Sell', color: 'text-[#DC2626]' }
  return { label: raw, color: 'text-[#64748B]' }
}

export default function MarketInterpretationCard({
  upsidePct,
  confidence,
  reverseDCFInterpretation,
  reverseDCFText,
  analystRecommendation,
  analystTargetMean,
  analystTargetLow,
  analystTargetHigh,
  currentPrice,
  currency,
}: MarketInterpretationCardProps) {
  const interp = buildInterpretation(upsidePct, confidence, reverseDCFInterpretation)

  const { label: recLabel, color: recColor } = normalizeRec(analystRecommendation)
  const showAnalyst = analystRecommendation.trim().length > 0

  // Suppress reverseDCFText if it's the same content already embedded in body
  const showRdcfNote =
    reverseDCFText != null &&
    reverseDCFText.trim().length > 0 &&
    reverseDCFInterpretation === 'not_meaningful'

  return (
    <div className={cn(CARD, 'p-4 flex flex-col gap-3')}>
      {/* Header */}
      <p className="text-[13px] font-[700] text-[#0F172A]">Market Interpretation</p>

      {/* Interpretation box */}
      <div
        className="rounded-[12px] px-3.5 py-3 flex flex-col gap-1"
        style={{
          background: interp.bgColor,
          border: `1px solid ${interp.borderColor}`,
        }}
      >
        <p className="text-[13px] font-[700] text-[#0F172A] leading-snug">
          {interp.title}
        </p>
        <p className="text-[12px] text-[#334155] leading-relaxed">{interp.body}</p>
        {showRdcfNote && (
          <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed italic">
            {reverseDCFText}
          </p>
        )}
      </div>

      {/* Analyst consensus */}
      {showAnalyst && (
        <div className="flex flex-col gap-2 border-t border-[#E6ECF5] pt-3 mt-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-[600] text-[#64748B] mb-0.5">
                Analyst consensus
              </p>
              <p className={cn('text-[13px] font-[700]', recColor)}>{recLabel}</p>
            </div>
            {analystTargetMean != null && analystTargetMean > 0 && (
              <div className="text-right">
                <p className="text-[11px] font-[600] text-[#64748B] mb-0.5">
                  Target price
                </p>
                <p className="text-[13px] font-[700] text-[#0F172A] tabular-nums">
                  {fmtPrice(analystTargetMean, currency)}
                </p>
              </div>
            )}
          </div>

          {/* Price target range bar */}
          {analystTargetLow != null && analystTargetHigh != null && analystTargetMean != null &&
           currentPrice != null && currentPrice > 0 && analystTargetHigh > analystTargetLow && (
            (() => {
              const lo = Math.min(analystTargetLow, currentPrice * 0.85)
              const hi = Math.max(analystTargetHigh, currentPrice * 1.15)
              const span = hi - lo
              const pricePct  = ((currentPrice - lo) / span) * 100
              const meanPct   = ((analystTargetMean - lo) / span) * 100
              const lowPct    = ((analystTargetLow  - lo) / span) * 100
              const highPct   = ((analystTargetHigh - lo) / span) * 100
              const upside    = (analystTargetMean - currentPrice) / currentPrice
              const upsideStr = `${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(1)}%`

              return (
                <div className="mt-1">
                  {/* Bar */}
                  <div className="relative h-4 rounded-full bg-slate-100 overflow-visible">
                    {/* Range band (low to high target) */}
                    <div
                      className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-slate-200 to-emerald-200"
                      style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
                    />
                    {/* Current price marker */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-700 border-2 border-white shadow-sm z-10"
                      style={{ left: `${Math.max(0, Math.min(97, pricePct))}%`, marginLeft: '-6px' }}
                      title={`Current: ${fmtPrice(currentPrice, currency)}`}
                    />
                    {/* Mean target marker */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm z-10"
                      style={{ left: `${Math.max(3, Math.min(97, meanPct))}%`, marginLeft: '-6px' }}
                      title={`Mean target: ${fmtPrice(analystTargetMean, currency)}`}
                    />
                  </div>
                  {/* Labels */}
                  <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400 tabular-nums">
                    <span>{fmtPrice(analystTargetLow, currency)}</span>
                    <span className={`font-semibold ${upside > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      Mean {upsideStr} upside
                    </span>
                    <span>{fmtPrice(analystTargetHigh, currency)}</span>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-white inline-block" />
                      Current
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white inline-block" />
                      Consensus target
                    </span>
                  </div>
                </div>
              )
            })()
          )}
        </div>
      )}
    </div>
  )
}
