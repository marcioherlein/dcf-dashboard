'use client'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { PiotroskiResult, AltmanResult, BeneishResult, ROICResult } from '@/lib/dcf/calculateScores'
import { deriveVerdict } from '@/lib/stock/verdict'

interface Ratings {
  profitability: { grade: string }
  liquidity:     { grade: string }
  growth:        { grade: string }
  moat:          { grade: string }
  valuation:     { grade: string }
}

interface Scores {
  piotroski?: PiotroskiResult | null
  altman?:    AltmanResult    | null
  beneish?:   BeneishResult   | null
  roic?:      ROICResult      | null
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
  scores?: Scores | null
}

interface RedFlag {
  label: string
  level: 'danger' | 'warning'
}

function extractRedFlags(scores: Scores): RedFlag[] {
  const flags: RedFlag[] = []

  if (scores.beneish) {
    if (scores.beneish.flag === 'Manipulator') {
      flags.push({ label: 'Earnings manipulation risk', level: 'danger' })
    } else if (scores.beneish.flag === 'Warning') {
      flags.push({ label: 'Earnings quality concern', level: 'warning' })
    }
  }

  if (scores.altman) {
    if (scores.altman.zone === 'Distress') {
      flags.push({
        label: `Financial distress zone${!scores.altman.isReliable ? ' (EM)' : ''}`,
        level: 'danger',
      })
    }
  }

  if (scores.piotroski) {
    const hasRealData = scores.piotroski.criteria.some(
      c => c.pass !== null && !c.detail.includes('unavailable'),
    )
    if (hasRealData && scores.piotroski.score <= 2) {
      flags.push({ label: `Weak financials (F-Score: ${scores.piotroski.score}/9)`, level: 'warning' })
    }
  }

  if (scores.roic?.dataAvailable && scores.roic.spread < -0.02) {
    flags.push({ label: 'Value destruction (ROIC < WACC)', level: 'warning' })
  }

  return flags
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

type Decision = 'BUY' | 'WATCH' | 'AVOID'

function decisionFromUpside(upside: number): { decision: Decision; note: string } {
  if (upside >= 0.20) return { decision: 'BUY',   note: `Strong margin of safety — ${(upside * 100).toFixed(0)}% below fair value` }
  if (upside >= 0.05) return { decision: 'BUY',   note: `Moderate upside — ${(upside * 100).toFixed(0)}% below fair value` }
  if (upside >= -0.10) return { decision: 'WATCH', note: 'Near fair value — monitor for a better entry' }
  return { decision: 'AVOID', note: `${Math.abs(upside * 100).toFixed(0)}% above fair value estimate — wait for a better price` }
}

const DECISION_COLORS: Record<Decision, string> = {
  BUY:   'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D]',
  WATCH: 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]',
  AVOID: 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]',
}

function plainEnglishSummary(
  upside: number,
  price: number,
  fairValue: number,
  sym: string,
  quality: 'Strong' | 'Solid' | 'Mixed' | 'Weak' | null,
): string {
  const pricePer1 = fairValue > 0 ? (price / fairValue).toFixed(2) : null
  const isUnder = upside >= 0.10
  const isFair  = upside >= -0.10

  if (isUnder) {
    const value = pricePer1 != null
      ? `You're paying roughly ${sym}${pricePer1} for every ${sym}1.00 of estimated value — `
      : ''
    const quality_note = quality === 'Strong' || quality === 'Solid'
      ? 'and the fundamentals back it up.'
      : 'though check the quality grades below before acting.'
    return `${value}the model sees meaningful upside from here, ${quality_note}`
  }

  if (isFair) {
    return `The stock is trading close to the model's fair value estimate. You're paying roughly what the company appears to be worth today — no significant discount or premium.`
  }

  const pctAbove = Math.abs(upside * 100).toFixed(0)
  return `The stock appears to be trading about ${pctAbove}% above its estimated fair value. The market may be pricing in growth that the model doesn't yet see, or the stock may need time to grow into its valuation.`
}

const QUALITY_COLOR: Record<string, string> = {
  Strong: 'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]',
  Solid:  'text-[#2563EB] bg-[#EAF1FF] border-[#BFDBFE]',
  Mixed:  'text-[#B56A00] bg-[#FFF4DA] border-[#F3D391]',
  Weak:   'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]',
}

const CONFIDENCE_COLOR: Record<string, string> = {
  High:   'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]',
  Medium: 'text-[#B56A00] bg-[#FFF4DA] border-[#F3D391]',
  Low:    'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]',
}

