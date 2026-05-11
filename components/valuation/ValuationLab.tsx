'use client'

import { useState, useMemo, useRef } from 'react'
import ValuationMethodCard from './ValuationMethodCard'
import ValuationModelDrawer, {
  type ValuationMethodId,
  type ValuationMethodConfig,
  type ValuationResult,
} from './ValuationModelDrawer'
import ModellingWorkspace from '@/components/modelling/ModellingWorkspace'
import DataQualityWarnings from '@/components/modelling/DataQualityWarnings'
import { computeForwardPE } from '@/lib/valuation/methods/forwardPE'
import { computeRevenueMultiple } from '@/lib/valuation/methods/revenueMultiple'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'
import { computeScenarioBlend } from '@/lib/valuation/methods/scenarioBlend'
import {
  deriveForwardPEAssumptions,
  deriveRevenueMultipleAssumptions,
} from '@/lib/valuation/assumptions/deriveAssumptions'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtPrice(v: number | null, currency = 'USD'): string {
  if (v == null) return '—'
  const prefix = currency === 'USD' ? '$' : currency + ' '
  if (Math.abs(v) >= 1000) return prefix + v.toFixed(0)
  return prefix + v.toFixed(2)
}

function fmtPctSigned(v: number | null): string {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'
}

function fmtB(v: number | null): string {
  if (v == null) return '—'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(2) + 'T'
  if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(1) + 'B'
  if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(0) + 'M'
  return sign + '$' + abs.toFixed(0)
}

// ─── Formula builders ─────────────────────────────────────────────────────────

function buildForwardPEFormula(
  inputs: { ltvRevenue: number | null; sharesOutstanding: number | null; revenueCAGR: number; netMargin: number; exitPE: number; dilutionRate: number; discountRate: number },
  result: ReturnType<typeof computeForwardPE>,
  N = 5,
): string[] {
  if (result.futureTargetPrice == null || inputs.ltvRevenue == null) return ['Insufficient inputs to display formula']
  const sharesB = inputs.sharesOutstanding != null ? (inputs.sharesOutstanding / 1e9).toFixed(3) + 'B' : '—'
  const cagrPct = (inputs.revenueCAGR * 100).toFixed(1)
  const marginPct = (inputs.netMargin * 100).toFixed(1)
  const dilPct = (inputs.dilutionRate * 100).toFixed(1)
  const waccPct = (inputs.discountRate * 100).toFixed(1)
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
  const cagrPct = (inputs.revenueCAGR * 100).toFixed(1)
  const waccPct = (inputs.discountRate * 100).toFixed(1)
  const targetYear = new Date().getFullYear() + N
  return [
    `${fmtB(inputs.ltvRevenue)} × (1+${cagrPct}%)^${N} × ${inputs.exitEVRevenue.toFixed(1)}× EV/Revenue`,
    inputs.netDebt != null ? `- ${fmtB(inputs.netDebt)} net debt = equity value` : '÷ shares outstanding',
    `= ${fmtPrice(result.futureTargetPrice)} target in ${targetYear}`,
    `Discounted at ${waccPct}% for ${N} years → fair value today`,
  ]
}

// ─── Results builders ─────────────────────────────────────────────────────────

function upsideTone(v: number | null): ValuationResult['tone'] {
  if (v == null) return 'neutral'
  if (v >= 0.10) return 'positive'
  if (v >= 0)    return 'neutral'
  return 'negative'
}

