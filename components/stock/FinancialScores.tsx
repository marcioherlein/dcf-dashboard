'use client'
import { useState } from 'react'
import type { PiotroskiResult, AltmanResult, BeneishResult, ROICResult } from '@/lib/dcf/calculateScores'
import { fmtPct } from '@/lib/utils'

interface Props {
  scores: {
    piotroski: PiotroskiResult
    altman: AltmanResult
    beneish: BeneishResult | null
    roic: ROICResult
  }
}

function ScoreColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'text-emerald-600 dark:text-emerald-400'
  if (value >= thresholds[0]) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function BgColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20'
  if (value >= thresholds[0]) return 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'
  return 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'
}

function BadgeColor(value: number, thresholds: [number, number]): string {
  if (value >= thresholds[1]) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
  if (value >= thresholds[0]) return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
  return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
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

  // Altman — higher is better, thresholds: 1.8 (distress→grey), 3.0 (grey→safe)
  const altmanGood = altman.zScore >= 3.0
  const altmanMid = altman.zScore >= 1.8 && altman.zScore < 3.0
  const altmanColor = altmanGood ? 'text-emerald-600 dark:text-emerald-400' : altmanMid ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  const altmanBg = altmanGood ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : altmanMid ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20' : 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'
  const altmanBadge = altmanGood ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : altmanMid ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'

  // Beneish — lower is better (more negative = cleaner), threshold: -1.78
  const mScore = beneish?.mScore ?? 0
  const beneishClean = beneish?.flag === 'Clean'
  const beneishWarn = beneish?.flag === 'Warning'
  const beneishColor = beneishClean ? 'text-emerald-600 dark:text-emerald-400' : beneishWarn ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  const beneishBg = beneishClean ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : beneishWarn ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20' : 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'
  const beneishBadge = beneishClean ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : beneishWarn ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
  const beneishLabel = beneish?.flag === 'Clean' ? 'Unlikely Manipulator' : beneish?.flag === 'Warning' ? 'Watch' : 'Possible Manipulation'

  // ROIC — positive spread = value creation
  const spreadPp = Math.round(roic.spread * 1000) / 10  // pp
  const spreadGood = roic.spread > 0

  const altmanZoneLabel = altman.zone === 'Safe' ? 'Safe Zone' : altman.zone === 'Grey' ? 'Grey Zone' : 'Distress Zone'

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-white/70">Financial Quality Scores</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

        {/* ── Piotroski F-Score ── */}
        <div className={`rounded-xl border p-4 ${BgColor(piotroski.score, [4, 8])}`}>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">Piotroski F-Score</p>
              <p className={`mt-0.5 text-3xl font-bold tabular-nums ${ScoreColor(piotroski.score, [4, 8])}`}>
                {piotroski.score}<span className="text-base font-normal text-gray-400 dark:text-white/30"> / 9</span>
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${BadgeColor(piotroski.score, [4, 8])}`}>
              {piotroski.label}
            </span>
          </div>

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
            className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-gray-600 dark:text-white/30 dark:hover:text-white/50"
          >
            {showPiotroski ? 'Hide signals ↑' : 'Show signals ↓'}
          </button>

          {showPiotroski && (
            <ul className="mt-2 space-y-1">
              {piotroski.criteria.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-[11px]">
                  <span className={`shrink-0 font-bold ${c.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {c.pass ? '✓' : '✗'}
                  </span>
                  <span className="text-gray-600 dark:text-white/50">{c.name}</span>
                  <span className="ml-auto text-gray-400 dark:text-white/25">{c.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Altman Z-Score ── */}
        <div className={`rounded-xl border p-4 ${altmanBg}`}>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">Altman Z-Score</p>
              <p className={`mt-0.5 text-3xl font-bold tabular-nums ${altmanColor}`}>
                {altman.zScore.toFixed(2)}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${altmanBadge}`}>
              {altmanZoneLabel}
            </span>
          </div>

          <div className="mb-3">
            {/* Zone bar */}
            <div className="relative h-2 w-full rounded-full bg-gray-200 dark:bg-white/10">
              <div className="absolute left-0 top-0 h-full rounded-l-full bg-red-400" style={{ width: '24%' }} />
              <div className="absolute top-0 h-full bg-amber-400" style={{ left: '24%', width: '16%' }} />
              <div className="absolute top-0 h-full rounded-r-full bg-emerald-400" style={{ left: '40%', width: '60%' }} />
              {/* Pointer */}
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gray-800 dark:bg-white shadow"
                style={{ left: `${Math.min(Math.max(altman.zScore / 7.5 * 100, 2), 98)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-gray-400 dark:text-white/25">
              <span>Distress &lt;1.8</span>
              <span>Grey 1.8–3.0</span>
              <span>Safe ≥3.0</span>
            </div>
          </div>

          <button
            onClick={() => setShowAltman(!showAltman)}
            className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-gray-600 dark:text-white/30 dark:hover:text-white/50"
          >
            {showAltman ? 'Hide components ↑' : 'Show components ↓'}
          </button>

          {showAltman && (
            <ul className="mt-2 space-y-1">
              {[
                { label: 'X1 · Working Capital / Assets', value: altman.components.x1, weight: '×1.2' },
                { label: 'X2 · Retained Earnings / Assets', value: altman.components.x2, weight: '×1.4' },
                { label: 'X3 · EBIT / Assets', value: altman.components.x3, weight: '×3.3' },
                { label: 'X4 · Mkt Cap / Total Liabilities', value: altman.components.x4, weight: '×0.6' },
                { label: 'X5 · Revenue / Assets', value: altman.components.x5, weight: '×1.0' },
              ].map((row) => (
                <li key={row.label} className="flex items-center gap-1 text-[11px]">
                  <span className="text-gray-500 dark:text-white/40">{row.weight}</span>
                  <span className="flex-1 text-gray-600 dark:text-white/50">{row.label}</span>
                  <span className="tabular-nums text-gray-700 dark:text-white/60">{row.value.toFixed(3)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Beneish M-Score ── */}
        <div className={`rounded-xl border p-4 ${beneish ? beneishBg : 'bg-gray-50 border-gray-200 dark:bg-white/5 dark:border-white/10'}`}>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">Beneish M-Score</p>
              {beneish ? (
                <p className={`mt-0.5 text-3xl font-bold tabular-nums ${beneishColor}`}>
                  {mScore.toFixed(2)}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-gray-400 dark:text-white/30">Insufficient history</p>
              )}
            </div>
            {beneish && (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${beneishBadge}`}>
                {beneishLabel}
              </span>
            )}
          </div>

          {beneish && (
            <>
              <p className="mb-3 text-[11px] text-gray-500 dark:text-white/35">
                Threshold ≤ −1.78 = clean.{' '}
                <span className={beneishClean ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                  {beneishClean ? 'Earnings quality looks intact.' : 'Review accounting signals.'}
                </span>
              </p>

              <button
                onClick={() => setShowBeneish(!showBeneish)}
                className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-gray-600 dark:text-white/30 dark:hover:text-white/50"
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
                      <span className="flex-1 text-gray-600 dark:text-white/50">{row.label}</span>
                      <span className="tabular-nums text-gray-700 dark:text-white/60">{row.value.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ── ROIC vs WACC ── */}
        <div className={`rounded-xl border p-4 ${spreadGood ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20'}`}>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">ROIC vs WACC</p>
              <p className={`mt-0.5 text-3xl font-bold tabular-nums ${spreadGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {fmtPct(roic.roic)}
              </p>
              <p className="text-xs text-gray-500 dark:text-white/35">ROIC</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${spreadGood ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
              {spreadGood ? 'Value Created' : 'Value Destroyed'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-white/40">WACC</span>
              <span className="tabular-nums font-medium text-gray-700 dark:text-white/60">{fmtPct(roic.roic - roic.spread)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 dark:text-white/40">Spread (ROIC − WACC)</span>
              <span className={`tabular-nums font-bold ${spreadGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {spreadPp > 0 ? '+' : ''}{spreadPp.toFixed(1)} pp
              </span>
            </div>

            <div className="mt-1 rounded-lg bg-white/60 dark:bg-black/20 px-3 py-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/35">NOPAT</span>
                <span className="tabular-nums text-gray-700 dark:text-white/50">{fmtM(roic.nopat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-white/35">Invested Capital</span>
                <span className="tabular-nums text-gray-700 dark:text-white/50">{fmtM(roic.investedCapital)}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <p className="mt-3 text-[10px] text-gray-300 dark:text-white/20">
        Piotroski (2000), Altman (1968), Beneish (1999), ROIC/WACC per Damodaran framework. Computed from trailing annual financials.
      </p>
    </div>
  )
}
