'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  TrendingUp, TrendingDown, Target, DollarSign, BarChart2,
  ShieldCheck, ChevronRight, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct } from '@/lib/formatters'
import { computeReverseDCF } from '@/lib/valuation/methods/reverseDcf'
import InfoTooltip from '@/components/ui/InfoTooltip'
import OverviewMetricGrid from '@/components/stock/OverviewMetricGrid'

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-xl bg-slate-100" />,
})

// ─── shared card style ────────────────────────────────────────────────────────

const CARD = 'bg-white border border-[#E6ECF5] rounded-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]'

// ─── types ────────────────────────────────────────────────────────────────────

interface ScenarioData {
  fairValue: number
  wacc: number
  cagr: number
  terminalG: number
}

interface SummaryTabProps {
  ticker: string
  companyName: string
  // quote
  price: number
  change: number
  changePct: number
  currency: string
  high52: number
  low52: number
  sector: string
  // cockpit
  fairValue: number | null
  upsidePct: number | null
  confidence: 'High' | 'Medium' | 'Low' | null
  modelCount: number
  totalModels: number
  // reverse DCF inputs
  sharesM: number | null
  cashM: number | null
  debtM: number | null
  revenueM: number | null
  fcfMargin: number | null
  wacc: number
  terminalG: number
  historicalCAGR: number | null
  analystCAGR: number | null
  isEmergingMarket?: boolean
  // scenarios (Full DCF)
  scenarios: {
    bull: ScenarioData
    base: ScenarioData
    bear: ScenarioData
  } | null
  // quality grid
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ratings: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scores: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessProfile: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cagrAnalysis: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statementsData: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valuationMethods?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote?: any
  analystTargetMean?: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userModelFairValue?: number | null
  // callbacks
  onViewValuation: () => void
  onViewRisks: () => void
  analystRecommendation?: string
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function deriveVerdict(upside: number | null) {
  if (upside == null) return { chip: '—', label: 'Insufficient Data', chipClass: 'bg-slate-100 text-slate-500 border-slate-200', color: 'text-slate-500' }
  if (upside > 0.25)  return { chip: 'BUY',   label: 'Attractive',    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',  color: 'text-emerald-600' }
  if (upside > 0.05)  return { chip: 'BUY',   label: 'Undervalued',   chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',  color: 'text-emerald-600' }
  if (upside >= -0.10) return { chip: 'WATCH', label: 'Near Fair Value', chipClass: 'bg-blue-50 text-blue-700 border-blue-200',        color: 'text-blue-600' }
  if (upside >= -0.25) return { chip: 'AVOID', label: 'Overvalued',    chipClass: 'bg-red-50 text-red-600 border-red-200',             color: 'text-red-500' }
  return                      { chip: 'AVOID', label: 'Overvalued',    chipClass: 'bg-red-50 text-red-600 border-red-200',             color: 'text-red-500' }
}

function confidenceStyle(conf: 'High' | 'Medium' | 'Low' | null) {
  if (conf === 'High')   return { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' }
  if (conf === 'Medium') return { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' }
  return                        { dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100 border-slate-200' }
}

const INTERP_CHIP: Record<string, string> = {
  conservative:    'bg-emerald-50 border-emerald-200 text-emerald-700',
  reasonable:      'bg-blue-50 border-blue-200 text-blue-700',
  aggressive:      'bg-amber-50 border-amber-200 text-amber-700',
  very_aggressive: 'bg-red-50 border-red-200 text-red-700',
  not_meaningful:  'bg-slate-50 border-slate-200 text-slate-500',
}

const INTERP_LABELS: Record<string, string> = {
  conservative:    'Conservative',
  reasonable:      'Reasonable',
  aggressive:      'Aggressive',
  very_aggressive: 'Very Aggressive',
  not_meaningful:  'N/A',
}

const INTERP_BAR: Record<string, string> = {
  conservative:    'bg-emerald-500',
  reasonable:      'bg-blue-500',
  aggressive:      'bg-amber-500',
  very_aggressive: 'bg-red-500',
  not_meaningful:  'bg-slate-300',
}

const POSITIVE_RE = /strong|grow|profit|margin|cash\s*gen|moat|leader|dominan|innovat|compet.*advan|pric.*power|market.*share|expand|increas|high.*return|quality|best.in.class|track.record|breadth|diversif|solid|robust|effici|resilient|premium/i
const RISK_RE = /risk|slow|compet.*threat|compet.*pressure|compet.*tion.*increas|decline|margin.*pressur|debt|regul|geopolit|uncertain|challeng|pressur|headwind|restrict|vola|concern|restrict|expos|saturat|disrupt|commoditi/i

function buildBullets(drivers: string[], positive: boolean): string[] {
  const filtered = (drivers ?? []).filter(d =>
    positive ? POSITIVE_RE.test(d) && !RISK_RE.test(d) : RISK_RE.test(d)
  )
  return (filtered.length > 0 ? filtered : (positive ? (drivers ?? []).slice(0, 2) : [])).slice(0, 3)
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-0.5">
      {children}
      {tooltip && <InfoTooltip content={tooltip} />}
    </p>
  )
}

// ── Top Metric Strip ──────────────────────────────────────────────────────────

function TopStrip({
  price, change, changePct, currency,
  high52, low52,
  fairValue, upsidePct, confidence, modelCount, totalModels,
  onViewValuation,
}: Pick<SummaryTabProps,
  'price' | 'change' | 'changePct' | 'currency' |
  'high52' | 'low52' | 'fairValue' | 'upsidePct' | 'confidence' |
  'modelCount' | 'totalModels' | 'onViewValuation'
>) {
  const isUp      = change >= 0
  const verdict   = deriveVerdict(upsidePct)
  const conf      = confidenceStyle(confidence)

  const rangeSpan = high52 - low52
  const pricePct52 = rangeSpan > 0
    ? Math.max(2, Math.min(98, ((Math.max(low52, Math.min(high52, price)) - low52) / rangeSpan) * 100))
    : 50

  const ratio = fairValue != null && fairValue > 0 ? price / fairValue : null
  const SCALE_MAX = 2.5
  const dotPct  = ratio != null ? Math.max(1, Math.min(99, (ratio / SCALE_MAX) * 100)) : 50
  const fvLinePct = (1.0 / SCALE_MAX) * 100

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

      {/* Card 1: Current Price */}
      <div className={cn(CARD, 'p-4 flex flex-col gap-2')}>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <DollarSign size={13} className="text-blue-500" />
          </div>
          <SectionLabel>Current Price</SectionLabel>
        </div>
        <p className="text-[26px] font-bold tabular-nums text-slate-900 leading-none">
          {fmtPrice(price, currency)}
        </p>
        <p className={cn('text-[12px] font-semibold tabular-nums flex items-center gap-0.5', isUp ? 'text-emerald-600' : 'text-red-600')}>
          {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {isUp ? '+' : ''}{fmtPrice(change, currency)} ({isUp ? '+' : ''}{changePct.toFixed(2)}%)
        </p>

        {/* 52-week range */}
        <div className="mt-1">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mb-1">52-Week Range</p>
          <div className="relative h-1.5 rounded-full overflow-hidden bg-slate-100">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-[1.5px] border-slate-700 shadow-sm"
              style={{ left: `calc(${pricePct52}% - 5px)` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-slate-400 tabular-nums">{fmtPrice(low52, currency)}</span>
            <span className="text-[9px] text-slate-400 tabular-nums">{fmtPrice(high52, currency)}</span>
          </div>
        </div>
      </div>

      {/* Card 2: Intrinsic Value */}
      <div className={cn(CARD, 'p-4 flex flex-col gap-2 border-t-2 border-t-blue-400')}>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <Target size={13} className="text-indigo-500" />
          </div>
          <SectionLabel tooltip="Weighted average of available valuation models (Forward P/E, EV/EBITDA, Revenue Multiple, Core DCF). Unavailable models are excluded and weights redistributed.">Intrinsic Value</SectionLabel>
        </div>
        {fairValue != null ? (
          <>
            <p className="text-[26px] font-bold tabular-nums text-slate-900 leading-none">
              {fmtPrice(fairValue, currency)}
            </p>
            <p className="text-[10px] text-slate-400">
              {modelCount} of {totalModels} models · blended
            </p>
            <button onClick={onViewValuation} className="mt-auto text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-0.5">
              Full analysis <ChevronRight size={11} />
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-400 mt-1">—</p>
        )}
      </div>

      {/* Card 3: Upside / Downside */}
      <div className={cn(CARD, 'p-4 flex flex-col gap-2')}>
        <div className="flex items-center gap-1.5">
          <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', upsidePct != null && upsidePct >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
            {upsidePct != null && upsidePct >= 0
              ? <TrendingUp size={13} className="text-emerald-500" />
              : <TrendingDown size={13} className="text-red-500" />
            }
          </div>
          <SectionLabel tooltip="The percentage gap between the current price and our blended intrinsic value estimate. Positive = discount to fair value. Negative = premium.">Upside / Downside</SectionLabel>
        </div>
        {upsidePct != null ? (
          <>
            <p className={cn('text-[26px] font-bold tabular-nums leading-none', upsidePct >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {upsidePct >= 0 ? '+' : ''}{fmtPct(upsidePct)}
            </p>
            <p className="text-[10px] text-slate-400">
              {upsidePct >= 0 ? 'potential upside' : 'premium to fair value'}
            </p>
            {/* Mini zone bar */}
            <div className="mt-1">
              <div className="relative h-1.5 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '28%' }} />
                <div className="bg-emerald-400 h-full" style={{ width: '8%' }} />
                <div className="bg-blue-400 h-full" style={{ width: '8%' }} />
                <div className="bg-amber-400 h-full" style={{ width: '12%' }} />
                <div className="bg-red-400 h-full flex-1" />
              </div>
              {ratio != null && (
                <div className="relative h-1.5 -mt-1.5 pointer-events-none">
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10" style={{ left: `${fvLinePct}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-900 border-2 border-white shadow z-20" style={{ left: `calc(${dotPct}% - 6px)` }} />
                </div>
              )}
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px] text-slate-400">Deep value</span>
                <span className="text-[9px] text-slate-400">Expensive</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400 mt-1">—</p>
        )}
      </div>

      {/* Card 4: Verdict */}
      <div className={cn(CARD, 'p-4 flex flex-col gap-2')}>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
            <BarChart2 size={13} className="text-slate-500" />
          </div>
          <SectionLabel tooltip="The model-based conclusion on whether the stock appears undervalued or overvalued at today's price.">Verdict</SectionLabel>
        </div>
        <span className={cn('inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full border w-fit', verdict.chipClass)}>
          {verdict.chip}
        </span>
        <p className={cn('text-[20px] font-bold leading-tight', verdict.color)}>
          {verdict.label}
        </p>
        {upsidePct != null && (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {upsidePct >= 0
              ? `${(Math.abs(upsidePct) * 100).toFixed(0)}% below our intrinsic estimate`
              : `${(Math.abs(upsidePct) * 100).toFixed(0)}% above our intrinsic estimate`}
          </p>
        )}
        <button onClick={onViewValuation} className="mt-auto text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-0.5">
          See full analysis <ChevronRight size={11} />
        </button>
      </div>

      {/* Card 5: Confidence */}
      <div className={cn(CARD, 'p-4 flex flex-col gap-2')}>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
            <ShieldCheck size={13} className="text-slate-500" />
          </div>
          <SectionLabel tooltip="How much the valuation models agree with each other. High = models closely aligned. Low = wide spread — treat the estimate as a range.">Confidence</SectionLabel>
        </div>
        {confidence != null ? (
          <>
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border w-fit', conf.bg, conf.text)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', conf.dot)} />
              {confidence}
            </span>
            <p className="text-[12px] font-bold text-slate-800">{confidence} conviction</p>
            <p className="text-[10px] text-slate-400">
              {modelCount} of {totalModels} models computed
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed mt-auto">
              {confidence === 'High'
                ? 'Models are in close agreement.'
                : confidence === 'Medium'
                ? 'Moderate spread between models.'
                : 'Wide divergence — use as a range.'}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400 mt-1">—</p>
        )}
      </div>

    </div>
  )
}

// ── Insight Tri-Column ────────────────────────────────────────────────────────

function InsightTriColumn({
  price, currency, fairValue, upsidePct,
  sharesM, cashM, debtM, revenueM, fcfMargin,
  wacc, terminalG, historicalCAGR, analystCAGR, isEmergingMarket,
  analystRecommendation, analystTargetMean,
  onViewValuation,
}: Pick<SummaryTabProps,
  'price' | 'currency' | 'fairValue' | 'upsidePct' |
  'sharesM' | 'cashM' | 'debtM' | 'revenueM' | 'fcfMargin' |
  'wacc' | 'terminalG' | 'historicalCAGR' | 'analystCAGR' | 'isEmergingMarket' |
  'analystRecommendation' | 'analystTargetMean' | 'onViewValuation'
>) {
  const result = useMemo(() => computeReverseDCF({
    currentPrice: price,
    sharesOutstanding: sharesM != null ? sharesM * 1e6 : null,
    cashM,
    debtM,
    lastRevenue:  revenueM != null ? revenueM * 1e6 : null,
    lastFCFMargin: fcfMargin,
    wacc,
    terminalG,
    historicalCAGR,
  }), [price, sharesM, cashM, debtM, revenueM, fcfMargin, wacc, terminalG, historicalCAGR])

  const impliedPct    = result.impliedCAGR != null ? result.impliedCAGR * 100 : null
  const historicalPct = historicalCAGR != null ? historicalCAGR * 100 : null
  const analystPct    = analystCAGR != null ? analystCAGR * 100 : null
  const scale = Math.max(impliedPct ?? 0, historicalPct ?? 0, analystPct ?? 0, 12)
  const impliedW   = impliedPct != null ? Math.min(100, (impliedPct / scale) * 100) : 0
  const historicalW = historicalPct != null ? Math.min(100, (historicalPct / scale) * 100) : 0
  const analystW   = analystPct != null ? Math.min(100, (analystPct / scale) * 100) : 0

  const barCls = INTERP_BAR[result.interpretation] ?? 'bg-slate-300'
  const chipCls = INTERP_CHIP[result.interpretation] ?? ''
  const interpLabel = INTERP_LABELS[result.interpretation] ?? '—'

  const ratio = fairValue != null && fairValue > 0 ? price / fairValue : null
  const SCALE_MAX = 2.5
  const dotPct  = ratio != null ? Math.max(1, Math.min(99, (ratio / SCALE_MAX) * 100)) : 50
  const fvLinePct = (1.0 / SCALE_MAX) * 100

  function zoneLabel(r: number): string {
    if (r <= 0.70) return 'Deep Value'
    if (r <= 0.90) return 'Undervalued'
    if (r <= 1.10) return 'Fair Value'
    if (r <= 1.40) return 'Premium'
    if (r <= 2.00) return 'Expensive'
    return 'Very Expensive'
  }

  const ratioIsAbove = ratio != null && ratio > 1
  const ratioZone = ratio != null ? zoneLabel(ratio) : null
  const ratioChipCls = ratioIsAbove ? 'text-red-600 bg-red-50 border-red-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200'

  // Interpretation text for Col 3
  const analystRaw = (analystRecommendation ?? '').toLowerCase()
  const analystBullish = analystRaw.includes('buy') || analystRaw.includes('outperform') || analystRaw.includes('overweight')
  const analystBearish = analystRaw.includes('sell') || analystRaw.includes('underperform') || analystRaw.includes('underweight')
  const analystNeutral = analystRaw.includes('hold') || analystRaw.includes('neutral') || analystRaw.includes('market perform')

  const analystSentiment = analystBullish ? 'bullish' : analystBearish ? 'bearish' : analystNeutral ? 'neutral' : null
  const analystSentimentColor = analystBullish ? 'text-emerald-600' : analystBearish ? 'text-red-500' : 'text-amber-600'

  return (
    <div className={cn(CARD, 'overflow-hidden')}>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E6ECF5]">

        {/* Column 1: Reverse DCF */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-4">
            <div>
              <SectionLabel tooltip="Works backward from today's price to estimate the revenue growth rate the market is already pricing in.">Reverse DCF Analysis</SectionLabel>
              <p className="text-[13px] font-semibold text-slate-700 leading-tight">What the market is pricing in</p>
            </div>
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 whitespace-nowrap', chipCls)}>
              {interpLabel}
            </span>
          </div>

          {result.interpretation === 'not_meaningful' ? (
            <p className="text-[12px] text-slate-500 leading-relaxed">{result.interpretationText}</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Implied 5Y Revenue CAGR</p>
                <p className={cn('text-[28px] font-bold tabular-nums leading-none', impliedPct != null && impliedPct > 20 ? 'text-red-600' : impliedPct != null && impliedPct < 8 ? 'text-emerald-600' : 'text-amber-600')}>
                  {impliedPct != null ? `${impliedPct.toFixed(1)}%` : '—'}
                </p>
              </div>
              <div className="space-y-2">
                {/* Implied */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500">Implied 5Y CAGR</span>
                    <span className={cn('text-[10px] font-semibold tabular-nums', barCls.replace('bg-', 'text-'))}>
                      {impliedPct != null ? `${impliedPct.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-700', barCls)} style={{ width: `${impliedW}%` }} />
                  </div>
                </div>
                {historicalPct != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-500">3Y Historical</span>
                      <span className="text-[10px] font-semibold tabular-nums text-slate-600">{historicalPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400 transition-all duration-700 delay-100" style={{ width: `${historicalW}%` }} />
                    </div>
                  </div>
                )}
                {analystPct != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-500">Analyst Est. (1Y)</span>
                      <span className="text-[10px] font-semibold tabular-nums text-purple-600">{analystPct.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-purple-400 transition-all duration-700 delay-200" style={{ width: `${analystW}%` }} />
                    </div>
                  </div>
                )}
              </div>
              {historicalPct != null && impliedPct != null && Math.abs(impliedPct - historicalPct) > 1 && (
                <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
                  Market assumes <strong>{impliedPct.toFixed(1)}%</strong> — {Math.abs(impliedPct - historicalPct).toFixed(1)}pp{' '}
                  {impliedPct > historicalPct ? 'above' : 'below'} 3Y track record of {historicalPct.toFixed(1)}%.
                </p>
              )}
              {isEmergingMarket && (
                <p className="text-[10px] text-amber-600 leading-relaxed">⚠ Emerging market — interpret CAGR benchmark with caution.</p>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Price vs Fair Value */}
        <div className="p-5">
          <SectionLabel tooltip="Compares the current price to our intrinsic value estimate as a ratio. 1.0× = fairly priced. Above 1.0× = premium. Below 1.0× = discount.">Price vs Fair Value</SectionLabel>
          <p className="text-[13px] font-semibold text-slate-700 leading-tight mb-4">Where price sits relative to intrinsic</p>

          {ratio != null ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-[32px] font-extrabold tabular-nums text-slate-900 leading-none">{ratio.toFixed(2)}×</span>
                <span className="text-[11px] text-slate-400">Price / Intrinsic</span>
              </div>
              <span className={cn('inline-flex text-[10px] font-bold px-2.5 py-0.5 rounded-full border', ratioChipCls)}>
                {ratioZone}
              </span>

              {/* Zone bar */}
              <div>
                <div className="relative h-2.5 rounded-full overflow-hidden flex">
                  <div className="bg-emerald-500 h-full" style={{ width: '28%' }} />
                  <div className="bg-emerald-400 h-full" style={{ width: '8%' }} />
                  <div className="bg-blue-400 h-full" style={{ width: '8%' }} />
                  <div className="bg-amber-400 h-full" style={{ width: '12%' }} />
                  <div className="bg-red-400 h-full flex-1" />
                </div>
                <div className="relative h-2.5 -mt-2.5 pointer-events-none mb-1">
                  <div className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10" style={{ left: `${fvLinePct}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-white shadow z-20" style={{ left: `calc(${dotPct}% - 7px)` }} />
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] text-slate-400">0× Deep</span>
                  <span className="text-[9px] text-blue-500">1× FV</span>
                  <span className="text-[9px] text-slate-400">2.5× Rich</span>
                </div>
              </div>

              {upsidePct != null && (
                <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
                  {ratioIsAbove
                    ? `At ${ratio.toFixed(2)}×, price is ${(Math.abs(upsidePct) * 100).toFixed(0)}% above our estimate. Limited margin of safety.`
                    : `At ${ratio.toFixed(2)}×, price is ${(Math.abs(upsidePct) * 100).toFixed(0)}% below our estimate. Potential upside if assumptions hold.`}
                </p>
              )}

              {analystTargetMean != null && analystTargetMean > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400">Analyst target</span>
                  <span className="text-[10px] font-semibold tabular-nums text-slate-700">{fmtPrice(analystTargetMean, currency)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Intrinsic value not available.</p>
          )}
        </div>

        {/* Column 3: Interpretation */}
        <div className="p-5 flex flex-col gap-3">
          <SectionLabel>Interpretation</SectionLabel>
          <p className="text-[13px] font-semibold text-slate-700 leading-tight mb-1">Our read on the situation</p>

          {/* Analyst stance */}
          {analystSentiment && (
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <span className="text-slate-400 text-[13px] shrink-0">👥</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Analyst consensus:{' '}
                <strong className={analystSentimentColor}>{analystSentiment.charAt(0).toUpperCase() + analystSentiment.slice(1)}</strong>
                {analystTargetMean != null && analystTargetMean > 0 && (
                  <> · target {fmtPrice(analystTargetMean, currency)}</>
                )}
              </p>
            </div>
          )}

          {/* Reverse DCF interpretation */}
          {result.interpretation !== 'not_meaningful' && (
            <div className={cn('flex items-start gap-2 rounded-lg px-3 py-2 border', chipCls.replace('bg-', 'bg-').replace('text-', ''))}>
              <span className="text-[13px] shrink-0">📊</span>
              <p className="text-[11px] leading-relaxed text-slate-600">
                <span className="font-semibold">Market pricing:</span> {result.interpretationText}
              </p>
            </div>
          )}

          {/* Model vs analyst divergence */}
          {upsidePct != null && analystSentiment != null && (
            (() => {
              const modelBullish = upsidePct > 0.10
              const modelBearish = upsidePct < -0.10
              const hasDivergence = (modelBullish && analystBearish) || (modelBearish && analystBullish)
              return hasDivergence ? (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <span className="text-amber-500 text-[13px] shrink-0">⚠</span>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    <strong>Signal divergence:</strong> our model says{' '}
                    {modelBullish ? 'undervalued' : 'overvalued'} while analysts lean{' '}
                    {analystBullish ? 'bullish' : 'bearish'}. Investigate before acting.
                  </p>
                </div>
              ) : null
            })()
          )}

          <button
            onClick={onViewValuation}
            className="mt-auto w-full rounded-xl py-2.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
          >
            Open Full Valuation <ChevronRight size={13} />
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Bottom Decision Row ───────────────────────────────────────────────────────

function BottomDecisionRow({
  scenarios, price, currency,
  ratings, cagrAnalysis, upsidePct,
  ticker, fairValue, analystTargetMean, userModelFairValue,
  onViewValuation, onViewRisks,
}: Pick<SummaryTabProps,
  'scenarios' | 'price' | 'currency' | 'ratings' | 'cagrAnalysis' |
  'upsidePct' | 'ticker' | 'fairValue' | 'analystTargetMean' | 'userModelFairValue' |
  'onViewValuation' | 'onViewRisks'
>) {
  const drivers: string[] = cagrAnalysis?.drivers ?? []
  const supportBullets = buildBullets(drivers, true)
  const riskBullets = buildBullets(drivers, false)
    .slice(0, Math.max(0, 3 - drivers.filter((d: string) => RISK_RE.test(d)).length))

  const allRiskBullets = (() => {
    const bullets: string[] = []
    if (cagrAnalysis?.drivers) {
      const riskDrivers = (cagrAnalysis.drivers as string[]).filter((d: string) => RISK_RE.test(d))
      bullets.push(...riskDrivers.slice(0, 2))
    }
    if (bullets.length < 2 && upsidePct != null && upsidePct < -0.15) {
      bullets.push(`Price is ${(Math.abs(upsidePct) * 100).toFixed(0)}% above our intrinsic estimate — limited margin of safety.`)
    }
    if (bullets.length === 0 && ratings?.valuation?.color) {
      const c = ratings.valuation.color
      if (c === 'red' || c === 'orange') bullets.push('Valuation elevated relative to fundamentals.')
      else if (c === 'amber') bullets.push('Valuation stretched — limited buffer if growth disappoints.')
    }
    if (bullets.length === 0) bullets.push('No significant risk signals from available data.')
    return bullets.slice(0, 3)
  })()

  const bullUpside = scenarios?.bull && price > 0 ? (scenarios.bull.fairValue - price) / price : null
  const bearUpside = scenarios?.bear && price > 0 ? (scenarios.bear.fairValue - price) / price : null

  void riskBullets

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

      {/* Bull Case */}
      {scenarios?.bull && (
        <div className={cn(CARD, 'p-4 flex flex-col gap-2')}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-emerald-500 shrink-0" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Bull Case</p>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">Sustained growth + margin expansion</p>
          {bullUpside != null && (
            <p className={cn('text-[24px] font-bold tabular-nums leading-none', bullUpside >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {bullUpside >= 0 ? '+' : ''}{(bullUpside * 100).toFixed(1)}%
            </p>
          )}
          <p className="text-[13px] font-semibold tabular-nums text-slate-700">{fmtPrice(scenarios.bull.fairValue, currency)}</p>
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 mt-auto">
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">WACC</p>
              <p className="text-[11px] font-semibold tabular-nums text-slate-700">{(scenarios.bull.wacc * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">CAGR</p>
              <p className="text-[11px] font-semibold tabular-nums text-slate-700">{(scenarios.bull.cagr * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">Term G</p>
              <p className="text-[11px] font-semibold tabular-nums text-slate-700">{(scenarios.bull.terminalG * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Bear Case */}
      {scenarios?.bear && (
        <div className={cn(CARD, 'p-4 flex flex-col gap-2')}>
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown size={14} className="text-red-500 shrink-0" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">Bear Case</p>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">Slowdown or execution miss</p>
          {bearUpside != null && (
            <p className={cn('text-[24px] font-bold tabular-nums leading-none', bearUpside >= 0 ? 'text-emerald-600' : 'text-red-600')}>
              {bearUpside >= 0 ? '+' : ''}{(bearUpside * 100).toFixed(1)}%
            </p>
          )}
          <p className="text-[13px] font-semibold tabular-nums text-slate-700">{fmtPrice(scenarios.bear.fairValue, currency)}</p>
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 mt-auto">
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">WACC</p>
              <p className="text-[11px] font-semibold tabular-nums text-slate-700">{(scenarios.bear.wacc * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">CAGR</p>
              <p className="text-[11px] font-semibold tabular-nums text-slate-700">{(scenarios.bear.cagr * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider">Term G</p>
              <p className="text-[11px] font-semibold tabular-nums text-slate-700">{(scenarios.bear.terminalG * 100).toFixed(1)}%</p>
            </div>
          </div>
          {allRiskBullets.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-1 mt-1">
              {allRiskBullets.slice(0, 2).map((b, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  <span className="text-[10px] text-slate-500 leading-relaxed">{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Panel */}
      <div className={cn(CARD, 'p-4 flex flex-col gap-3')}>
        <div className="flex items-center gap-1.5 mb-1">
          <Target size={14} className="text-blue-500 shrink-0" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Next Steps</p>
        </div>

        {supportBullets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600">What supports</p>
            {supportBullets.map((d, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5 shrink-0 text-[11px]">✓</span>
                <span className="text-[11px] text-slate-600 leading-relaxed">{d}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5 mt-auto">
          <button
            onClick={onViewValuation}
            className="w-full rounded-xl py-2 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            View valuation →
          </button>
          <button
            onClick={onViewRisks}
            className="w-full rounded-xl py-2 text-[12px] font-semibold text-slate-600 border border-[#E6ECF5] hover:bg-slate-50 transition-colors"
          >
            View risk analysis →
          </button>
        </div>
      </div>

      {/* Price Chart (compact) */}
      <div className={cn(CARD, 'p-4 flex flex-col gap-2')}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Price Chart</p>
        <div className="flex-1 min-h-[160px]">
          <PriceChart
            ticker={ticker}
            isDark={false}
            triangulatedFairValue={fairValue ?? undefined}
            analystTarget={analystTargetMean ?? undefined}
            userModelFairValue={userModelFairValue ?? null}
          />
        </div>
      </div>

    </div>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────

export default function SummaryTab({
  ticker, currency,
  price, change, changePct, high52, low52,
  fairValue, upsidePct, confidence, modelCount, totalModels,
  sharesM, cashM, debtM, revenueM, fcfMargin,
  wacc, terminalG, historicalCAGR, analystCAGR, isEmergingMarket,
  scenarios, ratings, scores, businessProfile, cagrAnalysis, statementsData,
  valuationMethods, quote, analystTargetMean, userModelFairValue,
  onViewValuation, onViewRisks, analystRecommendation,
}: SummaryTabProps) {
  return (
    <div className="space-y-4">

      {/* 1. Top 5-card strip */}
      <TopStrip
        price={price}
        change={change}
        changePct={changePct}
        currency={currency}
        high52={high52}
        low52={low52}
        fairValue={fairValue}
        upsidePct={upsidePct}
        confidence={confidence}
        modelCount={modelCount}
        totalModels={totalModels}
        onViewValuation={onViewValuation}
      />

      {/* 2. Insight tri-column */}
      <InsightTriColumn
        price={price}
        currency={currency}
        fairValue={fairValue}
        upsidePct={upsidePct}
        sharesM={sharesM}
        cashM={cashM}
        debtM={debtM}
        revenueM={revenueM}
        fcfMargin={fcfMargin}
        wacc={wacc}
        terminalG={terminalG}
        historicalCAGR={historicalCAGR}
        analystCAGR={analystCAGR}
        isEmergingMarket={isEmergingMarket}
        analystRecommendation={analystRecommendation}
        analystTargetMean={analystTargetMean}
        onViewValuation={onViewValuation}
      />

      {/* 3. Quality grid */}
      {ratings && (
        <OverviewMetricGrid
          ratings={ratings}
          scores={scores}
          businessProfile={businessProfile}
          cagrAnalysis={cagrAnalysis}
          statementsData={statementsData}
          onViewRisks={onViewRisks}
          valuationMethods={valuationMethods}
          quote={quote}
        />
      )}

      {/* 4. Bottom decision row */}
      <BottomDecisionRow
        scenarios={scenarios}
        price={price}
        currency={currency}
        ratings={ratings}
        cagrAnalysis={cagrAnalysis}
        upsidePct={upsidePct}
        ticker={ticker}
        fairValue={fairValue}
        analystTargetMean={analystTargetMean}
        userModelFairValue={userModelFairValue}
        onViewValuation={onViewValuation}
        onViewRisks={onViewRisks}
      />

    </div>
  )
}