function buildForwardPEResults(
  result: ReturnType<typeof computeForwardPE>,
  currentPrice: number,
  currency = 'USD',
): ValuationResult[] {
  const N = 5
  const targetYear = new Date().getFullYear() + N
  return [
    { label: 'Actual Price',      value: currentPrice,                formattedValue: fmtPrice(currentPrice, currency), tone: 'neutral' },
    { label: `${targetYear} Target`, value: result.futureTargetPrice, formattedValue: fmtPrice(result.futureTargetPrice, currency), tone: 'neutral' },
    { label: 'Fair Value Today',  value: result.fairValueToday,       formattedValue: fmtPrice(result.fairValueToday, currency), tone: upsideTone(result.upsidePct) },
    { label: '1Y Price Target',   value: result.target1Y,             formattedValue: fmtPrice(result.target1Y, currency), tone: 'neutral' },
    { label: 'Potential Upside',  value: result.upsidePct,            formattedValue: fmtPctSigned(result.upsidePct), tone: upsideTone(result.upsidePct) },
    { label: 'Expected Return',   value: result.expectedReturnPct,    formattedValue: result.expectedReturnPct != null ? fmtPctSigned(result.expectedReturnPct) + '/yr' : '—', tone: upsideTone(result.expectedReturnPct) },
    ...(result.expectedReturnWithDivPct != null && result.expectedReturnWithDivPct !== result.expectedReturnPct
      ? [{ label: 'Total Ret. (w/ Div)', value: result.expectedReturnWithDivPct, formattedValue: fmtPctSigned(result.expectedReturnWithDivPct) + '/yr', tone: upsideTone(result.expectedReturnWithDivPct) } as ValuationResult]
      : []),
  ]
}

function buildRevMultipleResults(
  result: ReturnType<typeof computeRevenueMultiple>,
  currentPrice: number,
  currency = 'USD',
): ValuationResult[] {
  const N = 5
  const targetYear = new Date().getFullYear() + N
  return [
    { label: 'Actual Price',      value: currentPrice,                formattedValue: fmtPrice(currentPrice, currency), tone: 'neutral' },
    { label: `${targetYear} Target`, value: result.futureTargetPrice, formattedValue: fmtPrice(result.futureTargetPrice, currency), tone: 'neutral' },
    { label: 'Fair Value Today',  value: result.fairValueToday,       formattedValue: fmtPrice(result.fairValueToday, currency), tone: upsideTone(result.upsidePct) },
    { label: '1Y Price Target',   value: result.target1Y,             formattedValue: fmtPrice(result.target1Y, currency), tone: 'neutral' },
    { label: 'Potential Upside',  value: result.upsidePct,            formattedValue: fmtPctSigned(result.upsidePct), tone: upsideTone(result.upsidePct) },
    { label: 'Expected Return',   value: result.expectedReturnPct,    formattedValue: result.expectedReturnPct != null ? fmtPctSigned(result.expectedReturnPct) + '/yr' : '—', tone: upsideTone(result.expectedReturnPct) },
  ]
}

