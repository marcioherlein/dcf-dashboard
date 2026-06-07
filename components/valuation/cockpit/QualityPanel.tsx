'use client'

import type { UncertaintyLevel, StarRatingResult } from '@/lib/valuation/valueInvestingAnalysis'
import ScenarioRangeBar from '@/components/ui/ScenarioRangeBar'

interface Props {
  roic: number | null
  roicSpread: number | null
  wacc: number
  starRating: StarRatingResult | null
  uncertainty: UncertaintyLevel | null
  bearFV: number | null
  bullFV: number | null
  blendedFV: number | null
  currentPrice: number
  currency: string
  structuralRisk?: string | null
  countryRisk?: string | null
}

const UNCERTAINTY_STYLE: Record<UncertaintyLevel, { label: string; dot: string; text: string }> = {
  'Low':       { label: 'Low uncertainty',       dot: 'bg-[#11875D]', text: 'text-[#11875D]' },
  'Medium':    { label: 'Medium uncertainty',     dot: 'bg-[#B56A00]',   text: 'text-[#B56A00]'   },
  'High':      { label: 'High uncertainty',       dot: 'bg-orange-400',  text: 'text-orange-700'  },
  'Very High': { label: 'Very high uncertainty',  dot: 'bg-[#D83B3B]',     text: 'text-[#D83B3B]'     },
}

const STAR_COLOR: Record<number, string> = {
  5: 'text-[#11875D]',
  4: 'text-emerald-400',
  3: 'text-amber-400',
  2: 'text-orange-400',
  1: 'text-[#D83B3B]',
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i < count ? STAR_COLOR[count] : 'text-[#CDD1C8]'}`}
          fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// ── Moat Gauge ────────────────────────────────────────────────────────────────

function MoatGauge({ roic, roicSpread, wacc }: { roic: number | null; roicSpread: number | null; wacc: number }) {
  if (roic == null) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] font-[600] text-[#566174]">ROIC / WACC Spread</p>
        <p className="text-[11px] text-[#8A95A6]">ROIC data unavailable</p>
      </div>
    )
  }

  const spread = roicSpread ?? (roic - wacc)
  const hasPositiveSpread = spread > 0

  // Clamp ROIC to 0–100% for the gauge (handles >100% ROIC like NVDA)
  const roicClamped = Math.min(roic, 1.0)
  const waccNorm    = Math.min(wacc, 1.0)

  // Gauge: WACC is the divider; ROIC dot placed relative to WACC
  const waccPct = waccNorm * 100  // e.g. 10%
  const roicPct = Math.min(roicClamped * 100, 90)  // cap visual at 90% width

  const moatLabel = hasPositiveSpread
    ? (spread > 0.10 ? 'Wide moat' : 'Narrow moat')
    : 'No moat'

  const moatColor = hasPositiveSpread
    ? (spread > 0.10 ? 'text-[#11875D]' : 'text-[#11875D]')
    : 'text-[#D83B3B]'

  const spreadColor = hasPositiveSpread ? 'bg-[#E8F7EF]' : 'bg-[#FCEAEA]'
  const spreadBorderColor = hasPositiveSpread ? 'border-[#A3D9BE]' : 'border-[#F0B8B8]'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-[600] text-[#566174]">ROIC vs WACC</p>
        <span className={`text-[10px] font-[700] ${moatColor}`}>{moatLabel}</span>
      </div>

      {/* Visual gauge */}
      <div className="relative h-2 bg-[#F4F3EF] rounded-full overflow-visible">
        {/* Spread fill from WACC to ROIC */}
        {hasPositiveSpread && (
          <div
            className="absolute top-0 h-full bg-emerald-200 rounded-full"
            style={{ left: `${waccPct}%`, width: `${Math.max(0, roicPct - waccPct)}%` }}
          />
        )}
        {!hasPositiveSpread && (
          <div
            className="absolute top-0 h-full bg-[#FCEAEA] rounded-full"
            style={{ left: `${roicPct}%`, width: `${Math.max(0, waccPct - roicPct)}%` }}
          />
        )}
        {/* WACC marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[#8A95A6] rounded-full"
          style={{ left: `${waccPct}%` }}
        />
        {/* ROIC dot */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm ${hasPositiveSpread ? 'bg-[#E8F7EF]0' : 'bg-[#D83B3B]'}`}
          style={{ left: `${roicPct}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-[11px] text-[#566174]">
        <span>0%</span>
        <div className="flex items-center gap-3">
          <span>WACC {(wacc * 100).toFixed(1)}%</span>
          <span className={`font-[700] ${moatColor}`}>ROIC {(roic * 100).toFixed(0)}%</span>
        </div>
        <span>{roic >= 1 ? `${(roic * 100).toFixed(0)}%+` : '100%'}</span>
      </div>

      {/* Spread badge */}
      <div className={`inline-flex items-center gap-1.5 self-start px-2 py-1 rounded-full border text-[10px] font-[700] ${spreadColor} ${spreadBorderColor} ${moatColor}`}>
        <span>{spread >= 0 ? '+' : ''}{(spread * 100).toFixed(1)}pp spread</span>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function QualityPanel({
  roic, roicSpread, wacc, starRating, uncertainty,
  bearFV, bullFV, blendedFV, currentPrice, currency,
  structuralRisk, countryRisk,
}: Props) {
  const unc = uncertainty ? UNCERTAINTY_STYLE[uncertainty] : null

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4">
      {/* Risk badges — shown when VIE or high country risk is detected */}
      {(structuralRisk || countryRisk) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {structuralRisk && (
            <a
              href="#model_evidence"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FCEAEA] border border-[#F0B8B8] text-[10px] font-[700] text-[#D83B3B] hover:bg-[#FCEAEA] transition-colors"
              title={structuralRisk}
            >
              <span>⚑</span>
              <span>Structural risk — see model evidence</span>
            </a>
          )}
          {countryRisk && (
            <a
              href="#model_evidence"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFF4DA] border border-[#F3D391] text-[10px] font-[700] text-[#B56A00] hover:bg-[#FFF4DA] transition-colors"
              title={countryRisk}
            >
              <span>⚠</span>
              <span>High country risk — see model evidence</span>
            </a>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:divide-x sm:divide-[#F4F3EF]">

        {/* Left: ROIC / WACC moat gauge */}
        <div className="sm:pr-5">
          <MoatGauge roic={roic} roicSpread={roicSpread} wacc={wacc} />
        </div>

        {/* Center: Star rating + conviction */}
        <div className="sm:px-5 flex flex-col gap-2">
          <p className="text-[10px] font-[600] text-[#566174]">Conviction</p>
          {starRating ? (
            <>
              <Stars count={starRating.stars} />
              <p className="text-[14px] font-[750] text-[#06101F] leading-tight">{starRating.label}</p>
              <p className="text-[10px] text-[#566174]">{starRating.description}</p>
            </>
          ) : (
            <p className="text-[11px] text-[#8A95A6]">Insufficient data</p>
          )}
          {unc && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className={`w-2 h-2 rounded-full shrink-0 ${unc.dot}`} />
              <span className={`text-[10px] font-[600] ${unc.text}`}>{unc.label}</span>
            </div>
          )}
        </div>

        {/* Right: Range bar */}
        <div className="sm:pl-5">
          <ScenarioRangeBar
            bear={bearFV} base={blendedFV} bull={bullFV}
            currentPrice={currentPrice} currency={currency}
            label="Fair Value Range"
          />
        </div>

      </div>
    </div>
  )
}
