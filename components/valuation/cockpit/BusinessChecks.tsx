'use client'

import { fmtPrice } from '@/lib/formatters'
import type { StarRatingResult, UncertaintyLevel } from '@/lib/valuation/valueInvestingAnalysis'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  roic: number | null
  roicSpread: number | null
  wacc: number
  epvGrowthPremiumPct: number | null
  epvPerShare: number | null
  currentPrice: number
  currency: string
  fcfYield: number | null
  rfRate: number | null
  marketImpliedGrowth: number | null
  marketImpliedText: string
  priceToBook: number | null
  pbSectorMedian: number | null
  sector: string | null
  starRating: StarRatingResult | null
  uncertainty: UncertaintyLevel | null
  structuralRisk?: string | null
  countryRisk?: string | null
}

// ─── Sector gate for P/B card ─────────────────────────────────────────────────

const ASSET_HEAVY_SECTORS = new Set([
  'Financial Services',
  'Real Estate',
  'Utilities',
  'Industrials',
  'Basic Materials',
])

// ─── Shared card shell ────────────────────────────────────────────────────────

type Signal = 'green' | 'amber' | 'red' | 'slate'

const SIGNAL_STYLES: Record<Signal, { border: string; verdict: string; badge: string; badgeBg: string }> = {
  green: {
    border: 'border-[#A3D9BE]',
    verdict: 'text-[#11875D]',
    badge: 'text-[#11875D]',
    badgeBg: 'bg-[#E8F7EF] border-[#A3D9BE]',
  },
  amber: {
    border: 'border-[#F3D391]',
    verdict: 'text-[#B56A00]',
    badge: 'text-[#B56A00]',
    badgeBg: 'bg-[#FFF4DA] border-[#F3D391]',
  },
  red: {
    border: 'border-[#F0B8B8]',
    verdict: 'text-[#D83B3B]',
    badge: 'text-[#D83B3B]',
    badgeBg: 'bg-[#FCEAEA] border-[#F0B8B8]',
  },
  slate: {
    border: 'border-[#E5E5E5]',
    verdict: 'text-[#6B6B6B]',
    badge: 'text-[#6B6B6B]',
    badgeBg: 'bg-[#F5F5F5] border-[#E5E5E5]',
  },
}

