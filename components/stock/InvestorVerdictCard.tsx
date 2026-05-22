'use client'
import { cn } from '@/lib/utils'

interface Ratings {
  profitability: { grade: string }
  liquidity:     { grade: string }
  growth:        { grade: string }
  moat:          { grade: string }
  valuation:     { grade: string }
}

interface Props {
  upside: number | null
  fairValue: number | null
  price: number
  currency: string
  analystRecommendation: string
  ratings?: Ratings | null
  confidence?: 'High' | 'Medium' | 'Low'
  growthModel?: 'two-stage' | 'three-stage'
}

function gradeToScore(g: string): number {
  return { 'A+': 5, 'A': 4, 'B+': 3.5, 'B': 3, 'C': 2, 'D': 1, 'F': 0 }[g] ?? 2
}

function overallQuality(ratings: Ratings): 'Strong' | 'Solid' | 'Mixed' | 'Weak' {
  const keys: (keyof Ratings)[] = ['profitability', 'liquidity', 'growth', 'moat']
  const avg = keys.reduce((s, k) => s + gradeToScore(ratings[k].grade), 0) / keys.length
  if (avg >= 3.5) return 'Strong'
  if (avg >= 2.5) return 'Solid'
  if (avg >= 1.5) return 'Mixed'
  return 'Weak'
}

function verdictFromUpside(upside: number): 'undervalued' | 'fairly-valued' | 'overvalued' {
  if (upside >= 0.10) return 'undervalued'
  if (upside >= -0.10) return 'fairly-valued'
  return 'overvalued'
}

function plainEnglishSummary(
  upside: number,
  price: number,
  fairValue: number,
  sym: string,
  quality: 'Strong' | 'Solid' | 'Mixed' | 'Weak' | null,
): string {
  const pricePer1 = fairValue > 0 ? (price / fairValue).toFixed(2) : null
  const verdict = verdictFromUpside(upside)

  if (verdict === 'undervalued') {
    const value = pricePer1 != null
      ? `You're paying roughly ${sym}${pricePer1} for every ${sym}1.00 of estimated value — `
      : ''
    const quality_note = quality === 'Strong' || quality === 'Solid'
      ? 'and the fundamentals back it up.'
      : 'though check the quality grades below before acting.'
    return `${value}the model sees meaningful upside from here, ${quality_note}`
  }

  if (verdict === 'fairly-valued') {
    return `The stock is trading close to the model's fair value estimate. You're paying roughly what the company appears to be worth today — no significant discount or premium.`
  }

  // overvalued
  const pctAbove = Math.abs(upside * 100).toFixed(0)
  return `The stock appears to be trading about ${pctAbove}% above its estimated fair value. The market may be pricing in growth that the model doesn't yet see, or the stock may need time to grow into its valuation.`
}

const VERDICT_CONFIG = {
  'undervalued': {
    label: 'Looks Undervalued',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    badge: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300',
  },
  'fairly-valued': {
    label: 'Fairly Valued',
    bg: 'bg-blue-500/10 border-blue-500/30',
    dot: 'bg-blue-400',
    text: 'text-blue-400',
    badge: 'bg-blue-500/15 border-blue-500/25 text-blue-300',
  },
  'overvalued': {
    label: 'Looks Overvalued',
    bg: 'bg-amber-500/10 border-amber-500/30',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    badge: 'bg-amber-500/15 border-amber-500/25 text-amber-300',
  },
}

const QUALITY_COLOR: Record<string, string> = {
  Strong: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
  Solid:  'text-blue-400 bg-blue-500/15 border-blue-500/25',
  Mixed:  'text-amber-400 bg-amber-500/15 border-amber-500/25',
  Weak:   'text-red-400 bg-red-500/15 border-red-500/25',
}

const CONFIDENCE_COLOR: Record<string, string> = {
  High:   'text-emerald-400 bg-emerald-500/15 border-emerald-500/25',
  Medium: 'text-amber-400 bg-amber-500/15 border-amber-500/25',
  Low:    'text-slate-400 bg-slate-500/15 border-slate-500/25',
}

export default function InvestorVerdictCard({
  upside, fairValue, price, currency, analystRecommendation, ratings, confidence, growthModel,
}: Props) {
  if (upside == null || fairValue == null) return null

  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency
  const verdict = verdictFromUpside(upside)
  const config  = VERDICT_CONFIG[verdict]
  const quality = ratings ? overallQuality(ratings) : null

  const recNorm = (analystRecommendation ?? '').toLowerCase()
  const isBuy   = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell  = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const analystLabel = isBuy ? 'Analysts: Buy' : isSell ? 'Analysts: Sell' : 'Analysts: Hold'
  const analystColor = isBuy
    ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25'
    : isSell
    ? 'text-red-400 bg-red-500/15 border-red-500/25'
    : 'text-amber-400 bg-amber-500/15 border-amber-500/25'

  const summary = plainEnglishSummary(upside, price, fairValue, sym, quality)

  return (
    <div className={cn('rounded-xl border px-5 py-4 space-y-3', config.bg)}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full shrink-0', config.dot)} />
          <span className={cn('text-sm font-bold tracking-wide', config.text)}>
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Upside badge */}
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border tabular-nums', config.badge)}>
            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}% vs fair value
          </span>
          {/* Fair value */}
          <span className="text-xs text-slate-400 tabular-nums">
            FV {sym}{fairValue.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Plain English summary */}
      <p className="text-[12px] text-slate-300 leading-relaxed">{summary}</p>

      {/* Signal pills */}
      <div className="flex gap-2 flex-wrap pt-0.5">
        {quality && (
          <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', QUALITY_COLOR[quality])}>
            Quality: {quality}
          </span>
        )}
        <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', analystColor)}>
          {analystLabel}
        </span>
        {confidence && (
          <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', CONFIDENCE_COLOR[confidence])}>
            Model confidence: {confidence}
          </span>
        )}
        {growthModel && (
          <span className="text-[11px] text-slate-500 px-2.5 py-0.5 rounded-full border border-slate-700">
            {growthModel === 'three-stage' ? '3-stage DCF' : '2-stage DCF'}
          </span>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-slate-600 leading-tight border-t border-white/5 pt-2">
        This is a model-based estimate, not financial advice. All valuations involve assumptions — treat this as one input alongside your own research.
      </p>
    </div>
  )
}
