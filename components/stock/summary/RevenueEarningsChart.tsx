'use client'

import { useMemo } from 'react'

// ─── helpers ──────────────────────────────────────────────────────────────────

function currSym(c: string): string {
  if (c === 'USD') return '$'
  if (c === 'EUR') return '€'
  if (c === 'GBP') return '£'
  if (c === 'JPY') return '¥'
  if (c === 'CNY') return '¥'
  return c + ' '
}

function fmtDollars(v: number, sym: string): string {
  const abs = Math.abs(v)
  if (abs >= 1e12) return `${sym}${(v / 1e12).toFixed(1)}T`
  if (abs >= 1e9)  return `${sym}${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `${sym}${(v / 1e6).toFixed(0)}M`
  return `${sym}${Math.round(v / 1e3)}K`
}

// ─── types ────────────────────────────────────────────────────────────────────

interface Point {
  year: string
  revenue: number
  netIncome: number | null
  isTTM: boolean
  yoyRev: number | null   // YoY revenue growth fraction
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface RevenueEarningsChartProps {
  statementsData: AnyRecord | null
  currency?: string
}

// ─── component ────────────────────────────────────────────────────────────────

export default function RevenueEarningsChart({ statementsData, currency = 'USD' }: RevenueEarningsChartProps) {
  const sym = currSym(statementsData?.financialCurrency ?? currency)

  const points = useMemo<Point[]>(() => {
    const annualRows: AnyRecord[] = statementsData?.annual?.incomeStatement ?? []
    const ttmRow: AnyRecord | null = statementsData?.ttm?.incomeStatement ?? null

    // Build annual points — last 5 years, sorted oldest first
    const annual: Point[] = annualRows
      .filter(r => r.totalRevenue != null && (r.totalRevenue as number) > 0)
      .slice(-5)
      .map(r => ({
        year:       String(r.endDate ?? '').slice(0, 4),
        revenue:    r.totalRevenue as number,
        netIncome:  r.netIncome != null ? (r.netIncome as number) : null,
        isTTM:      false,
        yoyRev:     null,
      }))

    // Add TTM if available and not duplicating the latest annual year
    const latestAnnualYear = annual[annual.length - 1]?.year ?? ''
    const ttmRevenue = ttmRow?.totalRevenue as number | null
    let pts: Point[] = annual
    if (ttmRevenue != null && ttmRevenue > 0) {
      const ttmYear = String(ttmRow?.endDate ?? 'TTM').slice(0, 4)
      if (ttmYear !== latestAnnualYear) {
        pts = [
          ...annual,
          {
            year:      'TTM',
            revenue:   ttmRevenue,
            netIncome: ttmRow?.netIncome != null ? (ttmRow.netIncome as number) : null,
            isTTM:     true,
            yoyRev:    null,
          },
        ]
      }
    }

    // Compute YoY revenue growth
    return pts.map((p, i) => ({
      ...p,
      yoyRev: i > 0 && pts[i - 1].revenue > 0
        ? (p.revenue - pts[i - 1].revenue) / pts[i - 1].revenue
        : null,
    }))
  }, [statementsData])

  if (points.length < 2) return null

  const maxRev = Math.max(...points.map(p => p.revenue))

  // Latest non-TTM net margin for the footnote
  const latestForMargin = [...points].reverse().find(p => !p.isTTM && p.netIncome != null && p.revenue > 0)
  const latestNetMargin = latestForMargin
    ? (latestForMargin.netIncome! / latestForMargin.revenue)
    : null

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E3E1DA] shadow-card">
      {/* header */}
      <div className="px-4 sm:px-5 py-3 bg-white border-b border-[#E3E1DA] flex items-center justify-between">
        <p className="text-[12px] font-[650] text-[#566174]">Revenue &amp; Net Income</p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] text-[#8A95A6]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#D8E6FF]" />
            Revenue
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[#8A95A6]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[#11875D]" />
            Net Income
          </span>
        </div>
      </div>

      <div className="bg-white px-4 sm:px-5 pt-3 pb-4">
        {/* chart rows */}
        <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: 120 }}>
          {points.map((p) => {
            const revH   = (p.revenue / maxRev) * 100
            const niH    = p.netIncome != null ? (Math.abs(p.netIncome) / maxRev) * 100 : null
            const niPos  = p.netIncome != null && p.netIncome >= 0
            const alpha  = p.isTTM ? 'opacity-60' : ''

            return (
              <div key={p.year} className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 ${alpha}`}>
                {/* YoY growth badge */}
                <div className="h-[14px] flex items-end justify-center">
                  {p.yoyRev != null && (
                    <span className={`text-[8px] font-semibold leading-none ${p.yoyRev >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                      {p.yoyRev >= 0 ? '+' : ''}{(p.yoyRev * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* bars */}
                <div className="w-full flex gap-0.5 items-end" style={{ height: 88 }}>
                  {/* revenue bar */}
                  <div
                    className="flex-[2] min-w-0 bg-[#D8E6FF] rounded-t-sm transition-all"
                    style={{ height: `${Math.max(2, revH)}%` }}
                    title={`${p.year} Revenue: ${fmtDollars(p.revenue, sym)}`}
                  />
                  {/* net income bar */}
                  {niH != null ? (
                    <div
                      className={`flex-1 min-w-0 rounded-t-sm transition-all ${niPos ? 'bg-[#11875D]' : 'bg-[#D83B3B]'}`}
                      style={{ height: `${Math.max(2, niH)}%` }}
                      title={`${p.year} Net Income: ${fmtDollars(p.netIncome!, sym)}`}
                    />
                  ) : (
                    <div className="flex-1" />
                  )}
                </div>

                {/* year label */}
                <span className={`text-[8px] sm:text-[10px] leading-none mt-0.5 ${p.isTTM ? 'text-[#8A95A6] font-semibold' : 'text-[#8A95A6]'}`}>
                  {p.year}
                </span>
              </div>
            )
          })}
        </div>

        {/* footnote: latest net margin */}
        {latestNetMargin != null && (
          <p className="mt-2 text-[10px] text-[#8A95A6] leading-snug">
            {latestForMargin?.year} net margin:{' '}
            <span className={`font-semibold ${latestNetMargin >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
              {(latestNetMargin * 100).toFixed(1)}%
            </span>
            &nbsp;·&nbsp;Net income bars scaled to revenue
          </p>
        )}
      </div>
    </div>
  )
}
