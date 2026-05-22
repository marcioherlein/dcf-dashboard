'use client'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { fmtPctAbs, fmtLargeCurrency, fmtLarge } from '@/lib/formatters'
import type { DerivedFinancialInsights, TrendPoint } from '@/lib/stock/deriveFinancialInsightMetrics'

interface Quote {
  price: number
  peRatio: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  analystTargetMean: number
  marketCap: number
  currency: string
}

interface CAGRAnalysis {
  numAnalysts: number
  blended: number
}

interface CategoryRating {
  grade: string
  summary: string
}

interface Ratings {
  profitability: CategoryRating
  liquidity: CategoryRating
  growth: CategoryRating
  moat: CategoryRating
  valuation: CategoryRating
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValuationMethods = any

interface Props {
  quote: Quote
  cagrAnalysis: CAGRAnalysis
  analystRecommendation: string
  ratings?: Ratings
  valuationMethods?: AnyValuationMethods
  derivedInsights: DerivedFinancialInsights
  onNavigateToFinancials?: (rowKey: string, statement: 'income' | 'balance' | 'cashflow') => void
}

// ── Shared card primitives ────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl bg-white border border-slate-200 px-5 py-4', className)}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{children}</p>
}

// ── Signal badge ──────────────────────────────────────────────────────────────

type Signal = 'Good' | 'Watch' | 'Risk'

function SignalBadge({ signal }: { signal: Signal | null }) {
  if (!signal) return null
  const cls =
    signal === 'Good'  ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    signal === 'Watch' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                         'text-red-700 bg-red-50 border-red-200'
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0', cls)}>
      {signal}
    </span>
  )
}

// ── "View in Financials" link ─────────────────────────────────────────────────

function ViewLink({
  rowKey,
  statement,
  onNav,
}: {
  rowKey: string
  statement: 'income' | 'balance' | 'cashflow'
  onNav?: (rowKey: string, statement: 'income' | 'balance' | 'cashflow') => void
}) {
  if (!onNav) return null
  return (
    <button
      onClick={() => onNav(rowKey, statement)}
      className="text-[10px] text-blue-500 hover:text-blue-700 font-medium mt-2 flex items-center gap-0.5 transition-colors"
    >
      View in Financials <ChevronRight size={10} />
    </button>
  )
}

// ── Compact revenue bar chart ─────────────────────────────────────────────────

const CHART_H = 44
const LABEL_H = 12
const BAR_H = CHART_H - LABEL_H

