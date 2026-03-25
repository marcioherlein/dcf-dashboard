'use client'
import { useState } from 'react'
import type { MultiplesResult, MultipleEstimate, BenchmarkSource } from '@/lib/dcf/calculateMultiples'
import type { DDMResult } from '@/lib/dcf/calculateDDM'
import type { FCFEResult } from '@/lib/dcf/calculateFCFE'
import type { CompanyType } from '@/lib/dcf/detectCompanyType'

interface FCFFModel {
  fairValue: number
  upsidePct: number
  applicable: boolean
  reason: string
}

interface ValuationMethodsData {
  companyType: CompanyType
  companyTypeLabel: string
  primaryModelLabel: string
  rationale: string
  triangulatedFairValue: number
  triangulatedUpsidePct: number
  effectiveWeights: { fcff: number; fcfe: number; ddm: number; multiples: number }
  models: {
    fcff: FCFFModel
    fcfe: FCFEResult
    ddm: DDMResult
    multiples: MultiplesResult
  }
}

interface Props {
  valuationMethods: ValuationMethodsData
  currency?: string
}

const TYPE_COLORS: Record<CompanyType, { bg: string; text: string; border: string; badge: string }> = {
  financial: {
    bg:     'bg-blue-50 dark:bg-blue-500/10',
    text:   'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-500/20',
    badge:  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  },
  dividend: {
    bg:     'bg-green-50 dark:bg-green-500/10',
    text:   'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-500/20',
    badge:  'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  },
  growth: {
    bg:     'bg-violet-50 dark:bg-violet-500/10',
    text:   'text-violet-700 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-500/20',
    badge:  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
  },
  startup: {
    bg:     'bg-orange-50 dark:bg-orange-500/10',
    text:   'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-500/20',
    badge:  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  },
  standard: {
    bg:     'bg-gray-50 dark:bg-white/5',
    text:   'text-gray-700 dark:text-white/60',
    border: 'border-gray-200 dark:border-white/10',
    badge:  'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/60',
  },
}

function fmt(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
}

function ModelCard({
  label, subtitle, fairValue, upsidePct, applicable, reason, currency, isPrimary,
}: {
  label: string; subtitle?: string; fairValue: number; upsidePct: number
  applicable: boolean; reason: string; currency: string; isPrimary?: boolean
}) {
  const up = upsidePct >= 0
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1.5 ${
      isPrimary
        ? 'bg-gray-50 dark:bg-[#1f1f21] border-gray-300 dark:border-white/20 ring-1 ring-gray-300 dark:ring-white/20'
        : 'bg-white dark:bg-[#161618] border-gray-200 dark:border-white/[0.06]'
    } ${!applicable ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-700 dark:text-white/70 leading-tight">{label}</p>
        {isPrimary && (
          <span className="text-[10px] font-medium bg-gray-200 dark:bg-white/[0.12] text-gray-600 dark:text-white/60 rounded px-1.5 py-0.5">primary</span>
        )}
      </div>
      {subtitle && <p className="text-[10px] text-gray-400 dark:text-white/25 leading-tight">{subtitle}</p>}
      {applicable ? (
        <>
          <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{currency}{fmt(fairValue)}</p>
          <span className={`text-sm font-semibold tabular-nums ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
            {fmtPct(upsidePct)}
          </span>
        </>
      ) : (
        <p className="text-xs text-gray-400 dark:text-white/25 italic mt-1">{reason}</p>
      )}
      {applicable && (
        <p className="text-[10px] text-gray-400 dark:text-white/25 leading-relaxed border-t border-gray-100 dark:border-white/5 pt-1.5 mt-0.5">{reason}</p>
      )}
    </div>
  )
}

function BenchmarkBadge({ source, count }: { source: BenchmarkSource; count: number }) {
  if (source === 'live-peers') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
        <span className="inline-block h-1 w-1 rounded-full bg-blue-500 dark:bg-blue-400" />
        {count} peers
      </span>
    )
  }
  if (source === 'industry-median') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium bg-gray-100 text-gray-500 dark:bg-white/8 dark:text-white/35">
        industry
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-white/25">
      sector
    </span>
  )
}

function MultipleRow({ est, currency }: { est: MultipleEstimate; currency: string }) {
  if (!est.applicable) return null
  const up = est.upsidePct >= 0
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-50 dark:border-white/5 last:border-0 text-xs">
      <span className="font-medium text-gray-600 dark:text-white/50 w-16 shrink-0">{est.multiple}</span>
      <span className="text-gray-500 dark:text-white/40 tabular-nums w-12 shrink-0">{est.actualValue.toFixed(1)}x</span>
      <span className="text-gray-400 dark:text-white/25 shrink-0">vs {est.sectorMedian.toFixed(1)}x</span>
      <BenchmarkBadge source={est.benchmarkSource} count={est.peerTickers.length} />
      <span className="font-semibold text-gray-800 dark:text-white/70 tabular-nums ml-auto">{currency}{fmt(est.impliedFairValue)}</span>
      <span className={`font-semibold tabular-nums w-14 text-right shrink-0 ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
        {fmtPct(est.upsidePct)}
      </span>
    </div>
  )
}

export default function ValuationMethods({ valuationMethods: vm, currency = '$' }: Props) {
  const [showRationale, setShowRationale] = useState(false)
  const [showMultiples, setShowMultiples] = useState(false)

  const c = TYPE_COLORS[vm.companyType]
  const triUp = vm.triangulatedUpsidePct >= 0
  const applicableMultiples = vm.models.multiples.estimates.filter((e) => e.applicable)

  const isPrimaryModel = (key: 'fcff' | 'fcfe' | 'ddm' | 'multiples') => {
    const { companyType, models } = vm
    if (companyType === 'financial') return key === (models.ddm.applicable ? 'fcfe' : 'fcfe')
    if (companyType === 'dividend') return key === 'ddm'
    if (companyType === 'startup') return key === 'multiples'
    return key === 'fcff'
  }

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70">Valuation Methods</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-white/25">
            {vm.primaryModelLabel} · {[
              vm.models.fcff.applicable ? 'FCFF' : null,
              vm.models.fcfe.applicable ? 'FCFE' : null,
              vm.models.ddm.applicable ? 'DDM' : null,
              applicableMultiples.length > 0 ? 'Multiples' : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${c.badge}`}>
          {vm.companyTypeLabel}
        </span>
      </div>

      {/* Model cards grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
        <ModelCard
          label="FCFF DCF"
          subtitle="Free Cash Flow to Firm"
          fairValue={vm.models.fcff.fairValue}
          upsidePct={vm.models.fcff.upsidePct}
          applicable={vm.models.fcff.applicable}
          reason={vm.models.fcff.reason}
          currency={currency}
          isPrimary={isPrimaryModel('fcff')}
        />
        <ModelCard
          label="FCFE DCF"
          subtitle="Free Cash Flow to Equity"
          fairValue={vm.models.fcfe.fairValuePerShare}
          upsidePct={vm.models.fcfe.upsidePct}
          applicable={vm.models.fcfe.applicable}
          reason={vm.models.fcfe.reason}
          currency={currency}
          isPrimary={isPrimaryModel('fcfe')}
        />
        <ModelCard
          label="DDM"
          subtitle="Dividend Discount Model"
          fairValue={vm.models.ddm.fairValuePerShare}
          upsidePct={vm.models.ddm.upsidePct}
          applicable={vm.models.ddm.applicable}
          reason={vm.models.ddm.reason}
          currency={currency}
          isPrimary={isPrimaryModel('ddm')}
        />
        <ModelCard
          label="Multiples"
          subtitle={`${applicableMultiples.length} comparable metric${applicableMultiples.length !== 1 ? 's' : ''}`}
          fairValue={vm.models.multiples.blendedFairValue ?? 0}
          upsidePct={vm.models.multiples.blendedFairValue !== null && currency
            ? (vm.models.multiples.estimates.filter(e => e.applicable).reduce((s, e) => s + e.upsidePct, 0) /
               Math.max(applicableMultiples.length, 1))
            : 0}
          applicable={vm.models.multiples.blendedFairValue !== null}
          reason={applicableMultiples.length > 0
            ? `Blended: ${applicableMultiples.map(e => e.multiple).join(', ')}`
            : 'No applicable multiples'}
          currency={currency}
          isPrimary={isPrimaryModel('multiples')}
        />
      </div>

      {/* Triangulated result */}
      <div className={`rounded-xl border ${c.border} ${c.bg} px-4 py-3.5 mb-4`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-white/40">Triangulated Fair Value</p>
            <p className="text-[10px] text-gray-400 dark:text-white/25 mt-0.5">
              FCFF {vm.effectiveWeights.fcff}%
              {vm.effectiveWeights.fcfe > 0 && ` · FCFE ${vm.effectiveWeights.fcfe}%`}
              {vm.effectiveWeights.ddm > 0 && ` · DDM ${vm.effectiveWeights.ddm}%`}
              {vm.effectiveWeights.multiples > 0 && ` · Multiples ${vm.effectiveWeights.multiples}%`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{currency}{fmt(vm.triangulatedFairValue)}</p>
            <p className={`text-sm font-semibold tabular-nums ${triUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
              {fmtPct(vm.triangulatedUpsidePct)} upside
            </p>
          </div>
        </div>
      </div>

      {/* Peer Comparison Chart */}
      {applicableMultiples.length > 0 && (() => {
        const chartData = applicableMultiples
          .filter((e) => e.sectorMedian > 0 && e.actualValue > 0)
          .map((e) => {
            const pct = Math.round((e.actualValue / e.sectorMedian - 1) * 1000) / 10
            return { name: e.multiple, pct, actual: e.actualValue, median: e.sectorMedian }
          })

        if (chartData.length < 2) return null

        // Visual cap: ±60% so extreme values don't crush other bars
        const CAP = 60
        return (
          <div className="mb-4 rounded-xl border border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-white/40">vs Peer Median</p>
              <span className="text-[10px] text-gray-400 dark:text-white/25">
                <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1" />cheaper
                <span className="inline-block w-2 h-2 rounded-sm bg-red-400 ml-3 mr-1" />pricier
              </span>
            </div>
            <div className="space-y-2">
              {chartData.map((d) => {
                const clamped = Math.max(-CAP, Math.min(CAP, d.pct))
                const cheap = d.pct <= 0
                // Bar position: center line is at 50% of the track
                const barLeft  = cheap ? 50 + clamped / CAP * 50 : 50
                const barWidth = Math.abs(clamped) / CAP * 50
                const overflowed = Math.abs(d.pct) > CAP
                return (
                  <div key={d.name} className="flex items-center gap-3 text-xs">
                    {/* Label */}
                    <span className="w-16 shrink-0 font-medium text-gray-600 dark:text-white/50">{d.name}</span>
                    {/* Actual vs median */}
                    <span className="w-28 shrink-0 text-[10px] text-gray-400 dark:text-white/30 tabular-nums">
                      {d.actual.toFixed(1)}x vs {d.median.toFixed(1)}x
                    </span>
                    {/* Diverging bar track */}
                    <div className="relative flex-1 h-5 rounded bg-gray-100 dark:bg-white/8 overflow-hidden">
                      {/* Center line */}
                      <div className="absolute left-1/2 top-0 h-full w-px bg-gray-300 dark:bg-white/20" />
                      {/* Bar */}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-3 rounded-sm ${cheap ? 'bg-emerald-500' : 'bg-red-400'}`}
                        style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                      />
                    </div>
                    {/* Percentage */}
                    <span className={`w-16 shrink-0 text-right font-semibold tabular-nums text-[11px] ${cheap ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {d.pct > 0 ? '+' : ''}{d.pct.toFixed(1)}%
                      {overflowed && <span className="text-[9px] text-gray-400 dark:text-white/25 ml-0.5">*</span>}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[9px] text-gray-300 dark:text-white/20">
              <span>−{CAP}%</span>
              <span>0%</span>
              <span>+{CAP}%</span>
            </div>
          </div>
        )
      })()}

      {/* Multiples detail */}
      {applicableMultiples.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setShowMultiples(!showMultiples)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60"
          >
            <span>{showMultiples ? '▾' : '▸'}</span>
            Multiples breakdown
          </button>
          {showMultiples && (
            <div className="mt-2 rounded-xl border border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/5 px-4 py-2">
              {vm.models.multiples.estimates.map((est) => (
                <MultipleRow key={est.multiple} est={est} currency={currency} />
              ))}
              {vm.models.multiples.peerTickers && vm.models.multiples.peerTickers.length > 0 && (
                <p className="mt-2 pt-1.5 border-t border-gray-100 dark:border-white/5 text-[10px] text-gray-400 dark:text-white/25 leading-relaxed">
                  <span className="font-medium">Peers:</span> {vm.models.multiples.peerTickers.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rationale */}
      <div>
        <button
          onClick={() => setShowRationale(!showRationale)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60"
        >
          <span>{showRationale ? '▾' : '▸'}</span>
          Why these models?
        </button>
        {showRationale && (
          <p className="mt-2 text-xs text-gray-500 dark:text-white/40 leading-relaxed bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/8 px-4 py-3">
            {vm.rationale}
          </p>
        )}
      </div>
    </div>
  )
}
