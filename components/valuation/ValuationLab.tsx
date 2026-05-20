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
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

// ─── Local helpers ─────────────────────────────────────────────────────────────

function rowYear(r: { endDate?: string | null; year?: string; fiscalDate?: string | null }): string {
  return r.endDate?.slice(0, 4) ?? r.year ?? r.fiscalDate?.slice(0, 4) ?? ''
}

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

// ─── MethodInlinePanel ────────────────────────────────────────────────────────

interface MethodInlinePanelProps {
  config: ValuationMethodConfig
  overrides: Record<string, number>
  currency: string
  onAssumptionChange: (key: string, value: number) => void
  onResetOverrides: () => void
  onNavigateToFinancials?: (rowKey: string, statement: 'income' | 'balance' | 'cashflow') => void
  evidenceCharts?: Record<string, EvidenceChartDef | undefined>
}

function MethodInlinePanel({ config, overrides, currency, onAssumptionChange, onResetOverrides, onNavigateToFinancials, evidenceCharts }: MethodInlinePanelProps) {
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
          {config.methodDescription && (
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{config.methodDescription}</p>
          )}
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
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-2">
                {config.evidence.map(({ label, text, rowKey, statement }) => {
                  const isLink = !!rowKey && !!statement
                  const chart  = evidenceCharts?.[label]
                  return (
                    <div key={label} className="text-xs">
                      <div className="flex gap-3">
                        <span
                          className={cn(
                            'font-medium w-24 shrink-0',
                            isLink
                              ? 'cursor-pointer text-blue-600 hover:text-blue-800 hover:underline underline-offset-2'
                              : 'text-slate-500',
                          )}
                          title={isLink ? 'View in Financials tab' : undefined}
                          onClick={() => isLink && onNavigateToFinancials?.(rowKey!, statement!)}
                        >
                          {isLink && (
                            <svg className="inline mr-0.5 mb-0.5" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          )}
                          {label}
                        </span>
                        <span className="text-slate-600 leading-relaxed">{text}</span>
                      </div>
                      {chart && chart.data.length >= 2 && (
                        <div className="mt-1.5 h-[72px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chart.data} margin={{ top: 2, right: 4, left: -18, bottom: 0 }}>
                              <XAxis dataKey="year" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                                tickFormatter={(v: number) =>
                                  chart.unit === '%' ? `${v}%` : chart.unit === 'x' ? `${v}×` : `${v}`
                                }
                              />
                              <Tooltip formatter={(v: unknown) => [
                                typeof v === 'number'
                                  ? `${v.toFixed(1)}${chart.unit === '%' ? '%' : chart.unit === 'x' ? '×' : chart.unit === '$M' ? 'M' : ''}`
                                  : '—',
                                label,
                              ]} />
                              <ReferenceLine y={0} stroke="#e2e8f0" />
                              {chart.referenceValue != null && (
                                <ReferenceLine y={chart.referenceValue} stroke={chart.color} strokeDasharray="3 3"
                                  label={{ value: chart.referenceLabel ?? '', fontSize: 8, fill: chart.color, position: 'right' }} />
                              )}
                              <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                                {chart.data.map((entry, idx) => (
                                  <Cell key={idx} fill={entry.value < 0 ? '#ef4444' : chart.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )
                })}
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
                          {displayVal === '—'
                            ? <NABadge reason="no-data" />
                            : <>{displayVal}{a.unit === '%' ? '%' : a.unit === 'x' ? '×' : ''}</>
                          }
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Results */}
        <div className="space-y-5">
          {config.results.length > 0 && (
            <div>
              <p className="text-label uppercase tracking-wider text-slate-400 mb-2">Results</p>
              <div className="divide-y divide-slate-100">
                {config.results.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-slate-500 font-medium">{r.label}</span>
                    <span className={cn('font-bold font-mono text-sm', resultToneClass(r.tone))}>
                      {r.formattedValue === '—' ? <NABadge reason="calc-error" /> : r.formattedValue}
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

// ─── Types ────────────────────────────────────────────────────────────────────

type EvidenceChartDef = {
  data: { year: string; value: number }[]
  unit: '%' | '$M' | 'x' | '$'
  color: string
  referenceValue?: number
  referenceLabel?: string
}

interface HistoryChartDef {
  data: { year: string; value: number }[]
}

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
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationLab({ apiData, ticker, statementsData, onNavigateToFinancials }: ValuationLabProps) {
  const [overrides,    setOverrides]    = useState<OverridesMap>({})
  const [showAdvanced, setShowAdvanced] = useState(false)

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

  // Annual data — use any[] because fundamentalsTimeSeries uses totalRevenue/EBITDA (not revenue/ebitda)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annualIS: any[] = statementsData?.annual?.incomeStatement ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annualCF: any[] = statementsData?.annual?.cashFlow ?? []

  // FX rate: statementsData (fundamentalsTimeSeries) reports in financialCurrency (e.g. BRL for STNE).
  // All absolute monetary TTM values must be converted to quote currency (USD for ADRs) before use.
  const stmtFxRate = (apiData?.providerStatus?.fx?.rate as number | undefined) ?? 1

  // Annual chart data for method history panels
  const chartRevenueGrowth: HistoryChartDef['data'] = annualIS.slice(1).reduce<{ year: string; value: number }[]>((acc, r: any, i) => {
    const prev = annualIS[i]
    const rev  = r.totalRevenue as number | null
    const prevRev = prev.totalRevenue as number | null
    if (rev != null && prevRev != null && prevRev > 0) {
      acc.push({ year: rowYear(r), value: (rev - prevRev) / prevRev * 100 })
    }
    return acc
  }, []).slice(-5)

  const chartNetMargin: HistoryChartDef['data'] = annualIS.reduce<{ year: string; value: number }[]>((acc, r: any) => {
    const rev = r.totalRevenue as number | null
    const ni  = r.netIncome   as number | null
    if (rev != null && rev > 0 && ni != null) {
      acc.push({ year: rowYear(r), value: ni / rev * 100 })
    }
    return acc
  }, []).slice(-5)

  const chartEbitda: HistoryChartDef['data'] = annualIS.reduce<{ year: string; value: number }[]>((acc, r: any) => {
    const ebitda = r.EBITDA as number | null
    if (ebitda != null) acc.push({ year: rowYear(r), value: ebitda / 1e6 * stmtFxRate })
    return acc
  }, []).slice(-5)

  const chartRevenue: HistoryChartDef['data'] = annualIS.reduce<{ year: string; value: number }[]>((acc, r: any) => {
    const rev = r.totalRevenue as number | null
    if (rev != null && rev > 0) acc.push({ year: rowYear(r), value: rev / 1e6 * stmtFxRate })
    return acc
  }, []).slice(-5)

  const cfByYear = new Map(annualCF.map((r: any) => [rowYear(r), (r.freeCashFlow as number | null) ?? null]))

  const chartFCFMargin: HistoryChartDef['data'] = annualIS.reduce<{ year: string; value: number }[]>((acc, r: any) => {
    const yr  = rowYear(r)
    const rev = r.totalRevenue as number | null
    const fcf = cfByYear.get(yr)
    if (rev != null && rev > 0 && fcf != null) {
      acc.push({ year: yr, value: fcf / rev * 100 })
    }
    return acc
  }, []).slice(-5)

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
    // ttmEbitda / ttmNetDebt are in reporting currency (BRL for ADRs) — convert to quote currency
    const ebitdaRaw  = ttmEbitda ?? (apiData?.financialStatements?.incomeStatement?.find((r: { isProjected?: boolean; ebitda?: number }) => !r.isProjected)?.ebitda ?? null)
    const ebitda     = ebitdaRaw != null ? ebitdaRaw * stmtFxRate : null
    const shares     = sharesAbsolute
    const cashFMP    = apiData?.fairValue?.cash != null ? apiData.fairValue.cash * 1e6 : null
    const debtFMP    = apiData?.fairValue?.debt != null ? apiData.fairValue.debt * 1e6 : null
    const netDebtRaw = ttmNetDebt != null ? ttmNetDebt * stmtFxRate : null
    const netDebt    = netDebtRaw ?? (debtFMP != null && cashFMP != null ? debtFMP - cashFMP : null)
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

  const currentPERatio = apiData?.quote?.peRatio ?? null
  const chartPEComparison: EvidenceChartDef['data'] = [
    ...(currentPERatio != null && currentPERatio > 0 ? [{ year: 'TTM P/E', value: +currentPERatio.toFixed(1) }] : []),
    ...(fwdPEInputs.exitPE != null ? [{ year: 'Exit P/E', value: +fwdPEInputs.exitPE.toFixed(1) }] : []),
  ]
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

  const reverseDCFConfig = useMemo((): ValuationMethodConfig => {
    return {
      id: 'reverse_dcf', title: 'Reverse DCF', subtitle: 'What growth rate the market is pricing in',
      methodDescription: "Works backwards from today's price to find the growth rate the market is implicitly pricing in. If the implied CAGR looks unrealistically high vs. analyst expectations, the stock may be expensive.",
      companyName: apiData?.companyName ?? ticker, ticker, currency,
      evidence: [
        { label: 'Implied EV', text: reverseDCFResult.impliedEV != null ? fmtB(reverseDCFResult.impliedEV) + ' (price × shares + debt − cash)' : 'Cannot compute — missing inputs' },
        { label: 'FCF Margin', text: lastFCFMargin != null ? (lastFCFMargin * 100).toFixed(1) + '% (TTM FCF / revenue)' : 'Not available', rowKey: 'freeCashFlow', statement: 'cashflow' },
        { label: 'Revenue',    text: lastActualRevenue != null ? fmtB(lastActualRevenue) + ' (TTM / last annual)' : 'Not available', rowKey: 'totalRevenue', statement: 'income' },
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
      formulaLines: [],
      results:  buildReverseDCFResults(reverseDCFResult),
      warnings: [...reverseDCFResult.guardErrors, ...(reverseDCFResult.interpretationText ? [reverseDCFResult.interpretationText] : [])],
      fairValueSummary: null,
      currentPrice,
    }
  }, [reverseDCFResult, ticker, currency, currentPrice, lastActualRevenue, lastFCFMargin, apiData])

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleAssumptionChange(methodId: ValuationMethodId | 'ev_ebitda', key: string, value: number) {
    setOverrides(prev => ({ ...prev, [methodId]: { ...(prev[methodId] ?? {}), [key]: value } }))
  }
  function handleResetOverrides(methodId: ValuationMethodId | 'ev_ebitda') {
    setOverrides(prev => { const n = { ...prev }; delete n[methodId]; return n })
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const summaryMethods: MethodResult[] = [
    { id: 'forward_pe',       label: 'Forward P/E (5Y)',          fairValue: fwdPEResult.fairValueToday,       upsidePct: fwdPEResult.upsidePct,           weight: 0.35 },
    { id: 'ev_ebitda',        label: 'EV/EBITDA',                 fairValue: evEbitdaResult.fairValuePerShare, upsidePct: evEbitdaResult.upsidePct,        weight: 0.30 },
    { id: 'revenue_multiple', label: 'Revenue Multiple',          fairValue: revMultResult.fairValueToday,     upsidePct: revMultResult.upsidePct,         weight: 0.25 },
    { id: 'core_dcf',         label: 'Core DCF (FCFF/FCFE/DDM)',  fairValue: (apiData?.valuationMethods?.triangulatedFairValue as number | null) ?? null, upsidePct: (apiData?.valuationMethods?.triangulatedUpsidePct as number | null) ?? null, weight: 0.10 },
  ]

  return (
    <div className="space-y-4">

      {/* ── 1. Valuation Summary — THE ANSWER (always first) ─────────────── */}
      <ValuationSummary
        methods={summaryMethods}
        currentPrice={currentPrice}
        currency={currency}
      />

      {/* ── 2. Method details ────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <p className="text-label uppercase tracking-wider text-slate-400 px-1">How each method is computed</p>

        <MethodInlinePanel
          config={fwdPEConfig}
          overrides={overrides['forward_pe'] ?? {}}
          currency={currency}
          onAssumptionChange={(key, val) => handleAssumptionChange('forward_pe', key, val)}
          onResetOverrides={() => handleResetOverrides('forward_pe')}
          onNavigateToFinancials={onNavigateToFinancials}
          evidenceCharts={{
            'Revenue CAGR': chartRevenueGrowth.length >= 2 ? { data: chartRevenueGrowth, unit: '%', color: '#6366f1', referenceValue: +(fwdPEBase.revenueCAGR * 100).toFixed(1), referenceLabel: 'Blended' } : undefined,
            'Net Margin':   chartNetMargin.length   >= 2 ? { data: chartNetMargin,    unit: '%', color: '#10b981', referenceValue: +((fwdPEInputs.netMargin ?? 0) * 100).toFixed(1), referenceLabel: 'Exit target' } : undefined,
            'Exit P/E':     chartPEComparison.length >= 2 ? { data: chartPEComparison, unit: 'x', color: '#f59e0b' } : undefined,
          }}
        />

        <MethodInlinePanel
          config={evEbitdaConfig}
          overrides={overrides['ev_ebitda'] ?? {}}
          currency={currency}
          onAssumptionChange={(key, val) => handleAssumptionChange('ev_ebitda', key, val)}
          onResetOverrides={() => handleResetOverrides('ev_ebitda')}
          onNavigateToFinancials={onNavigateToFinancials}
          evidenceCharts={{
            'TTM EBITDA': chartEbitda.length >= 2 ? { data: chartEbitda, unit: '$M', color: '#3b82f6' } : undefined,
          }}
        />

        <MethodInlinePanel
          config={revMultConfig}
          overrides={overrides['revenue_multiple'] ?? {}}
          currency={currency}
          onAssumptionChange={(key, val) => handleAssumptionChange('revenue_multiple', key, val)}
          onResetOverrides={() => handleResetOverrides('revenue_multiple')}
          onNavigateToFinancials={onNavigateToFinancials}
          evidenceCharts={{
            'Revenue CAGR': chartRevenueGrowth.length >= 2 ? { data: chartRevenueGrowth, unit: '%', color: '#6366f1', referenceValue: +(revMultBase.revenueCAGR * 100).toFixed(1), referenceLabel: 'Blended' } : undefined,
          }}
        />

        <MethodInlinePanel
          config={reverseDCFConfig}
          overrides={{}}
          currency={currency}
          onAssumptionChange={() => {}}
          onResetOverrides={() => {}}
          onNavigateToFinancials={onNavigateToFinancials}
          evidenceCharts={{
            'FCF Margin': chartFCFMargin.length >= 2 ? { data: chartFCFMargin, unit: '%', color: '#0ea5e9' } : undefined,
            'Revenue':    chartRevenue.length    >= 2 ? { data: chartRevenue,  unit: '$M', color: '#8b5cf6' } : undefined,
          }}
        />
      </div>

      {/* ── 5. Advanced Mode — full DCF table ────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-card overflow-hidden">
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-semibold text-slate-700">Advanced DCF model</span>
            <span className="text-micro text-slate-400">Year-by-year DCF model · UFCF &amp; LFCF · editable cells</span>
          </div>
          <svg
            className={cn('text-slate-400 transition-transform', showAdvanced && 'rotate-180')}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="border-t border-slate-100">
            <div className="px-5 pt-4 pb-2">
              <h3 className="text-base font-bold text-slate-900">Full DCF Modelling Table</h3>
              <p className="text-micro text-slate-400 mt-0.5">
                Year-by-year unlevered FCF model grounded in Yahoo Finance statements
              </p>
            </div>
            <ModellingWorkspace apiData={apiData} ticker={ticker} statementsData={statementsData} />
          </div>
        )}
      </div>
    </div>
  )
}
