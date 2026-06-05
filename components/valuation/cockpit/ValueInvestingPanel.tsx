'use client'

import { fmtPrice } from '@/lib/formatters'
import type { ValueInvestingData } from '@/lib/valuation/valueInvestingAnalysis'

interface Props {
  data: ValueInvestingData
  currency: string
  currentPrice: number
}

// ── Shared card shell ─────────────────────────────────────────────────────────

function Card({ title, subtitle, badge, children }: {
  title: string; subtitle: string; badge?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-[700] text-slate-800">{title}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{subtitle}</p>
        </div>
        {badge}
      </div>
      {children}
    </div>
  )
}

function UpsidePill({ upsidePct }: { upsidePct: number | null }) {
  if (upsidePct == null) return null
  const pos = upsidePct >= 0
  return (
    <span className={`text-[11px] font-[700] tabular-nums ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
    </span>
  )
}

// ── EPV: No-growth floor ──────────────────────────────────────────────────────

function EPVCard({ data, currency, currentPrice }: Props) {
  const { epv } = data
  const hasValue = epv.epvPerShare != null && epv.epvPerShare > 0

  return (
    <Card
      title="No-growth Floor (EPV)"
      subtitle="Greenwald — what the company earns if growth stops"
      badge={epv.isNormalized || epv.isCyclical ? (
        <span className="text-[10px] font-[600] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
          {epv.isNormalized ? 'Normalized' : 'Cyclical'}
        </span>
      ) : undefined}
    >
      {hasValue ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-[800] tabular-nums leading-none text-slate-900">
              {fmtPrice(epv.epvPerShare!, currency)}
            </span>
            <UpsidePill upsidePct={epv.upsidePct} />
          </div>

          {epv.growthPremiumPct != null && epv.growthPremiumPct > 0 && currentPrice > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-[10px] text-amber-800 leading-relaxed">
                <span className="font-[700]">{(epv.growthPremiumPct * 100).toFixed(0)}% of the current price</span> reflects growth expectations beyond what the company already earns today.
              </p>
            </div>
          )}

          {epv.growthPremiumPct != null && epv.growthPremiumPct <= 0 && (
            <p className="text-[10px] text-emerald-700">Stock trades at or below its no-growth value — no growth premium priced in.</p>
          )}
        </>
      ) : (
        <p className="text-[12px] text-slate-400 leading-relaxed">{epv.guardErrors[0] ?? 'Data unavailable'}</p>
      )}
    </Card>
  )
}

// ── Owner Earnings: Capital intensity analysis ────────────────────────────────

function OwnerEarningsCard({ data, currency, currentPrice }: Props) {
  const { ownerEarnings: oe } = data

  const intensityColor = oe.isAssetLight
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : oe.isCapitalIntensive
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-600 border-slate-200'

  const ni = oe.ownerEarningsM != null && oe.ownerEarningsToNetIncomeRatio != null && oe.ownerEarningsToNetIncomeRatio !== 0
    ? oe.ownerEarningsM / oe.ownerEarningsToNetIncomeRatio : null

  return (
    <Card
      title="Capital Intensity"
      subtitle="How much of reported earnings is real cash for shareholders"
      badge={oe.isNormalized || oe.isCyclical ? (
        <span className="text-[10px] font-[600] px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
          {oe.isNormalized ? 'Normalized' : 'Cyclical'}
        </span>
      ) : undefined}
    >
      {oe.ownerEarningsFVPerShare != null ? (
        <>
          {/* NI vs Owner Earnings bar comparison */}
          {oe.ownerEarningsM != null && ni != null && (
            <div className="bg-slate-50 rounded-lg px-3 py-2.5 space-y-2">
              <p className="text-[11px] font-[700] text-slate-500 uppercase tracking-wide">Net Income vs Owner Earnings</p>
              {[
                { label: 'Net Income', value: ni, cls: 'bg-slate-400', pct: 1 },
                { label: 'Owner Earnings', value: oe.ownerEarningsM, cls: oe.isAssetLight ? 'bg-emerald-400' : oe.isCapitalIntensive ? 'bg-amber-400' : 'bg-slate-400', pct: oe.ownerEarningsToNetIncomeRatio ?? 0.8 },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 w-[90px] shrink-0">{row.label}</span>
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${row.cls}`} style={{ width: `${Math.min(100, Math.max(0, row.pct * 100))}%` }} />
                  </div>
                  <span className="text-[11px] font-[600] tabular-nums text-slate-700 w-[48px] text-right shrink-0">
                    {row.value >= 1000 ? `$${(row.value / 1000).toFixed(1)}B` : `$${row.value.toFixed(0)}M`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`self-start text-[10px] font-[700] uppercase tracking-wide px-2 py-0.5 rounded-full border ${intensityColor}`}>
              {oe.capitalIntensityLabel}
            </span>
            {oe.ownerEarningsYield != null && currentPrice > 0 && (
              <span className="text-[10px] text-slate-500">
                Owner earnings yield: <span className="font-[700] tabular-nums text-slate-700">{(oe.ownerEarningsYield * 100).toFixed(1)}%</span>
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 pt-1 border-t border-slate-50">
            <span className="text-[10px] text-slate-500">Fair value (Buffett):</span>
            <span className="text-[14px] font-[750] tabular-nums text-slate-800">{fmtPrice(oe.ownerEarningsFVPerShare, currency)}</span>
            <UpsidePill upsidePct={oe.upsidePct} />
          </div>

          <p className="text-[10px] text-slate-400">
            Maintenance CapEx assumed at 70% of total CapEx. Asset-light businesses convert more of their earnings into distributable cash.
          </p>
        </>
      ) : (
        <p className="text-[12px] text-slate-400 leading-relaxed">{oe.guardErrors[0] ?? 'Data unavailable'}</p>
      )}
    </Card>
  )
}

