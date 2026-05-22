'use client'
import { cn } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/info-tooltip'

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

interface IncomeRow {
  year: string
  revenue: number | null
  netIncome: number | null
  ebitda: number | null
  grossProfit: number | null
  operatingIncome: number | null
  isProjected: boolean
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
  financialStatements?: { incomeStatement: IncomeRow[] }
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

// API values are in millions — convert to B/T for display
function fmtShort(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e6)  return (v < 0 ? '-' : '') + '$' + (a / 1e6).toFixed(1) + 'T'
  if (a >= 1000) return (v < 0 ? '-' : '') + '$' + (a / 1000).toFixed(1) + 'B'
  return (v < 0 ? '-' : '') + '$' + a.toFixed(0) + 'M'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{children}</p>
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl bg-white border border-slate-200 px-5 py-4', className)}>
      {children}
    </div>
  )
}

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (grade === 'B+' || grade === 'B') return 'text-blue-600 bg-blue-50 border-blue-200'
  if (grade === 'C')                   return 'text-amber-600 bg-amber-50 border-amber-200'
  if (grade === 'D')                   return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

function MiniBarChart({
  bars,
  height = 40,
}: {
  bars: { label: string; value: number; color: string }[]
  height?: number
}) {
  const max = Math.max(...bars.map(b => Math.abs(b.value)))
  if (max === 0) return null
  const LABEL_H = 12
  const barAreaH = height - LABEL_H
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {bars.map(b => {
        const barH = Math.max(2, (Math.abs(b.value) / max) * barAreaH)
        return (
          <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-0.5">
            <div className={cn('w-full rounded-sm', b.color)} style={{ height: barH }} />
            <span className="text-[9px] text-slate-500 tabular-nums leading-none">{b.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function OverviewSidebar({
  quote, cagrAnalysis, businessProfile, wacc, analystRecommendation,
  ratings, valuationMethods, financialStatements,
}: Props) {
  const { price, fiftyTwoWeekHigh, fiftyTwoWeekLow, analystTargetMean, peRatio, marketCap } = quote

  const rangeSpan = fiftyTwoWeekHigh - fiftyTwoWeekLow
  const pricePct  = rangeSpan > 0 ? Math.max(0, Math.min(1, (price - fiftyTwoWeekLow) / rangeSpan)) : 0.5
  const targetPct = rangeSpan > 0 && analystTargetMean > 0
    ? Math.max(0, Math.min(1, (analystTargetMean - fiftyTwoWeekLow) / rangeSpan))
    : null

  const recNorm = (analystRecommendation ?? '').toLowerCase()
  const isBuy   = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell  = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
  const recColor = isBuy ? 'text-emerald-600' : isSell ? 'text-red-600' : 'text-amber-600'
  const recBg    = isBuy ? 'bg-emerald-50 border-emerald-200' : isSell ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
  const targetUpside = analystTargetMean && price > 0 ? (analystTargetMean - price) / price : null

  const blendedFV: number | null = valuationMethods?.triangulatedFairValue ?? null
  const blendedUpside: number | null = valuationMethods?.triangulatedUpsidePct ?? null

  const sym = quote.currency === 'USD' ? '$' : quote.currency === 'BRL' ? 'R$' : quote.currency

  // Revenue + Net Income historical rows (last 4 actual)
  const histRows = (financialStatements?.incomeStatement ?? [])
    .filter(r => !r.isProjected)
    .slice(-4)

  const revBars = histRows
    .filter(r => r.revenue != null)
    .map(r => ({
      label: r.year.slice(-2),
      value: r.revenue as number,
      color: 'bg-blue-400/60',
    }))

  const niBars = histRows
    .filter(r => r.netIncome != null)
    .map(r => ({
      label: r.year.slice(-2),
      value: r.netIncome as number,
      color: (r.netIncome as number) >= 0 ? 'bg-emerald-400/60' : 'bg-red-400/60',
    }))

  // Margin trend across last 4 years — use EBIT and Net (Gross unreliable from API)
  const marginRows = histRows.filter(r => r.revenue != null && r.revenue > 0)
  const ebitMargins = marginRows
    .filter(r => r.operatingIncome != null)
    .map(r => ({ year: r.year.slice(-2), v: (r.operatingIncome! / r.revenue!) * 100 }))
  const netMargins = marginRows
    .filter(r => r.netIncome != null)
    .map(r => ({ year: r.year.slice(-2), v: (r.netIncome! / r.revenue!) * 100 }))

  const ratingCategories: { label: string; key: keyof Ratings }[] = [
    { label: 'Profitability', key: 'profitability' },
    { label: 'Liquidity',     key: 'liquidity'     },
    { label: 'Growth',        key: 'growth'        },
    { label: 'Moat',          key: 'moat'          },
    { label: 'Valuation',     key: 'valuation'     },
  ]

  return (
    <div className="space-y-4">

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
            <span className="text-[10px] text-slate-500">Avg. target</span>
            <div className="text-right">
              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                {sym}{analystTargetMean.toFixed(2)}
              </span>
              {targetUpside != null && (
                <span className={cn('ml-1.5 text-[11px] font-semibold tabular-nums', targetUpside >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {targetUpside >= 0 ? '+' : ''}{(targetUpside * 100).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Intrinsic Value Estimate */}
      {blendedFV != null && (
        <Card>
          <SectionLabel>Intrinsic Value Estimate</SectionLabel>
          <div className="flex items-end justify-between mb-1">
            <span className="text-xl font-bold text-slate-900 tabular-nums">
              {sym}{blendedFV.toFixed(2)}
            </span>
            {blendedUpside != null && (
              <span className={cn(
                'text-sm font-bold tabular-nums mb-0.5',
                blendedUpside >= 0.15 ? 'text-emerald-600' : blendedUpside >= 0 ? 'text-emerald-500' : blendedUpside >= -0.15 ? 'text-amber-600' : 'text-red-600'
              )}>
                {blendedUpside >= 0 ? '+' : ''}{(blendedUpside * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">Blended DCF + multiples estimate</p>
        </Card>
      )}

      {/* 52-Week Range */}
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

      {/* Key Stats */}
      <Card>
        <SectionLabel>Key Stats</SectionLabel>
        <div className="space-y-1.5">
          {[
            { label: 'Market Cap',   value: fmtCap(marketCap),                                              tip: 'Total market value of all shares outstanding. Large-cap (>$10B) stocks are generally more stable; small-cap (<$2B) stocks carry more risk and growth potential.' },
            { label: 'P/E (TTM)',    value: peRatio > 0 ? peRatio.toFixed(1) + '×' : '—',                  tip: 'Price-to-Earnings based on the last 12 months of profits. Tells you how much the market pays per dollar of earnings. High P/E = high growth expectations; low P/E = cheaper or slower growth.' },
            { label: 'Gross Margin', value: fmtPct(businessProfile.grossMargin),                           tip: 'Revenue minus cost of goods sold, as a % of revenue. Higher = more pricing power. Software companies often exceed 70%; retailers may be 20–30%.' },
            { label: 'Net Margin',   value: fmtPct(businessProfile.netMargin),                             tip: 'Profit after all expenses (including taxes and interest) as a % of revenue. What the company actually keeps from each dollar of sales.' },
            { label: 'FCF Margin',   value: fmtPct(businessProfile.fcfMargin),                             tip: 'Free Cash Flow as a % of revenue — the cash left after maintaining and growing the business. Often more reliable than net income as it\'s harder to manipulate.' },
            { label: 'Beta',         value: wacc?.inputs?.beta != null ? wacc.inputs.beta.toFixed(2) : '—', tip: 'How much this stock moves relative to the broader market. Beta 1.5 means it moves ~50% more than the market in both directions. Higher beta = higher risk and potential reward.' },
          ].map(({ label, value, tip }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                {label}
                <InfoTooltip text={tip} side="left" />
              </span>
              <span className="text-[11px] font-semibold text-slate-900 tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Revenue Trend */}
      {revBars.length >= 2 && (
        <Card>
          <SectionLabel>Annual Revenue</SectionLabel>
          <MiniBarChart bars={revBars} height={44} />
          <div className="flex justify-between mt-1 text-[9px] text-slate-500 tabular-nums">
            {histRows.filter(r => r.revenue != null).map(r => (
              <span key={r.year}>{fmtShort(r.revenue!)}</span>
            ))}
          </div>
          {histRows.length >= 2 && histRows[0].revenue && histRows[histRows.length - 1].revenue && (
            (() => {
              const first = histRows.find(r => r.revenue != null)?.revenue ?? 0
              const last  = [...histRows].reverse().find(r => r.revenue != null)?.revenue ?? 0
              const cagr  = first > 0 && histRows.length > 1
                ? Math.pow(last / first, 1 / (histRows.length - 1)) - 1 : null
              return cagr != null ? (
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Rev. CAGR (3Y): <span className={cn('font-semibold', cagr >= 0.1 ? 'text-emerald-600' : cagr >= 0 ? 'text-slate-600' : 'text-red-600')}>
                    {cagr >= 0 ? '+' : ''}{(cagr * 100).toFixed(1)}%
                  </span>
                </p>
              ) : null
            })()
          )}
        </Card>
      )}

      {/* Net Income Trend */}
      {niBars.length >= 2 && (
        <Card>
          <SectionLabel>Net Income</SectionLabel>
          <MiniBarChart bars={niBars} height={44} />
          <div className="flex justify-between mt-1 text-[9px] text-slate-500 tabular-nums">
            {histRows.filter(r => r.netIncome != null).map(r => (
              <span key={r.year}>{fmtShort(r.netIncome!)}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Margin Trend */}
      {(ebitMargins.length >= 2 || netMargins.length >= 2) && (
        <Card>
          <SectionLabel>Margin Trend</SectionLabel>
          {/* Header row */}
          <div className="flex justify-between text-[9px] text-slate-500 mb-1.5">
            <span>Year</span>
            <div className="flex gap-4">
              {ebitMargins.length >= 2 && <span className="text-emerald-500/80">EBIT</span>}
              {netMargins.length   >= 2 && <span className="text-blue-400/80">Net</span>}
            </div>
          </div>
          <div className="space-y-1">
            {marginRows.map((r, i) => {
              const ebit = ebitMargins[i]?.v
              const net  = netMargins[i]?.v
              return (
                <div key={r.year} className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{r.year.slice(-2)}</span>
                  <div className="flex gap-4">
                    {ebitMargins.length >= 2 && (
                      <span className={cn('text-[10px] font-semibold tabular-nums text-right w-10',
                        ebit != null && ebit >= 15 ? 'text-emerald-600' : ebit != null && ebit >= 5 ? 'text-emerald-500' : 'text-amber-600'
                      )}>
                        {ebit != null ? ebit.toFixed(1) + '%' : '—'}
                      </span>
                    )}
                    {netMargins.length >= 2 && (
                      <span className={cn('text-[10px] font-semibold tabular-nums text-right w-10',
                        net != null && net >= 15 ? 'text-emerald-600' : net != null && net >= 5 ? 'text-blue-600' : 'text-amber-600'
                      )}>
                        {net != null ? net.toFixed(1) + '%' : '—'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Financial Health Grades */}
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
