'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  type ValuationMethodId,
  type ValuationMethodConfig,
  type ValuationResult,
  type ValuationAssumption,
  sourceLabel,
} from './ValuationModelDrawer'
import ValuationSummary, { type MethodResult } from './ValuationSummary'
import ModellingWorkspace from '@/components/modelling/ModellingWorkspace'
import { computeForwardPE } from '@/lib/valuation/methods/forwardPE'
import { computeRevenueMultiple } from '@/lib/valuation/methods/revenueMultiple'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'
import { computeEVEBITDA, blendEVEBITDAMultiple } from '@/lib/valuation/methods/evEbitda'
import {
  deriveForwardPEAssumptions,
  deriveRevenueMultipleAssumptions,
} from '@/lib/valuation/assumptions/deriveAssumptions'
import type { AssumptionAudit, AuditResult } from '@/lib/valuation/assumptionAuditor'
import { AssumptionHealthBanner } from './AssumptionHealthBanner'
import { fmtPrice, fmtPct, fmtLargeCurrency } from '@/lib/formatters'
import { TrendBadge } from '@/components/ui/trend-badge'
import { NABadge } from '@/components/ui/na-badge'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'

// ─── Local helpers ─────────────────────────────────────────────────────────────

function fmtB(v: number | null): string { return fmtLargeCurrency(v) }
function fmtPctSigned(v: number | null): string { return fmtPct(v) }

// ─── Result builders ──────────────────────────────────────────────────────────

function upsideTone(v: number | null): ValuationResult['tone'] {
  if (v == null) return 'neutral'
  if (v >= 0.10) return 'positive'
  if (v >= 0)    return 'neutral'
  return 'negative'
}

function buildForwardPEResults(result: ReturnType<typeof computeForwardPE>, currentPrice: number, currency = 'USD'): ValuationResult[] {
  const N = 5; const targetYear = new Date().getFullYear() + N
  return [
    { label: 'Current Price',        value: currentPrice,             formattedValue: fmtPrice(currentPrice, currency),             tone: 'neutral' },
    { label: `${targetYear} Target`, value: result.futureTargetPrice, formattedValue: fmtPrice(result.futureTargetPrice, currency), tone: 'neutral' },
    { label: 'Fair Value Today',     value: result.fairValueToday,    formattedValue: fmtPrice(result.fairValueToday, currency),    tone: upsideTone(result.upsidePct) },
    { label: '1Y Price Target',      value: result.target1Y,          formattedValue: fmtPrice(result.target1Y, currency),         tone: 'neutral' },
    { label: 'Potential Upside',     value: result.upsidePct,         formattedValue: fmtPctSigned(result.upsidePct),              tone: upsideTone(result.upsidePct) },
    { label: 'Expected Return',      value: result.expectedReturnPct, formattedValue: result.expectedReturnPct != null ? fmtPctSigned(result.expectedReturnPct) + '/yr' : '—', tone: upsideTone(result.expectedReturnPct) },
    ...(result.expectedReturnWithDivPct != null && result.expectedReturnWithDivPct !== result.expectedReturnPct
      ? [{ label: 'Total Ret. (w/ Div)', value: result.expectedReturnWithDivPct, formattedValue: fmtPctSigned(result.expectedReturnWithDivPct) + '/yr', tone: upsideTone(result.expectedReturnWithDivPct) } as ValuationResult]
      : []),
  ]
}

function buildRevMultipleResults(result: ReturnType<typeof computeRevenueMultiple>, currentPrice: number, currency = 'USD'): ValuationResult[] {
  const N = 5; const targetYear = new Date().getFullYear() + N
  return [
    { label: 'Current Price',        value: currentPrice,             formattedValue: fmtPrice(currentPrice, currency),             tone: 'neutral' },
    { label: `${targetYear} Target`, value: result.futureTargetPrice, formattedValue: fmtPrice(result.futureTargetPrice, currency), tone: 'neutral' },
    { label: 'Fair Value Today',     value: result.fairValueToday,    formattedValue: fmtPrice(result.fairValueToday, currency),    tone: upsideTone(result.upsidePct) },
    { label: '1Y Price Target',      value: result.target1Y,          formattedValue: fmtPrice(result.target1Y, currency),         tone: 'neutral' },
    { label: 'Potential Upside',     value: result.upsidePct,         formattedValue: fmtPctSigned(result.upsidePct),              tone: upsideTone(result.upsidePct) },
    { label: 'Expected Return',      value: result.expectedReturnPct, formattedValue: result.expectedReturnPct != null ? fmtPctSigned(result.expectedReturnPct) + '/yr' : '—', tone: upsideTone(result.expectedReturnPct) },
  ]
}

