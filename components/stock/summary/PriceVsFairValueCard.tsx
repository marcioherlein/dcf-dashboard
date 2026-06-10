'use client'

import { cn } from '@/lib/utils'
import { fmtPrice } from '@/lib/formatters'

const CARD =
  'bg-white border border-[#E5E5E5] rounded-xl shadow-card'

interface PriceVsFairValueCardProps {
  price: number
  fairValue: number | null
  upsidePct: number | null
  currency: string
  analystTargetMean: number | null
}

const SCALE_MAX = 2.5

function zoneLabel(r: number): { label: string; chip: string } {
  if (r <= 0.70) return { label: 'Deep Value',    chip: 'bg-[#ECFDF3] text-[#047857] border-[#BBF7D0]' }
  if (r <= 0.90) return { label: 'Undervalued',   chip: 'bg-[#ECFDF3] text-[#047857] border-[#BBF7D0]' }
  if (r <= 1.10) return { label: 'Fair Value',    chip: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]' }
  if (r <= 1.40) return { label: 'Premium',       chip: 'bg-[#FFF7ED] text-[#D97706] border-[#FED7AA]' }
  if (r <= 2.00) return { label: 'Expensive',     chip: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]' }
  return               { label: 'Very Expensive', chip: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]' }
}

function buildInterpText(ratio: number, upsidePct: number | null): string {
  if (ratio < 1) {
    const discountFromFV = ((1 - ratio) * 100).toFixed(0)
    const upsideStr =
      upsidePct != null
        ? `, implying ${(Math.abs(upsidePct) * 100).toFixed(0)}% upside`
        : ''
    return `At ${ratio.toFixed(2)}×, price is ${discountFromFV}% below fair value${upsideStr}.`
  } else {
    const premiumAboveFV = ((ratio - 1) * 100).toFixed(0)
    const downsideStr =
      upsidePct != null
        ? `, implying ${(Math.abs(upsidePct) * 100).toFixed(0)}% downside`
        : ''
    return `At ${ratio.toFixed(2)}×, price is ${premiumAboveFV}% above fair value${downsideStr}.`
  }
}

export default function PriceVsFairValueCard({
  price,
  fairValue,
  upsidePct,
  currency,
  analystTargetMean,
}: PriceVsFairValueCardProps) {
  const ratio =
    fairValue != null && fairValue > 0 ? price / fairValue : null

  const zone = ratio != null ? zoneLabel(ratio) : null
  const interpText = ratio != null ? buildInterpText(ratio, upsidePct) : null

  const markerLeft =
    ratio != null
      ? `calc(${Math.max(1, Math.min(99, (ratio / SCALE_MAX) * 100))}% - 7px)`
      : null

  return (
    <div className={cn(CARD, 'p-4 sm:p-5 flex flex-col gap-3')}>
      {/* Header */}
      <p className="text-[13px] font-[700] text-[#111111] leading-tight">Price vs Fair Value</p>

      {/* Ratio row */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[44px] sm:text-[32px] font-[800] text-[#06101F] leading-none tabular-nums">
          {ratio != null ? `${ratio.toFixed(2)}×` : '—'}
        </span>
        <div>
          <p className="text-[11px] font-[600] text-[#566174] leading-tight">Price / Intrinsic</p>
          {zone != null && (
            <span
              className={cn(
                'inline-block mt-0.5 rounded-full border px-2.5 py-0.5 text-[11px] font-[600]',
                zone.chip,
              )}
            >
              {zone.label}
            </span>
          )}
        </div>
      </div>

      {/* Spectrum bar */}
      <div className="relative mt-1">
        <div
          className="h-3 sm:h-2 rounded-full w-full"
          style={{
            background:
              'linear-gradient(90deg, #10B981 0%, #34D399 25%, #3B82F6 45%, #FBBF24 62%, #F97316 76%, #EF4444 100%)',
          }}
        />
        {/* FV line at 40% (1.0 / 2.5) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/70 rounded-full"
          style={{ left: '40%' }}
        />
        {/* Dot marker */}
        {markerLeft != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 sm:w-3.5 sm:h-3.5 rounded-full bg-[#06101F] border-2 border-white shadow-sm"
            style={{ left: markerLeft }}
          />
        )}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[#566174]">0×</span>
        <span className="text-[10px] text-[#3B82F6] font-[650]">1× Fair</span>
        <span className="text-[10px] text-[#566174]">2.5×</span>
      </div>

      {/* Interpretation sentence */}
      {interpText != null && (
        <p className="text-[12px] text-[#566174] leading-relaxed">{interpText}</p>
      )}

      {ratio == null && (
        <p className="text-[12px] text-[#8A95A6]">
          Fair value estimate unavailable — no interpretation possible.
        </p>
      )}

      {/* Analyst target */}
      {analystTargetMean != null && analystTargetMean > 0 && (
        <p className="text-[12px] text-[#566174]">
          Analyst target:{' '}
          <span className="font-[700] text-[#566174]">
            {fmtPrice(analystTargetMean, currency)}
          </span>
        </p>
      )}
    </div>
  )
}
