'use client'
import { useMemo } from 'react'
import type { PiotroskiResult, AltmanResult, BeneishResult, ROICResult } from '@/lib/dcf/calculateScores'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  ticker: string
  upsidePct: number | null | undefined
  scores: {
    piotroski: PiotroskiResult
    altman: AltmanResult | null
    beneish: BeneishResult | null
    roic: ROICResult
  } | null | undefined
  analystRecommendation: string | null | undefined
  fcfMargin: number | null | undefined
  grossMargin: number | null | undefined
  netMargin: number | null | undefined
  revenueCAGR: number | null | undefined
  // New optional props
  pegRatio?: number | null
  epsGrowthFwd?: number | null
  currentPrice?: number | null
  high52?: number | null
  low52?: number | null
  insiderPct?: number | null
  shortPct?: number | null
  analystTargetMean?: number | null
}

// ─── Criterion types ──────────────────────────────────────────────────────────

type CriterionStatus = 'pass' | 'fail' | 'na'

interface Criterion {
  label: string
  status: CriterionStatus
  value: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number | null | undefined, decimals = 1): string {
  if (v == null || !isFinite(v)) return 'N/A'
  return (v * 100).toFixed(decimals) + '%'
}

function fmt2(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return 'N/A'
  return v.toFixed(2)
}

function criterion(
  label: string,
  pass: boolean | null,
  value: string,
): Criterion {
  return { label, status: pass === null ? 'na' : pass ? 'pass' : 'fail', value }
}

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: CriterionStatus }) {
  if (status === 'pass') {
    return (
      <span
        className="flex items-center justify-center w-[18px] h-[18px] rounded-full shrink-0 text-[10px] font-bold bg-[#E8F7EF] text-[#11875D]"
        aria-label="Pass"
      >
        ✓
      </span>
    )
  }
  if (status === 'fail') {
    return (
      <span
        className="flex items-center justify-center w-[18px] h-[18px] rounded-full shrink-0 text-[10px] font-bold bg-[#FCEAEA] text-[#D83B3B]"
        aria-label="Fail"
      >
        ✗
      </span>
    )
  }
  return (
    <span
      className="flex items-center justify-center w-[18px] h-[18px] rounded-full shrink-0 text-[10px] font-bold bg-[#F5F5F5] text-[#9B9B9B]"
      aria-label="Not available"
    >
      –
    </span>
  )
}

// ─── Single criterion row ─────────────────────────────────────────────────────

function CriterionRow({ c }: { c: Criterion }) {
  const valueClass =
    c.status === 'pass'
      ? 'text-[#11875D]'
      : c.status === 'fail'
        ? 'text-[#D83B3B]'
        : 'text-[#9B9B9B]'

  return (
    <div
      role="row"
      aria-label={`${c.label}: ${c.status} — ${c.value}`}
      className="flex items-center justify-between gap-2 py-[7px] border-b border-[#F0F0F0] last:border-0"
    >
      <div className="flex items-center gap-[7px] min-w-0">
        <StatusIcon status={c.status} />
        <span className="text-[12px] leading-tight truncate text-[#111111]">
          {c.label}
        </span>
      </div>
      <span
        className={`text-[11px] font-medium shrink-0 tabular-nums ${valueClass}`}
      >
        {c.value}
      </span>
    </div>
  )
}

// ─── Category header ──────────────────────────────────────────────────────────

function CategoryHeader({ label }: { label: string }) {
  return (
    <p
      className="text-[11px] font-[600] pt-[6px] pb-[2px] text-[#6B6B6B]"
    >
      {label}
    </p>
  )
}

// ─── Info tooltip icon ────────────────────────────────────────────────────────

function InfoIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="text-[#C0C0C0] shrink-0"
    >
      <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="7.25" y="6.75" width="1.5" height="5" rx="0.75" fill="currentColor" />
      <circle cx="8" cy="4.75" r="0.85" fill="currentColor" />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InvestmentVerdict({
  ticker: _ticker,
  upsidePct,
  scores,
  analystRecommendation,
  fcfMargin,
  grossMargin,
  netMargin: _netMargin,
  revenueCAGR,
  pegRatio,
  epsGrowthFwd,
  currentPrice,
  high52,
  low52,
  insiderPct,
  shortPct,
  analystTargetMean,
}: Props) {

  const criteria = useMemo(() => {
    const piotroski = scores?.piotroski ?? null
    const altman    = scores?.altman    ?? null
    const beneish   = scores?.beneish   ?? null
    const roic      = scores?.roic      ?? null

    // ── Helper: find Piotroski criterion by partial name ───────────────────
    function pioC(fragment: string): boolean | null {
      if (!piotroski) return null
      const c = piotroski.criteria.find(
        cr => cr.name.toLowerCase().includes(fragment.toLowerCase()),
      )
      return c?.pass ?? null
    }

    // ── Analyst bullish check ──────────────────────────────────────────────
    const analystBullish: boolean | null = analystRecommendation != null
      ? ['strongbuy', 'buy', 'strong_buy', 'strong buy'].includes(
          analystRecommendation.toLowerCase(),
        )
      : null

    const analystLabel = analystRecommendation
      ? analystRecommendation.replace(/([A-Z])/g, ' $1').trim()
      : 'N/A'

    // ── VALUATION (3 criteria) ─────────────────────────────────────────────

    // 1. DCF upside >= 15%
    const c1 = criterion(
      'DCF upside ≥ 15%',
      upsidePct != null ? upsidePct >= 0.15 : null,
      upsidePct != null
        ? (upsidePct >= 0 ? '+' : '') + pct(upsidePct, 1)
        : 'N/A',
    )

    // 2. Fair valuation (PEG < 2.0 and > 0)
    const pegPass: boolean | null =
      pegRatio != null
        ? pegRatio > 0 && pegRatio < 2.0
        : null
    const c2 = criterion(
      'Fair valuation (PEG)',
      pegPass,
      pegRatio != null ? fmt2(pegRatio) : 'N/A',
    )

    // 3. P/FCF vs sector — proxy: FCF margin > 5%
    const pfcfPass: boolean | null =
      fcfMargin != null ? fcfMargin > 0.05 : null
    const c3 = criterion(
      'P/FCF vs sector',
      pfcfPass,
      fcfMargin != null ? `FCF ${pct(fcfMargin, 1)}` : 'N/A',
    )

    // ── BUSINESS QUALITY (4 criteria) ─────────────────────────────────────

    // 4. Positive cash flow (FCF margin > 0)
    const c4 = criterion(
      'Positive cash flow',
      fcfMargin != null ? fcfMargin > 0 : null,
      pct(fcfMargin, 1),
    )

    // 5. High ROIC (ROIC > WACC, spread > 0)
    const roicPass: boolean | null =
      roic?.dataAvailable && roic.spread != null
        ? roic.spread > 0
        : null
    const roicLabel =
      roic?.dataAvailable && roic.roic != null && roic.spread != null
        ? `${pct(roic.roic, 1)} (${roic.spread > 0 ? '+' : ''}${pct(roic.spread, 1)} spread)`
        : 'N/A'
    const c5 = criterion('High ROIC (> WACC)', roicPass, roicLabel)

    // 6. Competitive moat (Piotroski >= 6)
    const fScore = piotroski?.score ?? null
    const c6 = criterion(
      'Competitive moat (F-score)',
      fScore != null ? fScore >= 6 : null,
      fScore != null
        ? `${fScore} / 9 (${piotroski!.label})`
        : 'N/A',
    )

    // 7. Consistent margins (gross margin > 20%)
    const c7 = criterion(
      'Consistent margins',
      grossMargin != null ? grossMargin > 0.2 : null,
      grossMargin != null ? `Gross ${pct(grossMargin, 1)}` : 'N/A',
    )

    // ── FINANCIAL HEALTH (2 criteria) ─────────────────────────────────────

    // 8. Strong balance sheet (Altman Safe zone)
    const c8 = criterion(
      'Strong balance sheet',
      altman != null ? altman.zone === 'Safe' : null,
      altman != null
        ? `Z ${fmt2(altman.zScore)} (${altman.zone})`
        : 'N/A',
    )

    // 9. Management quality (Beneish not Manipulator)
    const notManipulator: boolean | null =
      beneish != null ? beneish.flag !== 'Manipulator' : null
    const c9 = criterion(
      'Management quality',
      notManipulator,
      beneish != null
        ? `M ${fmt2(beneish.mScore)} (${beneish.flag})`
        : 'N/A',
    )

    // ── GROWTH (3 criteria) ───────────────────────────────────────────────

    // 10. Revenue growth (CAGR > 5%)
    const c10 = criterion(
      'Revenue growth (3Y CAGR)',
      revenueCAGR != null ? revenueCAGR > 0.05 : null,
      revenueCAGR != null ? pct(revenueCAGR, 1) : 'N/A',
    )

    // 11. EPS growth outlook (epsGrowthFwd > 0)
    const c11 = criterion(
      'EPS growth outlook',
      epsGrowthFwd != null ? epsGrowthFwd > 0 : null,
      epsGrowthFwd != null ? pct(epsGrowthFwd, 1) : 'N/A',
    )

    // 12. Analyst consensus (buy or strongBuy)
    const c12 = criterion(
      'Analyst consensus',
      analystBullish,
      analystLabel,
    )

    // ── MARKET SIGNALS (4 criteria) ───────────────────────────────────────

    // c13: Analyst target upside >10%
    var analystUpside = (analystTargetMean != null && currentPrice != null && currentPrice > 0)
      ? (analystTargetMean - currentPrice) / currentPrice
      : null
    var c13 = criterion("Analyst target upside >10%",
      analystUpside != null ? analystUpside > 0.10 : null,
      analystUpside != null ? (analystUpside >= 0 ? "+" : "") + (analystUpside * 100).toFixed(1) + "%" : "N/A"
    )

    // c14: Price in lower 70% of 52W range (momentum signal)
    var range52 = (high52 != null && low52 != null && high52 > low52)
      ? high52 - low52 : null
    var rangePos = (range52 != null && currentPrice != null && low52 != null)
      ? (currentPrice - low52) / range52 : null
    var c14 = criterion("Price within 52W range",
      rangePos != null ? rangePos < 0.7 : null,
      rangePos != null ? Math.round(rangePos * 100) + "% of range" : "N/A"
    )

    // c15: Insider ownership >5%
    var c15 = criterion("Insider ownership >5%",
      insiderPct != null ? insiderPct > 0.05 : null,
      insiderPct != null ? (insiderPct * 100).toFixed(1) + "%" : "N/A"
    )

    // c16: Short interest <5%
    var c16 = criterion("Short interest low (<5%)",
      shortPct != null ? shortPct < 0.05 : null,
      shortPct != null ? (shortPct * 100).toFixed(1) + "% short" : "N/A"
    )

    // Piotroski leverage flag used by old health section (kept for reference only)
    const _leverageFalling = pioC('leverage')
    void _leverageFalling

    return {
      valuation:      [c1, c2, c3],
      quality:        [c4, c5, c6, c7],
      health:         [c8, c9],
      growth:         [c10, c11, c12],
      marketSignals:  [c13, c14, c15, c16],
      all:            [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16],
    }
  }, [
    upsidePct, pegRatio, fcfMargin, grossMargin,
    scores, analystRecommendation, revenueCAGR, epsGrowthFwd,
    currentPrice, high52, low52, insiderPct, shortPct, analystTargetMean,
  ])

  // Aggregate counts (N/A excluded from totals per existing logic)
  const totalMet = criteria.all.filter(c => c.status === 'pass').length
  const totalEligible = criteria.all.filter(c => c.status !== 'na').length

  const ratio = totalEligible > 0 ? totalMet / totalEligible : 0
  const summaryColor =
    ratio >= 0.75 ? '#11875D' : ratio >= 0.5 ? '#B56A00' : '#D83B3B'

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-0 bg-white border border-[#E5E5E5]"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-[6px]">
          <span
            className="text-[13px] font-[700] text-[#444444]"
          >
            Investment Checklist
          </span>
          <InfoIcon />
        </div>
        <span
          className="text-[11px] font-bold tabular-nums px-[8px] py-[2px] rounded-full border"
          style={{
            color: summaryColor,
            background: ratio >= 0.75 ? '#E8F7EF' : ratio >= 0.5 ? '#FFF4DA' : '#FCEAEA',
            borderColor: ratio >= 0.75 ? '#A3D9BE' : ratio >= 0.5 ? '#F3D391' : '#F0B8B8',
          }}
        >
          {ratio >= 0.75 ? 'Strong' : ratio >= 0.5 ? 'Mixed' : 'Weak'} · {totalMet} / {totalEligible} met
        </span>
      </div>

      {/* ── 2-column grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-0">

        {/* LEFT COLUMN */}
        <div>
          <CategoryHeader label="Valuation" />
          {criteria.valuation.map((c, i) => (
            <CriterionRow key={i} c={c} />
          ))}
          <CategoryHeader label="Financial Health" />
          {criteria.health.map((c, i) => (
            <CriterionRow key={i} c={c} />
          ))}
          <CategoryHeader label="Market Signals" />
          {criteria.marketSignals.map((c, i) => (
            <CriterionRow key={i} c={c} />
          ))}
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <CategoryHeader label="Business Quality" />
          {criteria.quality.map((c, i) => (
            <CriterionRow key={i} c={c} />
          ))}
          <CategoryHeader label="Growth" />
          {criteria.growth.map((c, i) => (
            <CriterionRow key={i} c={c} />
          ))}
        </div>

      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <p className="text-[11px] text-center mt-3 leading-relaxed text-[#6B6B6B]">
        Scores are model estimates, not investment advice.
      </p>
    </div>
  )
}
