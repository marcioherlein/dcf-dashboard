'use client'
import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
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

function getScoreColorScheme(value: number, thresholds: [number, number]): { text: string; bg: string; badge: string } {
  if (value >= thresholds[1]) return {
    text:  'text-[#11875D]',
    bg:    'bg-[#E8F7EF] border-[#A3D9BE]',
    badge: 'bg-[#E8F7EF] text-[#0D6B46]',
  }
  if (value >= thresholds[0]) return {
    text:  'text-[#B56A00]',
    bg:    'bg-[#FFF4DA] border-[#F3D391]',
    badge: 'bg-[#FFF4DA] text-[#854D0E]',
  }
  return {
    text:  'text-[#D83B3B]',
    bg:    'bg-[#FCEAEA] border-[#F0B8B8]',
    badge: 'bg-[#FCEAEA] text-[#991B1B]',
  }
}

// Thin shims kept for any existing call sites in this file
const ScoreColor  = (v: number, t: [number, number]) => getScoreColorScheme(v, t).text
const BgColor     = (v: number, t: [number, number]) => getScoreColorScheme(v, t).bg
const BadgeColor  = (v: number, t: [number, number]) => getScoreColorScheme(v, t).badge

// Groups: Profitability (0-3), Leverage/Cash (4-6), Efficiency (7-8)
const PIOTROSKI_GROUPS = [
  { label: 'Profitability', indices: [0, 1, 2, 3] },
  { label: 'Leverage & Cash', indices: [4, 5, 6] },
  { label: 'Efficiency', indices: [7, 8] },
]

