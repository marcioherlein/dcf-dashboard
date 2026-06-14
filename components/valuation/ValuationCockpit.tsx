'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import {
  computeCockpitOutput,
  computeBlendedFV,
  type ValuationAssumptions,
} from '@/lib/valuation/cockpit'
import { buildSnapshot, seedAssumptions } from '@/lib/valuation/cockpitBuilders'
import { buildValueInvestingData, computeStarRating, computeUncertainty } from '@/lib/valuation/valueInvestingAnalysis'
import { getIndustryMultiples } from '@/lib/dcf/calculateMultiples'
import GuidanceStrip from './cockpit/GuidanceStrip'
import BusinessChecks from './cockpit/BusinessChecks'
import ValueInvestingPanel from './cockpit/ValueInvestingPanel'
import FairValueChart from './cockpit/FairValueChart'
import { type SparkPoint } from './cockpit/AssumptionsPanel'
import ValuationMethodCards from './cockpit/ValuationMethodCards'
import ModelDivergencePanel from './cockpit/ModelDivergencePanel'
import MonteCarloPanel from './cockpit/MonteCarloPanel'
import VerdictHero from './cockpit/VerdictHero'
import SensitivityMatrix from './SensitivityMatrix'
import ProGate from '@/components/monetization/ProGate'
import SaveToWatchlistDialog from '@/components/watchlist/SaveToWatchlistDialog'
import type { WatchlistSavePayload } from '@/components/watchlist/SaveToWatchlistDialog'
import { fmtPrice } from '@/lib/formatters'
import AssumptionHealthPanel from './cockpit/AssumptionHealthPanel'
import type { AssumptionAudit } from '@/lib/valuation/assumptionAuditor'

