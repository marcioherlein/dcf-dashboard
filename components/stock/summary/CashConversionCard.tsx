'use client'

import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatementsData {
  ttm?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cashFlow?: Record<string, any> | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    incomeStatement?: Record<string, any> | null
  } | null
}

interface Props {
  fcfMargin?: number | null
  ttmCashFlow?: {
    freeCashFlow?: number | null
    operatingCashFlow?: number | null
    netIncome?: number | null
  } | null
  statementsData?: StatementsData | null
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

function computeFcfMarginFromStatements(statementsData: StatementsData | null | undefined): number | null {
  if (!statementsData) return null
  const ttmCF = statementsData?.ttm?.cashFlow ?? null
  const ttmIS = statementsData?.ttm?.incomeStatement ?? null
  const fcf = ttmCF?.freeCashFlow ?? ttmCF?.freeCashFlowAndCapex ?? null
  const revenue = ttmIS?.totalRevenue ?? ttmIS?.operatingRevenue ?? ttmIS?.revenue ?? null
  if (fcf != null && revenue != null && revenue > 0) return fcf / revenue
  return null
}

function computeFcfNiFromStatements(statementsData: StatementsData | null | undefined): number | null {
  if (!statementsData) return null
  const ttmCF = statementsData?.ttm?.cashFlow ?? null
  const ttmIS = statementsData?.ttm?.incomeStatement ?? null
  const fcf = ttmCF?.freeCashFlow ?? null
  const netIncome = ttmIS?.netIncome ?? ttmIS?.netIncomeCommonStockholders ?? null
  if (fcf != null && netIncome != null && netIncome !== 0) return fcf / netIncome
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
      return 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]'
    case 'A-':
      return 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]'
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
  gray:  'text-[#6B6B6B]',
  red:   'text-[#D83B3B]',
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

  // FCF / Net Income ratio — try explicit prop first, then derive from statementsData
  const fcfNiRatio: number | null = (() => {
    const fcf = ttmCashFlow?.freeCashFlow ?? null
    const ni  = ttmCashFlow?.netIncome ?? null
    if (fcf != null && ni != null && ni !== 0) return fcf / ni
    return computeFcfNiFromStatements(statementsData)
  })()

  const rating  = getRating(fcfNiRatio, resolvedFcfMargin)
  const bullets = getVerdictBullets(fcfNiRatio)

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 flex flex-col gap-3 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-[600] text-[#566174]">
          Cash Conversion
        </p>
        <span
          role="status"
          aria-label={`Cash conversion quality rating: ${rating}`}
          className={cn(
            'inline-block rounded-full px-2.5 py-0.5 text-[11px] font-[600] border leading-tight',
            getBadgeStyle(rating),
          )}
        >
          {rating}
        </span>
      </div>

      {/* Metric rows */}
      <div className="flex flex-col divide-y divide-[#E3E1DA]">
        {/* FCF Margin */}
        <div className="flex items-center justify-between py-2">
          <span className="text-[12px] text-[#6B6B6B]">FCF Margin (TTM)</span>
          <span className="text-[13px] font-mono font-[650] text-[#111111] tabular-nums">
            {resolvedFcfMargin != null ? fmtPct(resolvedFcfMargin) : '—'}
          </span>
        </div>

        {/* FCF / Net Income */}
        <div className="flex items-center justify-between py-2">
          <span className="text-[12px] text-[#6B6B6B]">FCF / Net Income (TTM)</span>
          <span className="text-[13px] font-mono font-[650] text-[#111111] tabular-nums">
            {fcfNiRatio != null ? fmtMultiple(fcfNiRatio) : '—'}
          </span>
        </div>
      </div>

      {/* Verdict bullets */}
      <div className="flex flex-col gap-1.5 pt-0.5">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'text-[12px] font-[700] leading-none mt-[1px] shrink-0 w-3 text-center',
                ICON_COLOR_CLASS[b.iconColor],
              )}
            >
              {b.icon}
            </span>
            <span className="sr-only">
              {b.iconColor === 'green' ? 'Positive' : b.iconColor === 'red' ? 'Negative' : 'Neutral'}:
            </span>
            <p className="text-[12px] text-[#6B6B6B] leading-snug">{b.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