function CheckCard({
  question, verdict, signal, badge, metrics,
}: {
  question: string
  verdict: string
  signal: Signal
  badge: string
  metrics: Array<{ label: string; value: string }>
}) {
  const s = SIGNAL_STYLES[signal]
  return (
    <div className={`bg-white rounded-xl border ${s.border} px-4 py-3.5 flex flex-col gap-2.5`}>
      <p className="text-[10px] text-[#9B9B9B] leading-tight">{question}</p>
      <div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-[700] px-2 py-0.5 rounded-full border ${s.badge} ${s.badgeBg}`}>
          {badge}
        </span>
      </div>
      <p className={`text-[12px] font-[650] leading-snug ${s.verdict}`}>{verdict}</p>
      {metrics.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 border-t border-[#E5E5E5]">
          {metrics.map(m => (
            <div key={m.label}>
              <p className="text-[11px] text-[#9B9B9B] leading-none mb-0.5">{m.label}</p>
              <p className="text-[11px] font-[650] text-[#111111] tabular-nums">{m.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Star rating ──────────────────────────────────────────────────────────────

const STAR_COLOR: Record<number, string> = {
  5: 'text-[#11875D]', 4: 'text-emerald-400',
  3: 'text-amber-400',   2: 'text-orange-400', 1: 'text-[#D83B3B]',
}

const UNCERTAINTY_DOT: Record<UncertaintyLevel, string> = {
  'Low': 'bg-[#11875D]', 'Medium': 'bg-[#B56A00]',
  'High': 'bg-orange-400', 'Very High': 'bg-[#D83B3B]',
}

function StarRow({ starRating, uncertainty }: { starRating: StarRatingResult | null; uncertainty: UncertaintyLevel | null }) {
  if (!starRating) return null
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-0.5" aria-label={`${starRating.stars} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, i) => (
          <svg
            key={i}
            className={`w-3 h-3 ${i < starRating.stars ? STAR_COLOR[starRating.stars] : 'text-[#CDD1C8]'}`}
            fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="text-[11px] font-[650] text-[#111111]">{starRating.label}</span>
      {uncertainty && (
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${UNCERTAINTY_DOT[uncertainty]}`} />
          <span className="text-[10px] text-[#6B6B6B]">{uncertainty} uncertainty</span>
        </div>
      )}
    </div>
  )
}

// ─── Card builders ────────────────────────────────────────────────────────────

function buildRoicCard(roic: number | null, roicSpread: number | null, wacc: number) {
  if (roic == null) {
    return { question: 'Does this business create value?', verdict: 'ROIC data unavailable', signal: 'slate' as Signal, badge: 'No data', metrics: [] }
  }
  const spread = roicSpread ?? (roic - wacc)
  const spreadPp = (Math.abs(spread) * 100).toFixed(1)
  const sign = spread >= 0 ? '+' : '-'

  let signal: Signal
  let badge: string
  let verdict: string

  if (spread > 0.10) {
    signal = 'green'; badge = 'Wide moat'
    verdict = `Earns ${sign}${spreadPp}pp above cost of capital — generates real economic value`
  } else if (spread > 0) {
    signal = 'amber'; badge = 'Narrow moat'
    verdict = `Earns ${sign}${spreadPp}pp above cost of capital — modest value creation`
  } else {
    signal = 'red'; badge = 'No moat'
    verdict = `${spreadPp}pp below cost of capital — destroying shareholder value`
  }

  return {
    question: 'Does this business create value?',
    verdict,
    signal,
    badge,
    metrics: [
      { label: 'ROIC', value: `${(roic * 100).toFixed(1)}%` },
      { label: 'WACC', value: `${(wacc * 100).toFixed(1)}%` },
      { label: 'Spread', value: `${sign}${spreadPp}pp` },
    ],
  }
}

function buildEpvCard(
  growthPremiumPct: number | null,
  epvPerShare: number | null,
  currentPrice: number,
  currency: string,
) {
  if (growthPremiumPct == null || epvPerShare == null) {
    return { question: 'What are you paying for growth?', verdict: 'Earnings power data unavailable', signal: 'slate' as Signal, badge: 'No data', metrics: [] }
  }

  const pct = Math.round(growthPremiumPct * 100)

  let signal: Signal
  let badge: string
  let verdict: string

  if (growthPremiumPct <= 0) {
    signal = 'green'; badge = 'No growth priced in'
    verdict = 'Trades at or below its no-growth earnings power — growth is free'
  } else if (pct < 30) {
    signal = 'green'; badge = 'Low premium'
    verdict = `${pct}% of today's price is growth premium — well-supported by current earnings`
  } else if (pct < 65) {
    signal = 'amber'; badge = 'Moderate premium'
    verdict = `${pct}% of today's price is a bet on future growth`
  } else {
    signal = 'red'; badge = 'High premium'
    verdict = `${pct}% of price is growth premium — fragile if growth disappoints`
  }

  return {
    question: 'What are you paying for growth?',
    verdict,
    signal,
    badge,
    metrics: [
      { label: 'No-growth value', value: fmtPrice(epvPerShare, currency) },
      { label: 'Current price', value: fmtPrice(currentPrice, currency) },
    ],
  }
}

function buildBondsCard(fcfYield: number | null, rfRate: number | null) {
  if (fcfYield == null || rfRate == null) {
    return { question: 'Does the yield justify the risk?', verdict: 'FCF or rate data unavailable', signal: 'slate' as Signal, badge: 'No data', metrics: [] }
  }

  const spread = fcfYield - rfRate
  const spreadPp = (Math.abs(spread) * 100).toFixed(1)
  const sign = spread >= 0 ? '+' : '-'

  let signal: Signal
  let badge: string
  let verdict: string

  if (spread > 0.02) {
    signal = 'green'; badge = 'Compensated'
    verdict = `${sign}${spreadPp}pp above the 10-yr treasury — equity risk is compensated`
  } else if (spread >= 0) {
    signal = 'amber'; badge = 'Thin margin'
    verdict = `Only ${spreadPp}pp above treasury — thin margin vs a risk-free bond`
  } else {
    signal = 'red'; badge = 'Bonds pay more'
    verdict = `${spreadPp}pp below treasury — bonds currently pay more than this stock's FCF yield`
  }

  return {
    question: 'Does the yield justify the risk?',
    verdict,
    signal,
    badge,
    metrics: [
      { label: 'FCF yield', value: `${(fcfYield * 100).toFixed(1)}%` },
      { label: '10-yr treasury', value: `${(rfRate * 100).toFixed(1)}%` },
      { label: 'Spread', value: `${sign}${spreadPp}pp` },
    ],
  }
}

function buildReverseDcfCard(impliedGrowth: number | null, impliedText: string) {
  if (impliedGrowth == null || impliedText.includes('not_meaningful') || impliedText === '') {
    return { question: 'What growth does today\'s price assume?', verdict: 'Insufficient data to compute implied growth rate', signal: 'slate' as Signal, badge: 'No data', metrics: [] }
  }

  // Derive signal from interpretation keywords in the text
  let signal: Signal
  let badge: string

  if (impliedText.toLowerCase().includes('very aggressive')) {
    signal = 'red'; badge = 'Very aggressive'
  } else if (impliedText.toLowerCase().includes('aggressive')) {
    signal = 'amber'; badge = 'Aggressive'
  } else if (impliedText.toLowerCase().includes('conservative')) {
    signal = 'green'; badge = 'Conservative'
  } else {
    signal = 'green'; badge = 'Reasonable'
  }

  return {
    question: 'What growth does today\'s price assume?',
    verdict: impliedText,
    signal,
    badge,
    metrics: [
      { label: 'Implied CAGR', value: `${(impliedGrowth * 100).toFixed(1)}%` },
    ],
  }
}

function buildPbCard(
  priceToBook: number | null,
  pbSectorMedian: number | null,
  sector: string | null,
) {
  if (priceToBook == null) {
    return { question: 'How does the market value its asset base?', verdict: 'Price-to-book data unavailable', signal: 'slate' as Signal, badge: 'No data', metrics: [] }
  }

  const sectorLabel = sector ?? 'sector'

  if (pbSectorMedian == null || pbSectorMedian <= 0) {
    return {
      question: 'How does the market value its asset base?',
      verdict: `Trades at ${priceToBook.toFixed(1)}x book value`,
      signal: 'slate' as Signal,
      badge: `${priceToBook.toFixed(1)}x book`,
      metrics: [{ label: 'P/B', value: `${priceToBook.toFixed(1)}x` }],
    }
  }

  const premium = (priceToBook - pbSectorMedian) / pbSectorMedian
  const premiumPct = Math.abs(Math.round(premium * 100))

  let signal: Signal
  let badge: string
  let verdict: string

  if (premium < -0.05) {
    signal = 'green'; badge = `${premiumPct}% below median`
    verdict = `Trades at ${priceToBook.toFixed(1)}x book — ${premiumPct}% discount to ${sectorLabel} median of ${pbSectorMedian.toFixed(1)}x`
  } else if (premium <= 0.20) {
    signal = 'amber'; badge = 'In line with sector'
    verdict = `Trades at ${priceToBook.toFixed(1)}x book — broadly in line with ${sectorLabel} median of ${pbSectorMedian.toFixed(1)}x`
  } else {
    signal = 'red'; badge = `${premiumPct}% above median`
    verdict = `Trades at ${priceToBook.toFixed(1)}x book — ${premiumPct}% premium to ${sectorLabel} median of ${pbSectorMedian.toFixed(1)}x`
  }

  return {
    question: 'How does the market value its asset base?',
    verdict,
    signal,
    badge,
    metrics: [
      { label: 'P/B', value: `${priceToBook.toFixed(1)}x` },
      { label: 'Sector median', value: `${pbSectorMedian.toFixed(1)}x` },
    ],
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BusinessChecks({
  roic, roicSpread, wacc,
  epvGrowthPremiumPct, epvPerShare,
  currentPrice, currency,
  fcfYield, rfRate,
  marketImpliedGrowth, marketImpliedText,
  priceToBook, pbSectorMedian, sector,
  starRating, uncertainty,
  structuralRisk, countryRisk,
}: Props) {
  const showPb = ASSET_HEAVY_SECTORS.has(sector ?? '')

  const roicCard     = buildRoicCard(roic, roicSpread, wacc)
  const epvCard      = buildEpvCard(epvGrowthPremiumPct, epvPerShare, currentPrice, currency)
  const bondsCard    = buildBondsCard(fcfYield, rfRate)
  const reverseDcf   = buildReverseDcfCard(marketImpliedGrowth, marketImpliedText)
  const pbCard       = showPb ? buildPbCard(priceToBook, pbSectorMedian, sector) : null

  const gridCols = showPb
    ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
    : 'grid-cols-2 lg:grid-cols-4'

  return (
    <div className="bg-white rounded-[20px] border border-[#E5E5E5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <p className="text-[12px] font-[650] text-[#6B6B6B]">Independent Checks</p>
          <p className="text-[11px] text-[#6B6B6B]">Each check asks a different question. Not blended into the fair value.</p>
        </div>
        <StarRow starRating={starRating} uncertainty={uncertainty} />
      </div>

      {/* Risk badges */}
      {(structuralRisk || countryRisk) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {structuralRisk && (
            <a
              href="#model_evidence"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FCEAEA] border border-[#F0B8B8] text-[10px] font-[700] text-[#D83B3B] hover:bg-[#FCEAEA] transition-colors"
              title={structuralRisk}
            >
              <span aria-hidden="true">⚑</span>
              <span>Structural risk — see model evidence</span>
            </a>
          )}
          {countryRisk && (
            <a
              href="#model_evidence"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFF4DA] border border-[#F3D391] text-[10px] font-[700] text-[#B56A00] hover:bg-[#FFF4DA] transition-colors"
              title={countryRisk}
            >
              <span aria-hidden="true">⚠</span>
              <span>High country risk — see model evidence</span>
            </a>
          )}
        </div>
      )}

      {/* Cards grid */}
      <div className={`grid ${gridCols} gap-3`}>
        <CheckCard {...roicCard} />
        <CheckCard {...epvCard} />
        <CheckCard {...bondsCard} />
        <CheckCard {...reverseDcf} />
        {pbCard && <CheckCard {...pbCard} />}
      </div>
    </div>
  )
}