function CriterionRow({ pass, name, detail }: { pass: boolean | null; name: string; detail: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
        pass === null ? 'bg-[#CDD1C8] text-[#566174]' : pass ? 'bg-[#E8F7EF]0' : 'bg-[#FCEAEA]0'
      }`}>
        {pass === null ? '?' : pass ? '✓' : '✗'}
      </div>
      <span className="flex-1 text-[11px] text-[#06101F]">{name}</span>
      <span className="text-[11px] text-[#566174] font-mono tabular-nums">{detail}</span>
    </div>
  )
}

export default function FinancialScores({ scores }: Props) {
  const { piotroski, altman, beneish, roic } = scores
  const [showAltman, setShowAltman] = useState(false)
  const [showBeneish, setShowBeneish] = useState(false)
  const reduced = useReducedMotion()

  const fmtM = (n: number) => {
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}B`
    return `$${n.toFixed(0)}M`
  }

  const piotroskiNoData = piotroski.score <= 1 && piotroski.criteria.every((c) => c.pass !== true || c.detail.includes('0.0%') || c.detail.includes('$0.0B'))
  const roicNoData = !roic.dataAvailable
  const noData = piotroskiNoData && altman == null && beneish == null && roicNoData

  if (noData) {
    return (
      <div className="rounded-xl card p-6">
        <h2 className="mb-4 text-[13px] font-[700] text-[#111111] leading-tight">Financial Quality Scores</h2>
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-12 h-12 rounded-full bg-[#F4F3EF] flex items-center justify-center">
            <svg className="w-6 h-6 text-[#8A95A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#566174]">Fundamental data unavailable</p>
          <p className="text-[11px] text-[#566174] text-center max-w-xs leading-relaxed">
            Yahoo Finance did not return financial statements for this ticker. Quality scores require at least 2 years of income statement and balance sheet data.
          </p>
        </div>
      </div>
    )
  }

  const altmanSafe = altman != null && isFinite(altman.zScore) && Math.abs(altman.zScore) <= 50 ? altman : null
  const altmanGood = altmanSafe != null && altmanSafe.zScore >= 3.0
  const altmanMid  = altmanSafe != null && altmanSafe.zScore >= 1.8 && altmanSafe.zScore < 3.0
  const altmanColor = altmanSafe == null ? 'text-[#8A95A6]' : altmanGood ? 'text-[#11875D]' : altmanMid ? 'text-[#B56A00]' : 'text-[#D83B3B]'
  const altmanBg    = altmanSafe == null ? 'bg-[#F4F3EF] border-[#E3E1DA]' : altmanGood ? 'bg-[#E8F7EF] border-[#A3D9BE]' : altmanMid ? 'bg-[#FFF4DA] border-[#F3D391]' : 'bg-[#FCEAEA] border-[#F0B8B8]'
  const altmanBadge = altmanSafe == null ? 'bg-[#F4F3EF] text-[#566174]' : altmanGood ? 'bg-[#E8F7EF] text-[#0D6B46]' : altmanMid ? 'bg-[#FFF4DA] text-[#854D0E]' : 'bg-[#FCEAEA] text-[#991B1B]'
  const altmanZoneLabel = altmanSafe == null ? 'No data' : altmanSafe.zone === 'Safe' ? 'Safe Zone' : altmanSafe.zone === 'Grey' ? 'Grey Zone' : 'Distress Zone'

  const mScore = beneish?.mScore ?? 0
  const beneishClean = beneish?.flag === 'Clean'
  const beneishWarn  = beneish?.flag === 'Warning'
  const beneishColor = beneishClean ? 'text-[#11875D]' : beneishWarn ? 'text-[#B56A00]' : 'text-[#D83B3B]'
  const beneishBg    = beneishClean ? 'bg-[#E8F7EF] border-[#A3D9BE]' : beneishWarn ? 'bg-[#FFF4DA] border-[#F3D391]' : 'bg-[#FCEAEA] border-[#F0B8B8]'
  const beneishBadge = beneishClean ? 'bg-[#E8F7EF] text-[#0D6B46]' : beneishWarn ? 'bg-[#FFF4DA] text-[#854D0E]' : 'bg-[#FCEAEA] text-[#991B1B]'
  const beneishLabel = beneish?.flag === 'Clean' ? 'Unlikely Manipulator' : beneish?.flag === 'Warning' ? 'Watch' : 'Possible Manipulation'

  const spreadPp   = Math.round(roic.spread * 1000) / 10
  const spreadGood = roic.spread > 0

  // ROIC bar: show ROIC and WACC as proportional bars (cap display at 40% for readability)
  const roicPct = Math.min(Math.max(roic.roic * 100, 0), 40)
  const waccPct = Math.min(Math.max((roic.roic - roic.spread) * 100, 0), 40)
  const barScale = 40  // 40% = full width

  return (
    <div className="rounded-xl card p-6">
      <h2 className="mb-5 text-[13px] font-[700] text-[#111111] leading-tight">Financial Quality Scores</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* ── Financial Strength (Piotroski F-Score) ── */}
        <div className={`rounded-xl border p-4 ${BgColor(piotroski.score, [4, 8])}`}>
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-[11px] font-[600] text-[#566174]">Financial Strength</p>
              <p className="text-[10px] text-[#8A95A6] mt-0.5">Piotroski F-Score</p>
              <p className={`mt-0.5 text-3xl font-bold tabular-nums ${ScoreColor(piotroski.score, [4, 8])}`}>
                {piotroski.score}<span className="text-base font-normal text-[#566174]"> / 9</span>
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${BadgeColor(piotroski.score, [4, 8])}`}>
              {piotroski.label}
            </span>
          </div>
          <p className="mb-4 text-[11px] text-[#8A95A6] leading-relaxed">
            9 binary accounting signals across profitability, leverage, and efficiency. Score ≥ 7 = strong. Score ≤ 3 = weak.
          </p>

          {/* Grouped criteria — always visible */}
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
          >
            {PIOTROSKI_GROUPS.map((group) => {
              const groupCriteria = group.indices.map(i => piotroski.criteria[i]).filter(Boolean)
              const groupPass = groupCriteria.filter(c => c.pass === true).length
              return (
                <motion.div
                  key={group.label}
                  variants={reduced ? {} : { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-[#566174]">{group.label}</p>
                    <p className="text-[10px] font-mono text-[#566174]">{groupPass}/{group.indices.length}</p>
                  </div>
                  <div className="divide-y divide-[#E3E1DA] rounded-lg bg-white border border-[#E3E1DA] px-2">
                    {groupCriteria.map((c, j) => (
                      <CriterionRow key={j} pass={c.pass} name={c.name} detail={c.detail} />
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>

        {/* ── Bankruptcy Risk (Altman Z-Score) ── */}
        <div className={`rounded-xl border p-4 ${altmanBg}`}>
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-[11px] font-[600] text-[#566174]">
                Bankruptcy Risk
                {altmanSafe && !altmanSafe.isReliable && (
                  <span className="ml-1.5 text-[10px] text-[#B56A00] font-medium">(EM)</span>
                )}
              </p>
              <p className="text-[10px] text-[#8A95A6] mt-0.5">Altman Z-Score</p>
              {altmanSafe != null ? (
                <p className={`mt-0.5 text-3xl font-bold tabular-nums ${altmanColor}`}>
                  {altmanSafe.zScore.toFixed(2)}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-[#566174]">Insufficient data</p>
              )}
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${altmanBadge}`}>
              {altmanZoneLabel}
            </span>
          </div>
          <p className="mb-4 text-[11px] text-[#566174] leading-relaxed">
            Predicts bankruptcy risk within 2 years using 5 financial ratios.
            Z &lt; 1.8 = distress · 1.8–3.0 = grey · Z ≥ 3.0 = safe.
            {altmanSafe && !altmanSafe.isReliable && (
              <span className="text-[#B56A00]"> Limited reliability for non-US/EM companies.</span>
            )}
          </p>

          {altmanSafe != null && (
            <div className="mb-4">
              {/* Proportional zone bar: 0–1.8 = distress (24%), 1.8–3.0 = grey (16%), 3.0–7.5 = safe (60%) */}
              <div className="relative h-2.5 w-full rounded-full bg-[#E3E1DA] overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-[#D83B3B]" style={{ width: '24%' }} />
                <div className="absolute top-0 h-full bg-[#B56A00]" style={{ left: '24%', width: '16%' }} />
                <div className="absolute top-0 h-full bg-[#11875D]" style={{ left: '40%', width: '60%' }} />
                {/* Pointer */}
                <div
                  className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-700 shadow"
                  style={{ left: `${Math.min(Math.max(altmanSafe.zScore / 7.5 * 100, 2), 98)}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-[#566174]">
                <span>Distress &lt;1.8</span>
                <span>Grey zone</span>
                <span>Safe ≥3.0</span>
              </div>
            </div>
          )}

          {altmanSafe != null && (
            <>
              <button
                onClick={() => setShowAltman(!showAltman)}
                className="text-[11px] text-olive-600 hover:text-olive-700 underline underline-offset-2"
              >
                {showAltman ? 'Hide components ↑' : 'Show components ↓'}
              </button>
              {showAltman && (
                <ul className="mt-2 space-y-1 rounded-lg bg-white border border-[#E3E1DA] px-3 py-2">
                  {[
                    { label: 'X1 · Working Capital / Assets', value: altmanSafe.components.x1, weight: '×1.2' },
                    { label: 'X2 · Retained Earnings / Assets', value: altmanSafe.components.x2, weight: '×1.4' },
                    { label: 'X3 · EBIT / Assets', value: altmanSafe.components.x3, weight: '×3.3' },
                    { label: 'X4 · Mkt Cap / Total Liabilities', value: altmanSafe.components.x4, weight: '×0.6' },
                    { label: 'X5 · Revenue / Assets', value: altmanSafe.components.x5, weight: '×1.0' },
                  ].map((row) => (
                    <li key={row.label} className="flex items-center gap-1 text-[11px] py-0.5">
                      <span className="text-[#566174] w-8 shrink-0">{row.weight}</span>
                      <span className="flex-1 text-[#566174]">{row.label}</span>
                      <span className="tabular-nums text-[#06101F] font-mono">{row.value.toFixed(3)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ── Earnings Quality (Beneish M-Score) ── */}
        <div className={`rounded-xl border p-4 ${beneish ? beneishBg : 'bg-[#F4F3EF] border-[#E3E1DA]'}`}>
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-[11px] font-[600] text-[#566174]">Earnings Quality</p>
              <p className="text-[10px] text-[#8A95A6] mt-0.5">Beneish M-Score</p>
              {beneish ? (
                <p className={`mt-0.5 text-3xl font-bold tabular-nums ${beneishColor}`}>
                  {mScore.toFixed(2)}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-[#566174]">Not applicable</p>
              )}
            </div>
            {beneish ? (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${beneishBadge}`}>
                {beneishLabel}
              </span>
            ) : (
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-[#F4F3EF] text-[#566174]">
                N/A
              </span>
            )}
          </div>
          <p className="mb-3 text-[11px] text-[#566174] leading-relaxed">
            Detects earnings manipulation using 8 accounting ratios. M-Score ≤ −1.78 = unlikely manipulator.
            {!beneish && (
              <span className="text-[#8A95A6]"> Not available — requires USD-reporting financials (YoY ratios are inflation-distorted for non-USD companies).</span>
            )}
          </p>

          {beneish && (
            <>
              <p className="mb-3 text-[11px] text-[#566174]">
                Threshold ≤ −1.78 = clean.{' '}
                <span className={beneishClean ? 'text-[#11875D]' : 'text-[#B56A00]'}>
                  {beneishClean ? 'Earnings quality looks intact.' : 'Review accounting signals.'}
                </span>
              </p>
              <button
                onClick={() => setShowBeneish(!showBeneish)}
                className="text-[11px] text-olive-600 hover:text-olive-700 underline underline-offset-2"
              >
                {showBeneish ? 'Hide indices ↑' : 'Show indices ↓'}
              </button>
              {showBeneish && (
                <ul className="mt-2 space-y-1 rounded-lg bg-white border border-[#E3E1DA] px-3 py-2">
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
                    <li key={row.label} className="flex items-center gap-1 text-[11px] py-0.5">
                      <span className="flex-1 text-[#566174]">{row.label}</span>
                      <span className="tabular-nums text-[#06101F] font-mono">{row.value.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ── Value Creation (ROIC vs WACC) ── */}
        {roic.dataAvailable && (
          <div className={`rounded-xl border p-4 ${spreadGood ? 'bg-[#E8F7EF] border-[#A3D9BE]' : 'bg-[#FCEAEA] border-[#F0B8B8]'}`}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <p className="text-[11px] font-[600] text-[#566174]">Value Creation</p>
                <p className="text-[10px] text-[#8A95A6] mt-0.5">ROIC vs cost of capital</p>
                <p className={`mt-0.5 text-3xl font-bold tabular-nums ${spreadGood ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                  {fmtPct(roic.roic)}
                </p>
                <p className="text-[11px] text-[#566174]">ROIC</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${spreadGood ? 'bg-[#E8F7EF] text-[#0D6B46]' : 'bg-[#FCEAEA] text-[#991B1B]'}`}>
                {spreadGood ? 'Value Created' : 'Value Destroyed'}
              </span>
            </div>
            <p className="mb-4 text-[11px] text-[#566174] leading-relaxed">
              When ROIC exceeds WACC, each invested dollar generates more than it costs — compounding value over time.
            </p>

            {/* Mini bar comparison */}
            <div className="space-y-2 mb-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-[#566174] font-medium">ROIC</span>
                  <span className={`text-[11px] font-mono font-semibold ${spreadGood ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>{fmtPct(roic.roic)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#E3E1DA] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${spreadGood ? 'bg-[#E8F7EF]0' : 'bg-[#FCEAEA]0'}`}
                    style={{ width: `${(roicPct / barScale) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-[#566174] font-medium">WACC</span>
                  <span className="text-[11px] font-mono font-semibold text-[#06101F]">{fmtPct(roic.roic - roic.spread)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#E3E1DA] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#8A95A6]"
                    style={{ width: `${(waccPct / barScale) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#E3E1DA]">
                <span className="text-[10px] text-[#566174]">Spread (ROIC − WACC)</span>
                <span className={`text-[12px] font-bold font-mono ${spreadGood ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                  {spreadPp > 0 ? '+' : ''}{spreadPp.toFixed(1)} pp
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-white border border-[#E3E1DA] px-3 py-2 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#566174]">NOPAT</span>
                <span className="tabular-nums text-[#06101F] font-mono">{fmtM(roic.nopat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#566174]">Invested Capital</span>
                <span className="tabular-nums text-[#06101F] font-mono">{fmtM(roic.investedCapital)}</span>
              </div>
            </div>
          </div>
        )}

      </div>

      <p className="mt-4 text-[10px] text-[#8A95A6]">
        Piotroski (2000), Altman (1968), Beneish (1999), ROIC/WACC per Damodaran framework. Computed from trailing annual financials.
      </p>
    </div>
  )
}
