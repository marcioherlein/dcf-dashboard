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
import { computeEVEBITDA, getDefaultEVEBITDAMultiple } from '@/lib/valuation/methods/evEbitda'
import {
  deriveForwardPEAssumptions,
  deriveRevenueMultipleAssumptions,
} from '@/lib/valuation/assumptions/deriveAssumptions'
import { fmtPrice, fmtPct, fmtLargeCurrency } from '@/lib/formatters'
import { TrendBadge } from '@/components/ui/trend-badge'
import { NABadge } from '@/components/ui/na-badge'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

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

// ─── Inline method panel helpers ──────────────────────────────────────────────

function resultToneClass(tone: ValuationResult['tone']): string {
  switch (tone) {
    case 'positive': return 'text-emerald-600'
    case 'negative': return 'text-red-600'
    case 'warning':  return 'text-amber-600'
    default:         return 'text-slate-900'
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

// ─── ReverseDCFPanel ──────────────────────────────────────────────────────────

function ReverseDCFPanel({ result, cagrAnalysis, wacc, terminalG, lastFCFMargin }: {
  result: ReturnType<typeof computeReverseDCF>
  cagrAnalysis: { analystEstimate1y?: number | null; historicalCagr3y?: number | null } | null
  wacc: number
  terminalG: number
  lastFCFMargin: number | null
}) {
  const impliedCAGR  = result.impliedCAGR
  const analystCAGR  = cagrAnalysis?.analystEstimate1y ?? null
  const historicalCAGR = cagrAnalysis?.historicalCagr3y ?? null

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

  return (
    <div className="card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">Reverse DCF</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Works backwards from today&apos;s price to find the growth rate the market is implicitly pricing in.
        </p>
      </div>

      {/* Three-column hero */}
      <div className="grid grid-cols-3 divide-x divide-slate-200">
        <div className="flex flex-col items-center px-4 py-5 gap-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Market Implies</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: toneColor }}>
            {impliedCAGR != null ? (impliedCAGR * 100).toFixed(1) + '%' : '—'}
          </p>
          <p className="text-xs text-slate-500">5Y CAGR</p>
          {impliedCAGR != null && toneLabel && (
            <span className="text-xs font-semibold mt-1" style={{ color: toneColor }}>
              {toneIcon} {toneLabel}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center px-4 py-5 gap-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Analyst Says</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {analystCAGR != null ? (analystCAGR * 100).toFixed(1) + '%' : '—'}
          </p>
          <p className="text-xs text-slate-500">FY+1 estimate</p>
          {analystCAGR != null && <span className="text-xs text-slate-400 mt-1">─ Consensus</span>}
        </div>
        <div className="flex flex-col items-center px-4 py-5 gap-1">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">History (3Y)</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {historicalCAGR != null ? (historicalCAGR * 100).toFixed(1) + '%' : '—'}
          </p>
          <p className="text-xs text-slate-500">3Y revenue CAGR</p>
          {historicalCAGR != null && <span className="text-xs text-slate-400 mt-1">─ Historical</span>}
        </div>
      </div>

      {/* Assumptions + interpretation */}
      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-3">Assumptions used</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] text-slate-500">FCF Margin</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900">
              {lastFCFMargin != null ? (lastFCFMargin * 100).toFixed(1) + '%' : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">WACC</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900">{(wacc * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">Terminal G</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900">{(terminalG * 100).toFixed(1)}%</p>
          </div>
        </div>
        {result.interpretationText && (
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">{result.interpretationText}</p>
        )}
        {result.guardErrors.length > 0 && (
          <div className="mt-2 space-y-1">
            {result.guardErrors.map((w, i) => (
              <p key={i} className="text-[10px] text-amber-600">⚠ {w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MethodInlinePanel ────────────────────────────────────────────────────────

interface MethodInlinePanelProps {
  config: ValuationMethodConfig
  overrides: Record<string, number>
  currency: string
  onAssumptionChange: (key: string, value: number) => void
  onResetOverrides: () => void
}

function MethodInlinePanel({ config, overrides, currency, onAssumptionChange, onResetOverrides }: MethodInlinePanelProps) {
  const isModified = Object.keys(overrides).length > 0
  const upside =
    config.fairValueSummary != null && config.currentPrice != null && config.currentPrice > 0
      ? (config.fairValueSummary - config.currentPrice) / config.currentPrice
      : null

  const editableAssumptions   = config.assumptions.filter(a => a.editable)
  const readonlyAssumptions   = config.assumptions.filter(a => !a.editable && a.unit !== 'shares')

  return (
    <div className="card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{config.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{config.methodDescription ?? config.subtitle}</p>
        </div>
        {config.fairValueSummary != null && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Fair Value</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">
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
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚠ {w}
            </div>
          ))}
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
            return (
              <div key={a.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-700">{a.label}</span>
                    <span className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                      isOverridden ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500',
                    )}>
                      {isOverridden ? 'Override' : sourceLabel(a.source)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {displayVal}{a.unit === '%' ? '%' : a.unit === 'x' ? '×' : ''}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={raw}
                  onChange={e => onAssumptionChange(a.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full accent-blue-500 cursor-pointer"
                />
                {a.sourceExplanation && (
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">▸ {a.sourceExplanation}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Read-only key values (Reverse DCF has no editable sliders) */}
      {editableAssumptions.length === 0 && readonlyAssumptions.length > 0 && (
        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {readonlyAssumptions.map(a => (
              <div key={a.key} className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{a.label}</p>
                <p className="text-sm font-semibold tabular-nums text-slate-800 mt-0.5">
                  {fmtAssumptionDisplay(a, overrides)}{a.unit === '%' ? '%' : a.unit === 'x' ? '×' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer: Results + Reset */}
      {(config.results.length > 0 || isModified) && (
        <div className="px-5 py-3 mt-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-4 flex-wrap">
            {config.results.map((r, i) => (
              <div key={i} className="text-xs">
                <span className="text-slate-500">{r.label}: </span>
                <span className={cn('font-semibold tabular-nums', resultToneClass(r.tone))}>
                  {r.formattedValue === '—' ? <NABadge reason="calc-error" /> : r.formattedValue}
                </span>
              </div>
            ))}
          </div>
          {isModified && (
            <button onClick={onResetOverrides} className="text-xs text-blue-600 hover:text-blue-700 underline shrink-0">
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

interface MethodAccordionProps {
  id: string
  title: string
  bestFor: string
  isOpen: boolean
  onToggle: () => void
  innerRef: (el: HTMLDivElement | null) => void
  fairValue: number | null
  upsidePct: number | null
  currency: string
  chips: Array<{ label: string; value: string }>
  children: React.ReactNode
}

function MethodAccordion({ title, bestFor, isOpen, onToggle, innerRef, fairValue, upsidePct, currency, chips, children }: MethodAccordionProps) {
  return (
    <div ref={innerRef} className="card rounded-xl overflow-hidden scroll-mt-4">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-slate-50/60 transition-colors"
      >
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-slate-400 transition-transform mt-0.5', isOpen ? 'rotate-180' : '')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{title}</span>
            {fairValue != null && (
              <span className="text-sm font-bold tabular-nums text-slate-900 ml-auto">
                {fmtPrice(fairValue, currency)}
              </span>
            )}
            {upsidePct != null && <TrendBadge value={upsidePct} size="sm" />}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{bestFor}</p>
          {chips.length > 0 && !isOpen && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {chips.map(c => (
                <span key={c.label} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                  {c.label}: {c.value}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-slate-100"
          >
            {/* Suppress inner card borders when embedded */}
            <div className="[&_.card]:rounded-none [&_.card]:border-0 [&_.card]:shadow-none">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationLab({ apiData, ticker, statementsData, onWeightedFVChange, onActiveMethodChange }: ValuationLabProps) {
  const [overrides,    setOverrides]    = useState<OverridesMap>({})
  const [linkedCAGR,   setLinkedCAGR]   = useState(true)
  const [openMethodId, setOpenMethodId] = useState<string | null>(null)
  const methodRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const currency     = apiData?.quote?.currency ?? 'USD'
  const currentPrice = (apiData?.quote?.price   ?? 0) as number

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
  // EBITDA: (1) direct field, (2) EBIT + D&A, (3) bottom-up: NI + Tax + Interest + D&A
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

  // FX rate: statementsData (fundamentalsTimeSeries) reports in financialCurrency (e.g. BRL for STNE).
  // All absolute monetary TTM values must be converted to quote currency (USD for ADRs) before use.
  const stmtFxRate = (apiData?.providerStatus?.fx?.rate as number | undefined) ?? 1

  // fairValue.sharesOutstanding is in millions (ADR-equivalent); TTM balance sheet shares may be ordinary
  // For ADRs (TSM: 5 ordinary = 1 ADR), fairValue.sharesOutstanding is already ADR-adjusted — prefer it
  const sharesAbsolute = (apiData?.fairValue?.sharesOutstanding != null ? apiData.fairValue.sharesOutstanding * 1e6 : null) ?? ttmShares

  // ── Derived assumptions ──────────────────────────────────────────────────
  const fwdPEBase   = useMemo(() => deriveForwardPEAssumptions(apiData), [apiData])
  const revMultBase = useMemo(() => deriveRevenueMultipleAssumptions(apiData), [apiData])

  // financialStatements revenue is in millions; TTM revenue is absolute — normalise to absolute USD
  // Apply stmtFxRate so ADR stocks (BRL, CNY, etc.) produce USD fair values
  // Must be defined after fwdPEBase (which provides the financialStatements fallback)
  const ltvRevenueAbsolute = (ttmRevenue != null ? ttmRevenue * stmtFxRate : null) ?? (fwdPEBase.ltvRevenue != null ? fwdPEBase.ltvRevenue * 1e6 : null)

  const evEbitdaBase = useMemo(() => {
    // ttmEbitda is in absolute reporting currency — convert to quote currency via stmtFxRate
    // financialStatements.incomeStatement.ebitda is in millions, already FX-converted — multiply by 1e6
    const ebitdaFromTTM     = ttmEbitda != null ? ttmEbitda * stmtFxRate : null
    const ebitdaFromFinStmt = (apiData?.financialStatements?.incomeStatement?.find((r: { isProjected?: boolean; ebitda?: number | null }) => !r.isProjected)?.ebitda ?? null) as number | null
    const ebitda            = ebitdaFromTTM ?? (ebitdaFromFinStmt != null ? ebitdaFromFinStmt * 1e6 : null)
    const shares     = sharesAbsolute
    const cashFMP    = apiData?.fairValue?.cash != null ? apiData.fairValue.cash * 1e6 : null
    const debtFMP    = apiData?.fairValue?.debt != null ? apiData.fairValue.debt * 1e6 : null
    const netDebtRaw = ttmNetDebt != null ? ttmNetDebt * stmtFxRate : null
    // Fallback from annual balance sheet (already in millions, already FX-converted)
    const annualBS   = apiData?.financialStatements?.balanceSheet?.find((r: { isProjected?: boolean }) => !r.isProjected)
    const cashBS     = annualBS?.cash != null ? (annualBS.cash as number) * 1e6 : null
    const debtBS     = annualBS?.longTermDebt != null ? (annualBS.longTermDebt as number) * 1e6 : null
    const netDebt    = netDebtRaw ?? (debtFMP != null && cashFMP != null ? debtFMP - cashFMP : null) ?? (debtBS != null && cashBS != null ? debtBS - cashBS : null)
    const sector     = apiData?.quote?.sector ?? null
    const multiple   = getDefaultEVEBITDAMultiple(sector)
    return { ebitda, netDebt, shares, exitMultiple: multiple, sector }
  }, [apiData, ttmEbitda, ttmNetDebt, sharesAbsolute, stmtFxRate])

  // ── Forward P/E ──────────────────────────────────────────────────────────
  const fwdPEOverrides = overrides['forward_pe'] ?? {}
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
      return a
    }),
    formulaLines: [],
    results:     buildForwardPEResults(fwdPEResult, currentPrice, currency),
    warnings:    fwdPEResult.guardErrors,
    fairValueSummary: fwdPEResult.fairValueToday,
    currentPrice,
  }), [fwdPEBase, fwdPEInputs, fwdPEResult, ticker, currency, currentPrice, apiData, ltvRevenueAbsolute, sharesAbsolute])

  // ── Revenue Multiple ─────────────────────────────────────────────────────
  const revMultOverrides = overrides['revenue_multiple'] ?? {}
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
      a.key === 'ltvRevenue' && ltvRevenueAbsolute != null ? { ...a, value: ltvRevenueAbsolute } : a
    ),
    formulaLines: [],
    results:     buildRevMultipleResults(revMultResult, currentPrice, currency),
    warnings:    revMultResult.guardErrors,
    fairValueSummary: revMultResult.fairValueToday,
    currentPrice,
  }), [revMultBase, revMultInputs, revMultResult, ticker, currency, currentPrice, apiData, ltvRevenueAbsolute])

  // ── EV/EBITDA ────────────────────────────────────────────────────────────
  const evEbitdaOverrides = overrides['ev_ebitda'] ?? {}
  const evEbitdaInputs = useMemo(() => ({
    ttmEbitda:    evEbitdaOverrides.ttmEbitda    ?? evEbitdaBase.ebitda,
    netDebt:      evEbitdaOverrides.netDebt      ?? evEbitdaBase.netDebt,
    shares:       evEbitdaOverrides.shares       ?? evEbitdaBase.shares,
    exitMultiple: evEbitdaOverrides.exitMultiple ?? evEbitdaBase.exitMultiple,
    currentPrice,
  }), [evEbitdaBase, evEbitdaOverrides, currentPrice])
  const evEbitdaResult = useMemo(() => computeEVEBITDA(evEbitdaInputs), [evEbitdaInputs])
  const evEbitdaConfig = useMemo((): ValuationMethodConfig => {
    const sect     = evEbitdaBase.sector ?? 'Unknown'
    const multiple = evEbitdaInputs.exitMultiple
    const multEstimates: Array<{ multiple: string; actualValue: number }> =
      (apiData as { valuationMethods?: { models?: { multiples?: { estimates?: unknown[] } } } })
        ?.valuationMethods?.models?.multiples?.estimates as Array<{ multiple: string; actualValue: number }> ?? []
    const actualEvEbitda = multEstimates.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
    const companyEVEBITDAStr = actualEvEbitda != null && actualEvEbitda > 0 ? `${actualEvEbitda.toFixed(1)}×` : 'N/A'
    const exitMultipleText = `Sector standard: ${multiple.toFixed(0)}× (${sect} sector median); company current EV/EBITDA: ${companyEVEBITDAStr}`
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
        { label: 'Net Debt',      text: evEbitdaInputs.netDebt   != null ? fmtB(evEbitdaInputs.netDebt)   + ' (total debt − cash)' : 'Assumed 0', rowKey: 'totalDebt', statement: 'balance' },
        { label: 'Shares',        text: evEbitdaInputs.shares    != null ? (evEbitdaInputs.shares / 1e9).toFixed(3) + 'B shares outstanding' : 'Not available', rowKey: 'ordinarySharesNumber', statement: 'balance' },
        { label: 'Exit Multiple', text: exitMultipleText },
      ],
      assumptions: [
        { key: 'ttmEbitda',    label: 'TTM EBITDA',         editable: false, value: evEbitdaInputs.ttmEbitda, unit: '$', source: 'historical_3y_median' as const },
        { key: 'netDebt',      label: 'Net Debt',           editable: false, value: evEbitdaInputs.netDebt,   unit: '$', source: 'historical_3y_median' as const },
        { key: 'exitMultiple', label: 'EV/EBITDA Multiple', editable: true,  value: multiple, unit: 'x', min: 1, max: 50, step: 0.5, source: 'sector_fallback' as const, sourceExplanation: exitMultipleText, description: 'Sector-typical exit multiple' },
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
  const incomeRows: Array<{ revenue: number | null; netIncome: number | null; freeCashFlow?: number | null; isProjected: boolean }> =
    apiData?.financialStatements?.incomeStatement ?? []
  const cashFlowRows: Array<{ freeCashFlow: number | null; isProjected: boolean }> =
    apiData?.financialStatements?.cashFlow ?? []

  const lastActualRevenue = useMemo(() => {
    // Apply stmtFxRate so revenue is in quote currency (USD for ADRs like STNE, PAGS, VALE, TSM)
    if (ttmRevenue != null) return ttmRevenue * stmtFxRate
    const actuals = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
    const revM = actuals.length > 0 ? actuals[actuals.length - 1].revenue! : null
    return revM != null ? revM * 1e6 : null  // financialStatements revenue is already in USD millions
  }, [incomeRows, ttmRevenue, stmtFxRate])

  const lastFCFMargin = useMemo(() => {
    // Use both from the same scale to keep the ratio consistent
    if (ttmRevenue != null && ttmFCF != null && ttmRevenue > 0) return ttmFCF / ttmRevenue
    const actRev = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
    const actFCF = cashFlowRows.filter(r => !r.isProjected && r.freeCashFlow != null)
    const revM = actRev.slice(-1)[0]?.revenue ?? null
    const fcfM = actFCF.slice(-1)[0]?.freeCashFlow ?? null
    return revM != null && revM > 0 && fcfM != null ? fcfM / revM : null
  }, [cashFlowRows, incomeRows, ttmRevenue, ttmFCF])

  const reverseDCFResult = useMemo(() => computeReverseDCF({
    currentPrice,
    sharesOutstanding: sharesAbsolute,
    cashM:    apiData?.fairValue?.cash ?? null,
    debtM:    apiData?.fairValue?.debt ?? null,
    lastRevenue: lastActualRevenue,
    lastFCFMargin,
    wacc:     apiData?.wacc?.wacc   ?? 0.09,
    terminalG:apiData?.terminalG    ?? 0.025,
    historicalCAGR: apiData?.cagrAnalysis?.historicalCagr3y ?? null,
  }), [currentPrice, apiData, lastActualRevenue, lastFCFMargin, sharesAbsolute])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleAssumptionChange(methodId: ValuationMethodId | 'ev_ebitda', key: string, value: number) {
    setOverrides(prev => {
      const updated = { ...prev, [methodId]: { ...(prev[methodId] ?? {}), [key]: value } }
      // When CAGR is linked, propagate revenueCAGR across Forward P/E and Revenue Multiple
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

  function handleSummaryMethodClick(id: string) {
    setOpenMethodId(prev => (prev === id ? null : id))
    setTimeout(() => {
      methodRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const summaryMethods: MethodResult[] = [
    { id: 'forward_pe',       label: 'Forward P/E (5Y)',          fairValue: fwdPEResult.fairValueToday,       upsidePct: fwdPEResult.upsidePct,           weight: 0.35 },
    { id: 'ev_ebitda',        label: 'EV/EBITDA',                 fairValue: evEbitdaResult.fairValuePerShare, upsidePct: evEbitdaResult.upsidePct,        weight: 0.30 },
    { id: 'revenue_multiple', label: 'Revenue Multiple',          fairValue: revMultResult.fairValueToday,     upsidePct: revMultResult.upsidePct,         weight: 0.25 },
    { id: 'core_dcf',         label: 'Core DCF (FCFF/FCFE/DDM)',  fairValue: (apiData?.valuationMethods?.triangulatedFairValue as number | null) ?? null, upsidePct: (apiData?.valuationMethods?.triangulatedUpsidePct as number | null) ?? null, weight: 0.10 },
  ]

  // Lift weighted fair value to parent so PriceChart can show "Your Model" line
  const weightedFV = useMemo(() => {
    const valid = summaryMethods.filter(m => m.fairValue != null && m.weight > 0)
    if (!valid.length) return null
    const total = valid.reduce((s, m) => s + m.weight, 0)
    return valid.reduce((s, m) => s + m.fairValue! * m.weight, 0) / total
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fwdPEResult, evEbitdaResult, revMultResult, apiData])

  useEffect(() => { onWeightedFVChange?.(weightedFV) }, [weightedFV, onWeightedFVChange])
  useEffect(() => { onActiveMethodChange?.(openMethodId) }, [openMethodId, onActiveMethodChange])

  return (
    <div className="space-y-4">

      {/* ── 1. Valuation Summary — THE ANSWER (always first) ─────────────── */}
      <ValuationSummary
        methods={summaryMethods}
        currentPrice={currentPrice}
        currency={currency}
        onMethodClick={handleSummaryMethodClick}
      />

      {/* ── 2. Method accordions ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600 px-1">Explore each method</p>

        {/* Forward P/E */}
        <MethodAccordion
          id="forward_pe"
          title={fwdPEConfig.title}
          bestFor="Best for profitable companies with stable earnings growth"
          isOpen={openMethodId === 'forward_pe'}
          onToggle={() => setOpenMethodId(p => p === 'forward_pe' ? null : 'forward_pe')}
          innerRef={el => { methodRefs.current['forward_pe'] = el }}
          fairValue={fwdPEResult.fairValueToday}
          upsidePct={fwdPEResult.upsidePct}
          currency={currency}
          chips={[
            { label: 'CAGR', value: fwdPEInputs.revenueCAGR != null ? (fwdPEInputs.revenueCAGR * 100).toFixed(1) + '%' : '—' },
            { label: 'Exit P/E', value: fwdPEInputs.exitPE != null ? (fwdPEInputs.exitPE as number).toFixed(1) + '×' : '—' },
            { label: 'Margin', value: fwdPEInputs.netMargin != null ? (fwdPEInputs.netMargin * 100).toFixed(1) + '%' : '—' },
          ]}
        >
          <MethodInlinePanel
            config={fwdPEConfig}
            overrides={overrides['forward_pe'] ?? {}}
            currency={currency}
            onAssumptionChange={(key, val) => handleAssumptionChange('forward_pe', key, val)}
            onResetOverrides={() => handleResetOverrides('forward_pe')}
          />
        </MethodAccordion>

        {/* EV/EBITDA */}
        <MethodAccordion
          id="ev_ebitda"
          title={evEbitdaConfig.title}
          bestFor="Best for comparing businesses regardless of capital structure"
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
        >
          <MethodInlinePanel
            config={evEbitdaConfig}
            overrides={overrides['ev_ebitda'] ?? {}}
            currency={currency}
            onAssumptionChange={(key, val) => handleAssumptionChange('ev_ebitda', key, val)}
            onResetOverrides={() => handleResetOverrides('ev_ebitda')}
          />
        </MethodAccordion>

        {/* Shared Assumptions interstitial */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-50/60 border border-blue-100">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-blue-700">Shared: Revenue CAGR (5Y)</p>
            <p className="text-[10px] text-blue-500 mt-0.5">
              {linkedCAGR ? 'Linked — changing CAGR in one method updates the other.' : 'Unlinked — each method uses an independent CAGR.'}
            </p>
          </div>
          <button
            onClick={() => setLinkedCAGR(v => !v)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors shrink-0 ${
              linkedCAGR
                ? 'bg-blue-100 border-blue-200 text-blue-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            {linkedCAGR ? '🔗 Linked' : '🔓 Unlinked'}
          </button>
        </div>

        {/* Revenue Multiple */}
        <MethodAccordion
          id="revenue_multiple"
          title={revMultConfig.title}
          bestFor="Best for high-growth or pre-profit companies"
          isOpen={openMethodId === 'revenue_multiple'}
          onToggle={() => setOpenMethodId(p => p === 'revenue_multiple' ? null : 'revenue_multiple')}
          innerRef={el => { methodRefs.current['revenue_multiple'] = el }}
          fairValue={revMultResult.fairValueToday}
          upsidePct={revMultResult.upsidePct}
          currency={currency}
          chips={[
            { label: 'CAGR', value: revMultInputs.revenueCAGR != null ? (revMultInputs.revenueCAGR * 100).toFixed(1) + '%' : '—' },
            { label: 'EV/Rev', value: revMultInputs.exitEVRevenue != null ? (revMultInputs.exitEVRevenue as number).toFixed(1) + '×' : '—' },
          ]}
        >
          <MethodInlinePanel
            config={revMultConfig}
            overrides={overrides['revenue_multiple'] ?? {}}
            currency={currency}
            onAssumptionChange={(key, val) => handleAssumptionChange('revenue_multiple', key, val)}
            onResetOverrides={() => handleResetOverrides('revenue_multiple')}
          />
        </MethodAccordion>

        {/* Reverse DCF */}
        <MethodAccordion
          id="reverse_dcf"
          title="Reverse DCF"
          bestFor="Best for checking what growth rate today's price implies"
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
        >
          <ReverseDCFPanel
            result={reverseDCFResult}
            cagrAnalysis={apiData?.cagrAnalysis ?? null}
            wacc={apiData?.wacc?.wacc ?? 0.09}
            terminalG={apiData?.terminalG ?? 0.025}
            lastFCFMargin={lastFCFMargin}
          />
        </MethodAccordion>

        {/* Full DCF */}
        <MethodAccordion
          id="full_dcf"
          title="Full DCF Modelling Table"
          bestFor="Best for deep-dive year-by-year cash flow projection with custom assumptions"
          isOpen={openMethodId === 'full_dcf'}
          onToggle={() => setOpenMethodId(p => p === 'full_dcf' ? null : 'full_dcf')}
          innerRef={el => { methodRefs.current['full_dcf'] = el }}
          fairValue={(apiData?.valuationMethods?.triangulatedFairValue as number | null) ?? null}
          upsidePct={(apiData?.valuationMethods?.triangulatedUpsidePct as number | null) ?? null}
          currency={currency}
          chips={[
            { label: 'WACC', value: ((apiData?.wacc?.wacc ?? 0.09) * 100).toFixed(1) + '%' },
            { label: 'Terminal G', value: ((apiData?.terminalG ?? 0.025) * 100).toFixed(1) + '%' },
          ]}
        >
          {/* Executive DCF summary */}
          {(apiData?.valuationMethods?.triangulatedFairValue != null) && (
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Core DCF Result</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] text-slate-500">Fair Value</p>
                  <p className="text-lg font-bold tabular-nums text-slate-900">
                    {fmtPrice(apiData.valuationMethods.triangulatedFairValue as number, currency)}
                  </p>
                </div>
                {(apiData?.valuationMethods?.triangulatedUpsidePct as number | null) != null && (
                  <TrendBadge value={apiData.valuationMethods.triangulatedUpsidePct as number} size="lg" />
                )}
                <div className="ml-auto flex gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500">WACC</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-800">
                      {((apiData?.wacc?.wacc ?? 0.09) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Terminal G</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-800">
                      {((apiData?.terminalG ?? 0.025) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                FCFF, FCFE &amp; DDM triangulated — intrinsic value from projected free cash flows.
              </p>
            </div>
          )}
          <ModellingWorkspace apiData={apiData} ticker={ticker} statementsData={statementsData} />
        </MethodAccordion>
      </div>
    </div>
  )
}