// ── DDM: Dividend value model ─────────────────────────────────────────────────

function DDMCard({ data, currency }: Props) {
  const { ddm } = data

  return (
    <Card
      title="Dividend Value Model"
      subtitle="Present value of all future dividends (Gordon Growth)"
    >
      {ddm.isApplicable && ddm.fairValuePerShare != null ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-[22px] font-[800] tabular-nums leading-none text-slate-900">
              {fmtPrice(ddm.fairValuePerShare, currency)}
            </span>
            <UpsidePill upsidePct={ddm.upsidePct} />
          </div>

          {ddm.dividendPerShare != null && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 self-start">
              <span className="text-[10px] font-[600] text-teal-600">Annual dividend</span>
              <span className="text-[10px] font-[700] tabular-nums text-teal-700">{currency}{ddm.dividendPerShare.toFixed(2)}/yr</span>
            </div>
          )}

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Best for stable dividend payers. Assumes dividends grow at the terminal growth rate indefinitely.
          </p>
        </>
      ) : (
        <p className="text-[12px] text-slate-400 leading-relaxed">{ddm.inapplicabilityReason ?? 'Data unavailable'}</p>
      )}
    </Card>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ValueInvestingPanel({ data, currency, currentPrice }: Props) {
  const { normalizedEarningsWarning, countryRiskDisclaimer, structuralRiskDisclaimer } = data

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-5">

      {/* Header */}
      <div className="mb-4">
        <p className="text-sm font-[700] text-slate-800 mb-1">Deep-Dive Checks</p>
        <p className="text-xs text-slate-400">
          Independent cross-checks that ask different questions than the main models. Not blended into the fair value — each one reveals a different aspect of business quality or value.
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

      {/* 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <EPVCard data={data} currency={currency} currentPrice={currentPrice} />
        <OwnerEarningsCard data={data} currency={currency} currentPrice={currentPrice} />
        {data.ddm.isApplicable && <DDMCard data={data} currency={currency} currentPrice={currentPrice} />}
      </div>

    </div>
  )
}
