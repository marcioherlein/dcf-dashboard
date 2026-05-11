'use client'

import { useState, useMemo, useRef } from 'react'
import ValuationMethodCard from './ValuationMethodCard'
import ValuationModelDrawer, {
  type ValuationMethodId,
  type ValuationMethodConfig,
  type ValuationResult,
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
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

// ─── Local helpers (formula builders need $-prefixed strings) ────────────────

function fmtB(v: number | null): string {
  return fmtLargeCurrency(v)
}

function fmtPctSigned(v: number | null): string {
  return fmtPct(v)
}

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

// ─── Results builders ─────────────────────────────────────────────────────────

function upsideTone(v: number | null): ValuationResult['tone'] {
  if (v == null) return 'neutral'
  if (v >= 0.10) return 'positive'
  if (v >= 0)    return 'neutral'
  return 'negative'
}

function buildForwardPEResults(result: ReturnType<typeof computeForwardPE>, currentPrice: number, currency = 'USD'): ValuationResult[] {
  const N = 5; const targetYear = new Date().getFullYear() + N
  return [
    { label: 'Actual Price',          value: currentPrice,             formattedValue: fmtPrice(currentPrice, currency),                tone: 'neutral' },
    { label: `${targetYear} Target`,  value: result.futureTargetPrice, formattedValue: fmtPrice(result.futureTargetPrice, currency),    tone: 'neutral' },
    { label: 'Fair Value Today',      value: result.fairValueToday,    formattedValue: fmtPrice(result.fairValueToday, currency),       tone: upsideTone(result.upsidePct) },
    { label: '1Y Price Target',       value: result.target1Y,          formattedValue: fmtPrice(result.target1Y, currency),            tone: 'neutral' },
    { label: 'Potential Upside',      value: result.upsidePct,         formattedValue: fmtPctSigned(result.upsidePct),                 tone: upsideTone(result.upsidePct) },
    { label: 'Expected Return',       value: result.expectedReturnPct, formattedValue: result.expectedReturnPct != null ? fmtPctSigned(result.expectedReturnPct) + '/yr' : '—', tone: upsideTone(result.expectedReturnPct) },
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
    result.interpretation === 'conservative' ? 'positive' :
    result.interpretation === 'reasonable'   ? 'positive' :
    result.interpretation === 'aggressive'   ? 'warning'  :
    result.interpretation === 'very_aggressive' ? 'negative' : 'neutral'
  return [
    { label: 'Implied 5Y CAGR', value: result.impliedCAGR,       formattedValue: implCAGRFmt, tone: interpTone },
    { label: 'FCF Margin Used', value: result.impliedFCFMargin,  formattedValue: result.impliedFCFMargin != null ? (result.impliedFCFMargin * 100).toFixed(1) + '%' : '—', tone: 'neutral' },
    { label: 'Assessment',      value: null,                     formattedValue: result.interpretation.replace('_', ' '), tone: interpTone },
  ]
}

function buildEVEBITDAResults(result: ReturnType<typeof computeEVEBITDA>, currentPrice: number, currency = 'USD'): ValuationResult[] {
  return [
    { label: 'Enterprise Value',   value: result.enterpriseValue,   formattedValue: fmtB(result.enterpriseValue),              tone: 'neutral' },
    { label: 'Equity Value',       value: result.equityValue,       formattedValue: fmtB(result.equityValue),                  tone: 'neutral' },
    { label: 'Fair Value / Share', value: result.fairValuePerShare, formattedValue: fmtPrice(result.fairValuePerShare, currency), tone: upsideTone(result.upsidePct) },
    { label: 'Actual Price',       value: currentPrice,             formattedValue: fmtPrice(currentPrice, currency),          tone: 'neutral' },
    { label: 'Potential Upside',   value: result.upsidePct,         formattedValue: fmtPctSigned(result.upsidePct),            tone: upsideTone(result.upsidePct) },
  ]
}

// ─── Stat Card (light design) ─────────────────────────────────────────────────

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

// ─── Assumption summary item ──────────────────────────────────────────────────

function AssumptionStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
      <div className="text-label uppercase tracking-wider text-blue-400 mb-0.5">{label}</div>
      <div className="text-base font-bold font-mono text-blue-900">{value}</div>
      <div className="text-micro text-blue-500">{sub}</div>
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
  const [activeMethod,      setActiveMethod]      = useState<ValuationMethodId | null>(null)
  const [overrides,         setOverrides]         = useState<OverridesMap>({})
  const [currentStep,       setCurrentStep]       = useState<1 | 2 | 3>(1)
  const [evEbitdaDrawerOpen,setEvEbitdaDrawerOpen]= useState(false)
  const dcfRef = useRef<HTMLDivElement>(null)

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

  const ebitdaMargin = ttmRevenue && ttmRevenue > 0 && ttmEbitda    != null ? ttmEbitda    / ttmRevenue : null
  const fcfMarginPct = ttmRevenue && ttmRevenue > 0 && ttmFCF       != null ? ttmFCF       / ttmRevenue : null
  const netMarginPct = ttmRevenue && ttmRevenue > 0 && ttmNetIncome != null ? ttmNetIncome / ttmRevenue : null

  // ── Derived assumptions ──────────────────────────────────────────────────
  const fwdPEBase   = useMemo(() => deriveForwardPEAssumptions(apiData), [apiData])
  const revMultBase = useMemo(() => deriveRevenueMultipleAssumptions(apiData), [apiData])

  const evEbitdaBase = useMemo(() => {
    const ebitda   = ttmEbitda ?? (apiData?.financialStatements?.incomeStatement?.find((r: { isProjected?: boolean; ebitda?: number }) => !r.isProjected)?.ebitda ?? null)
    const shares   = ttmShares ?? apiData?.fairValue?.sharesOutstanding ?? null
    const cashFMP  = apiData?.fairValue?.cash != null ? apiData.fairValue.cash * 1e6 : null
    const debtFMP  = apiData?.fairValue?.debt != null ? apiData.fairValue.debt * 1e6 : null
    const netDebt  = ttmNetDebt ?? (debtFMP != null && cashFMP != null ? debtFMP - cashFMP : null)
    const sector   = apiData?.quote?.sector ?? null
    const multiple = getDefaultEVEBITDAMultiple(sector)
    return { ebitda, netDebt, shares, exitMultiple: multiple, sector }
  }, [apiData, ttmEbitda, ttmNetDebt, ttmShares])

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
  const fwdPEResult  = useMemo(() => computeForwardPE(fwdPEInputs), [fwdPEInputs])
  const fwdPEConfig  = useMemo((): ValuationMethodConfig => ({
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
        { key: 'ttmEbitda',    label: 'TTM EBITDA',          editable: false, value: evEbitdaInputs.ttmEbitda, unit: '$', source: 'historical_3y_median' as const },
        { key: 'netDebt',      label: 'Net Debt',            editable: false, value: evEbitdaInputs.netDebt,   unit: '$', source: 'historical_3y_median' as const },
        { key: 'exitMultiple', label: 'EV/EBITDA Multiple',  editable: true,  value: multiple, unit: 'x', min: 1, max: 50, step: 0.5, source: 'sector_fallback' as const, sourceExplanation: `${sect} sector typical ${multiple.toFixed(0)}×`, description: 'Sector-typical exit multiple' },
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
    return actuals.length > 0 ? actuals[actuals.length - 1].revenue! : null
  }, [incomeRows, ttmRevenue])

  const lastFCFMargin = useMemo(() => {
    const rev = ttmRevenue ?? (incomeRows.filter(r => !r.isProjected && r.revenue != null).slice(-1)[0]?.revenue ?? null)
    const fcf = ttmFCF    ?? (cashFlowRows.filter(r => !r.isProjected && r.freeCashFlow != null).slice(-1)[0]?.freeCashFlow ?? null)
    return rev != null && rev > 0 && fcf != null ? fcf / rev : null
  }, [cashFlowRows, incomeRows, ttmRevenue, ttmFCF])

  const reverseDCFResult = useMemo(() => computeReverseDCF({
    currentPrice,
    sharesOutstanding: ttmShares ?? apiData?.fairValue?.sharesOutstanding ?? null,
    cashM:    apiData?.fairValue?.cash ?? null,
    debtM:    apiData?.fairValue?.debt ?? null,
    lastRevenue: lastActualRevenue,
    lastFCFMargin,
    wacc:     apiData?.wacc?.wacc   ?? 0.09,
    terminalG:apiData?.terminalG    ?? 0.025,
    historicalCAGR: apiData?.cagrAnalysis?.historicalCagr3y ?? null,
  }), [currentPrice, apiData, lastActualRevenue, lastFCFMargin, ttmShares])

  const reverseDCFConfig = useMemo((): ValuationMethodConfig => {
    const implCAGRPct = reverseDCFResult.impliedCAGR != null ? (reverseDCFResult.impliedCAGR * 100).toFixed(1) + '%' : '—'
    return {
      id: 'reverse_dcf', title: 'Reverse DCF', subtitle: 'What the market is pricing in',
      companyName: apiData?.companyName ?? ticker, ticker, currency,
      evidence: [
        { label: 'Implied EV', text: reverseDCFResult.impliedEV != null ? fmtB(reverseDCFResult.impliedEV) + ' (price × shares + debt − cash)' : 'Cannot compute — missing inputs' },
        { label: 'FCF Margin', text: lastFCFMargin != null ? (lastFCFMargin * 100).toFixed(1) + '% (TTM FCF / revenue)' : 'Not available' },
        { label: 'WACC',       text: ((apiData?.wacc?.wacc ?? 0.09) * 100).toFixed(1) + '%' },
        { label: 'Terminal G', text: ((apiData?.terminalG  ?? 0.025) * 100).toFixed(1) + '%' },
      ],
      assumptions: [
        { key: 'currentPrice',  label: 'Current Price',   value: currentPrice,        unit: '$', editable: false, source: 'model_default' as const },
        { key: 'lastRevenue',   label: 'LTM Revenue',     value: lastActualRevenue,   unit: '$', editable: false, source: 'historical_3y_median' as const },
        { key: 'lastFCFMargin', label: 'FCF Margin',      value: lastFCFMargin,       unit: '%', editable: false, source: 'historical_3y_median' as const },
        { key: 'wacc',          label: 'WACC',            value: apiData?.wacc?.wacc  ?? 0.09, unit: '%', editable: false, source: 'model_default' as const },
        { key: 'terminalG',     label: 'Terminal Growth', value: apiData?.terminalG   ?? 0.025, unit: '%', editable: false, source: 'model_default' as const },
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

  const dcfConfig = useMemo((): ValuationMethodConfig => ({
    id: 'dcf', title: 'Full DCF Model', subtitle: 'Year-by-year FCF model — see table below',
    companyName: apiData?.companyName ?? ticker, ticker, currency,
    evidence: [], assumptions: [],
    formulaLines: ['See the full modelling table below.'],
    results: [], warnings: [],
    fairValueSummary: null, currentPrice,
  }), [ticker, currency, currentPrice, apiData])

  const configMap = useMemo(() => ({
    forward_pe:       fwdPEConfig,
    revenue_multiple: revMultConfig,
    dcf:              dcfConfig,
    reverse_dcf:      reverseDCFConfig,
    scenario_blend:   scenarioConfig,
  } as Record<ValuationMethodId, ValuationMethodConfig>), [fwdPEConfig, revMultConfig, dcfConfig, reverseDCFConfig, scenarioConfig])

  const activeConfig = activeMethod ? configMap[activeMethod] : null
  const allMethods: ValuationMethodId[] = ['forward_pe', 'revenue_multiple', 'dcf', 'reverse_dcf', 'scenario_blend']

  function handleAssumptionChange(methodId: ValuationMethodId | 'ev_ebitda', key: string, value: number) {
    setOverrides(prev => ({ ...prev, [methodId]: { ...(prev[methodId] ?? {}), [key]: value } }))
  }
  function handleResetOverrides(methodId: ValuationMethodId | 'ev_ebitda') {
    setOverrides(prev => { const n = { ...prev }; delete n[methodId]; return n })
  }
  function handleMethodOpen(id: ValuationMethodId) {
    if (id === 'dcf') { dcfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    setActiveMethod(id)
  }

  const summaryMethods: MethodResult[] = [
    { id: 'forward_pe',       label: 'Forward P/E (5Y)',   fairValue: fwdPEResult.fairValueToday,          bullFairValue: scenarioResult.scenarios.find(s => s.label === 'bull')?.fairValue ?? null, bearFairValue: scenarioResult.scenarios.find(s => s.label === 'bear')?.fairValue ?? null, upsidePct: fwdPEResult.upsidePct,           weight: 0.30 },
    { id: 'ev_ebitda',        label: 'EV/EBITDA',          fairValue: evEbitdaResult.fairValuePerShare,    upsidePct: evEbitdaResult.upsidePct,       weight: 0.25 },
    { id: 'revenue_multiple', label: 'Revenue Multiple',   fairValue: revMultResult.fairValueToday,        upsidePct: revMultResult.upsidePct,        weight: 0.20 },
    { id: 'scenario_blend',   label: 'Scenario Blend',     fairValue: scenarioResult.weightedFairValue,    upsidePct: scenarioResult.weightedUpsidePct, weight: 0.15 },
    { id: 'reverse_dcf',      label: 'Reverse DCF',        fairValue: null,                                upsidePct: null,                           weight: 0.10 },
  ]

  return (
    <div className="space-y-4">

      {/* ── Wizard progress ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-card">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <WizardSteps steps={WIZARD_STEPS} current={currentStep} />
          <p className="text-micro text-slate-400 hidden sm:block">
            {currentStep === 1 ? 'Review the data foundation before running models' :
             currentStep === 2 ? 'Adjust % assumptions, open any method to edit' :
             'Weighted consensus across all methods'}
          </p>
        </div>
      </div>

      {/* ── Step 1: Base Data ─────────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          {statementsAvailable ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <p className="text-label uppercase tracking-wider text-slate-400">Trailing 12 Months</p>
                <SourceLabel source="yahoo">Yahoo Finance Statements</SourceLabel>
              </div>
              <div className="flex flex-wrap gap-3 mb-3">
                <StatCard label="Revenue"        value={fmtLarge(ttmRevenue)}   source="yahoo" />
                <StatCard label="EBITDA"         value={fmtLarge(ttmEbitda)}    sub={ebitdaMargin  != null ? `${(ebitdaMargin  * 100).toFixed(1)}% margin` : undefined} source="yahoo" />
                <StatCard label="Free Cash Flow" value={fmtLarge(ttmFCF)}       sub={fcfMarginPct  != null ? `${(fcfMarginPct  * 100).toFixed(1)}% FCF margin` : undefined} source="yahoo" />
                <StatCard label="Net Income"     value={fmtLarge(ttmNetIncome)} sub={netMarginPct  != null ? `${(netMarginPct  * 100).toFixed(1)}% net margin` : undefined} source="yahoo" />
              </div>
              <div className="flex flex-wrap gap-3">
                <StatCard label="Total Debt"    value={fmtLarge(ttmTotalDebt)} source="yahoo" />
                <StatCard label="Cash & Equiv." value={fmtLarge(ttmCash)}      source="yahoo" />
                <StatCard label="Net Debt"      value={ttmNetDebt != null ? fmtLarge(ttmNetDebt) : '—'} sub={ttmNetDebt != null && ttmNetDebt < 0 ? 'Net cash position' : undefined} source="calc" />
              </div>
            </div>
          ) : (
            <Alert>
              <AlertDescription>
                Statements data is loading. Key TTM metrics will appear once the data is available.
              </AlertDescription>
            </Alert>
          )}

          {/* % assumption summary */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-label uppercase tracking-wider text-slate-400">Model Assumptions (% inputs)</p>
              <SourceLabel source="calc">Derived from data</SourceLabel>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <AssumptionStat label="Revenue CAGR" value={`${(fwdPEBase.revenueCAGR  * 100).toFixed(1)}%`} sub="annual growth" />
              <AssumptionStat label="Net Margin"   value={`${(fwdPEBase.netMargin    * 100).toFixed(1)}%`} sub="exit year" />
              <AssumptionStat label="WACC"         value={`${(fwdPEBase.discountRate * 100).toFixed(1)}%`} sub="discount rate" />
              <AssumptionStat label="Exit P/E"     value={`${fwdPEBase.exitPE.toFixed(0)}×`}              sub="sector-normalized" />
            </div>
            <p className="text-micro text-slate-400 mt-3">
              Open any method card to edit these assumptions. All inputs are percentages or multiples — no absolute dollar editing.
            </p>
          </div>

          <Button className="w-full" onClick={() => setCurrentStep(2)}>
            Review Valuation Methods →
          </Button>
        </div>
      )}

      {/* ── Step 2: Methods ──────────────────────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
            <p className="text-label uppercase tracking-wider text-slate-400 mb-3">
              Valuation Methods — click any card to edit % assumptions
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {allMethods.map(id => (
                <ValuationMethodCard
                  key={id}
                  config={configMap[id]}
                  isActive={activeMethod === id}
                  onOpen={() => handleMethodOpen(id)}
                />
              ))}
              <ValuationMethodCard
                config={evEbitdaConfig}
                isActive={evEbitdaDrawerOpen}
                onOpen={() => setEvEbitdaDrawerOpen(true)}
              />
            </div>
          </div>

          {/* DCF Modelling Table */}
          <div ref={dcfRef}>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-label uppercase tracking-wider text-slate-400">Full DCF Modelling Table</p>
              </div>
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

      {/* ── Step 3: Summary ──────────────────────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-card">
            <p className={cn('text-label uppercase tracking-wider', 'text-slate-500')}>
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

      {/* ── Drawers ─────────────────────────────────────────────────────────── */}
      {activeConfig && (
        <ValuationModelDrawer
          config={activeConfig}
          onClose={() => setActiveMethod(null)}
          overrides={activeMethod ? (overrides[activeMethod] ?? {}) : {}}
          onAssumptionChange={(key, value) => activeMethod && handleAssumptionChange(activeMethod, key, value)}
          onResetOverrides={() => activeMethod && handleResetOverrides(activeMethod)}
        />
      )}
      {evEbitdaDrawerOpen && (
        <ValuationModelDrawer
          config={evEbitdaConfig}
          onClose={() => setEvEbitdaDrawerOpen(false)}
          overrides={overrides['ev_ebitda'] ?? {}}
          onAssumptionChange={(key, value) => handleAssumptionChange('ev_ebitda', key, value)}
          onResetOverrides={() => handleResetOverrides('ev_ebitda')}
        />
      )}
    </div>
  )
}
