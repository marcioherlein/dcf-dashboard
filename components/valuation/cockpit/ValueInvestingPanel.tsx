'use client'

import { fmtPrice } from '@/lib/formatters'
import type { ValueInvestingData } from '@/lib/valuation/valueInvestingAnalysis'

interface Props {
  data: ValueInvestingData
  currency: string
  currentPrice: number
}

// ── Shared card primitives ────────────────────────────────────────────────────

function ModelCard({
  title, subtitle, fairValue, upsidePct, currency, metric, metricLabel,
  isApplicable, inapplicabilityReason, isNormalized, isCyclical,
  disclaimer, detail, accentClass,
}: {
  title: string
  subtitle: string
  fairValue: number | null
  upsidePct: number | null
  currency: string
  metric?: string
  metricLabel?: string
  isApplicable: boolean
  inapplicabilityReason?: string | null
  isNormalized?: boolean
  isCyclical?: boolean
  disclaimer?: string | null
  detail?: string | null
  accentClass: string
}) {
  const hasValue  = isApplicable && fairValue != null && fairValue > 0
  const upColor   = upsidePct != null
    ? (upsidePct >= 0 ? 'text-emerald-600' : 'text-red-500')
    : 'text-slate-400'

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 flex flex-col gap-3 min-w-[190px] sm:min-w-0">

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-[700] text-slate-800">{title}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{subtitle}</p>
        </div>
        {(isCyclical || isNormalized) && (
          <span className="text-[9px] font-[600] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 shrink-0 whitespace-nowrap">
            {isNormalized ? 'Normalized' : 'Cyclical'}
          </span>
        )}
      </div>

      {/* Value */}
      {hasValue ? (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[22px] font-[800] tabular-nums leading-none text-slate-900">
            {fmtPrice(fairValue!, currency)}
          </span>
          {upsidePct != null && (
            <span className={`text-[11px] font-[700] tabular-nums ${upColor}`}>
              {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
            </span>
          )}
        </div>
      ) : (
        <div>
          <p className="text-[13px] font-[600] text-slate-500">N/A</p>
          {inapplicabilityReason && (
            <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{inapplicabilityReason}</p>
          )}
        </div>
      )}

      {/* Key metric chip */}
      {metric && metricLabel && hasValue && (
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full self-start ${accentClass}`}>
          <span className="text-[9px] font-[600] opacity-70">{metricLabel}</span>
          <span className="text-[10px] font-[700] tabular-nums">{metric}</span>
        </div>
      )}

      {/* Detail / rationale */}
      {detail && hasValue && (
        <p className="text-[10px] text-slate-500 leading-relaxed">{detail}</p>
      )}

      {/* Disclaimer */}
      {disclaimer && (
        <p className="text-[9px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 leading-relaxed">
          {disclaimer}
        </p>
      )}
    </div>
  )
}

// ── Magic Formula card (no fair value, shows attractiveness) ──────────────────

function MagicFormulaCard({
  data, currency: _currency,
}: { data: ValueInvestingData; currency: string }) {
  const mf = data.magicFormula

  const attractColor = {
    high:     'bg-emerald-50 border-emerald-200 text-emerald-700',
    moderate: 'bg-amber-50 border-amber-200 text-amber-700',
    low:      'bg-red-50 border-red-200 text-red-600',
  }

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 flex flex-col gap-3 min-w-[190px] sm:min-w-0">
      <div>
        <p className="text-[12px] font-[700] text-slate-800">Magic Formula</p>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Greenblatt — earnings yield + ROIC</p>
      </div>

      {mf.earningsYield != null ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-[9px] font-[600] text-slate-500 mb-0.5">Earnings Yield</p>
              <p className="text-[16px] font-[800] tabular-nums text-slate-900 leading-none">
                {(mf.earningsYield * 100).toFixed(1)}%
              </p>
              {mf.earningsYieldVsRFR != null && (
                <p className={`text-[9px] font-[600] mt-0.5 tabular-nums ${mf.earningsYieldVsRFR >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {mf.earningsYieldVsRFR >= 0 ? '+' : ''}{(mf.earningsYieldVsRFR * 100).toFixed(1)}% vs RFR
                </p>
              )}
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-[9px] font-[600] text-slate-500 mb-0.5">ROIC</p>
              <p className="text-[16px] font-[800] tabular-nums text-slate-900 leading-none">
                {mf.roic != null ? `${(mf.roic * 100).toFixed(0)}%` : '—'}
              </p>
              {mf.impliedMaxPE != null && (
                <p className="text-[9px] text-slate-500 mt-0.5">Implied max P/E: {mf.impliedMaxPE.toFixed(0)}×</p>
              )}
            </div>
          </div>

          {mf.attractiveness && (
            <div className={`rounded-lg border px-2.5 py-1.5 ${attractColor[mf.attractiveness]}`}>
              <p className="text-[10px] font-[600] leading-relaxed">{mf.attractivenessReason}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-[12px] text-slate-500">{mf.guardErrors[0] ?? 'Data unavailable'}</p>
      )}
    </div>
  )
}

// ── Owner Earnings card (capital intensity focus) ─────────────────────────────

function OwnerEarningsCard({
  data, currency, currentPrice,
}: { data: ValueInvestingData; currency: string; currentPrice: number }) {
  const oe = data.ownerEarnings

  const intensityColor = oe.isAssetLight
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : oe.isCapitalIntensive
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-600 border-slate-200'

  const upsidePct = oe.upsidePct
  const upColor = upsidePct != null
    ? (upsidePct >= 0 ? 'text-emerald-600' : 'text-red-500')
    : 'text-slate-400'

  const ni   = oe.ownerEarningsM != null && oe.ownerEarningsToNetIncomeRatio != null
    ? oe.ownerEarningsM / oe.ownerEarningsToNetIncomeRatio
    : null

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 flex flex-col gap-3 min-w-[190px] sm:min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-[700] text-slate-800">Owner Earnings</p>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Buffett — net income + D&amp;A − maint. CapEx</p>
        </div>
        {(oe.isCyclical || oe.isNormalized) && (
          <span className="text-[9px] font-[600] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
            {oe.isNormalized ? 'Normalized' : 'Cyclical'}
          </span>
        )}
      </div>

      {oe.ownerEarningsFVPerShare != null ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-[800] tabular-nums leading-none text-slate-900">
              {fmtPrice(oe.ownerEarningsFVPerShare, currency)}
            </span>
            {upsidePct != null && (
              <span className={`text-[11px] font-[700] tabular-nums ${upColor}`}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
              </span>
            )}
          </div>

          {/* NI vs OE comparison — the capital intensity signal */}
          {oe.ownerEarningsM != null && ni != null && (
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-[9px] font-[600] text-slate-500 mb-1.5">Net Income vs Owner Earnings</p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-slate-500">Net Income</span>
                    <span className="text-[9px] font-[600] tabular-nums text-slate-700">
                      {ni >= 1000 ? `$${(ni / 1000).toFixed(1)}B` : `$${ni.toFixed(0)}M`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] text-slate-500">Owner Earnings</span>
                    <span className="text-[9px] font-[600] tabular-nums text-slate-700">
                      {oe.ownerEarningsM >= 1000 ? `$${(oe.ownerEarningsM / 1000).toFixed(1)}B` : `$${oe.ownerEarningsM.toFixed(0)}M`}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${oe.isAssetLight ? 'bg-emerald-400' : oe.isCapitalIntensive ? 'bg-amber-400' : 'bg-slate-400'}`}
                      style={{ width: `${Math.min(100, Math.max(0, (oe.ownerEarningsToNetIncomeRatio ?? 0.8) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <span className={`self-start text-[9px] font-[700] uppercase tracking-wide px-2 py-0.5 rounded-full border ${intensityColor}`}>
            {oe.capitalIntensityLabel}
          </span>

          <p className="text-[10px] text-slate-500">
            Maintenance CapEx assumed at 70% of total CapEx (Buffett convention).
          </p>

          {oe.ownerEarningsYield != null && currentPrice > 0 && (
            <p className="text-[10px] text-slate-500">
              Owner earnings yield: <span className="font-[700] tabular-nums text-slate-700">{(oe.ownerEarningsYield * 100).toFixed(1)}%</span>
            </p>
          )}
        </>
      ) : (
        <p className="text-[12px] text-slate-500 leading-relaxed">{oe.guardErrors[0] ?? 'Data unavailable'}</p>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ValueInvestingPanel({ data, currency, currentPrice }: Props) {
  const { epv, grahamNumber, ddm, countryRiskDisclaimer, structuralRiskDisclaimer, normalizedEarningsWarning } = data

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-5">

      {/* Header */}
      <div className="mb-4">
        <p className="text-sm font-[700] text-slate-800 mb-1">Classic Value Screens</p>
        <p className="text-xs text-slate-400">
          Independent lenses from value investing theory. Not blended into the main fair value — each shows a different question: What does zero-growth earn? What would Graham pay? How does capital intensity affect distributable cash?
        </p>
      </div>

      {/* Warnings */}
      {(normalizedEarningsWarning || countryRiskDisclaimer || structuralRiskDisclaimer) && (
        <div className="flex flex-col gap-1.5 mb-4">
          {normalizedEarningsWarning && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="text-amber-500 mt-0.5 text-xs shrink-0">⚠</span>
              <p className="text-[10px] text-amber-800 leading-relaxed">
                <span className="font-[700]">Peak earnings detected.</span> Current earnings appear significantly above 5-year average. Cyclical models automatically use normalized figures.
              </p>
            </div>
          )}
          {countryRiskDisclaimer && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span className="text-amber-500 mt-0.5 text-xs shrink-0">⚠</span>
              <p className="text-[10px] text-amber-800 leading-relaxed">
                <span className="font-[700]">Country risk.</span> {countryRiskDisclaimer}
              </p>
            </div>
          )}
          {structuralRiskDisclaimer && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-red-400 mt-0.5 text-xs shrink-0">⚑</span>
              <p className="text-[10px] text-red-800 leading-relaxed">
                <span className="font-[700]">Structural risk.</span> {structuralRiskDisclaimer}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cards — horizontal scroll on mobile, grid on larger screens */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 sm:grid sm:grid-cols-2 lg:grid-cols-5 sm:overflow-visible sm:snap-none sm:pb-0 sm:mx-0 sm:px-0 items-start">

        {/* EPV */}
        <ModelCard
          title="EPV"
          subtitle="Greenwald — zero-growth value"
          fairValue={epv.epvPerShare}
          upsidePct={epv.upsidePct}
          currency={currency}
          metric={epv.growthPremiumPct != null ? `${(epv.growthPremiumPct * 100).toFixed(0)}% growth premium` : undefined}
          metricLabel={epv.growthPremiumPct != null ? 'You pay' : undefined}
          isApplicable={epv.epvPerShare != null}
          inapplicabilityReason={epv.guardErrors[0] ?? null}
          isNormalized={epv.isNormalized}
          isCyclical={epv.isCyclical}
          disclaimer={epv.cyclicalWarning}
          detail={epv.growthPremiumPct != null && epv.growthPremiumPct > 0
            ? `${(epv.growthPremiumPct * 100).toFixed(0)}% of current price reflects growth expectations beyond steady-state operations.`
            : undefined}
          accentClass="bg-blue-50 text-blue-700"
        />

        {/* Graham Number */}
        <ModelCard
          title="Graham Number"
          subtitle="Graham — √(22.5 × EPS × BVPS)"
          fairValue={grahamNumber.grahamNumber}
          upsidePct={grahamNumber.upsidePct}
          currency={currency}
          metric={grahamNumber.grahamNumber != null && currentPrice > 0
            ? `${(currentPrice / grahamNumber.grahamNumber).toFixed(1)}× Graham` : undefined}
          metricLabel="Trading at"
          isApplicable={grahamNumber.isApplicable}
          inapplicabilityReason={grahamNumber.inapplicabilityReason}
          isNormalized={grahamNumber.isNormalized}
          isCyclical={grahamNumber.isCyclical}
          detail={grahamNumber.isApplicable && grahamNumber.grahamNumber != null
            ? `Graham's conservative ceiling — max 15× earnings and 1.5× book simultaneously.`
            : undefined}
          accentClass="bg-violet-50 text-violet-700"
        />

        {/* Magic Formula */}
        <MagicFormulaCard data={data} currency={currency} />

        {/* Owner Earnings */}
        <OwnerEarningsCard data={data} currency={currency} currentPrice={currentPrice} />

        {/* DDM */}
        <ModelCard
          title="DDM"
          subtitle="Dividend discount model"
          fairValue={ddm.fairValuePerShare}
          upsidePct={ddm.upsidePct}
          currency={currency}
          metric={ddm.dividendPerShare != null ? `${currency}${ddm.dividendPerShare.toFixed(2)}/yr` : undefined}
          metricLabel="Dividend"
          isApplicable={ddm.isApplicable}
          inapplicabilityReason={ddm.inapplicabilityReason}
          detail={ddm.isApplicable ? 'Perpetual dividend growth model (Gordon). Best for stable dividend payers.' : undefined}
          accentClass="bg-teal-50 text-teal-700"
        />

      </div>
    </div>
  )
}