function buildReverseDCFResults(
  result: ReturnType<typeof computeReverseDCF>,
): ValuationResult[] {
  const implCAGRFmt = result.impliedCAGR != null
    ? (result.impliedCAGR * 100).toFixed(1) + '%'
    : '—'
  const interpTone: ValuationResult['tone'] =
    result.interpretation === 'conservative' ? 'positive'
    : result.interpretation === 'reasonable' ? 'positive'
    : result.interpretation === 'aggressive' ? 'warning'
    : result.interpretation === 'very_aggressive' ? 'negative'
    : 'neutral'
  return [
    { label: 'Implied 5Y CAGR', value: result.impliedCAGR, formattedValue: implCAGRFmt, tone: interpTone },
    { label: 'FCF Margin Used', value: result.impliedFCFMargin, formattedValue: result.impliedFCFMargin != null ? (result.impliedFCFMargin * 100).toFixed(1) + '%' : '—', tone: 'neutral' },
    { label: 'Assessment',      value: null, formattedValue: result.interpretation.replace('_', ' '), tone: interpTone },
  ]
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OverridesMap = Partial<Record<ValuationMethodId, Record<string, number>>>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinancialsData = any

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  const valueClass = tone === 'positive' ? 'text-emerald-400' : tone === 'negative' ? 'text-red-400' : 'text-[#e2e2e2]'
  return (
    <div className="bg-[#0a0a0a] rounded-xl border border-[#1e1e1e] px-4 py-3">
      <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1">{label}</div>
      <div className={`text-[20px] font-bold font-mono ${valueClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-[#444] mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ValuationLabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData: FinancialsData
  ticker: string
}

export default function ValuationLab({ apiData, ticker }: ValuationLabProps) {
  const [activeMethod, setActiveMethod] = useState<ValuationMethodId | null>(null)
  const [overrides, setOverrides] = useState<OverridesMap>({})
  const dcfRef = useRef<HTMLDivElement>(null)

  const currency = apiData?.quote?.currency ?? 'USD'
  const currentPrice: number = apiData?.quote?.price ?? 0

  // ── Derive base assumptions from API data ────────────────────────────────
  const fwdPEBase   = useMemo(() => deriveForwardPEAssumptions(apiData), [apiData])
  const revMultBase = useMemo(() => deriveRevenueMultipleAssumptions(apiData), [apiData])

  // ── Forward P/E ──────────────────────────────────────────────────────────
  const fwdPEOverrides = overrides['forward_pe'] ?? {}
  const fwdPEInputs = useMemo(() => ({
    ltvRevenue:        fwdPEOverrides.ltvRevenue        ?? fwdPEBase.ltvRevenue,
    sharesOutstanding: fwdPEOverrides.sharesOutstanding ?? fwdPEBase.sharesOutstanding,
    revenueCAGR:       fwdPEOverrides.revenueCAGR       ?? fwdPEBase.revenueCAGR,
    netMargin:         fwdPEOverrides.netMargin         ?? fwdPEBase.netMargin,
    exitPE:            fwdPEOverrides.exitPE            ?? fwdPEBase.exitPE,
    dilutionRate:      fwdPEOverrides.dilutionRate      ?? fwdPEBase.dilutionRate,
    discountRate:      fwdPEOverrides.discountRate      ?? fwdPEBase.discountRate,
    currentPrice,
    dividendYield:     null,
  }), [fwdPEBase, fwdPEOverrides, currentPrice])
  const fwdPEResult = useMemo(() => computeForwardPE(fwdPEInputs), [fwdPEInputs])

  const fwdPEConfig = useMemo((): ValuationMethodConfig => ({
    id: 'forward_pe',
    title: 'Forward P/E',
    subtitle: '5-year target price discounted to today',
    companyName: apiData?.companyName ?? ticker,
    ticker,
    currency,
    evidence: fwdPEBase.evidence,
    assumptions: fwdPEBase.assumptions,
    formulaLines: buildForwardPEFormula(fwdPEInputs, fwdPEResult),
    results: buildForwardPEResults(fwdPEResult, currentPrice, currency),
    warnings: fwdPEResult.guardErrors,
    fairValueSummary: fwdPEResult.fairValueToday,
    currentPrice,
  }), [fwdPEBase, fwdPEInputs, fwdPEResult, ticker, currency, currentPrice, apiData])

  // ── Revenue Multiple ─────────────────────────────────────────────────────
  const revMultOverrides = overrides['revenue_multiple'] ?? {}
  const revMultInputs = useMemo(() => ({
    ltvRevenue:        revMultOverrides.ltvRevenue        ?? revMultBase.ltvRevenue,
    sharesOutstanding: revMultOverrides.sharesOutstanding ?? revMultBase.sharesOutstanding,
    revenueCAGR:       revMultOverrides.revenueCAGR       ?? revMultBase.revenueCAGR,
    exitEVRevenue:     revMultOverrides.exitEVRevenue     ?? revMultBase.exitEVRevenue,
    netDebt:           revMultOverrides.netDebt           ?? revMultBase.netDebt,
    dilutionRate:      revMultOverrides.dilutionRate      ?? revMultBase.dilutionRate,
    discountRate:      revMultOverrides.discountRate      ?? revMultBase.discountRate,
    currentPrice,
    dividendYield:     null,
  }), [revMultBase, revMultOverrides, currentPrice])
  const revMultResult = useMemo(() => computeRevenueMultiple(revMultInputs), [revMultInputs])

  const revMultConfig = useMemo((): ValuationMethodConfig => ({
    id: 'revenue_multiple',
    title: 'Revenue Multiple',
    subtitle: 'EV/Revenue exit multiple discounted to today',
    companyName: apiData?.companyName ?? ticker,
    ticker,
    currency,
    evidence: revMultBase.evidence,
    assumptions: revMultBase.assumptions,
    formulaLines: buildRevMultipleFormula(revMultInputs, revMultResult),
    results: buildRevMultipleResults(revMultResult, currentPrice, currency),
    warnings: revMultResult.guardErrors,
    fairValueSummary: revMultResult.fairValueToday,
    currentPrice,
  }), [revMultBase, revMultInputs, revMultResult, ticker, currency, currentPrice, apiData])

  // ── Reverse DCF ──────────────────────────────────────────────────────────
  const incomeRows: Array<{ revenue: number | null; netIncome: number | null; freeCashFlow?: number | null; isProjected: boolean }> =
    apiData?.financialStatements?.incomeStatement ?? []
  const cashFlowRows: Array<{ freeCashFlow: number | null; isProjected: boolean }> =
    apiData?.financialStatements?.cashFlow ?? []

  const lastActualRevenue = useMemo(() => {
    const actuals = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
    return actuals.length > 0 ? actuals[actuals.length - 1].revenue! : null
  }, [incomeRows])

  const lastFCFMargin = useMemo(() => {
    const cfActuals = cashFlowRows.filter(r => !r.isProjected && r.freeCashFlow != null)
    const incActuals = incomeRows.filter(r => !r.isProjected && r.revenue != null && r.revenue > 0)
    if (cfActuals.length === 0 || incActuals.length === 0) return null
    const fcf = cfActuals[cfActuals.length - 1].freeCashFlow!
    const rev = incActuals[incActuals.length - 1].revenue!
    return rev > 0 ? fcf / rev : null
  }, [cashFlowRows, incomeRows])

  const reverseDCFResult = useMemo(() => computeReverseDCF({
    currentPrice,
    sharesOutstanding: apiData?.fairValue?.sharesOutstanding ?? null,
    cashM: apiData?.fairValue?.cash ?? null,
    debtM: apiData?.fairValue?.debt ?? null,
    lastRevenue: lastActualRevenue,
    lastFCFMargin,
    wacc: apiData?.wacc?.wacc ?? 0.09,
    terminalG: apiData?.terminalG ?? 0.025,
    historicalCAGR: apiData?.cagrAnalysis?.historicalCagr3y ?? null,
  }), [currentPrice, apiData, lastActualRevenue, lastFCFMargin])

  const reverseDCFConfig = useMemo((): ValuationMethodConfig => {
    const implCAGRPct = reverseDCFResult.impliedCAGR != null
      ? (reverseDCFResult.impliedCAGR * 100).toFixed(1) + '%'
      : '—'
    return {
      id: 'reverse_dcf',
      title: 'Reverse DCF',
      subtitle: 'What the market is pricing in',
      companyName: apiData?.companyName ?? ticker,
      ticker,
      currency,
      evidence: [
        { label: 'Implied EV',   text: reverseDCFResult.impliedEV != null ? fmtB(reverseDCFResult.impliedEV) + ' (price × shares + debt − cash)' : 'Cannot compute — missing inputs' },
        { label: 'FCF Margin',   text: lastFCFMargin != null ? (lastFCFMargin * 100).toFixed(1) + '% (trailing 12-month FCF / revenue)' : 'Not available' },
        { label: 'WACC',         text: ((apiData?.wacc?.wacc ?? 0.09) * 100).toFixed(1) + '% (from WACC calculation)' },
        { label: 'Terminal G',   text: ((apiData?.terminalG ?? 0.025) * 100).toFixed(1) + '% (long-run growth assumption)' },
      ],
      assumptions: [
        { key: 'currentPrice',       label: 'Current Price',        value: currentPrice, unit: '$', editable: false, source: 'model_default' },
        { key: 'sharesOutstanding',  label: 'Shares Outstanding',   value: apiData?.fairValue?.sharesOutstanding ?? null, unit: 'shares', editable: false, source: 'model_default' },
        { key: 'lastRevenue',        label: 'LTM Revenue',          value: lastActualRevenue, unit: '$', editable: false, source: 'historical_3y_median' },
        { key: 'lastFCFMargin',      label: 'FCF Margin',           value: lastFCFMargin, unit: '%', editable: false, source: 'historical_3y_median' },
        { key: 'wacc',               label: 'WACC',                 value: apiData?.wacc?.wacc ?? 0.09, unit: '%', editable: false, source: 'model_default' },
        { key: 'terminalG',          label: 'Terminal Growth',      value: apiData?.terminalG ?? 0.025, unit: '%', editable: false, source: 'model_default' },
      ],
      formulaLines: [
        `Implied EV = ${fmtB(reverseDCFResult.impliedEV)}`,
        `FCF margin fixed at ${lastFCFMargin != null ? (lastFCFMargin * 100).toFixed(1) + '%' : '—'}`,
        `Solve for CAGR such that PV(FCF) + PV(TV) = Implied EV`,
        `→ Required 5Y CAGR: ${implCAGRPct}`,
      ],
      results: buildReverseDCFResults(reverseDCFResult),
      warnings: [
        ...reverseDCFResult.guardErrors,
        ...(reverseDCFResult.interpretationText ? [reverseDCFResult.interpretationText] : []),
      ],
      fairValueSummary: null, // Reverse DCF doesn't produce a fair value
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
    const wFV = scenarioResult.weightedFairValue
    const wUpside = scenarioResult.weightedUpsidePct
    const [bear, base, bull] = scenarioResult.scenarios
    return {
      id: 'scenario_blend',
      title: 'Scenario Blend',
      subtitle: 'Bear / Base / Bull probability-weighted fair value',
      companyName: apiData?.companyName ?? ticker,
      ticker,
      currency,
      evidence: [
        { label: 'Bear (25%)',  text: `CAGR −5pp, margin −3pp, P/E −3× vs base → ${fmtPrice(bear?.fairValue, currency)}` },
        { label: 'Base (50%)',  text: `Model assumptions → ${fmtPrice(base?.fairValue, currency)}` },
        { label: 'Bull (25%)',  text: `CAGR +5pp, margin +3pp, P/E +3× vs base → ${fmtPrice(bull?.fairValue, currency)}` },
      ],
      assumptions: [],
      formulaLines: [
        `Bear: ${fmtPrice(bear?.fairValue, currency)} × 25%`,
        `Base: ${fmtPrice(base?.fairValue, currency)} × 50%`,
        `Bull: ${fmtPrice(bull?.fairValue, currency)} × 25%`,
        `= ${fmtPrice(wFV, currency)} weighted fair value`,
      ],
      results: [
        { label: 'Bear Fair Value',     value: bear?.fairValue  ?? null, formattedValue: fmtPrice(bear?.fairValue, currency),  tone: upsideTone(bear?.upsidePct) },
        { label: 'Base Fair Value',     value: base?.fairValue  ?? null, formattedValue: fmtPrice(base?.fairValue, currency),  tone: upsideTone(base?.upsidePct) },
        { label: 'Bull Fair Value',     value: bull?.fairValue  ?? null, formattedValue: fmtPrice(bull?.fairValue, currency),  tone: upsideTone(bull?.upsidePct) },
        { label: 'Weighted Fair Value', value: wFV,                     formattedValue: fmtPrice(wFV, currency),              tone: upsideTone(wUpside) },
        { label: 'Weighted Upside',     value: wUpside,                 formattedValue: fmtPctSigned(wUpside),                tone: upsideTone(wUpside) },
      ],
      warnings: scenarioResult.guardErrors,
      fairValueSummary: wFV,
      currentPrice,
    }
  }, [scenarioResult, ticker, currency, currentPrice, apiData])

  // ── DCF stub config (opens scroll-to section) ────────────────────────────
  const dcfConfig = useMemo((): ValuationMethodConfig => ({
    id: 'dcf',
    title: 'Full DCF Model',
    subtitle: 'Year-by-year unlevered & levered cash flow model',
    companyName: apiData?.companyName ?? ticker,
    ticker,
    currency,
    evidence: [],
    assumptions: [],
    formulaLines: ['See the full Fiscal AI-style modelling table below.'],
    results: [],
    warnings: [],
    fairValueSummary: null,
    currentPrice,
  }), [ticker, currency, currentPrice, apiData])

  // ── Active config ────────────────────────────────────────────────────────
  const configMap: Record<ValuationMethodId, ValuationMethodConfig> = useMemo(() => ({
    forward_pe:       fwdPEConfig,
    revenue_multiple: revMultConfig,
    dcf:              dcfConfig,
    reverse_dcf:      reverseDCFConfig,
    scenario_blend:   scenarioConfig,
  }), [fwdPEConfig, revMultConfig, dcfConfig, reverseDCFConfig, scenarioConfig])

  const activeConfig = activeMethod ? configMap[activeMethod] : null

  function handleAssumptionChange(methodId: ValuationMethodId, key: string, value: number) {
    setOverrides(prev => ({
      ...prev,
      [methodId]: { ...(prev[methodId] ?? {}), [key]: value },
    }))
  }

  function handleResetOverrides(methodId: ValuationMethodId) {
    setOverrides(prev => { const n = { ...prev }; delete n[methodId]; return n })
  }

  function handleMethodOpen(id: ValuationMethodId) {
    if (id === 'dcf') {
      dcfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setActiveMethod(id)
  }

  const allMethods: ValuationMethodId[] = ['forward_pe', 'revenue_multiple', 'dcf', 'reverse_dcf', 'scenario_blend']

  // Summary stats from Forward P/E as primary
  const baseFairValue   = fwdPEResult.fairValueToday
  const baseUpsidePct   = fwdPEResult.upsidePct
  const baseExpectedRet = fwdPEResult.expectedReturnPct

  return (
    <div className="space-y-4">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Current Price"
          value={fmtPrice(currentPrice, currency)}
          sub="Market price"
          tone="neutral"
        />
        <SummaryCard
          label="Base Fair Value"
          value={fmtPrice(baseFairValue, currency)}
          sub="Forward P/E method"
          tone={baseUpsidePct != null ? (baseUpsidePct >= 0.10 ? 'positive' : baseUpsidePct >= 0 ? undefined : 'negative') : undefined}
        />
        <SummaryCard
          label="Upside / Downside"
          value={fmtPctSigned(baseUpsidePct)}
          sub={baseFairValue != null ? `vs $${fmtPrice(baseFairValue, currency).replace(/[^0-9.]/g, '')}` : ''}
          tone={baseUpsidePct != null ? (baseUpsidePct >= 0 ? 'positive' : 'negative') : undefined}
        />
        <SummaryCard
          label="Expected Return"
          value={baseExpectedRet != null ? fmtPctSigned(baseExpectedRet) + '/yr' : '—'}
          sub="5-year annualized"
          tone={baseExpectedRet != null ? (baseExpectedRet >= 0.08 ? 'positive' : baseExpectedRet >= 0 ? undefined : 'negative') : undefined}
        />
      </div>

      {/* ── Method cards ── */}
      <div>
        <div className="text-[11px] font-bold text-[#444] uppercase tracking-widest mb-3 px-0.5">
          Valuation Methods
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {allMethods.map(id => (
            <ValuationMethodCard
              key={id}
              config={configMap[id]}
              isActive={activeMethod === id}
              onOpen={() => handleMethodOpen(id)}
            />
          ))}
        </div>
      </div>

      {/* ── Full DCF modelling table ── */}
      <div ref={dcfRef} className="pt-2">
        <div className="text-[11px] font-bold text-[#444] uppercase tracking-widest mb-3 px-0.5">
          Full DCF Modelling Table
        </div>
        <div className="bg-[#111111] rounded-xl overflow-hidden border border-[#222]">
          <DataQualityWarnings
            terminalGError={null}
            financialCurrencyNote={apiData?.financialCurrencyNote ?? null}
            isFinancialSector={apiData?.valuationMethods?.companyType === 'financial'}
            isNegativeFCF={apiData?.baseFCF != null && apiData.baseFCF < 0}
            altmanZone={apiData?.scores?.altman?.zone ?? null}
            beneishFlag={apiData?.scores?.beneish?.flag ?? null}
          />
          <ModellingWorkspace apiData={apiData} ticker={ticker} />
        </div>
      </div>

      {/* ── Drawer ── */}
      {activeConfig && (
        <ValuationModelDrawer
          config={activeConfig}
          onClose={() => setActiveMethod(null)}
          overrides={activeMethod ? (overrides[activeMethod] ?? {}) : {}}
          onAssumptionChange={(key, value) => activeMethod && handleAssumptionChange(activeMethod, key, value)}
          onResetOverrides={() => activeMethod && handleResetOverrides(activeMethod)}
        />
      )}
    </div>
  )
}
