'use client'
import { useState } from 'react'
import type { PiotroskiResult, AltmanResult, BeneishResult, ROICResult } from '@/lib/dcf/calculateScores'
import { fmtPct } from '@/lib/utils'

interface Props {
  scores: {
    piotroski: PiotroskiResult
    altman: AltmanResult | null
    beneish: BeneishResult | null
    roic: ROICResult
  }
}

function ScoreColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'text-emerald-600'
  if (value >= thresholds[0]) return 'text-amber-600'
  return 'text-red-600'
}

function BgColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'bg-emerald-50 border-emerald-200'
  if (value >= thresholds[0]) return 'bg-amber-50 border-amber-200'
  return 'bg-red-50 border-red-200'
}

function BadgeColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'bg-emerald-100 text-emerald-700'
  if (value >= thresholds[0]) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export default function FinancialScores({ scores }: Props) {
  const { piotroski, altman, beneish, roic } = scores
  const [showPiotroski, setShowPiotroski] = useState(false)
  const [showAltman, setShowAltman] = useState(false)
  const [showBeneish, setShowBeneish] = useState(false)

  const fmtM = (n: number) => {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}B`
    return `$${n.toFixed(0)}M`
  }

  // Detect "no fundamental data" state: all four metrics effectively empty
  const piotroskiNoData = piotroski.score <= 1 && piotroski.criteria.every((c) => !c.pass || c.detail.includes('0.0%') || c.detail.includes('$0.0B'))
  const roicNoData = !roic.dataAvailable
  const noData = piotroskiNoData && altman == null && beneish == null && roicNoData

  if (noData) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-card">
        <h2 className="mb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Financial Quality Scores</h2>
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="text-slate-300 text-4xl">⚠</div>
          <p className="text-sm font-semibold text-slate-500">Fundamental data unavailable</p>
          <p className="text-[11px] text-slate-400 text-center max-w-xs leading-relaxed">
            Yahoo Finance did not return financial statements for this ticker.
            Quality scores (Piotroski, Altman, Beneish, ROIC) require at least 2 years of income statement and balance sheet data.
          </p>
          <p className="text-[10px] text-slate-300 mt-2">
            This is common for MERVAL .BA tickers and thinly-covered international names.
          </p>
        </div>
      </div>
    )
  }

  // Altman — higher is better, thresholds: 1.8 (distress→grey), 3.0 (grey→safe)
  // Belt-and-suspenders: treat out-of-range values as null (catches any future calculation drift)
  const altmanSafe = altman != null && isFinite(altman.zScore) && Math.abs(altman.zScore) <= 50 ? altman : null
  const altmanGood = altmanSafe != null && altmanSafe.zScore >= 3.0
  const altmanMid = altmanSafe != null && altmanSafe.zScore >= 1.8 && altmanSafe.zScore < 3.0
  const altmanColor = altmanSafe == null ? 'text-gray-400'
    : altmanGood ? 'text-emerald-600'
    : altmanMid  ? 'text-amber-600'
    : 'text-red-600'
  const altmanBg = altmanSafe == null ? 'bg-gray-50 border-gray-200'
    : altmanGood ? 'bg-emerald-50 border-emerald-200'
    : altmanMid  ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200'
  const altmanBadge = altmanSafe == null ? 'bg-gray-100 text-gray-500'
    : altmanGood ? 'bg-emerald-100 text-emerald-700'
    : altmanMid  ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'

  // Beneish — lower is better (more negative = cleaner), threshold: -1.78
  const mScore = beneish?.mScore ?? 0
  const beneishClean = beneish?.flag === 'Clean'
  const beneishWarn = beneish?.flag === 'Warning'
  const beneishColor = beneishClean ? 'text-emerald-600' : beneishWarn ? 'text-amber-600' : 'text-red-600'
  const beneishBg = beneishClean ? 'bg-emerald-50 border-emerald-200' : beneishWarn ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  const beneishBadge = beneishClean ? 'bg-emerald-100 text-emerald-700' : beneishWarn ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
  const beneishLabel = beneish?.flag === 'Clean' ? 'Unlikely Manipulator' : beneish?.flag === 'Warning' ? 'Watch' : 'Possible Manipulation'

  // ROIC — positive spread = value creation
  const spreadPp = Math.round(roic.spread * 1000) / 10  // pp
  const spreadGood = roic.spread > 0

  const altmanZoneLabel = altmanSafe == null ? 'Data Unavailable'
    : altmanSafe.zone === 'Safe' ? 'Safe Zone'
    : altmanSafe.zone === 'Grey' ? 'Grey Zone'
    : 'Distress Zone'

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-card">
      <h2 className="mb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Financial Quality Scores</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

        {/* ── Piotroski F-Score ── */}
        <div className={`rounded-xl border p-4 ${BgColor(piotroski.score, [4, 8])}`}>
          <div className="mb-1 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Piotroski F-Score</p>
              <p className={`mt-0.5 text-3xl font-bold tabular-nums ${ScoreColor(piotroski.score, [4, 8])}`}>
                {piotroski.score}<span className="text-base font-normal text-gray-400"> / 9</span>
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${BadgeColor(piotroski.score, [4, 8])}`}>
              {piotroski.label}
            </span>
          </div>
          <p className="mb-3 text-[11px] text-gray-500 leading-relaxed">
            Developed by Joseph Piotroski (2000). Scores 9 accounting signals across profitability, leverage, and operating efficiency.
            Score ≥ 7 = strong financial health. Score ≤ 3 = potential distress. Each point is binary (pass/fail).
          </p>

          {/* 9 indicator dots */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {piotroski.criteria.map((c, i) => (
              <div
                key={i}
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${c.pass ? 'bg-emerald-500' : 'bg-red-400'}`}
                title={`${c.name}: ${c.detail}`}
              >
                {c.pass ? '✓' : '✗'}
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowPiotroski(!showPiotroski)}
            className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-gray-600"
          >
            {showPiotroski ? 'Hide signals ↑' : 'Show signals ↓'}
          </button>

          {showPiotroski && (
            <ul className="mt-2 space-y-1">
              {piotroski.criteria.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px]">
                  <span className={`shrink-0 font-bold ${c.pass ? 'text-emerald-600' : 'text-red-500'}`}>
                    {c.pass ? '✓' : '✗'}
                  </span>
                  <span className="text-gray-600">{c.name}</span>
                  <span className="ml-auto text-gray-400">{c.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Altman Z-Score ── */}
        <div className={`rounded-xl border p-4 ${altmanBg}`}>
          <div className="mb-1 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Altman Z-Score</p>
              {altmanSafe != null ? (
                <p className={`mt-0.5 text-3xl font-bold tabular-nums ${altmanColor}`}>
                  {altmanSafe.zScore.toFixed(2)}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-gray-400">Insufficient data</p>
              )}
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${altmanBadge}`}>
              {altmanZoneLabel}
            </span>
          </div>
          <p className="mb-3 text-[11px] text-gray-500 leading-relaxed">
            Created by Edward Altman (1968) to predict bankruptcy within 2 years. Combines 5 financial ratios weighted by predictive power.
            Z &lt; 1.8 = distress zone. 1.8–3.0 = grey zone. Z ≥ 3.0 = safe zone. Not designed for financial-sector companies.
          </p>

          {altmanSafe != null && (
            <div className="mb-3">
              {/* Zone bar */}
              <div className="relative h-2 w-full rounded-full bg-gray-200">
                <div className="absolute left-0 top-0 h-full rounded-l-full bg-red-400" style={{ width: '24%' }} />
                <div className="absolute top-0 h-full bg-amber-400" style={{ left: '24%', width: '16%' }} />
                <div className="absolute top-0 h-full rounded-r-full bg-emerald-400" style={{ left: '40%', width: '60%' }} />
                {/* Pointer */}
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gray-800 shadow"
                  style={{ left: `${Math.min(Math.max(altmanSafe.zScore / 7.5 * 100, 2), 98)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-gray-400">
                <span>Distress &lt;1.8</span>
                <span>Grey 1.8–3.0</span>
                <span>Safe ≥3.0</span>
              </div>
            </div>
          )}

          {altmanSafe != null && (
            <>
              <button
                onClick={() => setShowAltman(!showAltman)}
                className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-gray-600"
              >
                {showAltman ? 'Hide components ↑' : 'Show components ↓'}
              </button>

              {showAltman && (
                <ul className="mt-2 space-y-1">
                  {[
                    { label: 'X1 · Working Capital / Assets', value: altmanSafe.components.x1, weight: '×1.2' },
                    { label: 'X2 · Retained Earnings / Assets', value: altmanSafe.components.x2, weight: '×1.4' },
                    { label: 'X3 · EBIT / Assets', value: altmanSafe.components.x3, weight: '×3.3' },
                    { label: 'X4 · Mkt Cap / Total Liabilities', value: altmanSafe.components.x4, weight: '×0.6' },
                    { label: 'X5 · Revenue / Assets', value: altmanSafe.components.x5, weight: '×1.0' },
                  ].map((row) => (
                    <li key={row.label} className="flex items-center gap-1 text-[11px]">
                      <span className="text-gray-500">{row.weight}</span>
                      <span className="flex-1 text-gray-600">{row.label}</span>
                      <span className="tabular-nums text-gray-700">{row.value.toFixed(3)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ── Beneish M-Score ── */}
        <div className={`rounded-xl border p-4 ${beneish ? beneishBg : 'bg-gray-50 border-gray-200'}`}>
          <div className="mb-1 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Beneish M-Score</p>
              {beneish ? (
                <p className={`mt-0.5 text-3xl font-bold tabular-nums ${beneishColor}`}>
                  {mScore.toFixed(2)}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-gray-400">Insufficient history</p>
              )}
            </div>
            {beneish && (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${beneishBadge}`}>
                {beneishLabel}
              </span>
            )}
          </div>
          <p className="mb-3 text-[11px] text-gray-500 leading-relaxed">
            Developed by Messod Beneish (1999) to detect earnings manipulation. Uses 8 accounting indices that compare year-over-year changes in income statement and balance sheet ratios.
            M-Score ≤ −1.78 suggests the company is unlikely to be a manipulator. Higher values warrant closer scrutiny.
          </p>

          {beneish && (
            <>
              <p className="mb-3 text-[11px] text-gray-500">
                Threshold ≤ −1.78 = clean.{' '}
                <span className={beneishClean ? 'text-emerald-600' : 'text-amber-600'}>
                  {beneishClean ? 'Earnings quality looks intact.' : 'Review accounting signals.'}
                </span>
              </p>

              <button
                onClick={() => setShowBeneish(!showBeneish)}
                className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-gray-600"
              >
                {showBeneish ? 'Hide indices ↑' : 'Show indices ↓'}
              </button>

              {showBeneish && (
                <ul className="mt-2 space-y-1">
                  {[
                    { label: 'DSRI · Receivables inflation', value: beneish.components.dsri },
                    { label: 'GMI · Gross margin change', value: beneish.components.gmi },
                    { label: 'AQI · Asset quality shift', value: beneish.components.aqi },
                    { label: 'SGI · Sales growth index', value: beneish.components.sgi },
                    { label: 'DEPI · Depreciation index', value: beneish.components.depi },
                    { label: 'SGAI · SGA expense index', value: beneish.components.sgai },
                    { label: 'TATA · Accruals / Assets', value: beneish.components.tata },
                    { label: 'LVGI · Leverage index', value: beneish.components.lvgi },
                  ].map((row) => (
                    <li key={row.label} className="flex items-center gap-1 text-[11px]">
                      <span className="flex-1 text-gray-600">{row.label}</span>
                      <span className="tabular-nums text-gray-700">{row.value.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ── ROIC vs WACC ── */}
        {roic.dataAvailable && (
        <div className={`rounded-xl border p-4 ${spreadGood ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="mb-1 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">ROIC vs WACC</p>
              <p className={`mt-0.5 text-3xl font-bold tabular-nums ${spreadGood ? 'text-emerald-600' : 'text-red-600'}`}>
                {fmtPct(roic.roic)}
              </p>
              <p className="text-xs text-gray-500">ROIC</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${spreadGood ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {spreadGood ? 'Value Created' : 'Value Destroyed'}
            </span>
          </div>
          <p className="mb-3 text-[11px] text-gray-500 leading-relaxed">
            Return on Invested Capital (ROIC) measures how efficiently a company generates profit from the capital it has deployed.
            When ROIC exceeds WACC, the company creates economic value — each dollar invested earns more than it costs.
            NOPAT = EBIT × (1 − tax rate). Invested Capital = Total Assets − non-interest liabilities − excess cash.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">WACC</span>
              <span className="tabular-nums font-medium text-gray-700">{fmtPct(roic.roic - roic.spread)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Spread (ROIC − WACC)</span>
              <span className={`tabular-nums font-bold ${spreadGood ? 'text-emerald-600' : 'text-red-600'}`}>
                {spreadPp > 0 ? '+' : ''}{spreadPp.toFixed(1)} pp
              </span>
            </div>

            <div className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">NOPAT</span>
                <span className="tabular-nums text-gray-700">{fmtM(roic.nopat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Invested Capital</span>
                <span className="tabular-nums text-gray-700">{fmtM(roic.investedCapital)}</span>
              </div>
            </div>
          </div>
        </div>
        )}

      </div>

      <p className="mt-3 text-[10px] text-slate-400">
        Piotroski (2000), Altman (1968), Beneish (1999), ROIC/WACC per Damodaran framework. Computed from trailing annual financials.
      </p>
    </div>
  )
}
