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

interface Ownership {
  insiderPct: number | null
  institutionalPct: number | null
  shortPct: number | null
  shortRatio: number | null
}

interface WACCInputs {
  beta: number
}

interface Props {
  quote: Quote
  cagrAnalysis: CAGRAnalysis
  businessProfile: BusinessProfile
  ownership?: Ownership
  wacc?: { inputs: WACCInputs }
  analystRecommendation: string
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
  return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{children}</p>
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl glass-card border-[rgba(59,130,246,0.15)] px-4 py-3', className)}>
      {children}
    </div>
  )
}

export default function OverviewSidebar({ quote, cagrAnalysis, businessProfile, ownership, wacc, analystRecommendation }: Props) {
  const { price, fiftyTwoWeekHigh, fiftyTwoWeekLow, analystTargetMean, peRatio, marketCap } = quote

  // 52-week range
  const rangeSpan = fiftyTwoWeekHigh - fiftyTwoWeekLow
  const pricePct  = rangeSpan > 0 ? Math.max(0, Math.min(1, (price - fiftyTwoWeekLow) / rangeSpan)) : 0.5
  const targetPct = rangeSpan > 0 ? Math.max(0, Math.min(1, (analystTargetMean - fiftyTwoWeekLow) / rangeSpan)) : null

  // Analyst recommendation label → rough buy/hold/sell
  const recNorm = (analystRecommendation ?? '').toLowerCase()
  const isBuy   = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell  = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
  const recColor = isBuy ? 'text-emerald-400' : isSell ? 'text-red-400' : 'text-amber-400'
  const recBg    = isBuy ? 'bg-emerald-500/15 border-emerald-500/20' : isSell ? 'bg-red-500/15 border-red-500/20' : 'bg-amber-500/15 border-amber-500/20'

  const targetUpside = analystTargetMean && price > 0 ? (analystTargetMean - price) / price : null

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
            <span className="text-[11px] text-slate-400">Avg. target</span>
            <div className="text-right">
              <span className="text-sm font-semibold text-slate-100 tabular-nums">
                ${analystTargetMean.toFixed(2)}
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

      {/* 52-Week Range */}
      <Card>
        <SectionLabel>52-Week Range</SectionLabel>
        <div className="relative h-1.5 rounded-full bg-white/10 mb-2">
          {/* Gradient fill */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500/60 via-amber-400/60 to-emerald-500/60"
            style={{ width: '100%' }}
          />
          {/* Analyst target marker */}
          {targetPct != null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-sm bg-blue-400/80"
              style={{ left: `calc(${targetPct * 100}% - 2px)` }}
              title={`Analyst target: $${analystTargetMean.toFixed(2)}`}
            />
          )}
          {/* Current price dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#0d1117] shadow"
            style={{ left: `calc(${pricePct * 100}% - 5px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
          <span>${fiftyTwoWeekLow.toFixed(2)}</span>
          <span className="text-slate-300 font-semibold">${price.toFixed(2)}</span>
          <span>${fiftyTwoWeekHigh.toFixed(2)}</span>
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
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { label: 'Market Cap',  value: fmtCap(marketCap) },
            { label: 'P/E (TTM)',   value: peRatio > 0 ? peRatio.toFixed(1) + '×' : '—' },
            { label: 'FCF Margin',  value: fmtPct(businessProfile.fcfMargin) },
            { label: 'Beta',        value: wacc?.inputs?.beta != null ? wacc.inputs.beta.toFixed(2) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-slate-400">{label}</p>
              <p className="text-sm font-semibold text-slate-100 tabular-nums leading-tight">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Ownership */}
      {ownership && (
        <Card>
          <SectionLabel>Ownership</SectionLabel>
          <div className="space-y-1.5">
            {[
              { label: 'Insider',        value: fmtPct(ownership.insiderPct) },
              { label: 'Institutional',  value: fmtPct(ownership.institutionalPct) },
              { label: 'Short Float',    value: fmtPct(ownership.shortPct) },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{label}</span>
                <span className="text-[11px] font-semibold text-slate-200 tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  )
}
