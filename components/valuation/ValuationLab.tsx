'use client'

import { useState, useMemo } from 'react'
import {
  type ValuationMethodId,
  type ValuationMethodConfig,
  type ValuationResult,
  type ValuationAssumption,
  sourceLabel,
} from './ValuationModelDrawer'
import ValuationSummary, { type MethodResult } from './ValuationSummary'
import ModellingWorkspace from '@/components/modelling/ModellingWorkspace'
import DataQualityWarnings from '@/components/modelling/DataQualityWarnings'
import { computeForwardPE } from '@/lib/valuation/methods/forwardPE'
import { computeRevenueMultiple } from '@/lib/valuation/methods/revenueMultiple'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'
import { computeScenarioBlend } from '@/lib/valuation/methods/scenarioBlend'
import { computeEVEBITDA, getDefaultEVEBITDAMultiple } from '@/lib/valuation/methods/evEbitda'
import {
  deriveForwardPEAssumptions,
  deriveRevenueMultipleAssumptions,
} from '@/lib/valuation/assumptions/deriveAssumptions'
import { fmtPrice, fmtPct, fmtLarge, fmtLargeCurrency } from '@/lib/formatters'
import { WizardSteps } from '@/components/ui/wizard-steps'
import { SourceLabel } from '@/components/ui/source-label'
import { TrendBadge } from '@/components/ui/trend-badge'
import { MetricChip } from '@/components/ui/metric-chip'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { buildBusinessSummary } from '@/lib/simplifier/summaryBuilder'

// ─── Local helpers ─────────────────────────────────────────────────────────────

function fmtB(v: number | null): string { return fmtLargeCurrency(v) }
function fmtPctSigned(v: number | null): string { return fmtPct(v) }

// ─── Formula builders ─────────────────────────────────────────────────────────

function buildForwardPEFormula(
  inputs: { ltvRevenue: number | null; sharesOutstanding: number | null; revenueCAGR: number; netMargin: number; exitPE: number; dilutionRate: number; discountRate: number },
  result: ReturnType<typeof computeForwardPE>,
  N = 5,
): string[] {
  if (result.futureTargetPrice == null || inputs.ltvRevenue == null) return ['Insufficient inputs to display formula']
  const sharesB    = inputs.sharesOutstanding != null ? (inputs.sharesOutstanding / 1e9).toFixed(3) + 'B' : '—'
  const cagrPct    = (inputs.revenueCAGR  * 100).toFixed(1)
  const marginPct  = (inputs.netMargin    * 100).toFixed(1)
  const dilPct     = (inputs.dilutionRate * 100).toFixed(1)
  const waccPct    = (inputs.discountRate * 100).toFixed(1)
  const targetYear = new Date().getFullYear() + N
  return [
    `${fmtB(inputs.ltvRevenue)} × (1+${cagrPct}%)^${N} × ${marginPct}% × ${inputs.exitPE}×`,
    `÷ [${sharesB} × (1+${dilPct}%)^${N}]`,
    `= ${fmtPrice(result.futureTargetPrice)} target in ${targetYear}`,
    `Discounted at ${waccPct}% for ${N} years → fair value today`,
  ]
}

function buildRevMultipleFormula(
  inputs: { ltvRevenue: number | null; revenueCAGR: number; exitEVRevenue: number; netDebt: number | null; dilutionRate: number; discountRate: number },
  result: ReturnType<typeof computeRevenueMultiple>,
  N = 5,
): string[] {
  if (result.futureTargetPrice == null || inputs.ltvRevenue == null) return ['Insufficient inputs to display formula']
  const cagrPct    = (inputs.revenueCAGR  * 100).toFixed(1)
  const waccPct    = (inputs.discountRate * 100).toFixed(1)
  const targetYear = new Date().getFullYear() + N
  return [
    `${fmtB(inputs.ltvRevenue)} × (1+${cagrPct}%)^${N} × ${inputs.exitEVRevenue.toFixed(1)}× EV/Revenue`,
    inputs.netDebt != null ? `- ${fmtB(inputs.netDebt)} net debt = equity value` : '÷ shares outstanding',
    `= ${fmtPrice(result.futureTargetPrice)} target in ${targetYear}`,
    `Discounted at ${waccPct}% for ${N} years → fair value today`,
  ]
}

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
    { label: 'Actual Price',         value: currentPrice,             formattedValue: fmtPrice(currentPrice, currency),             tone: 'neutral' },
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
    { label: 'Actual Price',         value: currentPrice,             formattedValue: fmtPrice(currentPrice, currency),             tone: 'neutral' },
    { label: `${targetYear} Target`, value: result.futureTargetPrice, formattedValue: fmtPrice(result.futureTargetPrice, currency), tone: 'neutral' },
    { label: 'Fair Value Today',     value: result.fairValueToday,    formattedValue: fmtPrice(result.fairValueToday, currency),    tone: upsideTone(result.upsidePct) },
    { label: '1Y Price Target',      value: result.target1Y,          formattedValue: fmtPrice(result.target1Y, currency),         tone: 'neutral' },
    { label: 'Potential Upside',     value: result.upsidePct,         formattedValue: fmtPctSigned(result.upsidePct),              tone: upsideTone(result.upsidePct) },
    { label: 'Expected Return',      value: result.expectedReturnPct, formattedValue: result.expectedReturnPct != null ? fmtPctSigned(result.expectedReturnPct) + '/yr' : '—', tone: upsideTone(result.expectedReturnPct) },
  ]
}

