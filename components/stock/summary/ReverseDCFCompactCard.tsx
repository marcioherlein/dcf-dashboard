'use client'

import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'

const CARD =
  'bg-white border border-[#E6ECF5] rounded-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]'

interface ReverseDCFCompactCardProps {
  price: number
  currency: string
  sharesM: number | null
  cashM: number | null
  debtM: number | null
  revenueM: number | null
  fcfMargin: number | null
  wacc: number
  terminalG: number
  historicalCAGR: number | null
  analystCAGR: number | null
  isEmergingMarket?: boolean
}

const CHIP_STYLES = {
  conservative:    { bg: 'bg-[#ECFDF3]', border: 'border-[#BBF7D0]', text: 'text-[#047857]' },
  reasonable:      { bg: 'bg-[#EFF6FF]', border: 'border-[#BFDBFE]', text: 'text-[#2563EB]' },
  aggressive:      { bg: 'bg-[#FFF7ED]', border: 'border-[#FED7AA]', text: 'text-[#D97706]' },
  very_aggressive: { bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', text: 'text-[#DC2626]' },
  not_meaningful:  { bg: 'bg-[#F1F5F9]', border: 'border-[#E2E8F0]', text: 'text-[#64748B]' },
} as const

const CHIP_LABELS = {
  conservative:    'Conservative',
  reasonable:      'Moderate',
  aggressive:      'Aggressive',
  very_aggressive: 'Very Aggressive',
  not_meaningful:  'N/A',
} as const

type Interpretation = keyof typeof CHIP_STYLES

const CHIP_ORDER: Interpretation[] = ['conservative', 'reasonable', 'aggressive', 'very_aggressive']

const IMPLIED_COLOR: Record<Interpretation, string> = {
  conservative:    'text-[#047857]',
  reasonable:      'text-[#2563EB]',
  aggressive:      'text-[#D97706]',
  very_aggressive: 'text-[#DC2626]',
  not_meaningful:  'text-[#64748B]',
}

export default function ReverseDCFCompactCard({
  price,
  sharesM,
  cashM,
  debtM,
  revenueM,
  fcfMargin,
  wacc,
  terminalG,
  historicalCAGR,
  analystCAGR,
  isEmergingMarket = false,
}: ReverseDCFCompactCardProps) {
  const result = useMemo(
    () =>
      computeReverseDCF({
        currentPrice: price,
        sharesOutstanding: sharesM != null ? sharesM * 1_000_000 : null,
        cashM: cashM ?? null,
        debtM: debtM ?? null,
        lastRevenue: revenueM != null ? revenueM * 1_000_000 : null,
        lastFCFMargin: fcfMargin,
        wacc,
        terminalG,
        historicalCAGR,
      }),
    [price, sharesM, cashM, debtM, revenueM, fcfMargin, wacc, terminalG, historicalCAGR],
  )

  const impliedPct =
    result.impliedCAGR != null ? result.impliedCAGR * 100 : null
  const historicalPct =
    historicalCAGR != null ? historicalCAGR * 100 : null
  const analystPct =
    analystCAGR != null ? analystCAGR * 100 : null

  const allValues = [impliedPct ?? 0, historicalPct ?? 0, analystPct ?? 0]
  const minVal = Math.min(...allValues, 0)
  const maxVal = Math.max(...allValues, 10)
  const range = maxVal - minVal

  function barWidth(val: number): number {
    if (range <= 0) return 0
    return Math.max(0, Math.min(100, ((val - minVal) / range) * 100))
  }

  const interp = result.interpretation as Interpretation
  const showCallout = interp !== 'not_meaningful'

  const zeroLineLeft =
    range > 0 ? Math.max(0, Math.min(100, ((0 - minVal) / range) * 100)) : null

  return (
    <div className={cn(CARD, 'p-4 flex flex-col gap-3')}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-[700] text-[#0F172A] leading-tight">
          What the market is pricing in
        </p>
        <div className="flex items-center gap-1 text-[11px] font-[600] text-[#64748B]">
          <span>Reverse DCF</span>
          <Info className="w-3 h-3" />
        </div>
      </div>

      {/* Expectation chips */}
      <div className="flex flex-wrap gap-1.5">
        {CHIP_ORDER.map((key) => {
          const isActive = interp === key
          const s = CHIP_STYLES[key]
          return (
            <span
              key={key}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] font-[600] border',
                isActive ? cn(s.bg, s.border, s.text) : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]',
              )}
            >
              {CHIP_LABELS[key]}
            </span>
          )
        })}
      </div>

      {/* Content split */}
      <div className="flex gap-4">
        {/* Left */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-[700] uppercase tracking-widest text-[#94A3B8] mb-1">
            Implied 5Y Revenue CAGR
          </p>
          {impliedPct != null ? (
            <p className={cn('text-[28px] font-[800] leading-none tabular-nums', IMPLIED_COLOR[interp])}>
              {impliedPct.toFixed(1)}%
            </p>
          ) : (
            <p className="text-[20px] font-[700] text-[#94A3B8]">—</p>
          )}

          {historicalPct != null && (
            <div className="mt-2.5">
              <p className="text-[10px] font-[700] uppercase tracking-widest text-[#94A3B8] mb-0.5">
                3Y Historical CAGR
              </p>
              <p className="text-[14px] font-[700] text-[#334155] tabular-nums">
                {historicalPct.toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Right — horizontal bars */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Implied */}
          <BarRow
            label="Implied 5Y CAGR"
            value={impliedPct}
            barColor="bg-[#10B981]"
            widthPct={impliedPct != null ? barWidth(impliedPct) : 0}
            zeroLineLeft={minVal < 0 ? zeroLineLeft : null}
          />
          {/* Historical */}
          <BarRow
            label="3Y Historical"
            value={historicalPct}
            barColor="bg-[#3B82F6]"
            widthPct={historicalPct != null ? barWidth(historicalPct) : 0}
            zeroLineLeft={minVal < 0 ? zeroLineLeft : null}
          />
          {/* Analyst */}
          <BarRow
            label="Analyst Est. (1Y)"
            value={analystPct}
            barColor="bg-[#7C3AED]"
            widthPct={analystPct != null ? barWidth(analystPct) : 0}
            zeroLineLeft={minVal < 0 ? zeroLineLeft : null}
          />
        </div>
      </div>

      {/* Negative CAGR note */}
      {impliedPct != null && impliedPct < 0 && (
        <div className="rounded-[8px] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2">
          <p className="text-[11px] font-[650] text-[#DC2626] mb-0.5">
            What does negative implied growth mean?
          </p>
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            The market is pricing this stock as if revenue will shrink over the next 5 years.
          </p>
        </div>
      )}

      {/* Takeaway callout */}
      {showCallout && impliedPct != null && historicalPct != null && (
        <div className="rounded-[10px] bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-2.5">
          <p className="text-[12px] text-[#334155] leading-relaxed">
            The market assumes{' '}
            <strong>{impliedPct.toFixed(1)}%</strong> —{' '}
            {Math.abs(impliedPct - historicalPct).toFixed(1)}pp{' '}
            {impliedPct > historicalPct ? 'above' : 'below'} the 3-year historical
            track record of {historicalPct.toFixed(1)}%.
          </p>
        </div>
      )}

      {showCallout && (impliedPct == null || historicalPct == null) && (
        <div className="rounded-[10px] bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2.5">
          <p className="text-[12px] text-[#64748B] leading-relaxed">
            {result.interpretationText}
          </p>
        </div>
      )}

      {!showCallout && (
        <div className="rounded-[10px] bg-[#F1F5F9] border border-[#E2E8F0] px-3 py-2.5">
          <p className="text-[12px] text-[#64748B] leading-relaxed">
            {result.interpretationText}
          </p>
        </div>
      )}

      {/* Emerging market note */}
      {isEmergingMarket && (
        <p className="text-[10px] text-[#D97706] mt-1">
          ⚠ Emerging market — interpret CAGR benchmark with caution.
        </p>
      )}
    </div>
  )
}

interface BarRowProps {
  label: string
  value: number | null
  barColor: string
  widthPct: number
  zeroLineLeft: number | null
}

function BarRow({ label, value, barColor, widthPct, zeroLineLeft }: BarRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-[#64748B] truncate">{label}</span>
        <span className="text-[10px] font-[700] text-[#334155] tabular-nums ml-1 shrink-0">
          {value != null ? `${value.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="relative h-2 bg-[#EEF2F7] rounded-full w-full overflow-hidden">
        {value != null && (
          <div
            className={cn('h-full rounded-full', barColor)}
            style={{ width: `${widthPct}%` }}
          />
        )}
        {zeroLineLeft != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-[#94A3B8]/60"
            style={{ left: `${zeroLineLeft}%` }}
          />
        )}
      </div>
    </div>
  )
}
