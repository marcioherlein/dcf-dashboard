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
  currency: string
  drivers: string[]
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

  if (upsidePct != null && upsidePct > 0.15 && confidence === 'High') {
    title = 'appears meaningfully undervalued with high confidence.'
    body =
      'The market is pricing in pessimism despite the underlying fundamentals. Our models show strong upside.'
    bgColor = '#ECFDF3'
    borderColor = '#BBF7D0'
  } else if (upsidePct != null && upsidePct > 0.05) {
    title = 'appears modestly undervalued.'
    body = 'The models suggest moderate upside. Confidence is affected by model spread.'
    bgColor = '#ECFDF3'
    borderColor = '#BBF7D0'
  } else if (upsidePct != null && upsidePct >= -0.10) {
    title = 'appears fairly priced.'
    body = 'Current price is near our intrinsic estimate. Limited margin of safety at these levels.'
    bgColor = '#EFF6FF'
    borderColor = '#BFDBFE'
  } else if (upsidePct != null && upsidePct < -0.10) {
    title = 'appears overvalued.'
    body =
      'Current price exceeds our intrinsic estimate. The risk/reward is unfavorable at today\'s price.'
    bgColor = '#FEF2F2'
    borderColor = '#FECACA'
  } else {
    title = 'Insufficient data.'
    body =
      'Fair value estimate is unavailable. Check back when more financial data is accessible.'
    bgColor = '#F1F5F9'
    borderColor = '#E2E8F0'
  }

  // Enhance body based on reverse DCF
  if (rdcfInterp === 'aggressive' || rdcfInterp === 'very_aggressive') {
    body += ' The market is pricing in aggressive growth expectations.'
  } else if (rdcfInterp === 'conservative') {
    body += ' The market is pricing in contraction despite positive fundamentals.'
  } else if (rdcfInterp === 'reasonable') {
    body += ' Market growth expectations appear reasonable.'
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

const POSITIVE_RE =
  /strong|grow|profit|margin|cash\s*gen|moat|leader|dominan|innovat|compet.*advan|pric.*power|market.*share|expand|increas|high.*return|quality|best.in.class|track.record|breadth|diversif|solid|robust|effici|resilient|premium/i

export default function MarketInterpretationCard({
  upsidePct,
  confidence,
  reverseDCFInterpretation,
  reverseDCFText,
  analystRecommendation,
  analystTargetMean,
  currency,
  drivers,
}: MarketInterpretationCardProps) {
  const interp = buildInterpretation(upsidePct, confidence, reverseDCFInterpretation)

  const positiveDrivers = drivers.filter((d) => POSITIVE_RE.test(d)).slice(0, 5)
  const showDrivers = positiveDrivers.length >= 2

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
        <p className="text-[12.5px] font-[700] text-[#0F172A] leading-snug">
          The stock {interp.title}
        </p>
        <p className="text-[12px] text-[#334155] leading-relaxed">{interp.body}</p>
        {showRdcfNote && (
          <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed italic">
            {reverseDCFText}
          </p>
        )}
      </div>

      {/* Key Drivers */}
      {showDrivers && (
        <div>
          <p className="text-[10px] font-[700] uppercase tracking-widest text-[#94A3B8] mb-1.5">
            Key Drivers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {positiveDrivers.map((driver, i) => (
              <span
                key={i}
                className="bg-[#F1F5F9] border border-[#E2E8F0] rounded-full px-[9px] py-[6px] text-[11px] font-[600] text-[#334155]"
              >
                {driver}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Analyst consensus */}
      {showAnalyst && (
        <div className="flex items-center justify-between gap-2 border-t border-[#E6ECF5] pt-3 mt-1">
          <div>
            <p className="text-[10px] font-[700] uppercase tracking-widest text-[#94A3B8] mb-0.5">
              Analyst Consensus
            </p>
            <p className={cn('text-[13px] font-[700]', recColor)}>{recLabel}</p>
          </div>
          {analystTargetMean != null && analystTargetMean > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-[700] uppercase tracking-widest text-[#94A3B8] mb-0.5">
                Target Price
              </p>
              <p className="text-[13px] font-[700] text-[#0F172A] tabular-nums">
                {fmtPrice(analystTargetMean, currency)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