function buildReverseDCFResults(result: ReturnType<typeof computeReverseDCF>): ValuationResult[] {
  const implCAGRFmt = result.impliedCAGR != null ? (result.impliedCAGR * 100).toFixed(1) + '%' : '—'
  const interpTone: ValuationResult['tone'] =
    result.interpretation === 'conservative'    ? 'positive' :
    result.interpretation === 'reasonable'      ? 'positive' :
    result.interpretation === 'aggressive'      ? 'warning'  :
    result.interpretation === 'very_aggressive' ? 'negative' : 'neutral'
  return [
    { label: 'Implied 5Y CAGR', value: result.impliedCAGR,      formattedValue: implCAGRFmt, tone: interpTone },
    { label: 'FCF Margin Used', value: result.impliedFCFMargin, formattedValue: result.impliedFCFMargin != null ? (result.impliedFCFMargin * 100).toFixed(1) + '%' : '—', tone: 'neutral' },
    { label: 'Assessment',      value: null,                    formattedValue: result.interpretation.replace('_', ' '), tone: interpTone },
  ]
}

function buildEVEBITDAResults(result: ReturnType<typeof computeEVEBITDA>, currentPrice: number, currency = 'USD'): ValuationResult[] {
  return [
    { label: 'Enterprise Value',   value: result.enterpriseValue,   formattedValue: fmtB(result.enterpriseValue),                tone: 'neutral' },
    { label: 'Equity Value',       value: result.equityValue,       formattedValue: fmtB(result.equityValue),                    tone: 'neutral' },
    { label: 'Fair Value / Share', value: result.fairValuePerShare, formattedValue: fmtPrice(result.fairValuePerShare, currency), tone: upsideTone(result.upsidePct) },
    { label: 'Actual Price',       value: currentPrice,             formattedValue: fmtPrice(currentPrice, currency),            tone: 'neutral' },
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

  function handleInputChange(key: string, rawStr: string) {
    const assumption = config.assumptions.find(a => a.key === key)
    if (!assumption) return
    const parsed = parseFloat(rawStr)
    if (isNaN(parsed)) return
    onAssumptionChange(key, assumption.unit === '%' ? parsed / 100 : parsed)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{config.title}</h3>
          <p className="text-micro text-slate-400 mt-0.5">{config.subtitle}</p>
        </div>
        {config.fairValueSummary != null && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-label uppercase tracking-wider text-slate-400">Fair Value</p>
              <p className="text-lg font-bold font-mono text-slate-900">
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

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Evidence + Assumptions */}
        <div className="space-y-5">
          {config.evidence.length > 0 && (
            <div>
              <p className="text-label uppercase tracking-wider text-slate-400 mb-2">Evidence & Derivation</p>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1.5">
                {config.evidence.map(({ label, text }) => (
                  <div key={label} className="flex gap-3 text-xs">
                    <span className="text-slate-500 font-medium w-24 shrink-0">{label}</span>
                    <span className="text-slate-600 leading-relaxed">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {config.assumptions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-label uppercase tracking-wider text-slate-400">
                  Assumptions
                  {isModified && <span className="text-blue-500 normal-case ml-1 font-normal">(modified)</span>}
                </p>
                {isModified && (
                  <button
                    onClick={onResetOverrides}
                    className="text-xs text-blue-600 hover:text-blue-700 underline"
                  >
                    Reset to model
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {config.assumptions.map(a => {
                  const displayVal = fmtAssumptionDisplay(a, overrides)
                  const isOverridden = a.key in overrides
                  return (
                    <div key={a.key} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-medium text-slate-700">{a.label}</span>
                          <span className={cn(
                            'text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider',
                            isOverridden ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500',
                          )}>
                            {isOverridden ? 'Override' : sourceLabel(a.source)}
                          </span>
                        </div>
                        {a.description && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{a.description}</p>
                        )}
                      </div>
                      {a.editable ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            value={displayVal}
                            onChange={e => handleInputChange(a.key, e.target.value)}
                            step={String(a.step ?? 0.1)}
                            className="w-20 text-right border border-slate-200 rounded-md px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-400 bg-white text-slate-900"
                          />
                          {a.unit === '%' && <span className="text-slate-400 text-xs">%</span>}
                          {a.unit === 'x' && <span className="text-slate-400 text-xs">×</span>}
                        </div>
                      ) : (
                        <span className="text-xs font-mono text-slate-500 shrink-0">
                          {displayVal}{a.unit === '%' ? '%' : a.unit === 'x' ? '×' : ''}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Formula + Results */}
        <div className="space-y-5">
          {config.formulaLines.length > 0 && config.formulaLines[0] !== 'See the full modelling table below.' && (
            <div>
              <p className="text-label uppercase tracking-wider text-slate-400 mb-2">Formula</p>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 font-mono text-xs text-slate-600 space-y-0.5">
                {config.formulaLines.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            </div>
          )}

          {config.results.length > 0 && (
            <div>
              <p className="text-label uppercase tracking-wider text-slate-400 mb-2">Results</p>
              <div className="divide-y divide-slate-100">
                {config.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-slate-500 font-medium">{r.label}</span>
                    <span className={cn('font-bold font-mono text-sm', resultToneClass(r.tone))}>
                      {r.formattedValue}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Mini Bar Sparkline ───────────────────────────────────────────────────────

function MiniBarSparkline({ values, positive }: { values: (number | null)[]; positive?: boolean }) {
  const nums = values.map(v => (v != null && isFinite(v) ? Math.abs(v) : null))
  const max = Math.max(...nums.filter((v): v is number => v != null), 1)
  const barColor = positive !== false ? '#10b981' : '#f87171'
  const W = 80, H = 28, barW = 10, gap = 3
  const n = Math.min(nums.length, 5)
  const subset = nums.slice(-n)
  const totalW = n * barW + (n - 1) * gap
  const offsetX = (W - totalW) / 2
  return (
    <svg width={W} height={H} className="overflow-visible">
      {subset.map((v, i) => {
        const h = v != null ? Math.max(2, (v / max) * (H - 2)) : 2
        const x = offsetX + i * (barW + gap)
        const isLast = i === subset.length - 1
        return (
          <rect
            key={i}
            x={x} y={H - h} width={barW} height={h}
            rx={2}
            fill={isLast ? barColor : '#e2e8f0'}
            opacity={v == null ? 0.3 : 1}
          />
        )
      })}
    </svg>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, source }: { label: string; value: string; sub?: string; source?: 'yahoo' | 'calc' }) {
  return (
    <div className="flex-1 min-w-[140px] bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-card">
      <div className="text-label uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className="text-lg font-bold font-mono text-slate-900 truncate">{value}</div>
      {sub && <div className="text-micro text-slate-500 mt-0.5">{sub}</div>}
      {source && (
        <div className="mt-1.5">
          <SourceLabel source={source}>{source === 'yahoo' ? 'Yahoo Finance TTM' : 'Calculated'}</SourceLabel>
        </div>
      )}
    </div>
  )
}

function AssumptionStat({ label, value, sub, desc }: { label: string; value: string; sub: string; desc?: string }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
      <div className="text-label uppercase tracking-wider text-blue-400 mb-0.5">{label}</div>
      <div className="text-base font-bold font-mono text-blue-900">{value}</div>
      <div className="text-micro text-blue-500">{sub}</div>
      {desc && <div className="text-[10px] text-blue-400 mt-1 leading-snug">{desc}</div>}
    </div>
  )
}

// ─── Growth Bar ───────────────────────────────────────────────────────────────

function GrowthBar({ label, value, weight }: { label: string; value: number | null; weight: number }) {
  if (value == null) return null
  const pctVal = value * 100
  const barWidth = Math.min(Math.abs(pctVal) * 3, 100)
  const barColor = pctVal > 10 ? 'bg-emerald-400' : pctVal > 5 ? 'bg-amber-400' : 'bg-slate-300'
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-36 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barWidth}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-700 w-12 text-right">{pctVal.toFixed(1)}%</span>
      <span className="text-[10px] text-slate-400 w-8 text-right">{(weight * 100).toFixed(0)}%</span>
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
}

const WIZARD_STEPS = [
  { label: 'Base Data' },
  { label: 'Methods' },
  { label: 'Summary' },
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationLab({ apiData, ticker, statementsData }: ValuationLabProps) {
  const [overrides,   setOverrides]   = useState<OverridesMap>({})
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)

  const currency     = apiData?.quote?.currency ?? 'USD'
  const currentPrice = (apiData?.quote?.price   ?? 0) as number

  // ── TTM data from statements ─────────────────────────────────────────────
  const ttmIS = statementsData?.ttm?.incomeStatement ?? {}
  const ttmCF = statementsData?.ttm?.cashFlow        ?? {}
  const ttmBS = statementsData?.ttm?.balanceSheet    ?? {}

  const ttmRevenue   = (ttmIS.totalRevenue  as number | null) ?? null
  const ttmEbitda    = (ttmIS.EBITDA        as number | null) ?? null
  const ttmFCF       = (ttmCF.freeCashFlow  as number | null) ?? null
  const ttmNetIncome = (ttmIS.netIncome     as number | null) ?? null
  const ttmTotalDebt = (ttmBS.totalDebt     as number | null) ?? null
  const ttmCash      = ((ttmBS.cashCashEquivalentsAndShortTermInvestments ?? ttmBS.cash) as number | null) ?? null
  const ttmNetDebt   = ttmTotalDebt != null && ttmCash != null ? ttmTotalDebt - ttmCash : null
  const ttmShares    = ((ttmBS.commonStockSharesOutstanding ?? ttmBS.sharesOutstanding) as number | null) ?? null

  const statementsAvailable = ttmRevenue != null || ttmEbitda != null || ttmFCF != null

  // Annual sparkline data (values in millions, consistent scale for visual comparison)
  const annualIS = (statementsData?.annual?.incomeStatement ?? []) as Array<{ revenue?: number | null; ebitda?: number | null; netIncome?: number | null }>
  const annualCF = (statementsData?.annual?.cashFlow ?? [])        as Array<{ freeCashFlow?: number | null }>
  const sparkRevenue  = annualIS.slice(-5).map(r => r.revenue    ?? null)
  const sparkEbitda   = annualIS.slice(-5).map(r => r.ebitda     ?? null)
  const sparkFCF      = annualCF.slice(-5).map(r => r.freeCashFlow ?? null)
  const sparkNI       = annualIS.slice(-5).map(r => r.netIncome  ?? null)

  // CAGR analysis data
  const cagrAnalysis = apiData?.cagrAnalysis ?? {}

  // fairValue.sharesOutstanding is in millions (sharesM); TTM balance sheet shares are absolute
  const sharesAbsolute = ttmShares ?? (apiData?.fairValue?.sharesOutstanding != null ? apiData.fairValue.sharesOutstanding * 1e6 : null)

  const ebitdaMargin = ttmRevenue && ttmRevenue > 0 && ttmEbitda    != null ? ttmEbitda    / ttmRevenue : null
  const fcfMarginPct = ttmRevenue && ttmRevenue > 0 && ttmFCF       != null ? ttmFCF       / ttmRevenue : null
  const netMarginPct = ttmRevenue && ttmRevenue > 0 && ttmNetIncome != null ? ttmNetIncome / ttmRevenue : null

  // ── Derived assumptions ──────────────────────────────────────────────────
  const fwdPEBase   = useMemo(() => deriveForwardPEAssumptions(apiData), [apiData])
  const revMultBase = useMemo(() => deriveRevenueMultipleAssumptions(apiData), [apiData])

  // financialStatements revenue is in millions; TTM revenue is absolute — normalise to absolute $
  // Must be defined after fwdPEBase (which provides the financialStatements fallback)
  const ltvRevenueAbsolute = ttmRevenue ?? (fwdPEBase.ltvRevenue != null ? fwdPEBase.ltvRevenue * 1e6 : null)

  const evEbitdaBase = useMemo(() => {
    const ebitda   = ttmEbitda ?? (apiData?.financialStatements?.incomeStatement?.find((r: { isProjected?: boolean; ebitda?: number }) => !r.isProjected)?.ebitda ?? null)
    const shares   = sharesAbsolute
    const cashFMP  = apiData?.fairValue?.cash != null ? apiData.fairValue.cash * 1e6 : null
    const debtFMP  = apiData?.fairValue?.debt != null ? apiData.fairValue.debt * 1e6 : null
    const netDebt  = ttmNetDebt ?? (debtFMP != null && cashFMP != null ? debtFMP - cashFMP : null)
    const sector   = apiData?.quote?.sector ?? null
    const multiple = getDefaultEVEBITDAMultiple(sector)
    return { ebitda, netDebt, shares, exitMultiple: multiple, sector }
  }, [apiData, ttmEbitda, ttmNetDebt, sharesAbsolute])

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
    companyName: apiData?.companyName ?? ticker, ticker, currency,
    evidence:    fwdPEBase.evidence,
    assumptions: fwdPEBase.assumptions,
    formulaLines: buildForwardPEFormula(fwdPEInputs, fwdPEResult),
    results:     buildForwardPEResults(fwdPEResult, currentPrice, currency),
    warnings:    fwdPEResult.guardErrors,
    fairValueSummary: fwdPEResult.fairValueToday,
    currentPrice,
  }), [fwdPEBase, fwdPEInputs, fwdPEResult, ticker, currency, currentPrice, apiData])

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
    companyName: apiData?.companyName ?? ticker, ticker, currency,
    evidence:    revMultBase.evidence,
    assumptions: revMultBase.assumptions,
    formulaLines: buildRevMultipleFormula(revMultInputs, revMultResult),
    results:     buildRevMultipleResults(revMultResult, currentPrice, currency),
    warnings:    revMultResult.guardErrors,
    fairValueSummary: revMultResult.fairValueToday,
    currentPrice,
  }), [revMultBase, revMultInputs, revMultResult, ticker, currency, currentPrice, apiData])

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
    return {
      id: 'reverse_dcf' as ValuationMethodId,
      title: 'EV/EBITDA', subtitle: 'Enterprise value to EBITDA exit multiple',
      companyName: apiData?.companyName ?? ticker, ticker, currency,
      evidence: [
        { label: 'TTM EBITDA',    text: evEbitdaInputs.ttmEbitda != null ? fmtB(evEbitdaInputs.ttmEbitda) + ' (trailing 12 months, Yahoo Finance)' : 'Not available' },
        { label: 'Net Debt',      text: evEbitdaInputs.netDebt   != null ? fmtB(evEbitdaInputs.netDebt)   + ' (total debt − cash)' : 'Assumed 0' },
        { label: 'Shares',        text: evEbitdaInputs.shares    != null ? (evEbitdaInputs.shares / 1e9).toFixed(3) + 'B shares outstanding' : 'Not available' },
        { label: 'Exit Multiple', text: `${multiple.toFixed(0)}× EV/EBITDA (sector default: ${sect})` },
      ],
      assumptions: [
        { key: 'ttmEbitda',    label: 'TTM EBITDA',         editable: false, value: evEbitdaInputs.ttmEbitda, unit: '$', source: 'historical_3y_median' as const },
        { key: 'netDebt',      label: 'Net Debt',           editable: false, value: evEbitdaInputs.netDebt,   unit: '$', source: 'historical_3y_median' as const },
        { key: 'exitMultiple', label: 'EV/EBITDA Multiple', editable: true,  value: multiple, unit: 'x', min: 1, max: 50, step: 0.5, source: 'sector_fallback' as const, sourceExplanation: `${sect} sector typical ${multiple.toFixed(0)}×`, description: 'Sector-typical exit multiple' },
      ],
      formulaLines: [
        `EV = ${fmtB(evEbitdaInputs.ttmEbitda)} × ${multiple.toFixed(0)}× = ${fmtB(evEbitdaResult.enterpriseValue)}`,
        `Equity = EV ${evEbitdaInputs.netDebt != null ? `− ${fmtB(evEbitdaInputs.netDebt)} net debt` : ''} = ${fmtB(evEbitdaResult.equityValue)}`,
        `Fair Value = ${fmtB(evEbitdaResult.equityValue)} ÷ ${evEbitdaInputs.shares != null ? (evEbitdaInputs.shares / 1e9).toFixed(2) + 'B' : '—'} shares`,
        `= ${fmtPrice(evEbitdaResult.fairValuePerShare, currency)} per share`,
      ],
      results:  buildEVEBITDAResults(evEbitdaResult, currentPrice, currency),
      warnings: evEbitdaResult.guardErrors,
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
    if (ttmRevenue != null) return ttmRevenue
    const actuals = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
    const revM = actuals.length > 0 ? actuals[actuals.length - 1].revenue! : null
    return revM != null ? revM * 1e6 : null  // financialStatements revenue is in millions
  }, [incomeRows, ttmRevenue])

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

  const reverseDCFConfig = useMemo((): ValuationMethodConfig => {
    const implCAGRPct = reverseDCFResult.impliedCAGR != null ? (reverseDCFResult.impliedCAGR * 100).toFixed(1) + '%' : '—'
    return {
      id: 'reverse_dcf', title: 'Reverse DCF', subtitle: 'What growth rate the market is pricing in',
      companyName: apiData?.companyName ?? ticker, ticker, currency,
      evidence: [
        { label: 'Implied EV', text: reverseDCFResult.impliedEV != null ? fmtB(reverseDCFResult.impliedEV) + ' (price × shares + debt − cash)' : 'Cannot compute — missing inputs' },
        { label: 'FCF Margin', text: lastFCFMargin != null ? (lastFCFMargin * 100).toFixed(1) + '% (TTM FCF / revenue)' : 'Not available' },
        { label: 'WACC',       text: ((apiData?.wacc?.wacc ?? 0.09) * 100).toFixed(1) + '%' },
        { label: 'Terminal G', text: ((apiData?.terminalG  ?? 0.025) * 100).toFixed(1) + '%' },
      ],
      assumptions: [
        { key: 'currentPrice',  label: 'Current Price',   value: currentPrice,      unit: '$', editable: false, source: 'model_default' as const },
        { key: 'lastRevenue',   label: 'LTM Revenue',     value: lastActualRevenue, unit: '$', editable: false, source: 'historical_3y_median' as const },
        { key: 'lastFCFMargin', label: 'FCF Margin',      value: lastFCFMargin,     unit: '%', editable: false, source: 'historical_3y_median' as const },
        { key: 'wacc',          label: 'WACC',            value: apiData?.wacc?.wacc ?? 0.09, unit: '%', editable: false, source: 'model_default' as const },
        { key: 'terminalG',     label: 'Terminal Growth', value: apiData?.terminalG ?? 0.025, unit: '%', editable: false, source: 'model_default' as const },
      ],
      formulaLines: [
        `Implied EV = ${fmtB(reverseDCFResult.impliedEV)}`,
        `FCF margin fixed at ${lastFCFMargin != null ? (lastFCFMargin * 100).toFixed(1) + '%' : '—'}`,
        `Solve for CAGR such that PV(FCF) + PV(TV) = Implied EV`,
        `→ Required 5Y CAGR: ${implCAGRPct}`,
      ],
      results:  buildReverseDCFResults(reverseDCFResult),
      warnings: [...reverseDCFResult.guardErrors, ...(reverseDCFResult.interpretationText ? [reverseDCFResult.interpretationText] : [])],
      fairValueSummary: null,
      currentPrice,
    }
  }, [reverseDCFResult, ticker, currency, currentPrice, lastActualRevenue, lastFCFMargin, apiData])

  // ── Scenario Blend ───────────────────────────────────────────────────────
  const scenarioResult = useMemo(() => computeScenarioBlend([
    { label: 'bear', probability: 0.25, methodId: 'forward_pe', assumptions: { ...fwdPEInputs, revenueCAGR: Math.max(0, fwdPEInputs.revenueCAGR - 0.05), netMargin: Math.max(0.01, (fwdPEInputs.netMargin ?? 0.10) - 0.03), exitPE: Math.max(5, (fwdPEInputs.exitPE ?? 15) - 3) } },
    { label: 'base', probability: 0.50, methodId: 'forward_pe', assumptions: fwdPEInputs },
    { label: 'bull', probability: 0.25, methodId: 'forward_pe', assumptions: { ...fwdPEInputs, revenueCAGR: fwdPEInputs.revenueCAGR + 0.05, netMargin: Math.min(0.50, (fwdPEInputs.netMargin ?? 0.10) + 0.03), exitPE: (fwdPEInputs.exitPE ?? 15) + 3 } },
  ], currentPrice), [fwdPEInputs, currentPrice])

  const scenarioConfig = useMemo((): ValuationMethodConfig => {
    const wFV = scenarioResult.weightedFairValue; const wUpside = scenarioResult.weightedUpsidePct
    const [bear, base, bull] = scenarioResult.scenarios
    return {
      id: 'scenario_blend', title: 'Scenario Blend', subtitle: 'Bear / Base / Bull probability-weighted',
      companyName: apiData?.companyName ?? ticker, ticker, currency,
      evidence: [
        { label: 'Bear (25%)', text: `CAGR −5pp, margin −3pp, P/E −3× vs base → ${fmtPrice(bear?.fairValue, currency)}` },
        { label: 'Base (50%)', text: `Model assumptions → ${fmtPrice(base?.fairValue, currency)}` },
        { label: 'Bull (25%)', text: `CAGR +5pp, margin +3pp, P/E +3× vs base → ${fmtPrice(bull?.fairValue, currency)}` },
      ],
      assumptions: [],
      formulaLines: [
        `Bear: ${fmtPrice(bear?.fairValue, currency)} × 25%`,
        `Base: ${fmtPrice(base?.fairValue, currency)} × 50%`,
        `Bull: ${fmtPrice(bull?.fairValue, currency)} × 25%`,
        `= ${fmtPrice(wFV, currency)} weighted fair value`,
      ],
      results: [
        { label: 'Bear Fair Value',     value: bear?.fairValue ?? null, formattedValue: fmtPrice(bear?.fairValue, currency),  tone: upsideTone(bear?.upsidePct) },
        { label: 'Base Fair Value',     value: base?.fairValue ?? null, formattedValue: fmtPrice(base?.fairValue, currency),  tone: upsideTone(base?.upsidePct) },
        { label: 'Bull Fair Value',     value: bull?.fairValue ?? null, formattedValue: fmtPrice(bull?.fairValue, currency),  tone: upsideTone(bull?.upsidePct) },
        { label: 'Weighted Fair Value', value: wFV,                    formattedValue: fmtPrice(wFV, currency),              tone: upsideTone(wUpside) },
        { label: 'Weighted Upside',     value: wUpside,                formattedValue: fmtPctSigned(wUpside),                tone: upsideTone(wUpside) },
      ],
      warnings: scenarioResult.guardErrors,
      fairValueSummary: wFV,
      currentPrice,
    }
  }, [scenarioResult, ticker, currency, currentPrice, apiData])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleAssumptionChange(methodId: ValuationMethodId | 'ev_ebitda', key: string, value: number) {
    setOverrides(prev => ({ ...prev, [methodId]: { ...(prev[methodId] ?? {}), [key]: value } }))
  }
  function handleResetOverrides(methodId: ValuationMethodId | 'ev_ebitda') {
    setOverrides(prev => { const n = { ...prev }; delete n[methodId]; return n })
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const summaryMethods: MethodResult[] = [
    { id: 'forward_pe',       label: 'Forward P/E (5Y)',   fairValue: fwdPEResult.fairValueToday,       bullFairValue: scenarioResult.scenarios.find(s => s.label === 'bull')?.fairValue ?? null, bearFairValue: scenarioResult.scenarios.find(s => s.label === 'bear')?.fairValue ?? null, upsidePct: fwdPEResult.upsidePct,          weight: 0.30 },
    { id: 'ev_ebitda',        label: 'EV/EBITDA',          fairValue: evEbitdaResult.fairValuePerShare, upsidePct: evEbitdaResult.upsidePct,      weight: 0.25 },
    { id: 'revenue_multiple', label: 'Revenue Multiple',   fairValue: revMultResult.fairValueToday,     upsidePct: revMultResult.upsidePct,       weight: 0.20 },
    { id: 'scenario_blend',   label: 'Scenario Blend',     fairValue: scenarioResult.weightedFairValue, upsidePct: scenarioResult.weightedUpsidePct, weight: 0.15 },
    { id: 'reverse_dcf',      label: 'Reverse DCF',        fairValue: null,                             upsidePct: null,                          weight: 0.10 },
  ]

  return (
    <div className="space-y-4">

      {/* ── Wizard progress ────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <WizardSteps steps={WIZARD_STEPS} current={currentStep} />
          <p className="text-micro text-slate-400 hidden sm:block">
            {currentStep === 1 ? 'Review the data foundation before running models' :
             currentStep === 2 ? 'Scroll through each method — edit any assumption live' :
             'Weighted consensus across all methods'}
          </p>
        </div>
      </div>

      {/* ── Step 1: Base Data ──────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-4">

          {/* Section A: Business Snapshot */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex gap-3 items-start">
            <svg className="text-blue-400 mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm text-blue-800 leading-relaxed">
              {buildBusinessSummary(apiData?.companyName ?? ticker, apiData)}
            </p>
          </div>

          {/* Section B: TTM Performance */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <p className="text-label uppercase tracking-wider text-slate-400">Trailing 12 Months</p>
              <SourceLabel source="yahoo">Yahoo Finance Statements</SourceLabel>
            </div>

            {statementsAvailable ? (
              <>
                {/* 4 metric tiles with sparklines */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {([
                    { label: 'Revenue',        value: ttmRevenue,   margin: null,          tag: '',            vals: sparkRevenue },
                    { label: 'EBITDA',         value: ttmEbitda,    margin: ebitdaMargin,  tag: 'margin',      vals: sparkEbitda  },
                    { label: 'Free Cash Flow', value: ttmFCF,       margin: fcfMarginPct,  tag: 'FCF margin',  vals: sparkFCF     },
                    { label: 'Net Income',     value: ttmNetIncome, margin: netMarginPct,  tag: 'net margin',  vals: sparkNI      },
                  ] as const).map(({ label, value, margin, tag, vals }) => {
                    const nums = vals.filter((v): v is number => v != null)
                    const isPositive = nums.length >= 2 ? nums[nums.length - 1] >= nums[0] : true
                    return (
                      <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-3 flex flex-col gap-1">
                        <span className="text-label uppercase tracking-wider text-slate-400">{label}</span>
                        <span className="text-lg font-bold font-mono text-slate-900">{fmtLarge(value)}</span>
                        {margin != null && (
                          <span className="text-micro text-slate-500">{(margin * 100).toFixed(1)}% {tag}</span>
                        )}
                        <div className="mt-1">
                          <MiniBarSparkline values={vals} positive={isPositive} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Balance sheet row */}
                <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2">
                  <MetricChip label="Total Debt"    value={ttmTotalDebt != null ? fmtLarge(ttmTotalDebt) : '—'} variant="default" />
                  <MetricChip label="Cash & Equiv." value={ttmCash      != null ? fmtLarge(ttmCash)      : '—'} variant="positive" />
                  <MetricChip
                    label="Net Debt"
                    value={ttmNetDebt != null ? fmtLarge(ttmNetDebt) : '—'}
                    variant={ttmNetDebt == null ? 'default' : ttmNetDebt < 0 ? 'positive' : 'warning'}
                  />
                </div>
              </>
            ) : (
              <Alert>
                <AlertDescription>
                  Statements data is loading. Key TTM metrics will appear once the data is available.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Section C: Growth Assumption Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <p className="text-label uppercase tracking-wider text-slate-400">Revenue Growth Assumption</p>
              {cagrAnalysis.confidenceLabel && (
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                  cagrAnalysis.confidenceLabel === 'High'   && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  cagrAnalysis.confidenceLabel === 'Medium' && 'bg-amber-50 text-amber-700 border-amber-200',
                  cagrAnalysis.confidenceLabel === 'Low'    && 'bg-red-50 text-red-700 border-red-200',
                )}>
                  {cagrAnalysis.confidenceLabel} Confidence
                  {cagrAnalysis.numAnalysts ? ` · ${cagrAnalysis.numAnalysts} analysts` : ''}
                </span>
              )}
            </div>
            <div className="space-y-3 mb-4">
              <GrowthBar label="Historical 3Y CAGR" value={cagrAnalysis.historicalCagr3y  ?? null} weight={cagrAnalysis.weights?.historical  ?? 0.35} />
              <GrowthBar label="Analyst Consensus"  value={cagrAnalysis.analystEstimate1y ?? null} weight={cagrAnalysis.weights?.analyst     ?? 0.45} />
              <GrowthBar label="Fundamental Growth" value={cagrAnalysis.fundamentalGrowth ?? null} weight={cagrAnalysis.weights?.fundamental ?? 0.20} />
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-700 font-medium">Blended CAGR (used in model)</span>
              <span className="text-base font-bold font-mono text-emerald-700">
                {cagrAnalysis.blended != null
                  ? `${(cagrAnalysis.blended * 100).toFixed(1)}%`
                  : `${(fwdPEBase.revenueCAGR * 100).toFixed(1)}%`}
              </span>
            </div>
          </div>

          {/* Section D: Model Inputs */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-label uppercase tracking-wider text-slate-400">Model Inputs</p>
              <SourceLabel source="calc">Derived from data</SourceLabel>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <AssumptionStat label="Revenue CAGR" value={`${(fwdPEBase.revenueCAGR  * 100).toFixed(1)}%`} sub="annual growth"     desc="How fast revenue grows each year" />
              <AssumptionStat label="Net Margin"   value={`${(fwdPEBase.netMargin    * 100).toFixed(1)}%`} sub="exit year"         desc="Profit kept from every $1 of revenue" />
              <AssumptionStat label="WACC"         value={`${(fwdPEBase.discountRate * 100).toFixed(1)}%`} sub="discount rate"     desc="Risk-adjusted return investors require" />
              <AssumptionStat label="Exit P/E"     value={`${fwdPEBase.exitPE.toFixed(0)}×`}              sub="sector-normalized" desc="Earnings multiple at end of forecast" />
            </div>
          </div>

          {/* Section E: Methods Preview */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-label uppercase tracking-wider text-slate-400">Valuation Methods</p>
              <span className="text-micro text-slate-400">4 approaches → 1 weighted answer</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { name: 'Forward P/E',      desc: '5-year earnings target discounted to today',  weight: '30%', cls: 'bg-indigo-50 border-indigo-100 text-indigo-700'  },
                { name: 'EV/EBITDA',        desc: 'Profit-adjusted sector comparable multiple',  weight: '25%', cls: 'bg-blue-50 border-blue-100 text-blue-700'        },
                { name: 'Revenue Multiple', desc: 'Top-line growth rate applied to revenue',     weight: '20%', cls: 'bg-violet-50 border-violet-100 text-violet-700'  },
                { name: 'Scenario Blend',   desc: 'Bear / Base / Bull scenarios, DCF weighted',  weight: '15%', cls: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
              ] as const).map(m => (
                <div key={m.name} className={`border rounded-xl px-3 py-2.5 ${m.cls}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold">{m.name}</span>
                    <span className="text-[10px] font-mono font-bold opacity-50">{m.weight}</span>
                  </div>
                  <p className="text-[10px] leading-snug opacity-70">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full" onClick={() => setCurrentStep(2)}>
            Review Valuation Methods →
          </Button>
        </div>
      )}

      {/* ── Step 2: Methods (vertical scroll) ─────────────────────────────── */}
      {currentStep === 2 && (
        <div className="space-y-5">

          <MethodInlinePanel
            config={fwdPEConfig}
            overrides={overrides['forward_pe'] ?? {}}
            currency={currency}
            onAssumptionChange={(key, val) => handleAssumptionChange('forward_pe', key, val)}
            onResetOverrides={() => handleResetOverrides('forward_pe')}
          />

          <MethodInlinePanel
            config={evEbitdaConfig}
            overrides={overrides['ev_ebitda'] ?? {}}
            currency={currency}
            onAssumptionChange={(key, val) => handleAssumptionChange('ev_ebitda', key, val)}
            onResetOverrides={() => handleResetOverrides('ev_ebitda')}
          />

          <MethodInlinePanel
            config={revMultConfig}
            overrides={overrides['revenue_multiple'] ?? {}}
            currency={currency}
            onAssumptionChange={(key, val) => handleAssumptionChange('revenue_multiple', key, val)}
            onResetOverrides={() => handleResetOverrides('revenue_multiple')}
          />

          <MethodInlinePanel
            config={scenarioConfig}
            overrides={overrides['scenario_blend'] ?? {}}
            currency={currency}
            onAssumptionChange={(key, val) => handleAssumptionChange('scenario_blend', key, val)}
            onResetOverrides={() => handleResetOverrides('scenario_blend')}
          />

          <MethodInlinePanel
            config={reverseDCFConfig}
            overrides={{}}
            currency={currency}
            onAssumptionChange={() => {}}
            onResetOverrides={() => {}}
          />

          {/* Full DCF Modelling Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Full DCF Modelling Table</h3>
              <p className="text-micro text-slate-400 mt-0.5">
                Year-by-year unlevered FCF model grounded in Yahoo Finance statements
              </p>
            </div>
            <DataQualityWarnings
              terminalGError={null}
              financialCurrencyNote={apiData?.financialCurrencyNote ?? null}
              isFinancialSector={apiData?.valuationMethods?.companyType === 'financial'}
              isNegativeFCF={apiData?.baseFCF != null && apiData.baseFCF < 0}
              altmanZone={apiData?.scores?.altman?.zone ?? null}
              beneishFlag={apiData?.scores?.beneish?.flag ?? null}
            />
            <ModellingWorkspace apiData={apiData} ticker={ticker} statementsData={statementsData} />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
              ← Back to Base Data
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCurrentStep(3)}>
              See Valuation Summary →
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Summary ───────────────────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-card">
            <p className="text-label uppercase tracking-wider text-slate-500">
              Valuation Summary — Weighted Consensus
            </p>
          </div>
          <ValuationSummary
            methods={summaryMethods}
            currentPrice={currentPrice}
            currency={currency}
          />
          <Button variant="outline" className="w-full" onClick={() => setCurrentStep(2)}>
            ← Back to Methods
          </Button>
        </div>
      )}
    </div>
  )
}