function MiniRevChart({ points, currency }: { points: TrendPoint[]; currency: string }) {
  const valid = points.filter(p => p.value != null)
  if (valid.length < 2) return null
  const maxVal = Math.max(...valid.map(p => Math.abs(p.value!)))
  if (maxVal === 0) return null
  const lastIdx = points.reduce((acc, p, i) => (p.value != null ? i : acc), -1)

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: CHART_H }}>
        {points.map((p, i) => {
          if (p.value == null) return (
            <div key={p.year} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              <div className="w-full rounded-sm bg-slate-100" style={{ height: 2 }} />
              <span className="text-[9px] text-slate-400">{p.year.slice(-2)}</span>
            </div>
          )
          const barH = Math.max(3, (Math.abs(p.value) / maxVal) * BAR_H)
          const isLatest = i === lastIdx
          return (
            <div key={p.year} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              <div
                className={cn('w-full rounded-sm bg-blue-400', isLatest ? 'opacity-80' : 'opacity-45')}
                style={{ height: barH }}
              />
              <span className="text-[9px] text-slate-500">{p.year.slice(-2)}</span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-0.5">
        {points.map(p => (
          <span key={p.year} className="flex-1 text-center text-[9px] text-slate-400 tabular-nums leading-tight">
            {p.value != null ? fmtLarge(p.value) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Horizontal margin bar ─────────────────────────────────────────────────────

function MarginBar({ label, value, tooltip }: { label: string; value: number | null; tooltip?: string }) {
  const pct = value != null ? Math.min(100, Math.max(0, value * 100)) : null
  const color =
    pct == null     ? 'bg-slate-100' :
    pct >= 30       ? 'bg-emerald-500/70' :
    pct >= 15       ? 'bg-emerald-400/60' :
    pct >= 5        ? 'bg-amber-400/60' :
    pct >= 0        ? 'bg-orange-400/60' :
                      'bg-red-400/60'

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          {label}
          {tooltip && <InfoTooltip text={tooltip} side="left" />}
        </span>
        <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
          {pct != null ? pct.toFixed(1) + '%' : '—'}
        </span>
      </div>
      <div className="h-1 rounded-full bg-slate-100">
        {pct != null && pct > 0 && (
          <div className={cn('h-1 rounded-full', color)} style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  )
}

// ── Grade chip ────────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (grade === 'B+' || grade === 'B') return 'text-blue-600 bg-blue-50 border-blue-200'
  if (grade === 'C')                   return 'text-amber-600 bg-amber-50 border-amber-200'
  if (grade === 'D')                   return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

// ── Signal logic ──────────────────────────────────────────────────────────────

function revenueSignal(yoy: number | null): Signal | null {
  if (yoy == null) return null
  if (yoy >= 0.08) return 'Good'
  if (yoy >= 0)    return 'Watch'
  return 'Risk'
}

function marginSignal(net: number | null, ebit: number | null): Signal | null {
  const m = net ?? ebit
  if (m == null) return null
  if (m >= 0.10) return 'Good'
  if (m >= 0)    return 'Watch'
  return 'Risk'
}

function cashConversionSignal(fcf: number | null, ni: number | null): Signal | null {
  if (fcf == null || ni == null) return null
  if (ni <= 0) return fcf > 0 ? 'Good' : 'Risk'
  const ratio = fcf / ni
  if (ratio >= 0.80) return 'Good'
  if (ratio >= 0.30) return 'Watch'
  return 'Risk'
}

function balanceSheetSignal(ndToEbitda: number | null, currentRatio: number | null): Signal | null {
  if (ndToEbitda != null) {
    if (ndToEbitda <= 0)   return 'Good'
    if (ndToEbitda < 1.5)  return 'Good'
    if (ndToEbitda < 3.5)  return 'Watch'
    return 'Risk'
  }
  if (currentRatio != null) {
    if (currentRatio >= 1.5) return 'Good'
    if (currentRatio >= 1.0) return 'Watch'
    return 'Risk'
  }
  return null
}

// ── CAGR from trend points (dynamic window) ───────────────────────────────────

function computeCagr(points: TrendPoint[]): { value: number; label: string } | null {
  const valid = points.filter(p => p.value != null && p.value > 0)
  if (valid.length < 2) return null
  const useThree = valid.length >= 4
  const window = useThree ? 3 : valid.length - 1
  const newest = valid[valid.length - 1]
  const oldest = valid[valid.length - 1 - window]
  if (!oldest || oldest.value == null || oldest.value <= 0 || !newest.value) return null
  const cagr = Math.pow(newest.value / oldest.value, 1 / window) - 1
  return { value: cagr, label: `${window}Y CAGR` }
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtCap(v: number, currency: string): string {
  return fmtLargeCurrency(v, currency)
}

function upsideColor(pct: number): string {
  if (pct >=  0.15) return 'text-emerald-600'
  if (pct >=  0.00) return 'text-emerald-500'
  if (pct >= -0.15) return 'text-amber-600'
  return 'text-red-600'
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OverviewSidebar({
  quote,
  cagrAnalysis,
  analystRecommendation,
  ratings,
  valuationMethods,
  derivedInsights,
  onNavigateToFinancials,
}: Props) {
  const { price, fiftyTwoWeekHigh, fiftyTwoWeekLow, analystTargetMean, marketCap } = quote
  const currency = quote.currency ?? 'USD'
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency + ' '

  const { latestMetrics, revenueTrend, marginTrend, cashFlowTrend, dataQualityWarnings } = derivedInsights
  const isFinancialSector = dataQualityWarnings.some(w => w.field === 'ebitda')

  // ── Analyst Consensus values ──────────────────────────────────────────────
  const recNorm  = (analystRecommendation ?? '').toLowerCase()
  const isBuy    = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell   = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
  const recColor = isBuy ? 'text-emerald-600' : isSell ? 'text-red-600' : 'text-amber-600'
  const recBg    = isBuy ? 'bg-emerald-50 border-emerald-200' : isSell ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
  const targetUpside = analystTargetMean > 0 && price > 0 ? (analystTargetMean - price) / price : null

  // ── Intrinsic value ───────────────────────────────────────────────────────
  const blendedFV: number | null = valuationMethods?.triangulatedFairValue ?? null
  const blendedUpside: number | null = valuationMethods?.triangulatedUpsidePct ?? null

  // ── 52-week range ─────────────────────────────────────────────────────────
  const rangeSpan = fiftyTwoWeekHigh - fiftyTwoWeekLow
  const pricePct  = rangeSpan > 0 ? Math.max(0, Math.min(1, (price - fiftyTwoWeekLow) / rangeSpan)) : 0.5
  const targetPct = rangeSpan > 0 && analystTargetMean > 0
    ? Math.max(0, Math.min(1, (analystTargetMean - fiftyTwoWeekLow) / rangeSpan))
    : null

  // ── Revenue growth ────────────────────────────────────────────────────────
  const yoy = latestMetrics.revenueGrowthYoY
  const revSig = revenueSignal(yoy)
  const cagr = computeCagr(revenueTrend.points)

  // ── Cash conversion ───────────────────────────────────────────────────────
  const fcf = latestMetrics.fcf
  const netIncomeEst =
    latestMetrics.netMargin != null && latestMetrics.revenue != null
      ? latestMetrics.netMargin * latestMetrics.revenue
      : null
  const conversionRatio = fcf != null && netIncomeEst != null && netIncomeEst > 0
    ? fcf / netIncomeEst : null
  const cashSig = cashConversionSignal(fcf, netIncomeEst)

  // ── Balance sheet ─────────────────────────────────────────────────────────
  const bsSig = balanceSheetSignal(latestMetrics.netDebtToEbitda, latestMetrics.currentRatio)

  // ── Margin signals ────────────────────────────────────────────────────────
  const margSig = marginSignal(latestMetrics.netMargin, latestMetrics.ebitMargin)

  // ── Margin trend table (last 3 years) ────────────────────────────────────
  const ebitPts = marginTrend.ebit.points.slice(-3)
  const netPts  = marginTrend.net.points.slice(-3)
  const showMargTrend = ebitPts.filter(p => p.value != null).length >= 2

  // ── Revenue interpretation ────────────────────────────────────────────────
  function revInterpretation(): string | null {
    if (yoy == null) return null
    const pctStr = (Math.abs(yoy) * 100).toFixed(0) + '%'
    if (revSig === 'Good')  return `Growing steadily — revenue up ${pctStr} from last year.`
    if (revSig === 'Watch') return `Slow growth of ${pctStr} — monitor for re-acceleration.`
    return `Revenue fell ${pctStr} — worth investigating the cause.`
  }

  // ── Margin interpretation ─────────────────────────────────────────────────
  function margInterpretation(): string | null {
    const m = latestMetrics.netMargin ?? latestMetrics.ebitMargin
    if (m == null) return null
    const cents = Math.abs(m * 100).toFixed(0)
    if (margSig === 'Good')  return `Earns ${cents}¢ profit per $1 of revenue — healthy margin.`
    if (margSig === 'Watch') return `Thin margins of ${cents}% — profitability is real but modest.`
    return 'Currently spending more than it earns.'
  }

  // ── Cash conversion interpretation ───────────────────────────────────────
  function cashInterpretation(): string | null {
    if (fcf == null || netIncomeEst == null) return null
    if (netIncomeEst <= 0) {
      return fcf > 0 ? 'Generating real cash despite an accounting loss — a positive sign.' : 'Burning cash with no reported profit — needs close monitoring.'
    }
    if (conversionRatio == null) return null
    const pct = (conversionRatio * 100).toFixed(0) + '%'
    if (conversionRatio >= 1.0)  return 'Generates more cash than reported profits — a strong sign.'
    if (conversionRatio >= 0.80) return `Converts ${pct} of earnings into real cash — solid quality.`
    if (conversionRatio >= 0.30) return `Converts ${pct} of earnings into cash — typical but watch the gap.`
    if (fcf < 0)                 return 'Reporting profit but burning cash — a potential red flag.'
    return `Only ${pct} of earnings become actual cash — investigate accounting.`
  }

  // ── Balance sheet interpretation ──────────────────────────────────────────
  function bsInterpretation(): string | null {
    const nd = latestMetrics.netDebt
    const ratio = latestMetrics.netDebtToEbitda
    const cr = latestMetrics.currentRatio
    if (nd != null && nd <= 0) return 'Holds more cash than debt — financially conservative.'
    if (ratio != null) {
      const x = ratio.toFixed(1)
      if (bsSig === 'Good')  return `Low leverage — net debt is only ${x}× annual EBITDA.`
      if (bsSig === 'Watch') return `Moderate leverage — net debt is ${x}× annual EBITDA.`
      return `High leverage — ${x}× EBITDA in net debt. Watch debt costs.`
    }
    if (cr != null) {
      if (bsSig === 'Good')  return `Strong liquidity — ${cr.toFixed(1)}× current assets cover short-term bills.`
      if (bsSig === 'Watch') return `Adequate liquidity — current ratio of ${cr.toFixed(1)}×.`
      return `Tight liquidity — current ratio below 1× signals potential cash pressure.`
    }
    return null
  }

  const ratingCategories: { label: string; key: keyof Ratings }[] = [
    { label: 'Profitability', key: 'profitability' },
    { label: 'Liquidity',     key: 'liquidity'     },
    { label: 'Growth',        key: 'growth'        },
    { label: 'Moat',          key: 'moat'          },
    { label: 'Valuation',     key: 'valuation'     },
  ]

  return (
    <div className="space-y-4">

      {/* ── Card 1: Analyst Consensus ─────────────────────────────────────── */}
      <Card>
        <SectionLabel>Analyst Consensus</SectionLabel>
        <div className="flex items-center justify-between mb-2">
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', recBg, recColor)}>
            {recLabel}
          </span>
          {cagrAnalysis?.numAnalysts > 0 && (
            <span className="text-[10px] text-slate-400">{cagrAnalysis.numAnalysts} analysts</span>
          )}
        </div>
        {analystTargetMean > 0 && (
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-500">Avg. target</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                {sym}{analystTargetMean.toFixed(2)}
              </span>
              {targetUpside != null && (
                <span className={cn('text-[11px] font-semibold tabular-nums', targetUpside >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {targetUpside >= 0 ? '+' : ''}{(targetUpside * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        )}
        {marketCap > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Market cap</span>
            <span className="text-[10px] font-semibold text-slate-700 tabular-nums">
              {fmtCap(marketCap, currency)}
            </span>
          </div>
        )}
      </Card>

      {/* ── Card 2: Intrinsic Value Estimate (conditional) ───────────────── */}
      {blendedFV != null && (
        <Card>
          <SectionLabel>Intrinsic Value Estimate</SectionLabel>
          <div className="flex items-end justify-between mb-1">
            <span className="text-xl font-bold text-slate-900 tabular-nums">
              {sym}{blendedFV.toFixed(2)}
            </span>
            {blendedUpside != null && (
              <span className={cn('text-sm font-bold tabular-nums mb-0.5', upsideColor(blendedUpside))}>
                {blendedUpside >= 0 ? '+' : ''}{(blendedUpside * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">Blended DCF + multiples estimate</p>
        </Card>
      )}

      {/* ── Card 3: 52-Week Range ─────────────────────────────────────────── */}
      <Card>
        <SectionLabel>52-Week Range</SectionLabel>
        <div className="relative h-1.5 rounded-full bg-slate-200 mb-2.5">
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500/60 via-amber-400/60 to-emerald-500/60 w-full" />
          {targetPct != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-sm bg-blue-400/80"
              style={{ left: `calc(${targetPct * 100}% - 2px)` }}
              title={`Analyst target: ${sym}${analystTargetMean.toFixed(2)}`}
            />
          )}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-500 shadow"
            style={{ left: `calc(${pricePct * 100}% - 5px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
          <span>{sym}{fiftyTwoWeekLow.toFixed(2)}</span>
          <span className="text-slate-900 font-semibold">{sym}{price.toFixed(2)}</span>
          <span>{sym}{fiftyTwoWeekHigh.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mt-0.5 text-[9px] text-slate-500">
          <span>52W Low</span><span>Current</span><span>52W High</span>
        </div>
      </Card>

      {/* ── Card 4: Is the Company Growing? ──────────────────────────────── */}
      {revenueTrend.points.filter(p => p.value != null).length >= 2 && (
        <Card>
          <div className="flex items-start justify-between mb-3">
            <SectionLabel>Is the Company Growing?</SectionLabel>
            <SignalBadge signal={revSig} />
          </div>

          <MiniRevChart points={revenueTrend.points} currency={currency} />

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {yoy != null && (
              <div>
                <p className="text-[9px] text-slate-400 mb-0.5">YoY</p>
                <span className={cn('text-[11px] font-bold tabular-nums', yoy >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {yoy >= 0 ? '+' : ''}{(yoy * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {cagr != null && (
              <div>
                <p className="text-[9px] text-slate-400 mb-0.5">{cagr.label}</p>
                <span className={cn('text-[11px] font-bold tabular-nums', cagr.value >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {cagr.value >= 0 ? '+' : ''}{(cagr.value * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Interpretation */}
          {revInterpretation() && (
            <p className="text-[10px] text-slate-500 leading-snug mt-2">{revInterpretation()}</p>
          )}

          <ViewLink rowKey="totalRevenue" statement="income" onNav={onNavigateToFinancials} />
        </Card>
      )}

      {/* ── Card 5: Is Growth Profitable? ────────────────────────────────── */}
      {(latestMetrics.netMargin != null || latestMetrics.ebitMargin != null || latestMetrics.grossMargin != null) && (
        <Card>
          <div className="flex items-start justify-between mb-3">
            <SectionLabel>Is Growth Profitable?</SectionLabel>
            <SignalBadge signal={margSig} />
          </div>

          <div className="space-y-2.5">
            {latestMetrics.grossMargin != null && (
              <MarginBar label="Gross" value={latestMetrics.grossMargin} />
            )}
            {!isFinancialSector && latestMetrics.ebitdaMargin != null && (
              <MarginBar label="EBITDA" value={latestMetrics.ebitdaMargin} />
            )}
            {latestMetrics.ebitMargin != null && (
              <MarginBar
                label="Operating"
                value={latestMetrics.ebitMargin}
                tooltip="Operating profit before interest and taxes — measures core business efficiency."
              />
            )}
            {latestMetrics.netMargin != null && (
              <MarginBar label="Net" value={latestMetrics.netMargin} />
            )}
            {latestMetrics.fcfMargin != null && (
              <MarginBar
                label="FCF Margin"
                value={latestMetrics.fcfMargin}
                tooltip="Free cash actually generated per dollar of revenue — harder to manipulate than reported earnings."
              />
            )}
          </div>

          {/* 3-year EBIT / Net trend table */}
          {showMargTrend && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="flex justify-between text-[9px] text-slate-400 mb-1.5">
                <span>Year</span>
                <div className="flex gap-4">
                  {ebitPts.some(p => p.value != null) && <span className="text-emerald-500/80">EBIT</span>}
                  {netPts.some(p => p.value != null)  && <span className="text-blue-400/80">Net</span>}
                </div>
              </div>
              <div className="space-y-1">
                {ebitPts.map((ep, i) => {
                  const np = netPts[i]
                  if (ep.value == null && (np?.value == null)) return null
                  return (
                    <div key={ep.year} className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{ep.year.slice(-2)}</span>
                      <div className="flex gap-4">
                        <span className={cn('text-[10px] font-semibold tabular-nums text-right w-10',
                          ep.value != null && ep.value >= 0.15 ? 'text-emerald-600' :
                          ep.value != null && ep.value >= 0.05 ? 'text-emerald-500' : 'text-amber-600'
                        )}>
                          {ep.value != null ? fmtPctAbs(ep.value) : '—'}
                        </span>
                        <span className={cn('text-[10px] font-semibold tabular-nums text-right w-10',
                          np?.value != null && np.value >= 0.15 ? 'text-emerald-600' :
                          np?.value != null && np.value >= 0.05 ? 'text-blue-600' : 'text-amber-600'
                        )}>
                          {np?.value != null ? fmtPctAbs(np.value) : '—'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {margInterpretation() && (
            <p className="text-[10px] text-slate-500 leading-snug mt-2">{margInterpretation()}</p>
          )}

          <ViewLink rowKey="netIncome" statement="income" onNav={onNavigateToFinancials} />
        </Card>
      )}

      {/* ── Card 6: Does Profit Convert to Cash? ─────────────────────────── */}
      {!isFinancialSector && (fcf != null || netIncomeEst != null) && (
        <Card>
          <div className="flex items-start justify-between mb-3">
            <SectionLabel>Does Profit Convert to Cash?</SectionLabel>
            <SignalBadge signal={cashSig} />
          </div>

          {fcf != null && netIncomeEst != null ? (() => {
            const maxVal = Math.max(Math.abs(fcf), Math.abs(netIncomeEst), 1)
            const niWidth  = Math.max(4, (Math.abs(netIncomeEst) / maxVal) * 100)
            const fcfWidth = Math.max(4, (Math.abs(fcf) / maxVal) * 100)
            const fcfPositive = fcf >= 0
            return (
              <div className="space-y-2">
                {/* Net Income bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-slate-500">Net Income</span>
                    <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
                      {fmtLargeCurrency(netIncomeEst, currency)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-400/60"
                      style={{ width: `${niWidth}%` }}
                    />
                  </div>
                </div>
                {/* FCF bar */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] text-slate-500">Free Cash Flow</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
                        {fmtLargeCurrency(fcf, currency)}
                      </span>
                      {conversionRatio != null && netIncomeEst > 0 && (
                        <span className={cn('text-[10px] font-bold tabular-nums',
                          conversionRatio >= 0.80 ? 'text-emerald-600' : conversionRatio >= 0.30 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {(conversionRatio * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={cn('h-2 rounded-full', fcfPositive ? 'bg-emerald-400/70' : 'bg-red-400/70')}
                      style={{ width: `${fcfWidth}%` }}
                    />
                  </div>
                </div>
                {latestMetrics.isTTM && (
                  <p className="text-[9px] text-slate-400">TTM (trailing 12 months)</p>
                )}
              </div>
            )
          })() : (
            <p className="text-[11px] text-slate-400">Insufficient data</p>
          )}

          {cashInterpretation() && (
            <p className="text-[10px] text-slate-500 leading-snug mt-2">{cashInterpretation()}</p>
          )}

          <ViewLink rowKey="freeCashFlow" statement="cashflow" onNav={onNavigateToFinancials} />
        </Card>
      )}

      {/* ── Card 7: Is the Balance Sheet Safe? ───────────────────────────── */}
      {(latestMetrics.netDebt != null || latestMetrics.currentRatio != null) && (
        <Card>
          <div className="flex items-start justify-between mb-3">
            <SectionLabel>Is the Balance Sheet Safe?</SectionLabel>
            <SignalBadge signal={bsSig} />
          </div>

          <div className="space-y-1.5">
            {latestMetrics.netDebt != null && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Net Debt
                  <InfoTooltip text="Total debt minus cash held. Negative = net cash (more cash than debt)." side="left" />
                </span>
                <span className={cn('text-[11px] font-semibold tabular-nums',
                  latestMetrics.netDebt <= 0 ? 'text-emerald-600' : 'text-slate-900'
                )}>
                  {latestMetrics.netDebt <= 0 ? 'Net cash ' : ''}{fmtLargeCurrency(Math.abs(latestMetrics.netDebt), currency)}
                </span>
              </div>
            )}

            {!isFinancialSector && latestMetrics.netDebtToEbitda != null && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  Net Debt / EBITDA
                  <InfoTooltip text="How many years of EBITDA it would take to pay off net debt. Under 2× is comfortable; above 4× is elevated." side="left" />
                </span>
                <span className={cn('text-[11px] font-semibold tabular-nums',
                  latestMetrics.netDebtToEbitda <= 0   ? 'text-emerald-600' :
                  latestMetrics.netDebtToEbitda < 1.5  ? 'text-emerald-600' :
                  latestMetrics.netDebtToEbitda < 3.5  ? 'text-amber-600'   : 'text-red-600'
                )}>
                  {latestMetrics.netDebtToEbitda <= 0 ? '—' : `${latestMetrics.netDebtToEbitda.toFixed(1)}×`}
                </span>
              </div>
            )}

            {latestMetrics.currentRatio != null && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  Current Ratio
                  <InfoTooltip text="Short-term assets ÷ short-term bills due within a year. Above 1.5× means good liquidity." side="left" />
                </span>
                <span className={cn('text-[11px] font-semibold tabular-nums',
                  latestMetrics.currentRatio >= 1.5 ? 'text-emerald-600' :
                  latestMetrics.currentRatio >= 1.0 ? 'text-amber-600'   : 'text-red-600'
                )}>
                  {latestMetrics.currentRatio.toFixed(1)}×
                </span>
              </div>
            )}
          </div>

          {bsInterpretation() && (
            <p className="text-[10px] text-slate-500 leading-snug mt-2">{bsInterpretation()}</p>
          )}

          <ViewLink rowKey="totalDebt" statement="balance" onNav={onNavigateToFinancials} />
        </Card>
      )}

      {/* ── Card 8: Financial Health Grades ──────────────────────────────── */}
      {ratings && (
        <Card>
          <SectionLabel>Financial Health</SectionLabel>
          <div className="space-y-1.5">
            {ratingCategories.map(({ label, key }) => {
              const cat = ratings[key]
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 shrink-0">{label}</span>
                  <span className="text-[10px] text-slate-500 truncate flex-1 text-right">{cat.summary}</span>
                  <span className={cn('text-[11px] font-bold px-1.5 py-0 rounded border leading-5 shrink-0', gradeColor(cat.grade))}>
                    {cat.grade}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

    </div>
  )
}
