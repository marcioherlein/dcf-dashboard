'use client'
import { useState } from 'react'
import { fmt, fmtPct } from '@/lib/utils'

interface CFRow { year: number; cashFlow: number; discounted: number }
interface FairValue {
  ev: number; cash: number; debt: number; marketCap: number
  equityValue: number; sharesOutstanding: number
  fairValuePerShare: number; currentPrice: number; upsidePct: number; irr: number
}
interface Scenarios {
  bull: { fairValue: number; wacc: number; cagr: number; terminalG: number }
  base: { fairValue: number; wacc: number; cagr: number; terminalG: number }
  bear: { fairValue: number; wacc: number; cagr: number; terminalG: number }
}
interface Props {
  projections: CFRow[]; terminalValue: number; terminalValueDiscounted: number
  sumPV: number; ev: number; fairValue: FairValue
  wacc: number; cagr: number; terminalG: number; scenarios: Scenarios
  // For client-side recalculation when g is overridden
  baseFCF: number
  // Override state managed by parent
  terminalGOverride?: number | null
  onTerminalGChange?: (g: number | null) => void
  // Growth model
  growthModel?: 'two-stage' | 'three-stage'
  yearlyGrowthRates?: number[]
}

// Re-runs DCF projection inline (mirrors server logic) for scenario recalculation
function computeScenarioFV(
  baseFCF: number, cagr: number, waccBase: number,
  scenWaccAdj: number, scenCagrAdj: number, g: number,
  cash: number, debt: number, shares: number,
): number {
  const w = Math.max(waccBase + scenWaccAdj, 0.04)
  const c = Math.max(cagr + scenCagrAdj, -0.05)
  const gCapped = Math.min(Math.max(g, 0), w - 0.005)
  let cf = baseFCF
  let sumPV = 0
  for (let t = 1; t <= 10; t++) {
    cf = cf * (1 + c)
    sumPV += cf / Math.pow(1 + w, t)
  }
  const tv = (cf * (1 + gCapped)) / (w - gCapped)
  const tvDisc = tv / Math.pow(1 + w, 10)
  const ev = sumPV + tvDisc
  return shares > 0 ? Math.round(((ev + cash - debt) / shares) * 100) / 100 : 0
}