function buildEVEBITDAResults(result: ReturnType<typeof computeEVEBITDA>, currentPrice: number, currency = 'USD'): ValuationResult[] {
  return [
    { label: 'Enterprise Value',   value: result.enterpriseValue,   formattedValue: fmtB(result.enterpriseValue),                tone: 'neutral' },
    { label: 'Equity Value',       value: result.equityValue,       formattedValue: fmtB(result.equityValue),                    tone: 'neutral' },
    { label: 'Fair Value / Share', value: result.fairValuePerShare, formattedValue: fmtPrice(result.fairValuePerShare, currency), tone: upsideTone(result.upsidePct) },
    { label: 'Current Price',      value: currentPrice,             formattedValue: fmtPrice(currentPrice, currency),            tone: 'neutral' },
    { label: 'Potential Upside',   value: result.upsidePct,         formattedValue: fmtPctSigned(result.upsidePct),              tone: upsideTone(result.upsidePct) },
  ]
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

type ConfidenceLevel = 'high' | 'medium' | 'low'

function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const cfg = {
    high:   { label: 'High Confidence',   bg: 'bg-[#E8F7EF]', text: 'text-[#11875D]', border: 'border-[#CDD1C8]' },
    medium: { label: 'Medium Confidence', bg: 'bg-[#FFF4DA]',   text: 'text-[#B56A00]',   border: 'border-[#E3E1DA]'   },
    low:    { label: 'Low Confidence',    bg: 'bg-[#FCEAEA]',     text: 'text-[#D83B3B]',     border: 'border-[#E3E1DA]'     },
  }[level]
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

function methodVerdict(upsidePct: number | null, reverseDCFLabel?: string): string {
  if (reverseDCFLabel !== undefined) return reverseDCFLabel
  if (upsidePct == null) return 'Insufficient data to compute fair value'
  const pct = upsidePct * 100
  if (pct >= 25)  return `Suggests ${pct.toFixed(0)}% undervaluation — model sees meaningful upside`
  if (pct >= 10)  return `${pct.toFixed(0)}% below model fair value — potential buy zone by this measure`
  if (pct >= -5)  return `Trading near fair value — limited margin of safety by this measure`
  if (pct >= -20) return `${Math.abs(pct).toFixed(0)}% premium to model — priced for continued execution`
  return `${Math.abs(pct).toFixed(0)}% above model fair value — high expectations embedded in price`
}

// ─── Inline method panel helpers ──────────────────────────────────────────────

function resultToneClass(tone: ValuationResult['tone']): string {
  switch (tone) {
    case 'positive': return 'text-[#11875D]'
    case 'negative': return 'text-[#D83B3B]'
    case 'warning':  return 'text-[#B56A00]'
    default:         return 'text-[#06101F]'
  }
}

function fmtAssumptionDisplay(assumption: ValuationAssumption, overrides: Record<string, number>): string {
  const raw = assumption.key in overrides ? overrides[assumption.key] : assumption.value
  if (raw == null) return '—'
  if (assumption.unit === '%') return (raw * 100).toFixed(1)
  if (assumption.unit === 'x') return raw.toFixed(1)
  if (assumption.unit === '$') {
    const abs = Math.abs(raw)
    const sign = raw < 0 ? '-' : ''
    if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(2) + 'T'
    if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(1) + 'B'
    if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(0) + 'M'
    return sign + '$' + abs.toFixed(0)
  }
  if (assumption.unit === 'shares') {
    if (Math.abs(raw) >= 1e9) return (raw / 1e9).toFixed(3) + 'B'
    if (Math.abs(raw) >= 1e6) return (raw / 1e6).toFixed(0) + 'M'
    return raw.toFixed(0)
  }
  return raw.toFixed(2)
}

// ─── ReverseDCF helpers ───────────────────────────────────────────────────────

interface EVRow { year: number; revenue: number; fcf: number; discountFactor: number; pv: number }

function computeEVRows(lastRevenue: number, fcfMargin: number, cagr: number, wacc: number, terminalG: number, N = 5): { rows: EVRow[]; tv: number; pvTv: number; totalEV: number } {
  const rows: EVRow[] = []
  let sumPv = 0
  for (let t = 1; t <= N; t++) {
    const revenue = lastRevenue * Math.pow(1 + cagr, t)
    const fcf = revenue * fcfMargin
    const discountFactor = Math.pow(1 + wacc, t)
    const pv = fcf / discountFactor
    sumPv += pv
    rows.push({ year: t, revenue, fcf, discountFactor, pv })
  }
  const lastFCF = lastRevenue * Math.pow(1 + cagr, N) * fcfMargin
  const tv = (lastFCF * (1 + terminalG)) / (wacc - terminalG)
  const pvTv = tv / Math.pow(1 + wacc, N)
  return { rows, tv, pvTv, totalEV: sumPv + pvTv }
}

function computeFVPerShare(lastRevenue: number, fcfMargin: number, cagr: number, wacc: number, terminalG: number, cashDollars: number, debtDollars: number, shares: number, N = 5): number | null {
  if (wacc <= terminalG) return null
  const { totalEV } = computeEVRows(lastRevenue, fcfMargin, cagr, wacc, terminalG, N)
  const equity = totalEV + cashDollars - debtDollars
  return shares > 0 ? equity / shares : null
}

function fmtCompact(v: number | null): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (abs >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toFixed(0)}`
}

// ─── ReverseDCFPanel ──────────────────────────────────────────────────────────

function ReverseDCFPanel({ result, cagrAnalysis, wacc, terminalG, lastFCFMargin,
  lastRevenue, currentPrice, cashM, debtM, sharesAbsolute, currency = 'USD' }: {
  result: ReturnType<typeof computeReverseDCF>
  cagrAnalysis: { analystEstimate1y?: number | null; historicalCagr3y?: number | null } | null
  wacc: number
  terminalG: number
  lastFCFMargin: number | null
  lastRevenue: number | null
  currentPrice: number
  cashM: number | null
  debtM: number | null
  sharesAbsolute: number | null
  currency?: string
}) {
  const [showMath, setShowMath] = useState(false)
  const impliedCAGR    = result.impliedCAGR
  const analystCAGR    = cagrAnalysis?.analystEstimate1y ?? null
  const historicalCAGR = cagrAnalysis?.historicalCagr3y ?? null
  const N = 5

  const tone =
    result.interpretation === 'conservative' || result.interpretation === 'reasonable' ? 'positive' :
    result.interpretation === 'aggressive'      ? 'warning' :
    result.interpretation === 'very_aggressive' ? 'negative' : 'neutral'
  const toneColor =
    tone === 'positive' ? '#059669' : tone === 'warning' ? '#D97706' : tone === 'negative' ? '#DC2626' : '#6b7280'
  const toneLabel =
    result.interpretation === 'conservative'    ? 'Conservative' :
    result.interpretation === 'reasonable'      ? 'Reasonable'   :
    result.interpretation === 'aggressive'      ? 'Aggressive'   :
    result.interpretation === 'very_aggressive' ? 'Very Aggressive' : ''
  const toneIcon = tone === 'positive' ? '✓' : tone === 'warning' ? '⚠' : tone === 'negative' ? '✗' : '–'

  // Projection table rows (memoised to avoid recalc on every render)
  const projectionData = useMemo(() => {
    if (lastRevenue == null || lastFCFMargin == null || impliedCAGR == null) return null
    if (wacc <= terminalG) return null
    if (lastFCFMargin <= 0) return null
    return computeEVRows(lastRevenue, lastFCFMargin, impliedCAGR, wacc, terminalG, N)
  }, [lastRevenue, lastFCFMargin, impliedCAGR, wacc, terminalG])

  // Sensitivity scenarios
  const sensitivityScenarios = useMemo(() => {
    if (impliedCAGR == null || lastRevenue == null || lastFCFMargin == null || lastFCFMargin <= 0 || sharesAbsolute == null || sharesAbsolute <= 0) return []
    const cashDollars = (cashM ?? 0) * 1e6
    const debtDollars = (debtM ?? 0) * 1e6

    const slots: Array<{ label: string; sublabel?: string; cagr: number; isImplied?: boolean }> = []
    if (historicalCAGR != null && Math.abs(historicalCAGR - impliedCAGR) > 0.01)
      slots.push({ label: (historicalCAGR * 100).toFixed(1) + '%', sublabel: '3Y History', cagr: historicalCAGR })
    if (analystCAGR != null && Math.abs(analystCAGR - impliedCAGR) > 0.01)
      slots.push({ label: (analystCAGR * 100).toFixed(1) + '%', sublabel: 'Analyst est.', cagr: analystCAGR })
    slots.push({ label: (impliedCAGR * 100).toFixed(1) + '%', sublabel: 'Market implies', cagr: impliedCAGR, isImplied: true })
    for (const gap of [0.05, 0.10, 0.15]) {
      if (slots.length >= 5) break
      const c = impliedCAGR + gap
      slots.push({ label: (c * 100).toFixed(0) + '%', sublabel: gap > 0 ? `+${(gap * 100).toFixed(0)}pp` : '', cagr: c })
    }

    return slots.map(s => ({
      ...s,
      fvPerShare: computeFVPerShare(lastRevenue, lastFCFMargin, s.cagr, wacc, terminalG, cashDollars, debtDollars, sharesAbsolute, N),
    }))
  }, [impliedCAGR, lastRevenue, lastFCFMargin, sharesAbsolute, cashM, debtM, wacc, terminalG, historicalCAGR, analystCAGR])

  const canShowMath = projectionData != null && sensitivityScenarios.length > 0

  return (
    <div className="card rounded-xl">

      {/* ① Three-column hero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E3E1DA]">
        <div className="flex flex-col items-center px-3 sm:px-4 py-5 gap-1">
          <p className="text-[10px] uppercase tracking-wider text-[#8A95A6] font-bold text-center">Market Implies</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums" style={{ color: toneColor }}>
            {impliedCAGR != null ? (impliedCAGR * 100).toFixed(1) + '%' : '—'}
          </p>
          <p className="text-xs text-[#566174]">5Y CAGR</p>
          {impliedCAGR != null && toneLabel && (
            <span className="text-xs font-semibold mt-1 text-center" style={{ color: toneColor }}>
              {toneIcon} {toneLabel}
            </span>
          )}
          {result.interpretation === 'not_meaningful' && (
            <span className="text-[10px] text-[#B56A00] text-center leading-snug mt-1 px-1">
              Not computable — see below
            </span>
          )}
        </div>
        <div className="flex flex-col items-center px-3 sm:px-4 py-5 gap-1">
          <p className="text-[10px] uppercase tracking-wider text-[#8A95A6] font-bold text-center">Analyst Says</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-[#06101F]">
            {analystCAGR != null ? (analystCAGR * 100).toFixed(1) + '%' : '—'}
          </p>
          <p className="text-xs text-[#566174]">FY+1 estimate</p>
          {analystCAGR != null && <span className="text-xs text-[#8A95A6] mt-1">─ Consensus</span>}
        </div>
        <div className="flex flex-col items-center px-3 sm:px-4 py-5 gap-1">
          <p className="text-[10px] uppercase tracking-wider text-[#8A95A6] font-bold text-center">History (3Y)</p>
          <p className="text-xl sm:text-2xl font-bold tabular-nums text-[#06101F]">
            {historicalCAGR != null ? (historicalCAGR * 100).toFixed(1) + '%' : '—'}
          </p>
          <p className="text-xs text-[#566174]">3Y revenue CAGR</p>
          {historicalCAGR != null && <span className="text-xs text-[#8A95A6] mt-1">─ Historical</span>}
        </div>
      </div>

      {/* ② Show / hide calculations toggle */}
      {canShowMath && (
        <div className="px-5 py-2 border-t border-[#E3E1DA]">
          <button
            onClick={() => setShowMath(v => !v)}
            className="text-[11px] text-[#2563EB] hover:text-[#2563EB] font-medium flex items-center gap-1 transition-colors"
          >
            <ChevronDown size={12} className={cn('transition-transform duration-200', showMath ? 'rotate-180' : '')} />
            {showMath ? 'Hide calculations' : 'Show calculations'}
          </button>
        </div>
      )}

      {/* ③ Math panel (collapsible) */}
      <AnimatePresence>
        {showMath && canShowMath && projectionData && (
          <motion.div
            key="math"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >

            {/* Fixed inputs grid */}
            <div className="px-5 py-4 border-t border-[#E3E1DA] bg-[#EAF1FF]/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A95A6] mb-3">Fixed assumptions (locked inputs)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                {lastRevenue != null && (
                  <div>
                    <p className="text-[10px] text-[#566174]">Starting Revenue (TTM)</p>
                    <p className="text-sm font-semibold tabular-nums text-[#06101F]">{fmtCompact(lastRevenue)}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-[#566174]">FCF Margin</p>
                  <p className="text-sm font-semibold tabular-nums text-[#06101F]">
                    {lastFCFMargin != null ? (lastFCFMargin * 100).toFixed(1) + '%' : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#566174]">WACC</p>
                  <p className="text-sm font-semibold tabular-nums text-[#06101F]">{(wacc * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#566174]">Terminal Growth</p>
                  <p className="text-sm font-semibold tabular-nums text-[#06101F]">{(terminalG * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#566174]">Projection Years</p>
                  <p className="text-sm font-semibold tabular-nums text-[#06101F]">5 years</p>
                </div>
                {sharesAbsolute != null && (
                  <div>
                    <p className="text-[10px] text-[#566174]">Shares Outstanding</p>
                    <p className="text-sm font-semibold tabular-nums text-[#06101F]">
                      {sharesAbsolute >= 1e9 ? (sharesAbsolute / 1e9).toFixed(2) + 'B' : (sharesAbsolute / 1e6).toFixed(0) + 'M'}
                    </p>
                  </div>
                )}
                {cashM != null && debtM != null && (
                  <div>
                    <p className="text-[10px] text-[#566174]">Net Cash / (Debt)</p>
                    <p className={cn('text-sm font-semibold tabular-nums', cashM - debtM >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                      {fmtCompact((cashM - debtM) * 1e6)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Year-by-year projection table */}
            <div className="px-5 py-4 border-t border-[#E3E1DA]">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A95A6]">
                  Year-by-year projection
                </p>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#EAF1FF] text-[#2563EB] font-bold">
                  ★ X = {impliedCAGR != null ? (impliedCAGR * 100).toFixed(1) + '%' : '—'} CAGR (solved)
                </span>
              </div>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[420px] text-[11px]">
                  <thead>
                    <tr className="border-b border-[#E3E1DA]">
                      <th className="pb-2 text-left font-semibold text-[#566174] pr-2 w-10">Yr</th>
                      <th className="pb-2 text-right font-bold text-[#2563EB] px-2 bg-[#EAF1FF]/60 rounded-t-sm">★ Rev. Growth</th>
                      <th className="pb-2 text-right font-semibold text-[#566174] px-2">Revenue</th>
                      <th className="pb-2 text-right font-semibold text-[#566174] px-2 hidden sm:table-cell">FCF</th>
                      <th className="pb-2 text-right font-semibold text-[#566174] px-2 hidden md:table-cell">Disc. Factor</th>
                      <th className="pb-2 text-right font-semibold text-[#06101F] pl-2">PV of FCF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectionData.rows.map((row, i) => (
                      <tr key={row.year} className={cn('border-b border-[#E3E1DA]', i % 2 === 0 ? '' : 'bg-[#F0F1F6]/40')}>
                        <td className="py-1.5 text-left text-[#566174] font-medium pr-2">{row.year}</td>
                        <td className="py-1.5 text-right text-[#2563EB] font-bold bg-[#EAF1FF]/40 px-2">
                          {impliedCAGR != null ? '+' + (impliedCAGR * 100).toFixed(1) + '%' : '—'}
                        </td>
                        <td className="py-1.5 text-right text-[#06101F] px-2 tabular-nums">{fmtCompact(row.revenue)}</td>
                        <td className="py-1.5 text-right text-[#06101F] px-2 tabular-nums hidden sm:table-cell">{fmtCompact(row.fcf)}</td>
                        <td className="py-1.5 text-right text-[#566174] px-2 tabular-nums hidden md:table-cell">÷ {row.discountFactor.toFixed(3)}</td>
                        <td className="py-1.5 text-right text-[#06101F] font-semibold pl-2 tabular-nums">{fmtCompact(row.pv)}</td>
                      </tr>
                    ))}
                    {/* Terminal value row */}
                    <tr className="border-t-2 border-dashed border-[#CDD1C8]">
                      <td className="py-1.5 text-left text-[#566174] font-medium pr-2">TV</td>
                      <td className="py-1.5 text-right text-[#2563EB] bg-[#EAF1FF]/40 px-2 text-[10px]">
                        g = {(terminalG * 100).toFixed(1)}% ∞
                      </td>
                      <td className="py-1.5 text-right text-[#8A95A6] px-2">—</td>
                      <td className="py-1.5 text-right text-[#06101F] px-2 tabular-nums hidden sm:table-cell">{fmtCompact(projectionData.tv)}</td>
                      <td className="py-1.5 text-right text-[#566174] px-2 tabular-nums hidden md:table-cell">÷ {Math.pow(1 + wacc, N).toFixed(3)}</td>
                      <td className="py-1.5 text-right text-[#06101F] font-semibold pl-2 tabular-nums">{fmtCompact(projectionData.pvTv)}</td>
                    </tr>
                    {/* Total EV row */}
                    <tr className="border-t-2 border-[#CDD1C8] bg-[#F0F1F6]">
                      <td colSpan={3} className="py-2 text-left font-bold text-[#06101F] pr-2 text-xs">Implied Enterprise Value</td>
                      <td className="py-2 text-right font-bold text-[#06101F] tabular-nums hidden sm:table-cell px-2"></td>
                      <td className="py-2 text-right font-bold text-[#06101F] tabular-nums hidden md:table-cell px-2"></td>
                      <td className="py-2 text-right font-bold text-[#06101F] tabular-nums pl-2 text-xs">
                        {fmtCompact(projectionData.totalEV)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {result.impliedEV != null && (
                <p className="text-[10px] text-[#8A95A6] mt-2">
                  Cross-check: market cap + debt − cash = {fmtCompact(result.impliedEV)}.
                  {Math.abs(projectionData.totalEV - result.impliedEV) / result.impliedEV < 0.01
                    ? ' ✓ Table matches.'
                    : ' Small rounding difference expected.'}
                </p>
              )}
            </div>

            {/* Sensitivity strip */}
            {sensitivityScenarios.length > 0 && (
              <div className="px-5 py-4 border-t border-[#E3E1DA] bg-[#F0F1F6]/60">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A95A6] mb-3">What if growth is different?</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 snap-x">
                  {sensitivityScenarios.map(s => {
                    const isImplied  = !!s.isImplied
                    const isCheap    = s.fvPerShare != null && s.fvPerShare > currentPrice * 1.02
                    const isExpensive = s.fvPerShare != null && s.fvPerShare < currentPrice * 0.98
                    return (
                      <div
                        key={s.label + s.sublabel}
                        className={cn(
                          'shrink-0 snap-start flex flex-col items-center px-3 py-3 rounded-xl border text-center min-w-[90px]',
                          isImplied
                            ? 'border-[#93B4F5] bg-[#EAF1FF] ring-1 ring-blue-200 shadow-sm'
                            : 'border-[#E3E1DA] bg-white'
                        )}
                      >
                        <p className={cn('text-sm font-bold tabular-nums', isImplied ? 'text-[#2563EB]' : 'text-[#06101F]')}>
                          {s.label}
                        </p>
                        {s.sublabel && (
                          <p className={cn('text-[11px] mt-0.5 leading-tight', isImplied ? 'text-[#2563EB]' : 'text-[#8A95A6]')}>
                            {s.sublabel}
                          </p>
                        )}
                        <div className="mt-2 pt-2 border-t border-[#E3E1DA] w-full">
                          <p className={cn('text-sm font-bold tabular-nums',
                            isImplied ? 'text-[#2563EB]' : isCheap ? 'text-[#11875D]' : isExpensive ? 'text-[#D83B3B]' : 'text-[#06101F]'
                          )}>
                            {s.fvPerShare != null ? fmtPrice(s.fvPerShare, currency) : '—'}
                          </p>
                          {isImplied
                            ? <p className="text-[11px] text-[#2563EB] mt-0.5">= market price</p>
                            : <p className={cn('text-[11px] mt-0.5', isCheap ? 'text-[#11875D]' : isExpensive ? 'text-[#D83B3B]' : 'text-[#8A95A6]')}>
                                {s.fvPerShare != null ? (isCheap ? 'undervalued' : isExpensive ? 'overvalued' : 'near fair') : ''}
                              </p>
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-[#8A95A6] mt-2.5 leading-relaxed">
                  Fair value at each growth scenario, holding WACC, FCF margin and all other inputs constant. Green = stock looks cheap; red = expensive.
                </p>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* ④ Assumptions + interpretation (always visible) */}
      <div className="px-5 py-4 border-t border-[#E3E1DA] bg-[#F0F1F6]">
        <p className="text-[10px] uppercase tracking-wider text-[#8A95A6] font-bold mb-3">Assumptions used</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-[#566174]">FCF Margin</p>
            <p className={cn('text-sm font-semibold tabular-nums',
              lastFCFMargin != null && lastFCFMargin < 0 ? 'text-[#D83B3B]' : 'text-[#06101F]'
            )}>
              {lastFCFMargin != null ? (lastFCFMargin * 100).toFixed(1) + '%' : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#566174]">WACC</p>
            <p className="text-sm font-semibold tabular-nums text-[#06101F]">{(wacc * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[10px] text-[#566174]">Terminal G</p>
            <p className="text-sm font-semibold tabular-nums text-[#06101F]">{(terminalG * 100).toFixed(1)}%</p>
          </div>
        </div>
        {result.interpretationText && (
          <p className={cn('text-xs mt-3 leading-relaxed',
            result.interpretation === 'not_meaningful' ? 'text-[#B56A00] font-medium' : 'text-[#566174]'
          )}>
            {result.interpretationText}
          </p>
        )}
        {result.guardErrors.length > 0 && (
          <div className="mt-2 space-y-1">
            {result.guardErrors.map((w, i) => (
              <p key={i} className="text-[10px] text-[#B56A00]">⚠ {w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Slider heat helpers ──────────────────────────────────────────────────────

type HeatLevel = 'green' | 'amber' | 'red' | 'neutral'

interface SliderHeat {
  level: HeatLevel
  deviationPct: number | null
  primaryBenchmark: { label: string; value: number } | null
}

function getSliderHeat(
  key: string,
  value: number,
  benchmarks: Array<{ label: string; value: number }> | undefined,
): SliderHeat {
  if (!benchmarks || benchmarks.length === 0) {
    return { level: 'neutral', deviationPct: null, primaryBenchmark: null }
  }
  const primary = benchmarks[0]
  if (!primary.value || !isFinite(primary.value)) {
    return { level: 'neutral', deviationPct: null, primaryBenchmark: primary }
  }
  const pctDev = (value - primary.value) / Math.abs(primary.value)

  // Higher = more aggressive (bullish/optimistic)
  const highIsAggressive = ['revenueCAGR', 'exitPE', 'exitMultiple', 'netMargin', 'terminalG']
  // Higher = more conservative (stricter hurdle)
  const highIsConservative = ['discountRate', 'wacc']

  let aggressiveness: number
  if (highIsAggressive.includes(key))    aggressiveness = pctDev
  else if (highIsConservative.includes(key)) aggressiveness = -pctDev
  else aggressiveness = Math.abs(pctDev)

  const level: HeatLevel =
    aggressiveness > 0.50 ? 'red' :
    aggressiveness > 0.20 ? 'amber' :
    aggressiveness < -0.20 ? 'green' :
    'neutral'

  return { level, deviationPct: Math.round(pctDev * 100), primaryBenchmark: primary }
}

function fmtBenchmarkValue(value: number, unit: string): string {
  if (unit === '%') return `${(value * 100).toFixed(1)}%`
  if (unit === 'x') return `${value.toFixed(1)}×`
  return value.toFixed(1)
}

function heatDeviationMessage(heat: SliderHeat, unit: string, sourceExplanation?: string): string | null {
  if (!heat.primaryBenchmark || heat.deviationPct === null) return sourceExplanation ?? null
  const { label: bLabel, value: bVal } = heat.primaryBenchmark
  const bFmt = fmtBenchmarkValue(bVal, unit)
  const absDev = Math.abs(heat.deviationPct)
  if (heat.level === 'red')    return `⚠ ${absDev}% above ${bLabel} (${bFmt}) — verify this is realistic`
  if (heat.level === 'amber')  return `↑ ${absDev}% above ${bLabel} (${bFmt}) — somewhat optimistic`
  if (heat.level === 'green')  return `✓ ${absDev}% below ${bLabel} (${bFmt}) — conservative`
  return sourceExplanation ?? null
}

// ─── MethodInlinePanel ────────────────────────────────────────────────────────

interface MethodInlinePanelProps {
  config: ValuationMethodConfig
  overrides: Record<string, number>
  currency: string
  onAssumptionChange: (key: string, value: number) => void
  onResetOverrides: () => void
  audit?: AssumptionAudit | null
}

function MethodInlinePanel({ config, overrides, currency, onAssumptionChange, onResetOverrides, audit }: MethodInlinePanelProps) {
  const isModified = Object.keys(overrides).length > 0
  const upside =
    config.fairValueSummary != null && config.currentPrice != null && config.currentPrice > 0
      ? (config.fairValueSummary - config.currentPrice) / config.currentPrice
      : null

  const editableAssumptions   = config.assumptions.filter(a => a.editable)
  const readonlyAssumptions   = config.assumptions.filter(a => !a.editable && a.unit !== 'shares')

  // Build a key→AuditResult lookup for inline rendering
  const auditByKey = audit
    ? Object.fromEntries(audit.results.map((r: AuditResult) => [r.key, r]))
    : {}

  return (
    <div className="card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E3E1DA] flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#566174] mt-0.5 leading-relaxed">{config.methodDescription ?? config.subtitle}</p>
        </div>
        {config.fairValueSummary != null && (
          <div className="flex items-center gap-3 sm:shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-[#8A95A6] font-bold">Fair Value</p>
              <p className="text-lg font-bold tabular-nums text-[#06101F]">
                {fmtPrice(config.fairValueSummary, currency)}
              </p>
            </div>
            {upside != null && <TrendBadge value={upside} size="lg" />}
          </div>
        )}
      </div>

      {/* Warnings */}
      {config.warnings.length > 0 && (
        <div className="px-5 pt-3 space-y-1.5">
          {config.warnings.map((w, i) => (
            <div key={i} className="bg-[#FFF4DA] border border-[#E3E1DA] rounded-lg px-3 py-2 text-xs text-[#B56A00]">
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* Assumption anchor — plain-English summary of key assumption → fair value */}
      {editableAssumptions.length > 0 && (() => {
        const cagrA = config.assumptions.find(a => a.key === 'revenueCAGR')
        const cagrVal = cagrA != null ? ((cagrA.key in overrides ? overrides[cagrA.key] : cagrA.value ?? 0) * 100).toFixed(1) : null
        if (!cagrVal || !config.fairValueSummary) return null
        const upsideNum = config.currentPrice && config.currentPrice > 0
          ? ((config.fairValueSummary - config.currentPrice) / config.currentPrice * 100)
          : null
        return (
          <p className="mx-5 mt-4 text-[11px] text-[#566174] bg-[#F0F1F6] rounded-lg px-3 py-2 border border-[#E3E1DA] leading-relaxed">
            With <strong className="text-[#06101F]">{cagrVal}% annual revenue growth</strong>, this model estimates{' '}
            <strong className="text-[#06101F]">{fmtPrice(config.fairValueSummary, currency)}</strong> fair value
            {upsideNum != null && (
              <> (<span className={upsideNum >= 0 ? 'text-[#11875D] font-semibold' : 'text-[#B56A00] font-semibold'}>
                {upsideNum >= 0 ? '+' : ''}{upsideNum.toFixed(1)}% vs today
              </span>)</>
            )}.
          </p>
        )
      })()}

      {/* Assumption health banner — shows audit grade + per-assumption signals */}
      {audit && (
        <div className="px-5 pt-4">
          <AssumptionHealthBanner
            audit={audit}
            onApplySuggestion={onAssumptionChange}
          />
        </div>
      )}

      {/* Editable sliders */}
      {editableAssumptions.length > 0 && (
        <div className="px-5 pt-5 pb-2 space-y-5">
          {editableAssumptions.map(a => {
            const isOverridden = a.key in overrides
            const raw = isOverridden ? overrides[a.key] : (a.value ?? 0)
            const displayVal = fmtAssumptionDisplay(a, overrides)
            const min  = a.min ?? 0
            const max  = a.max ?? (a.unit === '%' ? 1 : 100)
            const step = a.unit === '%' ? 0.005 : (a.step ?? 0.5)

            const heat = getSliderHeat(a.key, raw, a.benchmarks)
            const fillPct = max > min ? Math.round(((raw - min) / (max - min)) * 100) : 0
            const trackColor =
              heat.level === 'green'  ? '#22c55e' :
              heat.level === 'amber'  ? '#f59e0b' :
              heat.level === 'red'    ? '#ef4444' :
              '#3b82f6'
            const deviationMsg = heatDeviationMessage(heat, a.unit, a.sourceExplanation)

            return (
              <div key={a.key}>
                {/* Label row */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-semibold text-[#06101F]">{a.label}</span>
                    {a.description && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-[#E3E1DA] text-[#8A95A6] text-[10px] cursor-help">?</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-[12px]">
                            {a.description}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {/* Source badge */}
                    <span className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                      isOverridden
                        ? 'bg-[#EAF1FF] text-[#2563EB]'
                        : a.source === 'analyst_estimate'
                        ? 'bg-[#E8F7EF] text-[#11875D]'
                        : a.source === 'historical_3y_median' || a.source === 'historical_5y_median'
                        ? 'bg-[#EAF1FF] text-[#2563EB]'
                        : a.source === 'sector_fallback'
                        ? 'bg-[#FFF4DA] text-[#B56A00]'
                        : 'bg-[#E3E1DA] text-[#566174]',
                    )}>
                      {isOverridden ? 'Override' : sourceLabel(a.source)}
                    </span>
                  </div>
                  {/* Value + heat chip */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {heat.level !== 'neutral' && (
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
                        heat.level === 'green' ? 'bg-[#E8F7EF] border-[#CDD1C8] text-[#11875D]' :
                        heat.level === 'amber' ? 'bg-[#FFF4DA]  border-[#E3E1DA]  text-[#B56A00]'  :
                                                 'bg-[#FCEAEA]    border-[#E3E1DA]    text-[#D83B3B]',
                      )}>
                        {heat.level === 'red' ? '⚠ Aggressive' : heat.level === 'amber' ? '↑ Elevated' : '✓ Conservative'}
                      </span>
                    )}
                    <span className="text-sm font-semibold tabular-nums text-[#06101F]">
                      {displayVal}{a.unit === '%' ? '%' : a.unit === 'x' ? '×' : ''}
                    </span>
                  </div>
                </div>

                {/* Gradient-filled slider track */}
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={raw}
                  onChange={e => onAssumptionChange(a.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full cursor-pointer appearance-none"
                  style={{
                    background: `linear-gradient(to right, ${trackColor} ${fillPct}%, #E3E1DA ${fillPct}%)`,
                  }}
                />

                {/* Deviation message — smarter when benchmarks exist */}
                {deviationMsg && (
                  <p className={cn(
                    'text-[10px] mt-1 leading-tight',
                    heat.level === 'red'    ? 'text-[#D83B3B]   font-medium' :
                    heat.level === 'amber'  ? 'text-[#B56A00] font-medium' :
                    heat.level === 'green'  ? 'text-[#11875D] font-medium' :
                    'text-[#8A95A6]',
                  )}>
                    {heat.level === 'neutral' ? `▸ ${deviationMsg}` : deviationMsg}
                  </p>
                )}

                {/* Benchmark snap chips */}
                {a.benchmarks && a.benchmarks.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] text-[#8A95A6] shrink-0">Compare:</span>
                    {a.benchmarks.map(b => {
                      const isCurrent = Math.abs((a.key in overrides ? overrides[a.key] : (a.value ?? 0)) - b.value) < 0.0005
                      return (
                        <button
                          key={b.label}
                          onClick={() => onAssumptionChange(a.key, b.value)}
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full border tabular-nums transition-colors',
                            isCurrent
                              ? 'bg-[#EAF1FF] border-[#93B4F5] text-[#2563EB] font-semibold'
                              : 'bg-[#F0F1F6] border-[#E3E1DA] text-[#566174] hover:bg-[#EAF1FF] hover:border-[#93B4F5] hover:text-[#2563EB]',
                          )}
                        >
                          {b.label}: {fmtBenchmarkValue(b.value, a.unit)}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Inline audit signal — only when warn or error and NOT already shown in banner */}
                {(() => {
                  const ar = auditByKey[a.key] as AuditResult | undefined
                  if (!ar || ar.severity === 'ok') return null
                  return (
                    <div className={cn(
                      'mt-2 rounded-lg border px-2.5 py-2 text-[10px] leading-snug',
                      ar.severity === 'error'
                        ? 'bg-[#FEF2F2] border-[#FECACA] text-[#D83B3B]'
                        : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
                    )}>
                      <span className="font-semibold">
                        {ar.severity === 'error' ? '✗ ' : '⚠ '}{ar.signal}
                      </span>
                      {ar.suggestedValue != null && ar.key !== 'quality' && (
                        <button
                          onClick={() => onAssumptionChange(ar.key, ar.suggestedValue!)}
                          className="ml-2 underline decoration-dotted font-semibold hover:no-underline"
                        >
                          → Use {ar.key === 'exitPE' || ar.key === 'revenueMultiple'
                            ? `${ar.suggestedValue.toFixed(1)}×`
                            : `${(ar.suggestedValue * 100).toFixed(1)}%`}
                        </button>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}

      {/* Read-only key values */}
      {editableAssumptions.length === 0 && readonlyAssumptions.length > 0 && (
        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {readonlyAssumptions.map(a => (
              <div key={a.key} className="bg-[#F0F1F6] rounded-lg px-3 py-2">
                <p className="text-[10px] text-[#566174] font-medium uppercase tracking-wider">{a.label}</p>
                <p className="text-sm font-semibold tabular-nums text-[#06101F] mt-0.5">
                  {fmtAssumptionDisplay(a, overrides)}{a.unit === '%' ? '%' : a.unit === 'x' ? '×' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Results + Reset */}
      {(config.results.length > 0 || isModified) && (
        <div className="px-5 py-3 mt-2 border-t border-[#E3E1DA] bg-[#F0F1F6] flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-4 flex-wrap">
            {config.results.map((r, i) => (
              <div key={i} className="text-xs">
                <span className="text-[#566174]">{r.label}: </span>
                <span className={cn('font-semibold tabular-nums', resultToneClass(r.tone))}>
                  {r.formattedValue === '—' ? <NABadge reason="calc-error" /> : r.formattedValue}
                </span>
              </div>
            ))}
          </div>
          {isModified && (
            <button onClick={onResetOverrides} className="text-xs text-[#2563EB] hover:text-[#2563EB] underline shrink-0">
              Reset to model
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OverridesMap = Partial<Record<ValuationMethodId | 'ev_ebitda', Record<string, number>>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinancialsData = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StatementsData = any

interface ValuationLabProps {
  apiData: FinancialsData
  ticker: string
  statementsData?: StatementsData | null
  onNavigateToFinancials?: (rowKey: string, statement: 'income' | 'balance' | 'cashflow') => void
  onWeightedFVChange?: (fv: number | null) => void
  onActiveMethodChange?: (id: string | null) => void
}

// ─── MethodAccordion ──────────────────────────────────────────────────────────

interface MethodChip {
  label: string
  value: string
  linked?: boolean
  onToggleLink?: () => void
}

interface MethodAccordionProps {
  id: string
  title: string
  confidence: ConfidenceLevel | null
  verdict: string
  weight: number
  isOpen: boolean
  onToggle: () => void
  innerRef: (el: HTMLDivElement | null) => void
  fairValue: number | null
  upsidePct: number | null
  currency: string
  chips: MethodChip[]
  guide: string[]
  bestFor?: string
  children: React.ReactNode
}

function MethodAccordion({
  title, confidence, verdict, weight, isOpen, onToggle, innerRef,
  fairValue, upsidePct, currency, chips, guide, bestFor, children,
}: MethodAccordionProps) {
  return (
    <div ref={innerRef} className="glass-accordion-header rounded-xl overflow-hidden scroll-mt-4">
      {/* Clickable header row */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-[#F0F1F6]/60 transition-colors"
      >
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-[#8A95A6] transition-transform mt-0.5', isOpen ? 'rotate-180' : '')}
        />
        <div className="min-w-0 flex-1">
          {/* Row 1: name + confidence badge + FV + upside */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#06101F]">{title}</span>
            {confidence && <ConfidenceBadge level={confidence} />}
            {fairValue != null && (
              <span className="text-sm font-bold tabular-nums text-[#06101F] ml-auto">
                {fmtPrice(fairValue, currency)}
              </span>
            )}
            {upsidePct != null && <TrendBadge value={upsidePct} size="sm" />}
          </div>
          {/* Row 2: verdict */}
          {verdict && <p className="text-[11px] text-[#566174] mt-0.5 leading-snug">{verdict}</p>}
          {/* Row 3: best for */}
          {bestFor && (
            <p className="text-[10px] text-[#8A95A6] mt-1">
              <span className="font-semibold text-[#566174]">Best for:</span> {bestFor}
            </p>
          )}
        </div>
      </button>

      {/* Chips + weight bar row (outside the button to allow nested controls) */}
      {!isOpen && chips.length > 0 && (
        <div className="px-5 pb-3 -mt-1 flex items-center gap-1.5 flex-wrap">
          {chips.map(c => (
            <span
              key={c.label}
              className="inline-flex items-center gap-0.5 text-[10px] bg-[#E3E1DA] text-[#566174] px-2 py-0.5 rounded-full border border-[#E3E1DA]"
            >
              {c.label}: {c.value}
              {c.onToggleLink && (
                <button
                  onClick={e => { e.stopPropagation(); c.onToggleLink!() }}
                  className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
                  title={c.linked ? 'CAGR linked — click to unlink' : 'CAGR unlinked — click to link'}
                >
                  {c.linked ? '🔗' : '🔓'}
                </button>
              )}
            </span>
          ))}
          {weight > 0 && (
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-[#8A95A6]">{(weight * 100).toFixed(0)}% weight</span>
              <div className="w-14 h-1.5 rounded-full bg-[#E3E1DA] overflow-hidden">
                <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${weight * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-[#E3E1DA] bg-white"
          >
            <div className="[&_.card]:rounded-none [&_.card]:border-0 [&_.card]:shadow-none">
              {/* 3-step guide */}
              {guide.length > 0 && (
                <div className="px-5 pt-4 pb-3 bg-[#EAF1FF]/40 border-b border-[#93B4F5]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] mb-2">How to use this model</p>
                  <ol className="space-y-1.5">
                    {guide.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-[#EAF1FF] text-[#2563EB] text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-[11px] text-[#566174] leading-snug">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Method guides ────────────────────────────────────────────────────────────

const METHOD_GUIDES: Record<string, string[]> = {
  forward_pe: [
    'Check the Revenue CAGR — does it align with analyst consensus or your own growth outlook?',
    'Adjust the Exit P/E to reflect the company\'s mature multiple. Lower = conservative; higher = growth premium.',
    'Review Net Margin — ensure it reflects a sustainable long-term profitability level for this business.',
  ],
  ev_ebitda: [
    'Confirm the TTM EBITDA (trailing 12-month earnings before interest, taxes, D&A) is correct.',
    'The sector median multiple is applied automatically — adjust if you believe this company deserves a premium or discount.',
    'EV/EBITDA is less reliable for financial companies (banks, fintechs). Use Forward P/E or P/Book instead.',
  ],
  revenue_multiple: [
    'Revenue CAGR is shared with Forward P/E by default — changing it in either model updates both.',
    'Adjust the EV/Revenue exit multiple based on the company\'s expected profitability at maturity.',
    'Best suited for pre-profit or high-growth companies where earnings are not yet stable.',
  ],
  reverse_dcf: [
    'Read the "Market Implies" growth rate — this is the CAGR that justifies buying at today\'s price.',
    'Compare it to analyst consensus and 3-year historical CAGR. A large gap signals elevated expectations.',
    'If market-implied CAGR far exceeds both analyst and historical data, the stock may be priced for perfection.',
  ],
  full_dcf: [
    'Review WACC and terminal growth rate — small changes have outsized impact on fair value.',
    'The three models (FCFF, FCFE, DDM) are triangulated into a blended intrinsic estimate.',
    'Edit year-by-year projections in the table below for a precise, customized valuation.',
  ],
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationLab({ apiData, ticker, statementsData, onWeightedFVChange, onActiveMethodChange }: ValuationLabProps) {
  const [overrides,    setOverrides]    = useState<OverridesMap>({})
  const [linkedCAGR,   setLinkedCAGR]   = useState(true)
  const [openMethodId, setOpenMethodId] = useState<string | null>(null)
  const [sanityChecksOpen, setSanityChecksOpen] = useState(true)
  const [fullDcfLiveFV, setFullDcfLiveFV] = useState<number | null>(null)
  const methodRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const currency     = apiData?.quote?.currency ?? 'USD'
  const currentPrice = (apiData?.quote?.price   ?? 0) as number
  const assumptionAudit = (apiData?.assumptionAudit as AssumptionAudit | null | undefined) ?? null

  const cagrBenchmarks = useMemo(() => {
    const out: Array<{ label: string; value: number }> = []
    const analyst    = apiData?.cagrAnalysis?.analystEstimate1y ?? null
    const historical = apiData?.cagrAnalysis?.historicalCagr3y  ?? null
    if (analyst    != null) out.push({ label: 'Analyst consensus', value: analyst })
    if (historical != null) out.push({ label: '3Y historical',     value: historical })
    return out
  }, [apiData])

  // ── TTM data from statements ─────────────────────────────────────────────
  const ttmIS = statementsData?.ttm?.incomeStatement ?? {}
  const ttmCF = statementsData?.ttm?.cashFlow        ?? {}
  const ttmBS = statementsData?.ttm?.balanceSheet    ?? {}

  const ttmRevenue   = (ttmIS.totalRevenue  as number | null) ?? null
  const ttmEbitdaRaw = (ttmIS.EBITDA        as number | null) ?? null
  const ttmEbit      = ((ttmIS.operatingIncome ?? ttmIS.EBIT) as number | null) ?? null
  const ttmDAStmt    = (ttmIS.reconciledDepreciation as number | null) ?? null
  const ttmDACF      = ((ttmCF.depreciationAndAmortization ?? ttmCF.depreciationAmortizationDepletion) as number | null) ?? null
  const ttmDA        = ttmDAStmt ?? ttmDACF
  const ttmNetIncome = (ttmIS.netIncome     as number | null) ?? null
  const ttmTaxProv   = (ttmIS.taxProvision as number | null) ?? null
  const ttmIntExp    = Math.abs(((ttmIS.interestExpenseNonOperating ?? ttmIS.interestExpense) as number | null) ?? 0)
  const ttmEbitda    = ttmEbitdaRaw
    ?? (ttmEbit != null && ttmDA != null ? ttmEbit + ttmDA : null)
    ?? (ttmNetIncome != null && ttmDA != null
        ? ttmNetIncome + Math.abs(ttmTaxProv ?? 0) + ttmIntExp + ttmDA
        : null)
  const ttmFCF       = (ttmCF.freeCashFlow  as number | null) ?? null
  const ttmTotalDebt = (ttmBS.totalDebt     as number | null) ?? null
  const ttmCash      = ((ttmBS.cashCashEquivalentsAndShortTermInvestments ?? ttmBS.cash) as number | null) ?? null
  const ttmNetDebt   = ttmTotalDebt != null && ttmCash != null ? ttmTotalDebt - ttmCash : null
  const ttmShares    = ((ttmBS.commonStockSharesOutstanding ?? ttmBS.sharesOutstanding) as number | null) ?? null

  const stmtFxRate = (apiData?.providerStatus?.fx?.rate as number | undefined) ?? 1

  const sharesAbsolute = (apiData?.fairValue?.sharesOutstanding != null ? apiData.fairValue.sharesOutstanding * 1e6 : null) ?? ttmShares

  // ── Derived assumptions ──────────────────────────────────────────────────
  const fwdPEBase   = useMemo(() => deriveForwardPEAssumptions(apiData), [apiData])
  const revMultBase = useMemo(() => deriveRevenueMultipleAssumptions(apiData), [apiData])

  const ltvRevenueAbsolute = (ttmRevenue != null ? ttmRevenue * stmtFxRate : null) ?? (fwdPEBase.ltvRevenue != null ? fwdPEBase.ltvRevenue * 1e6 : null)

  const evEbitdaBase = useMemo(() => {
    const ebitdaFromTTM     = ttmEbitda != null ? ttmEbitda * stmtFxRate : null
    const ebitdaFromFinStmt = (apiData?.financialStatements?.incomeStatement?.find((r: { isProjected?: boolean; ebitda?: number | null }) => !r.isProjected)?.ebitda ?? null) as number | null
    const ebitda            = ebitdaFromTTM ?? (ebitdaFromFinStmt != null ? ebitdaFromFinStmt * 1e6 : null)
    const shares     = sharesAbsolute
    const cashFMP    = apiData?.fairValue?.cash != null ? apiData.fairValue.cash * 1e6 : null
    const debtFMP    = apiData?.fairValue?.debt != null ? apiData.fairValue.debt * 1e6 : null
    const netDebtRaw = ttmNetDebt != null ? ttmNetDebt * stmtFxRate : null
    const annualBS   = apiData?.financialStatements?.balanceSheet?.find((r: { isProjected?: boolean }) => !r.isProjected)
    const cashBS     = annualBS?.cash != null ? (annualBS.cash as number) * 1e6 : null
    const debtBS     = annualBS?.longTermDebt != null ? (annualBS.longTermDebt as number) * 1e6 : null
    const netDebt    = netDebtRaw ?? (debtFMP != null && cashFMP != null ? debtFMP - cashFMP : null) ?? (debtBS != null && cashBS != null ? debtBS - cashBS : null)
    const sector     = apiData?.quote?.sector ?? null
    const industry   = apiData?.quote?.industry ?? null
    const crp        = (apiData?.wacc as { crp?: number } | undefined)?.crp ?? 0

    // Resolve current EV/EBITDA from multiples estimates or compute from market cap
    const multEstimates: Array<{ multiple: string; actualValue: number }> =
      (apiData as { valuationMethods?: { models?: { multiples?: { estimates?: unknown[] } } } })
        ?.valuationMethods?.models?.multiples?.estimates as Array<{ multiple: string; actualValue: number }> ?? []
    const actualEvEbitdaFromEstimates = multEstimates.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
    const marketCapRaw = (apiData?.quote?.marketCap as number | null | undefined) ?? null
    const computedEvEbitda = (actualEvEbitdaFromEstimates == null && marketCapRaw != null && ebitda != null && ebitda > 0)
      ? (marketCapRaw + (netDebt ?? 0)) / ebitda
      : null
    const currentEVEBITDA = actualEvEbitdaFromEstimates ?? computedEvEbitda

    const { multiple, sectorMedian } = blendEVEBITDAMultiple(sector, industry, currentEVEBITDA, crp)
    return { ebitda, netDebt, shares, exitMultiple: multiple, sectorMedian, currentEVEBITDA, sector }
  }, [apiData, ttmEbitda, ttmNetDebt, sharesAbsolute, stmtFxRate])

  // ── Forward P/E ──────────────────────────────────────────────────────────
  const fwdPEOverrides = useMemo(() => overrides['forward_pe'] ?? {}, [overrides])
  const fwdPEInputs = useMemo(() => ({
    ltvRevenue:        fwdPEOverrides.ltvRevenue        ?? ltvRevenueAbsolute,
    sharesOutstanding: fwdPEOverrides.sharesOutstanding ?? sharesAbsolute,
    revenueCAGR:       fwdPEOverrides.revenueCAGR       ?? fwdPEBase.revenueCAGR,
    netMargin:         fwdPEOverrides.netMargin         ?? fwdPEBase.netMargin,
    exitPE:            fwdPEOverrides.exitPE            ?? fwdPEBase.exitPE,
    dilutionRate:      fwdPEOverrides.dilutionRate      ?? fwdPEBase.dilutionRate,
    discountRate:      fwdPEOverrides.discountRate      ?? fwdPEBase.discountRate,
    currentPrice,
    dividendYield:     null,
  }), [fwdPEBase, fwdPEOverrides, currentPrice, ltvRevenueAbsolute, sharesAbsolute])
  const fwdPEResult = useMemo(() => computeForwardPE(fwdPEInputs), [fwdPEInputs])

  const fwdPEConfig = useMemo((): ValuationMethodConfig => ({
    id: 'forward_pe', title: 'Forward P/E', subtitle: '5-year target price discounted to today',
    methodDescription: 'Projects revenue 5 years forward using analyst growth estimates, applies a net margin target, multiplies by an exit P/E to get a future market cap, then discounts back to today at the WACC.',
    companyName: apiData?.companyName ?? ticker, ticker, currency,
    evidence:    fwdPEBase.evidence,
    assumptions: fwdPEBase.assumptions.map(a => {
      if (a.key === 'ltvRevenue' && ltvRevenueAbsolute != null) return { ...a, value: ltvRevenueAbsolute }
      if (a.key === 'sharesOutstanding' && sharesAbsolute != null) return { ...a, value: sharesAbsolute }
      if (a.key === 'revenueCAGR' && cagrBenchmarks.length > 0) return { ...a, benchmarks: cagrBenchmarks }
      return a
    }),
    formulaLines: [],
    results:     buildForwardPEResults(fwdPEResult, currentPrice, currency),
    warnings:    fwdPEResult.guardErrors,
    fairValueSummary: fwdPEResult.fairValueToday,
    currentPrice,
  }), [fwdPEBase, fwdPEResult, ticker, currency, currentPrice, apiData, ltvRevenueAbsolute, sharesAbsolute, cagrBenchmarks])

  // ── Revenue Multiple ─────────────────────────────────────────────────────
  const revMultOverrides = useMemo(() => overrides['revenue_multiple'] ?? {}, [overrides])
  const revMultInputs = useMemo(() => ({
    ltvRevenue:        revMultOverrides.ltvRevenue        ?? ltvRevenueAbsolute,
    sharesOutstanding: revMultOverrides.sharesOutstanding ?? sharesAbsolute,
    revenueCAGR:       revMultOverrides.revenueCAGR       ?? revMultBase.revenueCAGR,
    exitEVRevenue:     revMultOverrides.exitEVRevenue     ?? revMultBase.exitEVRevenue,
    netDebt:           revMultOverrides.netDebt           ?? revMultBase.netDebt,
    dilutionRate:      revMultOverrides.dilutionRate      ?? revMultBase.dilutionRate,
    discountRate:      revMultOverrides.discountRate      ?? revMultBase.discountRate,
    currentPrice,
    dividendYield:     null,
  }), [revMultBase, revMultOverrides, currentPrice, ltvRevenueAbsolute, sharesAbsolute])
  const revMultResult = useMemo(() => computeRevenueMultiple(revMultInputs), [revMultInputs])
  const revMultConfig = useMemo((): ValuationMethodConfig => ({
    id: 'revenue_multiple', title: 'Revenue Multiple', subtitle: 'EV/Revenue exit multiple discounted to today',
    methodDescription: 'Projects revenue 5 years forward, applies an EV/Revenue exit multiple for a future enterprise value, subtracts net debt, and discounts back at the WACC. Common for pre-profit or high-growth companies.',
    companyName: apiData?.companyName ?? ticker, ticker, currency,
    evidence:    revMultBase.evidence,
    assumptions: revMultBase.assumptions.map(a =>
      a.key === 'ltvRevenue' && ltvRevenueAbsolute != null ? { ...a, value: ltvRevenueAbsolute }
      : a.key === 'revenueCAGR' && cagrBenchmarks.length > 0 ? { ...a, benchmarks: cagrBenchmarks }
      : a
    ),
    formulaLines: [],
    results:     buildRevMultipleResults(revMultResult, currentPrice, currency),
    warnings:    revMultResult.guardErrors,
    fairValueSummary: revMultResult.fairValueToday,
    currentPrice,
  }), [revMultBase, revMultResult, ticker, currency, currentPrice, apiData, ltvRevenueAbsolute, cagrBenchmarks])

  // ── EV/EBITDA ────────────────────────────────────────────────────────────
  const evEbitdaOverrides = useMemo(() => overrides['ev_ebitda'] ?? {}, [overrides])
  const evEbitdaInputs = useMemo(() => ({
    ttmEbitda:    evEbitdaOverrides.ttmEbitda    ?? evEbitdaBase.ebitda,
    netDebt:      evEbitdaOverrides.netDebt      ?? evEbitdaBase.netDebt,
    shares:       evEbitdaOverrides.shares       ?? evEbitdaBase.shares,
    exitMultiple: evEbitdaOverrides.exitMultiple ?? evEbitdaBase.exitMultiple,
    currentPrice,
  }), [evEbitdaBase, evEbitdaOverrides, currentPrice])
  const evEbitdaResult = useMemo(() => computeEVEBITDA(evEbitdaInputs), [evEbitdaInputs])
  const evEbitdaConfig = useMemo((): ValuationMethodConfig => {
    const sect        = evEbitdaBase.sector ?? 'Unknown'
    const multiple    = evEbitdaInputs.exitMultiple
    const sectorMed   = evEbitdaBase.sectorMedian
    const currentEV   = evEbitdaBase.currentEVEBITDA
    const companyEVEBITDAStr = currentEV != null && currentEV > 0 ? `${currentEV.toFixed(1)}×` : 'N/A'
    const exitMultipleText = currentEV != null && currentEV > 0
      ? `Blend: current ${companyEVEBITDAStr} × 55% + sector ${sectorMed?.toFixed(0)}×  × 35% → ${multiple.toFixed(1)}× (${sect})`
      : `Sector median ${sectorMed?.toFixed(0)}× (${sect}); company current EV/EBITDA: ${companyEVEBITDAStr}`
    const financialSectorWarning = /financial|bank|insurance|fintech|payment/i.test(sect)
      ? 'EV/EBITDA is less reliable for financial-sector companies (banks, fintechs, payment processors) because balance-sheet debt is an operating input, not leverage — consider P/E or P/Book instead.'
      : null
    return {
      id: 'ev_ebitda',
      title: 'EV/EBITDA', subtitle: 'Enterprise value to EBITDA exit multiple',
      methodDescription: "Applies a sector-typical EV/EBITDA multiple to TTM earnings for a spot enterprise value. Subtracts net debt, divides by shares. No growth assumptions required — it's a current-state valuation.",
      companyName: apiData?.companyName ?? ticker, ticker, currency,
      evidence: [
        { label: 'TTM EBITDA',    text: evEbitdaInputs.ttmEbitda != null ? fmtB(evEbitdaInputs.ttmEbitda) + ' (trailing 12 months, Yahoo Finance)' : 'Not available', rowKey: 'EBITDA', statement: 'income' },
        { label: 'Net Debt',      text: evEbitdaInputs.netDebt   != null ? fmtB(evEbitdaInputs.netDebt)   + ' (total debt − cash)' : 'Not available — assumed 0', rowKey: 'totalDebt', statement: 'balance' },
        { label: 'Shares',        text: evEbitdaInputs.shares    != null ? (evEbitdaInputs.shares / 1e9).toFixed(3) + 'B shares outstanding' : 'Not available', rowKey: 'ordinarySharesNumber', statement: 'balance' },
        { label: 'Exit Multiple', text: exitMultipleText },
      ],
      assumptions: [
        { key: 'ttmEbitda',    label: 'TTM EBITDA',         editable: false, value: evEbitdaInputs.ttmEbitda, unit: '$', source: 'historical_3y_median' as const },
        { key: 'netDebt',      label: 'Net Debt',           editable: false, value: evEbitdaInputs.netDebt,   unit: '$', source: 'historical_3y_median' as const },
        { key: 'exitMultiple', label: 'EV/EBITDA Multiple', editable: true,  value: multiple, unit: 'x', min: 1, max: 50, step: 0.5,
          source: (currentEV != null && currentEV > 0 ? 'historical_3y_median' : 'sector_fallback') as 'historical_3y_median' | 'sector_fallback',
          sourceExplanation: exitMultipleText, description: 'EV/EBITDA multiple at valuation — blends current trading multiple with sector median',
          benchmarks: [
            ...(sectorMed != null ? [{ label: 'Sector', value: sectorMed }] : []),
            ...(currentEV != null && currentEV > 0 ? [{ label: 'Current EV/EBITDA', value: currentEV }] : []),
          ],
        },
      ],
      formulaLines: [],
      results:  buildEVEBITDAResults(evEbitdaResult, currentPrice, currency),
      warnings: [...(evEbitdaResult.guardErrors ?? []), ...(financialSectorWarning ? [financialSectorWarning] : [])],
      fairValueSummary: evEbitdaResult.fairValuePerShare,
      currentPrice,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evEbitdaBase, evEbitdaInputs, evEbitdaResult, ticker, currency, currentPrice, apiData])

  // ── Reverse DCF ──────────────────────────────────────────────────────────
  const incomeRows = useMemo(() =>
    (apiData?.financialStatements?.incomeStatement ?? []) as Array<{ revenue: number | null; netIncome: number | null; freeCashFlow?: number | null; isProjected: boolean }>,
    [apiData?.financialStatements?.incomeStatement]
  )
  const cashFlowRows = useMemo(() =>
    (apiData?.financialStatements?.cashFlow ?? []) as Array<{ freeCashFlow: number | null; isProjected: boolean }>,
    [apiData?.financialStatements?.cashFlow]
  )

  const lastActualRevenue = useMemo(() => {
    if (ttmRevenue != null) return ttmRevenue * stmtFxRate
    const actuals = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
    const revM = actuals.length > 0 ? actuals[actuals.length - 1].revenue! : null
    return revM != null ? revM * 1e6 : null
  }, [incomeRows, ttmRevenue, stmtFxRate])

  const lastFCFMargin = useMemo(() => {
    // Cap at 45% — same ceiling as route.ts. Prevents fintech/payment companies
    // (e.g. MELI Mercado Crédito) with loan-distorted OCF from producing inflated margins.
    const CAP = 0.45
    if (ttmRevenue != null && ttmFCF != null && ttmRevenue > 0) {
      const m = ttmFCF / ttmRevenue
      return m > 0 ? Math.min(m, CAP) : m
    }
    const actRev = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
    const actFCF = cashFlowRows.filter(r => !r.isProjected && r.freeCashFlow != null)
    const revM = actRev.slice(-1)[0]?.revenue ?? null
    const fcfM = actFCF.slice(-1)[0]?.freeCashFlow ?? null
    if (revM == null || revM <= 0 || fcfM == null) return null
    const m = fcfM / revM
    return m > 0 ? Math.min(m, CAP) : m
  }, [cashFlowRows, incomeRows, ttmRevenue, ttmFCF])

  const reverseDCFResult = useMemo(() => computeReverseDCF({
    currentPrice,
    sharesOutstanding: sharesAbsolute,
    cashM:    apiData?.fairValue?.cash ?? null,
    debtM:    apiData?.fairValue?.debt ?? null,
    lastRevenue: apiData?.businessProfile?.revenueM != null
      ? (apiData.businessProfile.revenueM as number) * 1e6
      : lastActualRevenue,
    lastFCFMargin: apiData?.businessProfile?.fcfMargin ?? lastFCFMargin,
    wacc:     apiData?.wacc?.wacc   ?? 0.10,
    terminalG:apiData?.terminalG    ?? 0.03,
    historicalCAGR: apiData?.cagrAnalysis?.historicalCagr3y ?? null,
  }), [currentPrice, apiData, lastActualRevenue, lastFCFMargin, sharesAbsolute])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleAssumptionChange(methodId: ValuationMethodId | 'ev_ebitda', key: string, value: number) {
    setOverrides(prev => {
      const updated = { ...prev, [methodId]: { ...(prev[methodId] ?? {}), [key]: value } }
      if (linkedCAGR && key === 'revenueCAGR' && (methodId === 'forward_pe' || methodId === 'revenue_multiple')) {
        updated['forward_pe']       = { ...(updated['forward_pe']       ?? {}), revenueCAGR: value }
        updated['revenue_multiple'] = { ...(updated['revenue_multiple'] ?? {}), revenueCAGR: value }
      }
      return updated
    })
  }
  function handleResetOverrides(methodId: ValuationMethodId | 'ev_ebitda') {
    setOverrides(prev => { const n = { ...prev }; delete n[methodId]; return n })
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const coreDcfFV = fullDcfLiveFV ?? (apiData?.valuationMethods?.triangulatedFairValue as number | null) ?? null
  const coreDcfUpside = coreDcfFV != null && currentPrice > 0 ? (coreDcfFV - currentPrice) / currentPrice : (apiData?.valuationMethods?.triangulatedUpsidePct as number | null) ?? null
  const summaryMethods: MethodResult[] = [
    { id: 'forward_pe',       label: 'Forward P/E (5Y)',          fairValue: fwdPEResult.fairValueToday,       upsidePct: fwdPEResult.upsidePct,           weight: 0.35 },
    { id: 'ev_ebitda',        label: 'EV/EBITDA',                 fairValue: evEbitdaResult.fairValuePerShare, upsidePct: evEbitdaResult.upsidePct,        weight: 0.30 },
    { id: 'revenue_multiple', label: 'Revenue Multiple',          fairValue: revMultResult.fairValueToday,     upsidePct: revMultResult.upsidePct,         weight: 0.25 },
    { id: 'core_dcf',         label: 'Core DCF (FCFF/FCFE/DDM)',  fairValue: coreDcfFV, upsidePct: coreDcfUpside, weight: 0.10 },
  ]

  const weightedFV = useMemo(() => {
    const valid = summaryMethods.filter(m => m.fairValue != null && m.weight > 0)
    if (!valid.length) return null
    const total = valid.reduce((s, m) => s + m.weight, 0)
    return valid.reduce((s, m) => s + m.fairValue! * m.weight, 0) / total
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fwdPEResult, evEbitdaResult, revMultResult, apiData])

  useEffect(() => { onWeightedFVChange?.(weightedFV) }, [weightedFV, onWeightedFVChange])
  useEffect(() => { onActiveMethodChange?.(openMethodId) }, [openMethodId, onActiveMethodChange])

  // ── Reverse DCF verdict ───────────────────────────────────────────────────
  const reverseDCFVerdictMap: Record<string, string> = {
    conservative:    'Market implies conservative growth — stock may be undervalued',
    reasonable:      'Market growth expectations look reasonable relative to fundamentals',
    aggressive:      'Market implies aggressive growth — high bar for the company to meet',
    very_aggressive: 'Implied growth is very aggressive — significant execution risk priced in',
  }
  const reverseDCFVerdict = (reverseDCFResult.interpretation ? reverseDCFVerdictMap[reverseDCFResult.interpretation] : null)
    ?? 'What growth rate does today\'s price require?'

  return (
    <div className="space-y-4">

      {/* ── 1. Fair Value by Method ──────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E3E1DA] bg-white/70 px-4 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8A95A6] mb-3">Fair Value by Method</p>
        <div className="space-y-2">
          {summaryMethods.map(m => {
            if (m.fairValue == null) return (
              <div key={m.id} className="flex items-center gap-2 sm:gap-3 opacity-40">
                <span className="text-[11px] text-[#8A95A6] w-24 sm:w-36 shrink-0 truncate">{m.label}</span>
                <div className="flex-1 h-4 bg-[#E3E1DA] rounded-full" />
                <span className="text-[11px] text-[#8A95A6] w-10 sm:w-16 text-right">N/A</span>
                <span className="text-[11px] text-[#8A95A6] w-10 sm:w-16 text-right">—</span>
              </div>
            )
            const upside = m.upsidePct ?? 0
            const isUp = upside >= 0
            const barWidth = Math.min(Math.abs(upside) * 100 / 2, 48)
            return (
              <div key={m.id} className="flex items-center gap-2 sm:gap-3">
                <span className="text-[11px] text-[#566174] w-24 sm:w-36 shrink-0 truncate">{m.label}</span>
                <div className="flex-1 relative h-4 bg-[#E3E1DA] rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 bottom-0 rounded-full ${isUp ? 'bg-[#11875D]' : 'bg-[#D83B3B]'}`}
                    style={isUp
                      ? { left: '50%', width: `${barWidth}%` }
                      : { right: '50%', width: `${barWidth}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-[1.5px] bg-[#8A95A6]" />
                </div>
                <span className={`text-[12px] font-semibold tabular-nums w-10 sm:w-14 text-right ${isUp ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                  {isUp ? '+' : ''}{(upside * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] text-[#566174] w-12 sm:w-16 text-right tabular-nums font-mono">{currency}{m.fairValue.toFixed(2)}</span>
              </div>
            )
          })}
          {weightedFV != null && (() => {
            const upside = currentPrice > 0 ? (weightedFV - currentPrice) / currentPrice : 0
            const isUp = upside >= 0
            const barWidth = Math.min(Math.abs(upside) * 100 / 2, 48)
            return (
              <div className="flex items-center gap-2 sm:gap-3 pt-2 border-t border-[#E3E1DA] mt-1">
                <span className="text-[11px] font-bold text-[#06101F] w-24 sm:w-36 shrink-0">Blended Estimate</span>
                <div className="flex-1 relative h-4 bg-[#EAF1FF] rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 bottom-0 rounded-full ${isUp ? 'bg-[#2563EB]' : 'bg-orange-400'}`}
                    style={isUp
                      ? { left: '50%', width: `${barWidth}%` }
                      : { right: '50%', width: `${barWidth}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-[1.5px] bg-[#566174]" />
                </div>
                <span className={`text-[12px] font-bold tabular-nums w-10 sm:w-14 text-right ${isUp ? 'text-[#2563EB]' : 'text-orange-600'}`}>
                  {isUp ? '+' : ''}{(upside * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] font-bold text-[#06101F] w-12 sm:w-16 text-right tabular-nums font-mono">{currency}{weightedFV.toFixed(2)}</span>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── 2. Valuation Summary — lollipop chart ────────────────────────── */}
      <ValuationSummary
        methods={summaryMethods}
        currentPrice={currentPrice}
        currency={currency}
      />

      {/* ── 3. Method cards ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Reverse DCF — what growth does the price assume? */}
        <MethodAccordion
          id="reverse_dcf"
          title="Reverse DCF"
          confidence={null}
          verdict={reverseDCFVerdict}
          weight={0}
          isOpen={openMethodId === 'reverse_dcf'}
          onToggle={() => setOpenMethodId(p => p === 'reverse_dcf' ? null : 'reverse_dcf')}
          innerRef={el => { methodRefs.current['reverse_dcf'] = el }}
          fairValue={null}
          upsidePct={null}
          currency={currency}
          chips={[
            { label: 'Implied CAGR', value: reverseDCFResult.impliedCAGR != null ? (reverseDCFResult.impliedCAGR * 100).toFixed(1) + '%' : '—' },
            { label: 'WACC', value: ((apiData?.wacc?.wacc ?? 0.09) * 100).toFixed(1) + '%' },
          ]}
          guide={METHOD_GUIDES.reverse_dcf}
          bestFor="Checking whether the market's growth expectations are realistic"
        >
          <ReverseDCFPanel
            result={reverseDCFResult}
            cagrAnalysis={apiData?.cagrAnalysis ?? null}
            wacc={apiData?.wacc?.wacc ?? 0.09}
            terminalG={apiData?.terminalG ?? 0.025}
            lastFCFMargin={lastFCFMargin}
            lastRevenue={lastActualRevenue}
            currentPrice={currentPrice}
            cashM={apiData?.fairValue?.cash ?? null}
            debtM={apiData?.fairValue?.debt ?? null}
            sharesAbsolute={sharesAbsolute}
            currency={currency}
          />
        </MethodAccordion>

        {/* Full DCF — build your own estimate */}
        <MethodAccordion
          id="full_dcf"
          title="Full DCF Modelling Table"
          confidence="high"
          verdict={methodVerdict(coreDcfUpside)}
          weight={0.10}
          isOpen={openMethodId === 'full_dcf'}
          onToggle={() => setOpenMethodId(p => p === 'full_dcf' ? null : 'full_dcf')}
          innerRef={el => { methodRefs.current['full_dcf'] = el }}
          fairValue={coreDcfFV}
          upsidePct={coreDcfUpside}
          currency={currency}
          chips={[
            { label: 'WACC', value: ((apiData?.wacc?.wacc ?? 0.09) * 100).toFixed(1) + '%' },
            { label: 'Terminal G', value: ((apiData?.terminalG ?? 0.025) * 100).toFixed(1) + '%' },
          ]}
          guide={METHOD_GUIDES.full_dcf}
          bestFor="Advanced: adjust year-by-year projections for a precise, customised estimate"
        >
          {/* Executive DCF summary */}
          {coreDcfFV != null && (
            <div className="px-5 pt-4 pb-3 border-b border-[#E3E1DA] bg-[#F0F1F6]/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A95A6] mb-2">
                {fullDcfLiveFV != null ? 'Modelling Table Result' : 'Core DCF Result'}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] text-[#566174]">Fair Value</p>
                  <p className="text-lg font-bold tabular-nums text-[#06101F]">
                    {fmtPrice(coreDcfFV!, currency)}
                  </p>
                </div>
                {coreDcfUpside != null && (
                  <TrendBadge value={coreDcfUpside} size="lg" />
                )}
                <div className="ml-auto flex gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] text-[#566174]">WACC</p>
                    <p className="text-sm font-semibold tabular-nums text-[#06101F]">
                      {((apiData?.wacc?.wacc ?? 0.09) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#566174]">Terminal G</p>
                    <p className="text-sm font-semibold tabular-nums text-[#06101F]">
                      {((apiData?.terminalG ?? 0.025) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-[#566174] mt-2">
                {fullDcfLiveFV != null
                  ? 'Derived from the modelling table below — updates as you edit projections.'
                  : 'UFCF & LFCF · Perpetuity Growth & Exit Multiple blend — Damodaran four-model average.'}
              </p>
            </div>
          )}
          <ModellingWorkspace apiData={apiData} ticker={ticker} statementsData={statementsData} onDerivedFVChange={setFullDcfLiveFV} />
        </MethodAccordion>        {/* ── Sanity Checks — Multiples ─────────────────────────────────────── */}
        <div className="glass-accordion-header rounded-xl overflow-hidden">
          <button
            onClick={() => setSanityChecksOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#F0F1F6]/60 transition-colors text-left"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#06101F]">Sanity Checks — Multiples</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E3E1DA] text-[#566174] border border-[#E3E1DA] uppercase tracking-wider">3 models</span>
              </div>
              <p className="text-[11px] text-[#566174] mt-0.5">Forward P/E · EV/EBITDA · Revenue Multiple — how the market prices peers. Best used as a cross-check against DCF results.</p>
            </div>
            <ChevronDown
              size={14}
              className={cn('shrink-0 text-[#8A95A6] transition-transform ml-3', sanityChecksOpen ? 'rotate-180' : '')}
            />
          </button>
          <AnimatePresence>
            {sanityChecksOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden border-t border-[#E3E1DA]"
              >
                <div className="p-3 space-y-3">
                  <MethodAccordion
                    id="forward_pe"
                    title={fwdPEConfig.title}
                    confidence="high"
                    verdict={methodVerdict(fwdPEResult.upsidePct)}
                    weight={0.35}
                    isOpen={openMethodId === 'forward_pe'}
                    onToggle={() => setOpenMethodId(p => p === 'forward_pe' ? null : 'forward_pe')}
                    innerRef={el => { methodRefs.current['forward_pe'] = el }}
                    fairValue={fwdPEResult.fairValueToday}
                    upsidePct={fwdPEResult.upsidePct}
                    currency={currency}
                    chips={[
                      { label: 'CAGR', value: fwdPEInputs.revenueCAGR != null ? (fwdPEInputs.revenueCAGR * 100).toFixed(1) + '%' : '—', linked: linkedCAGR, onToggleLink: () => setLinkedCAGR(v => !v) },
                      { label: 'Exit P/E', value: fwdPEInputs.exitPE != null ? (fwdPEInputs.exitPE as number).toFixed(1) + '×' : '—' },
                      { label: 'Margin', value: fwdPEInputs.netMargin != null ? (fwdPEInputs.netMargin * 100).toFixed(1) + '%' : '—' },
                    ]}
                    guide={METHOD_GUIDES.forward_pe}
                    bestFor="Profitable companies with stable, predictable earnings"
                  >
                    <MethodInlinePanel
                      config={fwdPEConfig}
                      overrides={overrides['forward_pe'] ?? {}}
                      currency={currency}
                      onAssumptionChange={(key, val) => handleAssumptionChange('forward_pe', key, val)}
                      onResetOverrides={() => handleResetOverrides('forward_pe')}
                      audit={assumptionAudit}
                    />
                  </MethodAccordion>

                  <MethodAccordion
                    id="ev_ebitda"
                    title={evEbitdaConfig.title}
                    confidence="medium"
                    verdict={methodVerdict(evEbitdaResult.upsidePct)}
                    weight={0.30}
                    isOpen={openMethodId === 'ev_ebitda'}
                    onToggle={() => setOpenMethodId(p => p === 'ev_ebitda' ? null : 'ev_ebitda')}
                    innerRef={el => { methodRefs.current['ev_ebitda'] = el }}
                    fairValue={evEbitdaResult.fairValuePerShare}
                    upsidePct={evEbitdaResult.upsidePct}
                    currency={currency}
                    chips={[
                      { label: 'Multiple', value: evEbitdaInputs.exitMultiple != null ? evEbitdaInputs.exitMultiple.toFixed(1) + '×' : '—' },
                      { label: 'EBITDA', value: evEbitdaInputs.ttmEbitda != null ? fmtLargeCurrency(evEbitdaInputs.ttmEbitda) : '—' },
                    ]}
                    guide={METHOD_GUIDES.ev_ebitda}
                    bestFor="Capital-intensive or mature businesses with stable EBITDA"
                  >
                    <MethodInlinePanel
                      config={evEbitdaConfig}
                      overrides={overrides['ev_ebitda'] ?? {}}
                      currency={currency}
                      onAssumptionChange={(key, val) => handleAssumptionChange('ev_ebitda', key, val)}
                      onResetOverrides={() => handleResetOverrides('ev_ebitda')}
                      audit={assumptionAudit}
                    />
                  </MethodAccordion>

                  <MethodAccordion
                    id="revenue_multiple"
                    title={revMultConfig.title}
                    confidence="medium"
                    verdict={methodVerdict(revMultResult.upsidePct)}
                    weight={0.25}
                    isOpen={openMethodId === 'revenue_multiple'}
                    onToggle={() => setOpenMethodId(p => p === 'revenue_multiple' ? null : 'revenue_multiple')}
                    innerRef={el => { methodRefs.current['revenue_multiple'] = el }}
                    fairValue={revMultResult.fairValueToday}
                    upsidePct={revMultResult.upsidePct}
                    currency={currency}
                    chips={[
                      { label: 'CAGR', value: revMultInputs.revenueCAGR != null ? (revMultInputs.revenueCAGR * 100).toFixed(1) + '%' : '—', linked: linkedCAGR, onToggleLink: () => setLinkedCAGR(v => !v) },
                      { label: 'EV/Rev', value: revMultInputs.exitEVRevenue != null ? (revMultInputs.exitEVRevenue as number).toFixed(1) + '×' : '—' },
                    ]}
                    guide={METHOD_GUIDES.revenue_multiple}
                    bestFor="Pre-profit or high-growth companies where earnings aren't stable yet"
                  >
                    <MethodInlinePanel
                      config={revMultConfig}
                      overrides={overrides['revenue_multiple'] ?? {}}
                      currency={currency}
                      onAssumptionChange={(key, val) => handleAssumptionChange('revenue_multiple', key, val)}
                      onResetOverrides={() => handleResetOverrides('revenue_multiple')}
                      audit={assumptionAudit}
                    />
                  </MethodAccordion>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── How We Value section ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E3E1DA] bg-white/70 px-4 py-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8A95A6] mb-4">How We Value {ticker}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { step: 1, title: 'Gather Data', body: 'Pull live financials, analyst estimates, and market data from Yahoo Finance.' },
            { step: 2, title: 'Run Models', body: 'DCF, multiples, and Reverse DCF reveal intrinsic value from different angles.' },
            { step: 3, title: 'Weight Results', body: 'Model weights are calibrated to company type and data quality.' },
            { step: 4, title: 'Stress Test', body: 'Bear / Base / Bull scenarios show the margin of safety across outcomes.' },
          ].map(({ step, title, body }) => (
            <div key={step} className="flex flex-col gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white">{step}</span>
              </div>
              <p className="text-[13px] font-semibold text-[#06101F]">{title}</p>
              <p className="text-[11px] text-[#566174] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Valuation Models summary cards ───────────────────────────────── */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#8A95A6] mb-3">Valuation Models</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryMethods.map(m => {
            const isUp = m.upsidePct != null && m.upsidePct >= 0
            return (
              <button
                key={m.id}
                onClick={() => {
                  const target = m.id === 'core_dcf' ? 'full_dcf' : m.id
                  setOpenMethodId(p => p === target ? null : target)
                  setTimeout(() => methodRefs.current[target]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
                }}
                className="text-left rounded-xl border border-[#E3E1DA] bg-white/80 hover:bg-white hover:border-[#93B4F5] transition-colors px-4 py-3 space-y-1.5"
              >
                <p className="text-[11px] font-bold text-[#06101F]">{m.label}</p>
                {m.fairValue != null ? (
                  <>
                    <p className="text-[18px] font-bold text-[#06101F] tabular-nums leading-none">{currency}{m.fairValue.toFixed(2)}</p>
                    <p className={`text-[12px] font-semibold ${isUp ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                      {isUp ? '+' : ''}{((m.upsidePct ?? 0) * 100).toFixed(1)}% upside
                    </p>
                  </>
                ) : (
                  <p className="text-[12px] text-[#8A95A6] italic">Not applicable</p>
                )}
                <p className="text-[10px] text-[#8A95A6]">{(m.weight * 100).toFixed(0)}% weight</p>
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
