'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currSym(c: string): string {
  if (c === 'USD') return '$'
  if (c === 'EUR') return '€'
  if (c === 'GBP') return '£'
  if (c === 'JPY') return '¥'
  if (c === 'CNY') return '¥'
  return c + ' '
}

function fmtVal(v: number, sym: string): string {
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${sym}${(abs / 1e12).toFixed(1)}T`
  if (abs >= 1e9)  return `${sym}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `${sym}${(abs / 1e6).toFixed(0)}M`
  return `${sym}${Math.round(abs / 1e3)}K`
}

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface IncomeFlowCardProps {
  statementsData: AnyRecord | null
  currency?: string
}

interface WaterfallRow {
  name: string
  value: number | null
  isDeduction?: boolean
  isProfit?: boolean
  isFinal?: boolean
  showDivider?: boolean
}

// ─── Row component ────────────────────────────────────────────────────────────

function Row({
  name, value, maxValue, isDeduction, isProfit, isFinal, showDivider, sym,
}: WaterfallRow & { maxValue: number; sym: string }) {
  if (value == null) return null
  const barPct  = maxValue > 0 ? Math.max(2, Math.min(100, (Math.abs(value) / maxValue) * 100)) : 2
  const isNeg   = value < 0

  const barColor = isDeduction
    ? 'bg-[#F4A7B9]'
    : isFinal || isProfit
      ? isNeg ? 'bg-[#F87171]' : 'bg-[#34D399]'
      : 'bg-[#60A5FA]'

  return (
    <>
      {showDivider && <div className="my-1 border-t border-[#E5E5E5]" />}
      <div className="flex items-center gap-3">
        {/* Label — right-aligned, fixed width */}
        <div className="w-[140px] sm:w-[160px] shrink-0 text-right">
          <span className={cn(
            'text-[12px] leading-none',
            isDeduction ? 'text-[#9B9B9B]' : 'text-[#111111]',
            isFinal && 'font-[700]',
          )}>
            {isDeduction && <span className="text-[#D83B3B] font-[600] mr-0.5">−</span>}
            {name}
          </span>
        </div>

        {/* Bar track */}
        <div className="flex-1 min-w-0 h-[22px] bg-[#F0F0F0] rounded-lg overflow-hidden">
          <div
            className={cn('h-full rounded-lg transition-all duration-500', barColor)}
            style={{ width: `${barPct}%` }}
          />
        </div>

        {/* Value — right-aligned */}
        <div className="w-[60px] shrink-0 text-right">
          <span className={cn(
            'text-[12px] font-[600] tabular-nums',
            isDeduction ? 'text-[#9B9B9B]' : isNeg ? 'text-[#D83B3B]' : isProfit || isFinal ? 'text-[#11875D]' : 'text-[#111111]',
          )}>
            {isNeg ? '−' : ''}{fmtVal(Math.abs(value), sym)}
          </span>
        </div>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IncomeFlowCard({ statementsData, currency = 'USD' }: IncomeFlowCardProps) {
  const [period, setPeriod] = useState<'annual' | 'quarterly'>('annual')

  const sym = currSym(statementsData?.financialCurrency ?? currency)

  const rows = useMemo<WaterfallRow[]>(() => {
    if (!statementsData) return []

    let row: AnyRecord | null = null
    if (period === 'annual') {
      const annual: AnyRecord[] = statementsData?.annual?.incomeStatement ?? []
      row = annual[annual.length - 1] ?? null
    } else {
      const quarterly: AnyRecord[] = statementsData?.quarterly?.incomeStatement ?? []
      row = quarterly[quarterly.length - 1] ?? null
    }
    // fallback to TTM
    if (!row) row = statementsData?.ttm?.incomeStatement ?? null
    if (!row) return []

    const revenue = row.totalRevenue ?? row.operatingRevenue ?? null
    if (!revenue || revenue <= 0) return []

    const rawGP   = row.grossProfit ?? null
    const rawCOGS = row.costOfRevenue ?? null
    let grossProfit: number | null = null
    let cogs: number | null = null
    if (rawGP != null && rawGP > 0) {
      grossProfit = Math.min(revenue, rawGP)
      cogs = revenue - grossProfit
    } else if (rawCOGS != null && rawCOGS > 0) {
      cogs = Math.min(revenue, rawCOGS)
      grossProfit = revenue - cogs
    }

    const rawOp = row.operatingIncome ?? row.ebit ?? null
    const operatingIncome: number | null = rawOp != null ? rawOp : null
    const opEx: number | null = (grossProfit != null && operatingIncome != null)
      ? grossProfit - operatingIncome : null

    const netIncome: number | null = row.netIncome ?? row.netIncomeCommonStockholders ?? null
    const taxOther: number | null = (operatingIncome != null && operatingIncome > 0 && netIncome != null)
      ? operatingIncome - Math.min(operatingIncome, Math.max(0, netIncome))
      : null

    return [
      { name: 'Revenue',            value: revenue,          showDivider: false },
      { name: 'Cost of Goods Sold', value: cogs,             isDeduction: true  },
      { name: 'Gross Profit',       value: grossProfit,      isProfit: true,    showDivider: true },
      { name: 'Operating Expenses', value: opEx,             isDeduction: true  },
      { name: 'Operating Income',   value: operatingIncome,  isProfit: true,    showDivider: true },
      { name: 'Taxes & Other',      value: taxOther && taxOther > 0 ? taxOther : null, isDeduction: true },
      { name: 'Net Income',         value: netIncome,        isFinal: true,     showDivider: true },
    ]
  }, [statementsData, period])

  const maxValue = (rows.find(r => r.name === 'Revenue')?.value) ?? 0

  const periodLabel = period === 'annual'
    ? (() => {
        const annual: AnyRecord[] = statementsData?.annual?.incomeStatement ?? []
        const row = annual[annual.length - 1]
        const year = row?.endDate ? String(row.endDate).slice(0, 4) : null
        return year ? `Annual · FY${year}` : 'Annual'
      })()
    : (() => {
        const quarterly: AnyRecord[] = statementsData?.quarterly?.incomeStatement ?? []
        const row = quarterly[quarterly.length - 1]
        const date = row?.endDate ? String(row.endDate).slice(0, 7) : null
        return date ? `Quarterly · ${date}` : 'Quarterly'
      })()

  if (!statementsData || rows.length === 0) return null

  return (
    <div className="rounded-2xl border border-[#E5E5E5] bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-2.5 border-b border-[#E5E5E5] flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <p className="text-[13px] font-[700] text-[#111111] leading-tight">Revenue to Profit</p>
          <span className="text-[11px] text-[#9B9B9B]">{periodLabel}</span>
        </div>
        {/* Period toggle */}
        <div className="flex items-center gap-1 bg-[#F5F5F5] rounded-lg p-0.5">
          <button
            onClick={() => setPeriod('annual')}
            className={cn(
              'px-3 py-1 text-[11px] font-[600] rounded-md transition-colors',
              period === 'annual' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B6B6B] hover:text-[#111111]',
            )}
          >
            Annual
          </button>
          <button
            onClick={() => setPeriod('quarterly')}
            className={cn(
              'px-3 py-1 text-[11px] font-[600] rounded-md transition-colors',
              period === 'quarterly' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B6B6B] hover:text-[#111111]',
            )}
          >
            Quarterly
          </button>
        </div>
      </div>

      {/* Waterfall rows */}
      <div className="px-4 sm:px-5 py-4 flex flex-col gap-1.5">
        {rows.map((row) => (
          <Row key={row.name} {...row} maxValue={maxValue} sym={sym} />
        ))}
      </div>
    </div>
  )
}
