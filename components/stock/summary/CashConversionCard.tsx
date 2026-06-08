'use client'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  fcfMargin?: number | null
  ttmCashFlow?: {
    freeCashFlow?: number | null
    operatingCashFlow?: number | null
    netIncome?: number | null
  } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statementsData?: any
}

type Rating = 'A+' | 'A-' | 'B+' | 'B' | 'C'

interface VerdictBullet {
  icon: '✓' | '—' | '✗'
  iconColor: 'green' | 'gray' | 'red'
  text: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}

function fmtMultiple(v: number): string {
  return `${v.toFixed(2)}×`
}

function computeFcfMarginFromStatements(statementsData: unknown): number | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sd = statementsData as any
  if (!sd) return null

  const ttmCF = sd?.ttm?.cashflowStatement ?? sd?.ttm?.cashFlowStatement ?? null
  const ttmIS = sd?.ttm?.incomeStatement ?? null

  const fcf = ttmCF?.freeCashFlow ?? null
  const revenue = ttmIS?.totalRevenue ?? ttmIS?.operatingRevenue ?? null

  if (fcf != null && revenue != null && revenue > 0) {
    return (fcf as number) / (revenue as number)
  }
  return null
}

function getRating(fcfNiRatio: number | null, margin: number | null): Rating {
  if (fcfNiRatio == null) return 'C'

  if (fcfNiRatio > 1.2 && margin != null && margin > 0.20) return 'A+'
  if (fcfNiRatio > 1.0 && margin != null && margin > 0.10) return 'A-'
  if (fcfNiRatio > 0.8) return 'B+'
  if (fcfNiRatio > 0.5) return 'B'
  return 'C'
}

function getBadgeStyle(rating: Rating): string {
  switch (rating) {
    case 'A+':
      return 'bg-[#ECFDF3] text-[#047857] border border-[#BBF7D0]'
    case 'A-':
      return 'bg-[#ECFDF3] text-[#047857] border border-[#BBF7D0]'
    case 'B+':
      return 'bg-[#F7F9EC] text-[#5F790B] border border-[#D6E89B]'
    case 'B':
      return 'bg-[#F7F9EC] text-[#5F790B] border border-[#D6E89B]'
    case 'C':
      return 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
  }
}

function getVerdictBullets(fcfNiRatio: number | null): VerdictBullet[] {
  if (fcfNiRatio == null) {
    return [
      { icon: '—', iconColor: 'gray', text: 'Insufficient data to assess cash conversion.' },
      { icon: '—', iconColor: 'gray', text: 'FCF and net income figures unavailable.' },
    ]
  }

  if (fcfNiRatio > 1) {
    return [
      { icon: '✓', iconColor: 'green', text: 'Consistent cash generation with strong conversion.' },
      { icon: '✓', iconColor: 'green', text: 'FCF comfortably exceeds net income.' },
    ]
  }

  if (fcfNiRatio >= 0.8) {
    return [
      { icon: '✓', iconColor: 'green', text: 'Earnings broadly convert to cash flow.' },
      { icon: '—', iconColor: 'gray', text: 'FCF closely tracks net income.' },
    ]
  }

  return [
    { icon: '✗', iconColor: 'red', text: 'Cash conversion below reported earnings.' },
    { icon: '✗', iconColor: 'red', text: 'Accruals may be inflating net income.' },
  ]
}

const ICON_COLOR_CLASS: Record<VerdictBullet['iconColor'], string> = {
  green: 'text-[#059669]',
  gray:  'text-[#9B9B9B]',
  red:   'text-[#DC2626]',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CashConversionCard({
  fcfMargin: fcfMarginProp,
  ttmCashFlow,
  statementsData,
}: Props) {
  // Resolve FCF margin — prop takes priority, then derive from statementsData
  const resolvedFcfMargin: number | null =
    fcfMarginProp != null
      ? fcfMarginProp
      : computeFcfMarginFromStatements(statementsData)

  // FCF / Net Income ratio
  const fcf       = ttmCashFlow?.freeCashFlow ?? null
  const netIncome = ttmCashFlow?.netIncome ?? null
  const fcfNiRatio: number | null =
    fcf != null && netIncome != null && netIncome !== 0
      ? fcf / netIncome
      : null

  const rating  = getRating(fcfNiRatio, resolvedFcfMargin)
  const bullets = getVerdictBullets(fcfNiRatio)

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-[700] tracking-wide text-[#6B6B6B] uppercase">
          Cash Conversion
        </p>
        <span
          className={cn(
            'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-[700] leading-tight',
            getBadgeStyle(rating),
          )}
        >
          {rating}
        </span>
      </div>

      {/* Metric rows */}
      <div className="flex flex-col divide-y divide-[#F0F0F0]">
        {/* FCF Margin */}
        <div className="flex items-center justify-between py-2">
          <span className="text-[12px] text-[#566174]">FCF Margin (TTM)</span>
          <span className="text-[13px] font-[650] text-[#06101F] tabular-nums">
            {resolvedFcfMargin != null ? fmtPct(resolvedFcfMargin) : '—'}
          </span>
        </div>

        {/* FCF / Net Income */}
        <div className="flex items-center justify-between py-2">
          <span className="text-[12px] text-[#566174]">FCF / Net Income (TTM)</span>
          <span className="text-[13px] font-[650] text-[#06101F] tabular-nums">
            {fcfNiRatio != null ? fmtMultiple(fcfNiRatio) : '—'}
          </span>
        </div>
      </div>

      {/* Verdict bullets */}
      <div className="flex flex-col gap-1.5 pt-0.5">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className={cn(
                'text-[12px] font-[700] leading-none mt-[1px] shrink-0 w-3 text-center',
                ICON_COLOR_CLASS[b.iconColor],
              )}
            >
              {b.icon}
            </span>
            <p className="text-[12px] text-[#566174] leading-snug">{b.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