const ModellingWorkspace = dynamic(
  () => import('@/components/modelling/ModellingWorkspace'),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-[#F5F5F5]" /> }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiData = Record<string, any>

interface Props {
  apiData: ApiData
  ticker: string
  statementsData?: ApiData | null
  limitedHistory?: boolean
  historyYears?: number
  onNavigateToFinancials?: (rowKey: string, statement: 'income' | 'balance' | 'cashflow') => void
  onNavigateToConviction?: () => void
  onLiveDcfFVChange?: (fv: number | null) => void
}

// Re-export so callers that import from this file continue to work
export { buildSnapshot, seedAssumptions } from '@/lib/valuation/cockpitBuilders'

type HistoricalData = Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>

function quarterLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const m = d.getUTCMonth() // 0-indexed
  const yr = String(d.getUTCFullYear()).slice(2)
  const q = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4'
  return `${q} '${yr}`
}

function buildHistoricalData(apiData: ApiData): HistoricalData {
  const incomeRows: Array<{
    year: string; isProjected: boolean
    revenue: number | null; netIncome: number | null; ebitda: number | null
  }> = apiData.financialStatements?.incomeStatement ?? []
  const actuals = incomeRows.filter(r => !r.isProjected).slice(-6)

  const cagrPoints: SparkPoint[] = []
  for (let i = 1; i < actuals.length; i++) {
    const prev = actuals[i - 1].revenue
    const curr = actuals[i].revenue
    if (prev && prev > 0 && curr != null) {
      cagrPoints.push({ label: String(actuals[i].year), value: (curr - prev) / prev })
    }
  }

  // Net margin: prefer quarterly rolling data for more data points
  const ratiosQ: Array<{ date: string; priceEarningsRatio: number | null; enterpriseValueMultiple: number | null; evToSales: number | null; priceToBookRatio: number | null }> =
    (apiData.ratiosQuarterly ?? []).slice().reverse() // reverse to oldest-first for chart

  const isQ: Array<{ date: string; revenue: number; netIncome: number }> =
    (apiData.incomeStatementQuarterly ?? []).slice().reverse() // oldest-first

  const netMarginPoints: SparkPoint[] = isQ.length >= 4
    ? isQ
        .filter(q => q.revenue > 0 && q.netIncome != null)
        .slice(-12)
        .map(q => ({ label: quarterLabel(q.date), value: q.netIncome / q.revenue }))
    : actuals
        .filter(r => r.revenue != null && r.revenue > 0 && r.netIncome != null)
        .map(r => ({ label: String(r.year), value: r.netIncome! / r.revenue! }))

  const clamp = (v: number | null | undefined, lo: number, hi: number): number | null => {
    if (v == null || !isFinite(v) || v <= 0) return null
    return v < lo || v > hi ? null : v
  }

  // Build quarterly series for P/E, EV/EBITDA, EV/Revenue, P/B
  const peSeries: SparkPoint[] = ratiosQ
    .map(r => ({ label: quarterLabel(r.date), v: clamp(r.priceEarningsRatio, 1, 500) }))
    .filter((p): p is { label: string; v: number } => p.v != null)
    .slice(-12)
    .map(p => ({ label: p.label, value: p.v }))

  const ebitdaSeries: SparkPoint[] = ratiosQ
    .map(r => ({ label: quarterLabel(r.date), v: clamp(r.enterpriseValueMultiple, 1, 80) }))
    .filter((p): p is { label: string; v: number } => p.v != null)
    .slice(-12)
    .map(p => ({ label: p.label, value: p.v }))

  const revSeries: SparkPoint[] = ratiosQ
    .map(r => ({ label: quarterLabel(r.date), v: clamp(r.evToSales, 0.1, 50) }))
    .filter((p): p is { label: string; v: number } => p.v != null)
    .slice(-12)
    .map(p => ({ label: p.label, value: p.v }))

  const pbSeries: SparkPoint[] = ratiosQ
    .map(r => ({ label: quarterLabel(r.date), v: clamp(r.priceToBookRatio, 0.1, 20) }))
    .filter((p): p is { label: string; v: number } => p.v != null)
    .slice(-12)
    .map(p => ({ label: p.label, value: p.v }))

  // Fall back to annual data if quarterly is empty
  const histMult: Array<{ fiscalYear: string; pe: number | null; evEbitda: number | null; evRevenue: number | null }> =
    apiData.historicalMultiples ?? []

  const peFinal = peSeries.length >= 2 ? peSeries : histMult.filter(h => h.pe != null).slice(-5).map(h => ({ label: String(h.fiscalYear), value: h.pe! }))
  const ebitdaFinal = ebitdaSeries.length >= 2 ? ebitdaSeries : histMult.filter(h => h.evEbitda != null).slice(-5).map(h => ({ label: String(h.fiscalYear), value: h.evEbitda! }))
  const revFinal = revSeries.length >= 2 ? revSeries : histMult.filter(h => h.evRevenue != null).slice(-5).map(h => ({ label: String(h.fiscalYear), value: h.evRevenue! }))

  // Append current TTM value as 'curr' point
  const peCurrent       = apiData.quote?.peRatio ?? null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const multEst: Array<{ multiple: string; actualValue: number }> =
    apiData.valuationMethods?.models?.multiples?.estimates ?? []
  const evEbitdaCurrent = multEst.find(e => e.multiple === 'EV/EBITDA')?.actualValue ?? null
  const evRevCurrent    = multEst.find(e => e.multiple === 'EV/Revenue')?.actualValue ?? null
  const pbCurrent       = multEst.find(e => e.multiple === 'P/Book')?.actualValue ?? null

  if (peCurrent != null && peCurrent > 0 && peCurrent < 1000) peFinal.push({ label: 'curr', value: peCurrent })
  if (evEbitdaCurrent != null && evEbitdaCurrent > 0) ebitdaFinal.push({ label: 'curr', value: evEbitdaCurrent })
  if (evRevCurrent != null && evRevCurrent > 0) revFinal.push({ label: 'curr', value: evRevCurrent })
  if (pbCurrent != null && pbCurrent > 0) pbSeries.push({ label: 'curr', value: pbCurrent })

  // FCF margin series — built from FMP keyMetricsQuarterly (freeCashFlowToFirm / revenue)
  // or from annual cash flow statements as fallback
  const kmQ: Array<{ date: string; freeCashFlowToFirm: number | null }> =
    (apiData.keyMetricsQuarterly ?? []).slice().reverse() // oldest-first
  const fcfMarginPoints: SparkPoint[] = (() => {
    // Try quarterly: join keyMetricsQuarterly FCFF with quarterly income revenue
    if (kmQ.length >= 3 && isQ.length >= 3) {
      const points: SparkPoint[] = []
      for (const km of kmQ.slice(-12)) {
        if (km.freeCashFlowToFirm == null) continue
        // Find matching quarter by date prefix (YYYY-MM)
        const match = isQ.find(q => q.date?.slice(0, 7) === km.date?.slice(0, 7))
        if (!match || !match.revenue || match.revenue <= 0) continue
        const margin = km.freeCashFlowToFirm / 1e6 / match.revenue
        if (!isFinite(margin) || margin < -1 || margin > 1) continue
        points.push({ label: quarterLabel(km.date), value: margin })
      }
      if (points.length >= 3) return points
    }
    // Fallback: annual cash flow statements from financialStatements
    const cfRows: Array<{ isProjected?: boolean; year: string; freeCashFlow: number | null; revenue?: number | null }> =
      apiData.financialStatements?.cashFlow ?? []
    const isRows: Array<{ isProjected?: boolean; year: string; revenue: number | null }> =
      apiData.financialStatements?.incomeStatement ?? []
    const annualPoints: SparkPoint[] = cfRows
      .filter(r => !r.isProjected && r.freeCashFlow != null)
      .slice(-6)
      .map(r => {
        const rev = r.revenue ?? isRows.find(is => !is.isProjected && is.year === r.year)?.revenue
        if (!rev || rev <= 0 || r.freeCashFlow == null) return null
        const margin = r.freeCashFlow / rev
        if (!isFinite(margin) || margin < -1 || margin > 1) return null
        return { label: String(r.year), value: margin }
      })
      .filter((p): p is SparkPoint => p != null)
    return annualPoints
  })()
  // Append TTM FCF margin as 'curr'
  const fcfMarginTTM = apiData.businessProfile?.fcfMargin ?? null
  if (fcfMarginTTM != null && isFinite(fcfMarginTTM) && Math.abs(fcfMarginTTM) <= 1) {
    fcfMarginPoints.push({ label: 'curr', value: fcfMarginTTM })
  }

  return {
    cagr:               cagrPoints.length >= 2 ? cagrPoints.slice(-5) : undefined,
    netMargin:          netMarginPoints.length >= 2 ? netMarginPoints : undefined,
    exitPE:             peFinal.length >= 1 ? peFinal : undefined,
    exitMultiple:       ebitdaFinal.length >= 1 ? ebitdaFinal : undefined,
    revenueMultiple:    revFinal.length >= 1 ? revFinal : undefined,
    priceToBookMultiple: pbSeries.length >= 1 ? pbSeries : undefined,
  }
}

// Build FCF margin SparkPoint[] separately (not part of ValuationAssumptions key space)
function buildFcfMarginSeries(apiData: ApiData): SparkPoint[] {
  // Financial/fintech companies: freeCashFlowToFirm is contaminated by
  // deposit flows, loan portfolio changes, and financing activities.
  // Return empty so the chart doesn't mislead.
  const companyType: string = apiData.valuationMethods?.companyType ?? 'standard'
  const FINANCIAL_TYPES = new Set(['financial', 'fintech', 'bdc', 'mreeit', 'alt_asset'])
  const sector: string = apiData.quote?.sector ?? ''
  if (FINANCIAL_TYPES.has(companyType) || /financ|bank|insur/i.test(sector)) {
    return []
  }

  const isQ: Array<{ date: string; revenue: number }> =
    (apiData.incomeStatementQuarterly ?? []).slice().reverse()
  const kmQ: Array<{ date: string; freeCashFlowToFirm: number | null }> =
    (apiData.keyMetricsQuarterly ?? []).slice().reverse()

  if (kmQ.length >= 3 && isQ.length >= 3) {
    const points: SparkPoint[] = []
    for (const km of kmQ.slice(-12)) {
      if (km.freeCashFlowToFirm == null) continue
      const match = isQ.find(q => q.date?.slice(0, 7) === km.date?.slice(0, 7))
      if (!match || !match.revenue || match.revenue <= 0) continue
      const margin = km.freeCashFlowToFirm / 1e6 / match.revenue
      if (!isFinite(margin) || margin < -1 || margin > 1) continue
      points.push({ label: quarterLabel(km.date), value: margin })
    }
    if (points.length >= 3) {
      const fcfMarginTTM = apiData.businessProfile?.fcfMargin ?? null
      if (fcfMarginTTM != null && isFinite(fcfMarginTTM) && Math.abs(fcfMarginTTM) <= 1) {
        points.push({ label: 'curr', value: fcfMarginTTM })
      }
      return points
    }
  }
  // Annual fallback
  const cfRows: Array<{ isProjected?: boolean; year: string; freeCashFlow: number | null; revenue?: number | null }> =
    apiData.financialStatements?.cashFlow ?? []
  const isRows: Array<{ isProjected?: boolean; year: string; revenue: number | null }> =
    apiData.financialStatements?.incomeStatement ?? []
  const annualPoints: SparkPoint[] = cfRows
    .filter(r => !r.isProjected && r.freeCashFlow != null)
    .slice(-6)
    .map(r => {
      const rev = r.revenue ?? isRows.find(is => !is.isProjected && is.year === r.year)?.revenue
      if (!rev || rev <= 0 || r.freeCashFlow == null) return null
      const margin = r.freeCashFlow / rev
      if (!isFinite(margin) || margin < -1 || margin > 1) return null
      return { label: String(r.year), value: margin }
    })
    .filter((p): p is SparkPoint => p != null)
  const fcfMarginTTM = apiData.businessProfile?.fcfMargin ?? null
  if (fcfMarginTTM != null && isFinite(fcfMarginTTM) && Math.abs(fcfMarginTTM) <= 1) {
    annualPoints.push({ label: 'curr', value: fcfMarginTTM })
  }
  return annualPoints
}

export default function ValuationCockpit({ apiData, ticker, statementsData, limitedHistory, historyYears, onNavigateToFinancials: _onNavigateToFinancials, onNavigateToConviction: _onNavigateToConviction, onLiveDcfFVChange }: Props) {
  const { data: session } = useSession()
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    if (!session?.user?.email) return
    fetch('/api/user/plan')
      .then(r => r.json())
      .then(d => setIsPro(d?.plan === 'pro'))
      .catch(() => {})
  }, [session?.user?.email])

  const snapshot        = useMemo(() => buildSnapshot(apiData, statementsData), [apiData, statementsData])
  const defaults        = useMemo(() => seedAssumptions(apiData), [apiData])
  const historicalData  = useMemo(() => buildHistoricalData(apiData), [apiData])
  const fcfMarginSeries = useMemo(() => buildFcfMarginSeries(apiData), [apiData])

  const [assumptions, setAssumptions] = useState<ValuationAssumptions>(() => seedAssumptions(apiData))
  const [history, setHistory] = useState<ValuationAssumptions[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [liveDcfFV, setLiveDcfFV] = useState<number | null>(null)
  const [_lastChange, setLastChange] = useState<{
    label: string; delta: number; unit: '%' | 'x'; fvImpact: number | null
  } | null>(null)
  const [clampNote, setClampNote] = useState<string | null>(null)

  // When ModellingWorkspace computes its derivedFV, override snapshot.fullDcfFairValue so
  // the Core DCF card always matches the Full DCF Table's 4-model blended result exactly.
  // Also bubble the value up via onLiveDcfFVChange so the Overview tab stays in sync.
  const effectiveSnapshot = useMemo(
    () => liveDcfFV != null ? { ...snapshot, fullDcfFairValue: liveDcfFV } : snapshot,
    [snapshot, liveDcfFV]
  )
  useEffect(() => { onLiveDcfFVChange?.(liveDcfFV) }, [liveDcfFV, onLiveDcfFVChange])

  const output = useMemo(
    () => computeCockpitOutput(assumptions, effectiveSnapshot),
    [assumptions, effectiveSnapshot]
  )


  // Sensitivity: % change in blended FV per 1pp (% fields) or 1× (multiple fields)
  const sensitivity = useMemo<Partial<Record<keyof ValuationAssumptions, number>>>(() => {
    const base = output.blendedFairValue
    if (base == null || base <= 0) return {}
    const deltas: Array<[keyof ValuationAssumptions, number]> = [
      ['wacc', 0.01], ['cagr', 0.01], ['netMargin', 0.01],
      ['exitPE', 1],  ['exitMultiple', 1], ['revenueMultiple', 1],
    ]
    const result: Partial<Record<keyof ValuationAssumptions, number>> = {}
    for (const [key, delta] of deltas) {
      const val = assumptions[key] as number
      const fvP = computeBlendedFV({ ...assumptions, [key]: val + delta }, snapshot)
      const fvM = computeBlendedFV({ ...assumptions, [key]: val - delta }, snapshot)
      if (fvP != null && fvM != null) result[key] = (fvP - fvM) / (2 * base)
    }
    return result
  }, [assumptions, snapshot, output.blendedFairValue])

  // Auto-select top-2 sensitivity drivers for SensitivityMatrix default axes
  const [defaultAxisY, defaultAxisX] = useMemo(() => {
    const AXIS_KEYS = ['cagr', 'wacc', 'netMargin', 'exitPE', 'exitMultiple', 'revenueMultiple'] as const
    const ranked = AXIS_KEYS
      .map(k => ({ k, abs: Math.abs(sensitivity[k] ?? 0) }))
      .sort((a, b) => b.abs - a.abs)
    return [ranked[0]?.k ?? 'cagr', ranked[1]?.k ?? 'wacc'] as [keyof ValuationAssumptions, keyof ValuationAssumptions]
  }, [sensitivity])

  const currency     = apiData.quote?.currency ?? 'USD'
  const currentPrice = apiData.quote?.price ?? 0
  const changePct    = apiData.quote?.changePct ?? null
  const sector       = apiData.quote?.sector ?? null
  const industry     = apiData.quote?.industry ?? null

  const sectorBenchmarks = useMemo(() => {
    if (!industry && !sector) return null
    const m = getIndustryMultiples(industry ?? '', sector ?? '')
    return { exitPE: m.pe, exitMultiple: m.evEbitda, revenueMultiple: m.evRevenue }
  }, [industry, sector])

  // NTM EV/Revenue: current EV/Revenue discounted by 1 year of analyst growth
  // approximation: evRevCurrent / (1 + analystEstimate1y)
  const ntmEVRevenue = useMemo(() => {
    const multEst: Array<{ multiple: string; actualValue: number }> =
      apiData.valuationMethods?.models?.multiples?.estimates ?? []
    const evRevCurrent = multEst.find(e => e.multiple === 'EV/Revenue')?.actualValue ?? null
    const growthEst = apiData.cagrAnalysis?.analystEstimate1y ?? null
    if (evRevCurrent == null || evRevCurrent <= 0) return null
    if (growthEst == null || growthEst <= -0.5) return evRevCurrent // no estimate, show current
    return evRevCurrent / (1 + growthEst)
  }, [apiData])

  const valueInvestingData = useMemo(
    () => buildValueInvestingData(apiData, assumptions.wacc, assumptions.terminalG),
    [apiData, assumptions.wacc, assumptions.terminalG]
  )

  const starRating = useMemo(
    () => computeStarRating(currentPrice, output.blendedFairValue),
    [currentPrice, output.blendedFairValue]
  )

  const uncertainty = useMemo(() => {
    if (output.blendedFairValue == null || output.blendedFairValue <= 0) return null
    return computeUncertainty(
      output.methods.map(m => m.fairValue),
      output.blendedFairValue
    )
  }, [output.methods, output.blendedFairValue])

  const fcfYield = useMemo(() => {
    const marketCapRaw: number = apiData.quote?.marketCap ?? 0
    if (marketCapRaw <= 0 || snapshot.baseFCF == null) return null
    return (snapshot.baseFCF * 1e6) / marketCapRaw
  }, [apiData.quote?.marketCap, snapshot.baseFCF])

  const rfRate: number = apiData.wacc?.inputs?.rfRate ?? 0.045

  const savePayload: WatchlistSavePayload = useMemo(() => ({
    ticker,
    name: apiData.quote?.longName ?? apiData.quote?.shortName ?? ticker,
    assetType: 'stock',
    fairValue: output.blendedFairValue,
    upsidePct: output.upsidePct,
    valuationSnapshot: output.blendedFairValue != null ? {
      price_at_save: currentPrice,
      fair_value: output.blendedFairValue,
      wacc: assumptions.wacc,
      beta: apiData.quote?.beta ?? 1,
      terminal_g: assumptions.terminalG,
      cagr: assumptions.cagr,
      upside_pct: output.upsidePct ?? 0,
      inputs: {
        wacc: assumptions.wacc,
        cagr: assumptions.cagr,
        terminalG: assumptions.terminalG,
        netMargin: assumptions.netMargin,
        exitPE: assumptions.exitPE,
        exitMultiple: assumptions.exitMultiple,
        revenueMultiple: assumptions.revenueMultiple,
      },
      scenarios: {
        bull: output.scenarios.bull.fairValue ?? 0,
        base: output.scenarios.base.fairValue ?? 0,
        bear: output.scenarios.bear.fairValue ?? 0,
      },
      epv_fair_value: output.methods.find(m => m.id === 'epv')?.fairValue ?? null,
    } : null,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ticker, output, assumptions, currentPrice, apiData.quote])

  const fullDcfRef        = useRef<HTMLDetailsElement>(null)
  const assumptionsPanelRef = useRef<HTMLDivElement>(null)

  function handleAssumptionChange(next: ValuationAssumptions) {
    const clampedG = Math.min(next.terminalG, Math.max(0.005, next.wacc - 0.02))
    const clamped  = clampedG !== next.terminalG ? { ...next, terminalG: clampedG } : next

    if (clampedG !== next.terminalG) {
      setClampNote(`Terminal G clamped to WACC − 200bps (${(clampedG * 100).toFixed(1)}%)`)
    } else {
      setClampNote(null)
    }

    const PCT_KEYS: (keyof ValuationAssumptions)[] = ['wacc', 'cagr', 'netMargin', 'terminalG']
    const LABELS: Partial<Record<keyof ValuationAssumptions, string>> = {
      wacc: 'WACC', cagr: 'CAGR', netMargin: 'Net margin',
      terminalG: 'Terminal G', exitPE: 'Exit P/E',
      exitMultiple: 'EV/EBITDA', revenueMultiple: 'EV/Revenue',
    }
    for (const k of Object.keys(clamped) as (keyof ValuationAssumptions)[]) {
      const delta = (clamped[k] as number) - (assumptions[k] as number)
      if (Math.abs(delta) > 0.00001) {
        const sens = sensitivity[k]
        const fvImpact = sens != null && output.blendedFairValue != null
          ? sens * delta * output.blendedFairValue
          : null
        setLastChange({ label: LABELS[k] ?? String(k), delta, unit: PCT_KEYS.includes(k) ? '%' : 'x', fvImpact })
        break
      }
    }

    setHistory(h => [...h.slice(-9), assumptions])
    setAssumptions(clamped)
  }

  function handleUndo() {
    if (history.length === 0) return
    setAssumptions(history[history.length - 1])
    setHistory(h => h.slice(0, -1))
    setLastChange(null)
    setClampNote(null)
  }

  function handleReset() {
    setHistory([])
    setAssumptions(defaults)
    setLastChange(null)
    setClampNote(null)
  }

  function scrollToFullDCF() {
    fullDcfRef.current?.setAttribute('open', '')
    fullDcfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-3">
      <SaveToWatchlistDialog
        open={saveOpen}
        payload={savePayload}
        onClose={() => setSaveOpen(false)}
        onReviewAssumptions={() => {
          setSaveOpen(false)
          assumptionsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />

      {/* ── 1. VERDICT HERO — headline + confidence + scenario slider ─────────── */}
      <VerdictHero
        output={output}
        currentPrice={currentPrice}
        changePct={changePct}
        currency={currency}
        ticker={ticker}
        companyName={apiData.quote?.longName ?? apiData.quote?.shortName ?? ''}
        starRating={starRating}
      />

      {/* Limited history warning */}
      {limitedHistory && (
        <div className="flex items-start gap-2 bg-[#FFF4DA] border border-[#F3D391] rounded-xl px-4 py-3">
          <span className="text-[#B56A00] shrink-0 text-xs mt-0.5">⚠</span>
          <p className="text-[11px] text-[#854D0E] leading-relaxed">
            <span className="font-[700]">Limited history ({historyYears} year{historyYears !== 1 ? 's' : ''} of data).</span>{' '}
            Projections draw on pre-IPO S-1 financials and analyst consensus. Exit multiple models are more reliable than growth-stage DCF here — treat them as primary.
          </p>
        </div>
      )}

      {/* ── 2. COLLAPSIBLE GUIDANCE ──────────────────────────────────────────── */}
      <GuidanceStrip />

      {/* ── 3. VALUATION MODELS — inline assumption editing ──────────────────── */}
      <div ref={assumptionsPanelRef} id="assumptions-panel">
        {clampNote && (
          <p className="mb-2 text-[11px] text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2">
            ⚠ {clampNote}
          </p>
        )}
        <ValuationMethodCards
          methods={output.methods}
          currentPrice={currentPrice}
          currency={currency}
          fcfMargin={snapshot.fcfMargin}
          ttmEbitdaDollars={snapshot.ttmEbitdaDollars}
          assumptions={assumptions}
          historicalData={historicalData}
          fcfMarginSeries={fcfMarginSeries.length >= 2 ? fcfMarginSeries : undefined}
          analystForwardPE={apiData.analystForwardPE ?? null}
          ntmEVRevenue={ntmEVRevenue}
          onChange={handleAssumptionChange}
          onReset={handleReset}
          onUndo={handleUndo}
          canUndo={history.length > 0}
          sensitivity={sensitivity}
          sectorBenchmarks={sectorBenchmarks}
          onScrollToFullDCF={scrollToFullDCF}
          blendedFairValue={output.blendedFairValue}
          upsidePct={output.upsidePct}
        />
      </div>

      {/* ── 4-5-6. THREE-COLUMN EQUAL-HEIGHT ROW: Scorecard · Sensitivity · Monte Carlo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">

        {/* ── 4. THESIS SCORECARD ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[#E3E1DA] bg-white overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#E3E1DA] shrink-0">
            <p className="text-[10px] font-[700] uppercase tracking-widest text-[#9B9B9B]">Thesis Scorecard</p>
            <p className="text-[13px] font-[700] text-[#06101F] mt-0.5">Independent Checks</p>
          </div>
          <div className="flex-1 flex flex-col justify-between">
            {/* Score tiles — 2x2 grid */}
            <div className="grid grid-cols-2 gap-px bg-[#F5F5F5] flex-1">
              {/* Tile 1: ROIC vs WACC */}
              {(() => {
                const pass = (valueInvestingData.roicSpread ?? 0) > 0
                const na = valueInvestingData.roic == null
                return (
                  <div className={`bg-white px-3 py-3 flex flex-col gap-1.5 ${na ? 'opacity-50' : ''}`}>
                    <p className="text-[10px] text-[#9B9B9B] leading-tight">Economic value creation</p>
                    <div className={`inline-flex items-center gap-1 text-[10px] font-[700] px-2 py-0.5 rounded-full border self-start ${pass ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' : na ? 'bg-[#F5F5F5] border-[#E3E1DA] text-[#9B9B9B]' : 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]'}`}>
                      {!na && (pass
                        ? <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        : <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      )}
                      {na ? 'No data' : pass ? 'Strong' : 'Weak'}
                    </div>
                    <p className="text-[11px] font-[650] text-[#111111]">
                      {valueInvestingData.roic != null ? `ROIC ${(valueInvestingData.roic*100).toFixed(1)}%` : '—'}
                    </p>
                    {valueInvestingData.roicSpread != null && (
                      <p className="text-[10px] text-[#9B9B9B]">{valueInvestingData.roicSpread > 0 ? '+' : ''}{(valueInvestingData.roicSpread*100).toFixed(1)}pp vs WACC</p>
                    )}
                  </div>
                )
              })()}
              {/* Tile 2: FCF yield */}
              {(() => {
                const pass = fcfYield != null && rfRate != null && fcfYield > rfRate
                const na = fcfYield == null || rfRate == null
                return (
                  <div className={`bg-white px-3 py-3 flex flex-col gap-1.5 ${na ? 'opacity-50' : ''}`}>
                    <p className="text-[10px] text-[#9B9B9B] leading-tight">Compensation for risk</p>
                    <div className={`inline-flex items-center gap-1 text-[10px] font-[700] px-2 py-0.5 rounded-full border self-start ${pass ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' : na ? 'bg-[#F5F5F5] border-[#E3E1DA] text-[#9B9B9B]' : 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]'}`}>
                      {!na && (pass
                        ? <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        : <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01"/></svg>
                      )}
                      {na ? 'No data' : pass ? 'Adequate' : 'Thin'}
                    </div>
                    <p className="text-[11px] font-[650] text-[#111111]">
                      {fcfYield != null ? `FCF yield ${(fcfYield*100).toFixed(1)}%` : '—'}
                    </p>
                    {rfRate != null && <p className="text-[10px] text-[#9B9B9B]">vs {(rfRate*100).toFixed(1)}% risk-free</p>}
                  </div>
                )
              })()}
              {/* Tile 3: Market-implied growth */}
              {(() => {
                const implied = output.marketImpliedGrowth
                const analyst = snapshot.historicalCAGR
                const pass = implied != null && analyst != null && implied <= analyst * 1.5
                const na = implied == null
                return (
                  <div className={`bg-white px-3 py-3 flex flex-col gap-1.5 ${na ? 'opacity-50' : ''}`}>
                    <p className="text-[10px] text-[#9B9B9B] leading-tight">Market expectations</p>
                    <div className={`inline-flex items-center gap-1 text-[10px] font-[700] px-2 py-0.5 rounded-full border self-start ${na ? 'bg-[#F5F5F5] border-[#E3E1DA] text-[#9B9B9B]' : pass ? 'bg-[#EAF1FF] border-[#BFDBFE] text-[#2563EB]' : 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]'}`}>
                      {na ? 'No data' : pass ? 'Conservative' : 'Aggressive'}
                    </div>
                    <p className="text-[11px] font-[650] text-[#111111]">
                      {implied != null ? `Implied ${(implied*100).toFixed(1)}% CAGR` : '—'}
                    </p>
                    {analyst != null && <p className="text-[10px] text-[#9B9B9B]">Historical {(analyst*100).toFixed(1)}%</p>}
                  </div>
                )
              })()}
              {/* Tile 4: EPV growth premium */}
              {(() => {
                const prem = valueInvestingData.epv.growthPremiumPct
                const na = prem == null
                const signal = na ? 'slate' : prem < 0.15 ? 'green' : prem < 0.40 ? 'amber' : 'red'
                const label = na ? 'No data' : prem! < 0.15 ? 'Low premium' : prem! < 0.40 ? 'Moderate' : 'High premium'
                return (
                  <div className={`bg-white px-3 py-3 flex flex-col gap-1.5 ${na ? 'opacity-50' : ''}`}>
                    <p className="text-[10px] text-[#9B9B9B] leading-tight">Growth premium (EPV)</p>
                    <div className={`inline-flex items-center gap-1 text-[10px] font-[700] px-2 py-0.5 rounded-full border self-start ${signal === 'green' ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]' : signal === 'amber' ? 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]' : signal === 'red' ? 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]' : 'bg-[#F5F5F5] border-[#E3E1DA] text-[#9B9B9B]'}`}>
                      {label}
                    </div>
                    <p className="text-[11px] font-[650] text-[#111111]">
                      {prem != null ? `${(prem*100).toFixed(0)}% of price` : '—'}
                    </p>
                    {valueInvestingData.epv.epvPerShare != null && (
                      <p className="text-[10px] text-[#9B9B9B]">EPV {fmtPrice(valueInvestingData.epv.epvPerShare, currency)}</p>
                    )}
                  </div>
                )
              })()}
            </div>
            <p className="px-4 py-2.5 text-[10px] text-[#9B9B9B] italic border-t border-[#F5F5F5]">Signals, not guarantees. Use judgment.</p>
          </div>
        </div>

        {/* ── 5. SENSITIVITY MATRIX ────────────────────────────────────────────── */}
        <ProGate featureName="Sensitivity table" isPro={isPro} placeholderHeight="h-40">
          <SensitivityMatrix
            assumptions={assumptions}
            snapshot={effectiveSnapshot}
            currentPrice={currentPrice}
            currency={currency}
            epvPerShare={valueInvestingData.epv.epvPerShare}
            historicalData={historicalData}
            defaultAxisY={defaultAxisY}
            defaultAxisX={defaultAxisX}
          />
        </ProGate>

        {/* ── 6. MONTE CARLO ───────────────────────────────────────────────────── */}
        <MonteCarloPanel
          assumptions={assumptions}
          snapshot={effectiveSnapshot}
          apiData={apiData}
          sensitivity={sensitivity}
          currentPrice={currentPrice}
          currency={currency}
          compact
        />

      </div>

      {/* ── 7. FULL DCF MODEL (collapsed) — year-by-year projections ─────────── */}
      <details ref={fullDcfRef} className="group" id="full_dcf" open>
        <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-xl border border-[#E3E1DA] shadow-card px-4 sm:px-5 py-3.5 hover:bg-[#EAF1FF] transition-colors select-none">
          <span className="text-[#2563EB] text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
          <span className="text-sm font-[650] text-[#2563EB]">
            Full DCF Model — Year-by-Year Projections
          </span>
          {liveDcfFV != null && (
            <span className="ml-1 text-[12px] font-[700] tabular-nums text-[#2563EB]">
              {fmtPrice(liveDcfFV, currency)}
            </span>
          )}
          <span className="ml-auto text-xs text-[#9B9B9B] hidden sm:inline">DCF-only estimate · click to expand · full screen available</span>
        </summary>
        <div className="mt-2">
          <p className="sm:hidden text-[11px] text-[#9B9B9B] text-center py-2 px-4">
            Best experienced on a wider screen — scroll horizontally to view all columns.
          </p>
          <ModellingWorkspace
            apiData={apiData}
            ticker={ticker}
            statementsData={statementsData}
            onDerivedFVChange={setLiveDcfFV}
            cockpitWacc={assumptions.wacc}
          />
        </div>
      </details>

      {/* ── 8. MODEL EVIDENCE (collapsed) ───────────────────────────────────── */}
      <details className="group" id="model_evidence">
        <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-xl border border-[#E3E1DA] shadow-card px-4 sm:px-5 py-3.5 hover:bg-[#F5F5F5] transition-colors select-none">
          <span className="text-[#6B6B6B] text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
          <span className="text-sm font-[650] text-[#111111]">Model Evidence</span>
          <span className="ml-auto text-xs text-[#9B9B9B] hidden sm:inline">Fair value chart · divergence analysis · value investing metrics</span>
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <ValueInvestingPanel
            data={valueInvestingData}
            currency={currency}
            currentPrice={currentPrice}
          />
          <FairValueChart
            methods={output.methods}
            blendedFairValue={output.blendedFairValue}
            currentPrice={currentPrice}
            currency={currency}
          />
          <ModelDivergencePanel divergence={output.divergence} />
        </div>
      </details>

      {/* ── 9. DEEP ANALYSIS — BusinessChecks + AssumptionHealth ─────────────── */}
      <details className="group" id="deep_analysis">
        <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-xl border border-[#E3E1DA] shadow-card px-4 sm:px-5 py-3.5 hover:bg-[#F5F5F5] transition-colors select-none">
          <span className="text-[#6B6B6B] text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
          <span className="text-sm font-[650] text-[#111111]">Detailed Analysis</span>
          <span className="ml-auto text-xs text-[#9B9B9B] hidden sm:inline">ROIC · FCF yield · EPV · market-implied growth · assumption audit</span>
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          <BusinessChecks
            roic={valueInvestingData.roic}
            roicSpread={valueInvestingData.roicSpread}
            wacc={valueInvestingData.wacc}
            epvGrowthPremiumPct={valueInvestingData.epv.growthPremiumPct}
            epvPerShare={valueInvestingData.epv.epvPerShare}
            currentPrice={currentPrice}
            currency={currency}
            fcfYield={fcfYield}
            rfRate={rfRate}
            marketImpliedGrowth={output.marketImpliedGrowth}
            marketImpliedText={output.marketImpliedText}
            marketImpliedInterpretation={output.marketImpliedInterpretation}
            priceToBook={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (apiData.valuationMethods?.models?.multiples?.estimates ?? []).find((e: any) => e.multiple === 'P/Book')?.actualValue ?? null
            }
            pbSectorMedian={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (apiData.valuationMethods?.models?.multiples?.estimates ?? []).find((e: any) => e.multiple === 'P/Book')?.sectorMedian ?? null
            }
            sector={sector}
            starRating={starRating}
            uncertainty={uncertainty}
            structuralRisk={valueInvestingData.structuralRiskDisclaimer}
            countryRisk={valueInvestingData.countryRiskDisclaimer}
          />
          {apiData.assumptionAudit && (
            <AssumptionHealthPanel
              audit={apiData.assumptionAudit as AssumptionAudit}
              assumptions={assumptions}
              onChange={handleAssumptionChange}
              analystForwardPE={apiData.analystForwardPE ?? null}
            />
          )}
        </div>
      </details>

    </div>
  )
}

