'use client'

import { fmtPrice } from '@/lib/formatters'
import type { CockpitOutput, CockpitMethodResult } from '@/lib/valuation/cockpit'

interface Props {
  output: CockpitOutput
  currentPrice: number
  currency: string
  ticker: string
  onViewFullDCF?: () => void
  onSave?: () => void
}

const VERDICT_COLORS = {
  Undervalued:         { text: 'text-emerald-600', bg: 'bg-[#ECFDF3] border-[#BBF7D0]' },
  'Fairly Valued':     { text: 'text-[#2563EB]',   bg: 'bg-[#EFF6FF] border-[#BFDBFE]' },
  Overvalued:          { text: 'text-red-600',      bg: 'bg-[#FEF2F2] border-[#FECACA]' },
  'Insufficient Data': { text: 'text-[#64748B]',   bg: 'bg-[#F8FAFC] border-[#E2E8F0]' },
}

const DIVERGENCE_STYLE = {
  low:      { text: 'text-emerald-600', bg: 'bg-[#ECFDF3] border-[#BBF7D0]', label: 'Low divergence'      },
  moderate: { text: 'text-[#D97706]',   bg: 'bg-[#FFFBEB] border-[#FDE68A]', label: 'Moderate divergence' },
  high:     { text: 'text-red-600',     bg: 'bg-[#FEF2F2] border-[#FECACA]', label: 'High divergence'     },
}

const METHOD_FILLS = ['#3B82F6', '#6366F1', '#8B5CF6', '#A855F7']

function Divider() {
  return <div className="border-t border-[#F1F5F9]" />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-[650] text-[#64748B] mb-2.5">{children}</p>
}

function RangeBar({
  methods, blendedFairValue, currentPrice, currency,
}: {
  methods: CockpitMethodResult[]
  blendedFairValue: number | null
  currentPrice: number
  currency: string
}) {
  const valid = methods.filter(m => m.fairValue != null && m.fairValue > 0)
  if (valid.length < 2) return null

  const vals  = valid.map(m => m.fairValue!)
  const min   = Math.min(...vals)
  const max   = Math.max(...vals)
  const range = max - min

  const blendedPct = blendedFairValue != null && range > 0
    ? Math.max(3, Math.min(97, ((blendedFairValue - min) / range) * 100)) : null
  const currentPct = range > 0
    ? Math.max(1, Math.min(99, ((currentPrice - min) / range) * 100)) : null

  return (
    <div>
      <div className="flex justify-between text-[11px] text-[#64748B] mb-1.5 tabular-nums">
        <span>{fmtPrice(min, currency)}</span>
        <span>{fmtPrice(max, currency)}</span>
      </div>
      <div className="relative h-3 bg-[#F1F5F9] rounded-full">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-400/40 via-amber-300/40 to-emerald-400/40" />
        {currentPct != null && (
          <div
            className="absolute top-0 h-full w-[2px] bg-[#94A3B8] rounded-full"
            style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
          />
        )}
        {blendedPct != null && (
          <div
            className="absolute w-4 h-4 bg-white rounded-full shadow-md border-2 border-[#2563EB]"
            style={{ left: `${blendedPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
          />
        )}
      </div>
      <p className="text-[11px] text-[#64748B] mt-1 tabular-nums">
        Current {fmtPrice(currentPrice, currency)}
      </p>
    </div>
  )
}

function WeightBars({ methods }: { methods: CockpitMethodResult[] }) {
  const validTotal = methods
    .filter(m => m.fairValue != null && m.fairValue > 0)
    .reduce((s, m) => s + m.weight, 0)

  return (
    <div className="flex flex-col gap-2.5">
      {methods.map((m, i) => {
        const isAvail = m.fairValue != null && m.fairValue > 0
        const effectivePct = isAvail && validTotal > 0 ? (m.weight / validTotal) * 100 : 0
        return (
          <div key={m.id} className="flex items-center gap-2.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: isAvail ? METHOD_FILLS[i] : '#E2E8F0' }}
            />
            <span className={`text-[11px] flex-1 truncate ${isAvail ? 'text-[#475569]' : 'text-[#CBD5E1]'}`}>
              {m.method}
            </span>
            <div className="w-20 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden shrink-0">
              {isAvail && (
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${effectivePct}%`, background: METHOD_FILLS[i] }}
                />
              )}
            </div>
            <span className={`text-[11px] w-7 text-right tabular-nums shrink-0 ${isAvail ? 'text-[#64748B]' : 'text-[#CBD5E1]'}`}>
              {isAvail ? `${Math.round(effectivePct)}%` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function RightSidebar({
  output, currentPrice, currency, ticker: _ticker, onViewFullDCF, onSave,
}: Props) {
  const vc  = VERDICT_COLORS[output.verdict]
  const ds  = DIVERGENCE_STYLE[output.divergence.level]
  const validCount = output.methods.filter(m => m.fairValue != null && m.fairValue > 0).length
  const convictionLabel =
    output.divergence.overallConfidence === 'high'   ? 'High conviction'   :
    output.divergence.overallConfidence === 'medium' ? 'Medium conviction' : 'Low conviction'

  return (
    <div
      className="rounded-[18px] border border-[#E6ECF5] bg-white flex flex-col gap-4 sticky top-4"
      style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.04)' }}
    >
      <div className="px-5 pt-5 pb-0">
        <SectionLabel>Model Summary</SectionLabel>

        <span className={`inline-flex text-[13px] font-[700] tracking-wide px-4 py-1.5 rounded-full border mb-2 ${vc.bg} ${vc.text}`}>
          {output.verdict}
        </span>

        <p className="text-[11px] text-[#94A3B8] mt-1">
          {convictionLabel} · {validCount} of {output.methods.length} models
        </p>
      </div>

      <div className="px-5"><Divider /></div>

      <div className="px-5">
        <div className="flex items-center gap-2">
          <SectionLabel>Model Divergence</SectionLabel>
          <span className={`text-[11px] font-[650] px-2 py-0.5 rounded-full border -mt-2.5 ${ds.bg} ${ds.text}`}>
            {ds.label}
          </span>
        </div>
      </div>

      <div className="px-5"><Divider /></div>

      <div className="px-5">
        <SectionLabel>Model Range</SectionLabel>
        <RangeBar
          methods={output.methods}
          blendedFairValue={output.blendedFairValue}
          currentPrice={currentPrice}
          currency={currency}
        />
      </div>

      <div className="px-5"><Divider /></div>

      <div className="px-5">
        <SectionLabel>Effective Blend Weights</SectionLabel>
        <WeightBars methods={output.methods} />
      </div>

      {onSave && (
        <div className="px-5">
          <button
            onClick={onSave}
            className="w-full rounded-[10px] text-white text-[13px] font-[650] py-2.5 px-4 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: '#2563EB', boxShadow: '0 2px 12px rgba(37,99,235,0.25)' }}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
            Save to Watchlist
          </button>
        </div>
      )}

      {onViewFullDCF && (
        <div className="px-5">
          <button
            onClick={onViewFullDCF}
            className="w-full rounded-[10px] border border-[#E6ECF5] bg-white hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A] text-[13px] font-[650] py-2.5 px-4 transition-colors flex items-center justify-center gap-2"
          >
            View Year-by-Year DCF
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      )}

      <div className="px-5 pb-5">
        <p className="text-[11px] text-[#94A3B8] leading-relaxed pt-3 border-t border-[#F1F5F9]">
          Blended estimate from {output.methods.filter(m => m.fairValue != null && m.fairValue > 0).map(m => m.method).join(', ')}. Not investment advice.
        </p>
      </div>
    </div>
  )
}