export default function DCFModel({
  projections, terminalValue, terminalValueDiscounted, fairValue,
  wacc, cagr, terminalG, scenarios,
  baseFCF, terminalGOverride, onTerminalGChange,
  growthModel = 'two-stage', yearlyGrowthRates,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')

  const activeG = terminalGOverride ?? terminalG

  // ── Client-side recalculation when terminalG is overridden ─────────────────
  const sumPVcfs = projections.reduce((s, p) => s + p.discounted, 0)
  const years = projections.length
  const lastCF = projections[years - 1]?.cashFlow ?? 0

  const activeTVraw = wacc > activeG
    ? lastCF * (1 + activeG) / (wacc - activeG)
    : lastCF * 15
  const activeTVdisc = activeTVraw / Math.pow(1 + wacc, years)
  const activeEV = sumPVcfs + activeTVdisc
  const activeFVperShare = fairValue.sharesOutstanding > 0
    ? (activeEV + fairValue.cash - fairValue.debt) / fairValue.sharesOutstanding
    : fairValue.fairValuePerShare
  const activeUpside = fairValue.currentPrice > 0
    ? (activeFVperShare - fairValue.currentPrice) / fairValue.currentPrice
    : fairValue.upsidePct

  const SCENARIO_DEFS = [
    { label: 'bull', waccAdj: -0.01, cagrAdj: +0.02, tgAdj: +0.005 },
    { label: 'base', waccAdj:  0,    cagrAdj:  0,    tgAdj:  0    },
    { label: 'bear', waccAdj: +0.01, cagrAdj: -0.02, tgAdj: -0.005 },
  ] as const

  // Recompute scenarios if g is overridden
  type ScenKey = 'bull' | 'base' | 'bear'
  const activeScenarios: Scenarios = terminalGOverride == null
    ? scenarios
    : ((): Scenarios => {
        const out: Partial<Scenarios> = {}
        for (const s of SCENARIO_DEFS) {
          const w = Math.max(wacc + s.waccAdj, 0.04)
          const c = Math.max(cagr + s.cagrAdj, -0.05)
          const g = Math.min(Math.max(activeG + s.tgAdj, 0), w - 0.005)
          out[s.label] = {
            fairValue: computeScenarioFV(baseFCF, cagr, wacc, s.waccAdj, s.cagrAdj, activeG, fairValue.cash, fairValue.debt, fairValue.sharesOutstanding),
            wacc: w,
            cagr: c,
            terminalG: g,
          }
        }
        return out as Scenarios
      })()

  // Displayed terminal value values
  const dispTV     = terminalGOverride != null ? Math.round(activeTVraw)  : terminalValue
  const dispTVdisc = terminalGOverride != null ? Math.round(activeTVdisc) : terminalValueDiscounted
  const dispFV     = terminalGOverride != null ? Math.round(activeFVperShare * 100) / 100 : fairValue.fairValuePerShare
  const dispUpside = terminalGOverride != null ? activeUpside : fairValue.upsidePct
  const dispEV     = terminalGOverride != null ? Math.round(activeEV) : fairValue.ev

  const up = dispUpside >= 0

  // ── Inline editor handlers ──────────────────────────────────────────────────
  function commitEdit() {
    setEditing(false)
    const parsed = parseFloat(inputVal)
    if (!isNaN(parsed) && parsed > 0 && parsed < 15) {
      onTerminalGChange?.(parsed / 100)
    }
  }

  function cancelEdit() {
    setEditing(false)
  }

  function resetG() {
    onTerminalGChange?.(null)
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-black/[0.06] bg-white shadow-sm dark:border-white/8 dark:bg-[#111]">
        <div className="px-6 pt-5 pb-2">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70">DCF Model</h2>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-white/30">
              <span>WACC <strong className="text-gray-800 dark:text-white/70">{fmtPct(wacc)}</strong></span>
              <span>CAGR <strong className="text-gray-800 dark:text-white/70">{fmtPct(cagr)}</strong></span>
              {growthModel === 'three-stage' && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
                  3-stage fade
                </span>
              )}

              {/* Terminal g — editable */}
              {editing ? (
                <span className="flex items-center gap-1">
                  <span>Terminal g</span>
                  <input
                    autoFocus
                    className="w-14 rounded border border-indigo-400 bg-transparent px-1.5 py-0.5 text-xs font-semibold text-gray-800 dark:text-white outline-none tabular-nums"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    placeholder="e.g. 2.5"
                  />
                  <span className="text-gray-400">%</span>
                  {terminalGOverride != null && (
                    <button
                      onMouseDown={(e) => { e.preventDefault(); resetG() }}
                      className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-white/60 ml-0.5"
                    >
                      × reset
                    </button>
                  )}
                </span>
              ) : (
                <button
                  onClick={() => {
                    setInputVal((activeG * 100).toFixed(1))
                    setEditing(true)
                  }}
                  className="flex items-center gap-1 rounded px-1 -ml-1 hover:bg-gray-100 dark:hover:bg-white/5 transition"
                  title="Click to override terminal growth rate"
                >
                  <span>Terminal g</span>
                  <strong className={terminalGOverride != null ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-white/70'}>
                    {fmtPct(activeG)}
                  </strong>
                  {terminalGOverride != null
                    ? <span className="text-[9px] text-indigo-500 dark:text-indigo-400 font-medium">override</span>
                    : <span className="text-[9px] text-gray-300 dark:text-white/15">✎</span>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <td className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-white/25">DCF MODEL</td>
              {(projections ?? []).map((p) => (
                <td key={p.year} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-white/25">{p.year}</td>
              ))}
              <td className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-white/25">TV</td>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 dark:border-white/5">
              <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-white/25">CF (M)</td>
              {(projections ?? []).map((p) => (
                <td key={p.year} className="px-3 py-2.5 text-center text-sm font-medium text-gray-800 dark:text-white/80">{fmt(p.cashFlow, 0)}</td>
              ))}
              <td className={`px-3 py-2.5 text-center text-sm font-medium ${terminalGOverride != null ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-white/80'}`}>
                {fmt(dispTV, 0)}
              </td>
            </tr>
            <tr className="border-t border-gray-100 bg-gray-50 dark:border-white/5 dark:bg-white/[0.03]">
              <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-white/25">DCF (M)</td>
              {(projections ?? []).map((p) => (
                <td key={p.year} className="px-3 py-2.5 text-center text-sm text-gray-600 dark:text-white/50">{fmt(p.discounted, 0)}</td>
              ))}
              <td className={`px-3 py-2.5 text-center text-sm ${terminalGOverride != null ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-600 dark:text-white/50'}`}>
                {fmt(dispTVdisc, 0)}
              </td>
            </tr>
            {growthModel === 'three-stage' && yearlyGrowthRates && yearlyGrowthRates.length > 0 && (
              <tr className="border-t border-gray-100 dark:border-white/5">
                <td className="px-4 py-1.5 text-xs text-gray-400 dark:text-white/20">g/yr</td>
                {yearlyGrowthRates.map((g, i) => (
                  <td key={i} className={`px-3 py-1.5 text-center text-xs tabular-nums ${i >= 5 ? 'text-violet-500 dark:text-violet-400 font-medium' : 'text-gray-400 dark:text-white/30'}`}>
                    {fmtPct(g)}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-center text-xs text-gray-300 dark:text-white/20">{fmtPct(terminalG)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#111]">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/25">Enterprise Value Bridge</h3>
          <div className="mt-4 space-y-2 text-sm">
            {[
              { label: 'EV',           value: `$ ${fmt(dispEV / 1000, 2)}B`,              g: false, r: false, b: false },
              { label: 'CASH (+)',     value: `$ ${fmt(fairValue.cash, 0)}M`,              g: true,  r: false, b: false },
              { label: 'DEBT (−)',     value: `$ ${fmt(fairValue.debt, 0)}M`,              g: false, r: true,  b: false },
              { label: 'MKT CAP',     value: `$ ${fmt(fairValue.marketCap / 1000, 2)}B`,  g: false, r: false, b: false },
              { label: 'SHARES OUT.', value: `${fmt(fairValue.sharesOutstanding, 0)}M`,   g: false, r: false, b: false },
              { label: 'FAIR VALUE',  value: `$ ${fmt(dispFV)}`,                           g: false, r: false, b: true },
              { label: 'PRICE',       value: `$ ${fmt(fairValue.currentPrice)}`,           g: false, r: false, b: false },
            ].map((row) => (
              <div key={row.label} className={`flex justify-between border-b border-gray-100 pb-1.5 dark:border-white/5 ${row.b ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/50'}`}>
                <span className={row.g ? 'text-emerald-600 dark:text-emerald-400' : row.r ? 'text-red-500 dark:text-red-400' : ''}>{row.label}</span>
                <span className={row.b && terminalGOverride != null ? 'text-indigo-600 dark:text-indigo-400' : ''}>{row.value}</span>
              </div>
            ))}
            <div className={`flex justify-between pt-1 font-bold text-base ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              <span>UPSIDE POTENTIAL</span>
              <span>{up ? '+' : ''}{fmtPct(dispUpside)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500 dark:text-white/30">
              <span>IRR (5Y)</span><span>{fmtPct(fairValue.irr)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#111]">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/25">Scenarios</h3>
          <div className="mt-4 space-y-3">
            {([
              { label: 'Bull', key: 'bull' as ScenKey, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
              { label: 'Base', key: 'base' as ScenKey, cls: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400' },
              { label: 'Bear', key: 'bear' as ScenKey, cls: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400' },
            ]).map((s) => {
              const sc = activeScenarios[s.key]
              const upside = ((sc.fairValue - fairValue.currentPrice) / fairValue.currentPrice) * 100
              return (
                <div key={s.key} className={`rounded-xl px-4 py-3 ${s.cls}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className="text-lg font-bold" style={{ letterSpacing: '-0.02em' }}>${fmt(sc.fairValue)}</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs opacity-70">
                    <span>WACC {fmtPct(sc.wacc)}</span>
                    <span>CAGR {fmtPct(sc.cagr)}</span>
                    <span>g {fmtPct(sc.terminalG)}</span>
                    <span className="ml-auto font-medium">{upside >= 0 ? '+' : ''}{upside.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