export default function InvestorVerdictCard({
  upside, fairValue, price, currency, analystRecommendation, ratings, confidence, growthModel, scores,
}: Props) {
  if (upside == null || fairValue == null) return null

  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency
  const verdict  = deriveVerdict(upside, fairValue)
  const quality  = ratings ? overallQuality(ratings) : null

  const recNorm = (analystRecommendation ?? '').toLowerCase()
  const isBuy   = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell  = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const analystLabel = isBuy ? 'Analysts: Buy' : isSell ? 'Analysts: Sell' : 'Analysts: Hold'
  const analystColor = isBuy
    ? 'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]'
    : isSell
    ? 'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]'
    : 'text-[#B56A00] bg-[#FFF4DA] border-[#F3D391]'

  const summary = plainEnglishSummary(upside, price, fairValue, sym, quality)
  const flags = scores ? extractRedFlags(scores) : null
  const { decision, note } = decisionFromUpside(upside)

  return (
    <div className={cn('rounded-xl border px-4 sm:px-5 py-4 space-y-3', verdict.verdictBg)}>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('w-2 h-2 rounded-full shrink-0', verdict.verdictDot)} />
          <span className={cn('text-sm font-bold tracking-wide', verdict.verdictText)}>
            {verdict.key === 'attractive' ? 'Looks Attractive' :
             verdict.key === 'undervalued' ? 'Looks Undervalued' :
             verdict.key === 'fairly-valued' ? 'Fairly Valued' :
             'Looks Overvalued'}
          </span>
          <span className={cn('text-[12px] font-bold px-3 py-1 rounded-full border min-h-[32px] flex items-center', DECISION_COLORS[decision])}>
            {decision}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('text-[12px] font-semibold px-2.5 py-1 rounded-full border tabular-nums', verdict.verdictBadge)}>
            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}% vs fair value
          </span>
          <span className="text-[12px] text-[#536174] tabular-nums">
            FV {sym}{fairValue.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Plain English summary + margin of safety */}
      <p className="text-[13px] text-[#536174] leading-relaxed">{summary}</p>
      <p className={cn('text-[13px] font-medium leading-tight',
        decision === 'BUY' ? 'text-[#11875D]' : decision === 'WATCH' ? 'text-[#B56A00]' : 'text-[#D83B3B]'
      )}>
        {note}.
      </p>

      {/* Signal pills */}
      <div className="flex gap-2 flex-wrap pt-0.5">
        {quality && (
          <Tooltip>
            <TooltipTrigger
              render={<span className={cn('text-[12px] font-semibold px-2.5 py-1 rounded-full border cursor-help min-h-[32px] flex items-center', QUALITY_COLOR[quality])} />}
            >
              Business Quality: {quality}
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-center text-[11px]">
              Based on profitability, liquidity, economic moat, and Piotroski F-Score. Strong = company earns well and doesn&apos;t rely on debt.
            </TooltipContent>
          </Tooltip>
        )}
        <span className={cn('text-[12px] font-semibold px-2.5 py-1 rounded-full border min-h-[32px] flex items-center', analystColor)}>
          {analystLabel}
        </span>
        {confidence && (
          <Tooltip>
            <TooltipTrigger
              render={<span className={cn('text-[12px] font-semibold px-2.5 py-1 rounded-full border cursor-help min-h-[32px] flex items-center', CONFIDENCE_COLOR[confidence])} />}
            >
              Model confidence: {confidence}
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px] text-center text-[11px]">
              How reliable the fair value estimate is. High = analyst data + stable earnings. Low = limited data or volatile financials.
            </TooltipContent>
          </Tooltip>
        )}
        {growthModel && (
          <span className="text-[12px] text-[#536174] px-2.5 py-1 rounded-full border border-[#E3E6E0] bg-white min-h-[32px] flex items-center">
            {growthModel === 'three-stage' ? '3-stage DCF' : '2-stage DCF'}
          </span>
        )}
      </div>

      {/* Red flags row */}
      {flags !== null && (
        <div className={cn('flex flex-wrap gap-1.5 pt-0.5 border-t', verdict.verdictDivider)}>
          {flags.length === 0 ? (
            <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-[#E8F7EF] border border-[#A3D9BE] text-[#11875D] min-h-[32px] flex items-center">
              ✓ No major red flags
            </span>
          ) : (
            flags.map((flag, i) => (
              <span
                key={i}
                className={cn(
                  'text-[12px] font-semibold px-2.5 py-1 rounded-full border min-h-[32px] flex items-center',
                  flag.level === 'danger'
                    ? 'bg-[#FCEAEA] border-[#F0B8B8] text-[#D83B3B]'
                    : 'bg-[#FFF4DA] border-[#F3D391] text-[#B56A00]',
                )}
              >
                ⚠ {flag.label}
              </span>
            ))
          )}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-[#8A96A8] leading-tight border-t border-[#E3E6E0]/70 pt-2">
        Model-based estimate, not financial advice. Treat as one input alongside your own research.
      </p>
    </div>
  )
}
