'use client'
import { cn } from '@/lib/utils'

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

interface BusinessProfile {
  grossMargin: number | null
  netMargin: number | null
  fcfMargin: number | null
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

interface WACCInputs {
  beta: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyValuationMethods = any

interface Props {
  quote: Quote
  cagrAnalysis: CAGRAnalysis
  businessProfile: BusinessProfile
  wacc?: { inputs: WACCInputs }
  analystRecommendation: string
  ratings?: Ratings
  valuationMethods?: AnyValuationMethods
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—'
  return (v * 100).toFixed(1) + '%'
}

function fmtCap(v: number): string {
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T'
  if (v >= 1e9)  return '$' + (v / 1e9).toFixed(1) + 'B'
  if (v >= 1e6)  return '$' + (v / 1e6).toFixed(1) + 'M'
  return '$' + v.toFixed(0)
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-2">{children}</p>
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl glass-card border border-[rgba(59,130,246,0.25)] px-4 py-3', className)}>
      {children}
    </div>
  )
}

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
  if (grade === 'B+' || grade === 'B') return 'text-blue-400 bg-blue-500/15 border-blue-500/25'
  if (grade === 'C')                   return 'text-amber-400 bg-amber-500/15 border-amber-500/25'
  if (grade === 'D')                   return 'text-orange-400 bg-orange-500/15 border-orange-500/25'
  return 'text-red-400 bg-red-500/15 border-red-500/25'
}

export default function OverviewSidebar({ quote, cagrAnalysis, businessProfile, wacc, analystRecommendation, ratings, valuationMethods }: Props) {
  const { price, fiftyTwoWeekHigh, fiftyTwoWeekLow, analystTargetMean, peRatio, marketCap } = quote

  // 52-week range
  const rangeSpan = fiftyTwoWeekHigh - fiftyTwoWeekLow
  const pricePct  = rangeSpan > 0 ? Math.max(0, Math.min(1, (price - fiftyTwoWeekLow) / rangeSpan)) : 0.5
  const targetPct = rangeSpan > 0 && analystTargetMean > 0
    ? Math.max(0, Math.min(1, (analystTargetMean - fiftyTwoWeekLow) / rangeSpan))
    : null

  const recNorm = (analystRecommendation ?? '').toLowerCase()
  const isBuy   = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell  = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
  const recColor = isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-amber-400'
  const recBg    = isBuy ? 'bg-emerald-500/15 border-emerald-500/20' : isSell ? 'bg-red-500/15 border-red-500/20' : 'bg-amber-500/15 border-amber-500/20'

  const targetUpside = analystTargetMean && price > 0 ? (analystTargetMean - price) / price : null

  // Valuation summary from triangulation
  const blendedFV: number | null = valuationMethods?.triangulatedFairValue ?? null
  const blendedUpside: number | null = valuationMethods?.triangulatedUpsidePct ?? null

  const ratingCategories: { label: string; key: keyof Ratings }[] = [
    { label: 'Profitability', key: 'profitability' },
    { label: 'Liquidity',     key: 'liquidity'     },
    { label: 'Growth',        key: 'growth'        },
    { label: 'Moat',          key: 'moat'          },
    { label: 'Valuation',     key: 'valuation'     },
  ]

  const sym = quote.currency === 'USD' ? '$' : quote.currency === 'BRL' ? 'R$' : quote.currency

  return (
    <div className="space-y-3">

      {/* Analyst Consensus */}
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
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-300">Avg. target</span>
            <div className="text-right">
              <span className="text-sm font-semibold text-white tabular-nums">
                {sym}{analystTargetMean.toFixed(2)}
              </span>
              {targetUpside != null && (
                <span className={cn('ml-1.5 text-[11px] font-semibold tabular-nums', targetUpside >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                  {targetUpside >= 0 ? '+' : ''}{(targetUpside * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Blended Fair Value (from multi-model triangulation) */}
      {blendedFV != null && (
        <Card>
          <SectionLabel>Intrinsic Value Estimate</SectionLabel>
          <div className="flex items-end justify-between mb-1">
            <span className="text-xl font-bold text-white tabular-nums">
              {sym}{blendedFV.toFixed(2)}
            </span>
            {blendedUpside != null && (
              <span className={cn(
                'text-sm font-bold tabular-nums mb-0.5',
                blendedUpside >= 0.15 ? 'text-emerald-400' : blendedUpside >= 0 ? 'text-emerald-300' : blendedUpside >= -0.15 ? 'text-amber-400' : 'text-red-400'
              )}>
                {blendedUpside >= 0 ? '+' : ''}{(blendedUpside * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">Blended DCF + Multiples estimate</p>
        </Card>
      )}

      {/* 52-Week Range */}
      <Card>
        <SectionLabel>52-Week Range</SectionLabel>
        <div className="relative h-1.5 rounded-full bg-white/10 mb-2">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500/60 via-amber-400/60 to-emerald-500/60"
            style={{ width: '100%' }}
          />
          {targetPct != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-sm bg-blue-400/80"
              style={{ left: `calc(${targetPct * 100}% - 2px)` }}
              title={`Analyst target: ${sym}${analystTargetMean.toFixed(2)}`}
            />
          )}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#0d1117] shadow"
            style={{ left: `calc(${pricePct * 100}% - 5px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
          <span>{sym}{fiftyTwoWeekLow.toFixed(2)}</span>
          <span className="text-white font-semibold">{sym}{price.toFixed(2)}</span>
          <span>{sym}{fiftyTwoWeekHigh.toFixed(2)}</span>
        </div>
        <div className="flex justify-between mt-0.5 text-[9px] text-slate-500">
          <span>52W Low</span>
          <span>Current</span>
          <span>52W High</span>
        </div>
      </Card>

      {/* Key Stats */}
      <Card>
        <SectionLabel>Key Stats</SectionLabel>
        <div className="space-y-1.5">
          {[
            { label: 'Market Cap',    value: fmtCap(marketCap) },
            { label: 'P/E (TTM)',     value: peRatio > 0 ? peRatio.toFixed(1) + '×' : '—' },
            { label: 'Gross Margin',  value: fmtPct(businessProfile.grossMargin) },
            { label: 'Net Margin',    value: fmtPct(businessProfile.netMargin) },
            { label: 'FCF Margin',    value: fmtPct(businessProfile.fcfMargin) },
            { label: 'Beta',          value: wacc?.inputs?.beta != null ? wacc.inputs.beta.toFixed(2) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-slate-300">{label}</span>
              <span className="text-[11px] font-semibold text-white tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Financial Health Grades */}
      {ratings && (
        <Card>
          <SectionLabel>Financial Health Grades</SectionLabel>
          <div className="space-y-1.5">
            {ratingCategories.map(({ label, key }) => {
              const cat = ratings[key]
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{cat.summary}</span>
                    <span className={cn('text-[11px] font-bold px-1.5 py-0 rounded border leading-5 shrink-0', gradeColor(cat.grade))}>
                      {cat.grade}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

    </div>
  )
}
