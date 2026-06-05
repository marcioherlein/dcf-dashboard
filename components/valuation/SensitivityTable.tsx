'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  baseFCF: number       // last historical FCF in $M (UFCF or LFCF)
  baseWacc: number      // base discount rate (WACC for unlevered, costOfEquity for levered)
  baseCagr: number      // effective FCF CAGR as decimal (e.g. 0.22)
  terminalG: number     // terminal growth rate as decimal
  cashM: number         // net cash in $M (0 when isLevered — equity bridge already embedded)
  debtM: number         // gross debt in $M (0 when isLevered)
  sharesM: number       // diluted shares in millions
  currentPrice: number  // current stock price
  numYears: number      // projection horizon
  currency: string
  terminalMethod?: 'perpetuity' | 'multiple'
  exitMultiple?: number
  isLevered?: boolean
}

// 7 WACC steps centred on base (±3pp in 1pp increments)
const WACC_DELTAS  = [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03] as const

// 9 CAGR steps centred on base (±4pp in 1pp increments)
const CAGR_DELTAS  = [-0.04, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04] as const

const BASE_WACC_IDX = 3   // index of delta=0 in WACC_DELTAS
const BASE_CAGR_IDX = 4   // index of delta=0 in CAGR_DELTAS

function computeCell(
  baseFCF: number, cagr: number, wacc: number,
  terminalG: number, cashM: number, debtM: number,
  sharesM: number, n: number, currentPrice: number,
  terminalMethod: 'perpetuity' | 'multiple',
  exitMultiple: number,
  isLevered: boolean,
): { fv: number; upside: number } | null {
  if (wacc <= 0 || sharesM <= 0 || n <= 0) return null
  if (terminalMethod === 'perpetuity' && wacc <= terminalG) return null

  // PV of projected FCFs
  let pvFCFs = 0
  for (let i = 1; i <= n; i++) {
    pvFCFs += (baseFCF * Math.pow(1 + cagr, i)) / Math.pow(1 + wacc, i)
  }

  const lastFCF = baseFCF * Math.pow(1 + cagr, n)

  // Terminal value
  const tv = terminalMethod === 'multiple'
    ? lastFCF * exitMultiple
    : (lastFCF * (1 + terminalG)) / (wacc - terminalG)
  const pvTV = tv / Math.pow(1 + wacc, n)

  const totalPV = pvFCFs + pvTV
  // Levered: LFCF is already an equity measure — no bridge needed
  const equity = isLevered ? totalPV : totalPV + cashM - debtM
  if (!isFinite(equity)) return null

  const fv     = equity / sharesM
  const upside = currentPrice > 0 ? (fv - currentPrice) / currentPrice : 0
  return { fv, upside }
}

function upside2Color(upside: number): string {
  if (upside >=  0.30) return 'bg-emerald-600 text-white'
  if (upside >=  0.15) return 'bg-emerald-500 text-white'
  if (upside >=  0.05) return 'bg-emerald-200 text-emerald-900'
  if (upside >= -0.05) return 'bg-white/8 text-slate-300'
  if (upside >= -0.15) return 'bg-amber-200 text-amber-900'
  if (upside >= -0.30) return 'bg-orange-400 text-white'
  return 'bg-red-600 text-white'
}

function fmt(v: number, symbol: string): string {
  const abs = Math.abs(v)
  if (abs >= 1000) return symbol + (v / 1000).toFixed(1) + 'k'
  return symbol + v.toFixed(0)
}

export default function SensitivityTable({
  baseFCF, baseWacc, baseCagr, terminalG,
  cashM, debtM, sharesM, currentPrice, numYears, currency,
  terminalMethod = 'perpetuity',
  exitMultiple = 15,
  isLevered = false,
}: Props) {
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency

  const grid = useMemo(() =>
    WACC_DELTAS.map(wd => {
      const wacc = Math.max(0.02, baseWacc + wd)
      return CAGR_DELTAS.map(cd => {
        const cagr = baseCagr + cd
        return computeCell(baseFCF, cagr, wacc, terminalG, cashM, debtM, sharesM, numYears, currentPrice, terminalMethod, exitMultiple, isLevered)
      })
    }),
  [baseFCF, baseWacc, baseCagr, terminalG, cashM, debtM, sharesM, numYears, currentPrice, terminalMethod, exitMultiple, isLevered])

  const noData = baseFCF === 0 || sharesM === 0

  return (
    <div className="rounded-xl bg-[#0d1117] border border-[#222] isolate">
      <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-[13px] font-bold text-white">Sensitivity Analysis</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Fair value at each {isLevered ? 'FCF' : 'Revenue'} CAGR × {isLevered ? 'Cost of Equity' : 'WACC'} combination — base case highlighted
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
            isLevered ? 'bg-purple-900/40 border-purple-700 text-purple-300' : 'bg-blue-900/40 border-blue-700 text-blue-300'
          )}>
            {isLevered ? 'Levered (LFCF)' : 'Unlevered (UFCF)'}
          </span>
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
            terminalMethod === 'multiple' ? 'bg-amber-900/40 border-amber-700 text-amber-300' : 'bg-slate-700 border-slate-600 text-slate-200'
          )}>
            {terminalMethod === 'multiple' ? `Exit ${exitMultiple.toFixed(1)}×` : `g = ${(terminalG * 100).toFixed(1)}%`}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">{numYears}yr horizon</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-900/40 border-amber-700 text-amber-300">
            Full DCF only
          </span>
        </div>
      </div>
      {currentPrice > 0 && (
        <p className="text-[10px] text-slate-400 px-5 pb-3">
          Sensitivity reflects the Full DCF model. The blended fair value at the top of the page also includes Forward P/E, Revenue Multiple, and other methods.
        </p>
      )}

      {noData ? (
        <div className="px-5 py-10 text-center text-[12px] text-slate-400">
          Insufficient FCF data to build sensitivity table for this company.
        </div>
      ) : (
        <div className="overflow-x-auto px-4 py-4">
          <div className="min-w-[480px] sm:min-w-[580px]">

            {/* Column header: CAGR axis */}
            <div className="flex items-end mb-1.5">
              {/* Corner: WACC label */}
              <div className="shrink-0 text-right pr-3 w-[64px] sm:w-[90px]">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">WACC ↓</span>
              </div>

              {/* CAGR column headers */}
              <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${CAGR_DELTAS.length}, 1fr)` }}>
                {CAGR_DELTAS.map((cd, ci) => {
                  const abs = (baseCagr + cd) * 100
                  const isBase = ci === BASE_CAGR_IDX
                  return (
                    <div key={ci} className={cn(
                      'text-center pb-1.5 border-b',
                      isBase ? 'border-blue-500' : 'border-transparent'
                    )}>
                      <div className={cn(
                        'text-[10px] font-bold font-mono leading-tight',
                        isBase ? 'text-blue-400' : 'text-slate-300'
                      )}>
                        {abs.toFixed(0)}%
                      </div>
                      <div className={cn(
                        'text-[9px] leading-none',
                        isBase ? 'text-blue-400' : 'text-slate-400'
                      )}>
                        {cd === 0 ? 'base' : `${cd > 0 ? '+' : ''}${(cd * 100).toFixed(0)}pp`}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Title above columns */}
            <div className="flex items-start mb-2">
              <div className="shrink-0 w-[64px] sm:w-[90px]" />
              <div className="flex-1 text-center">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Revenue CAGR →</span>
              </div>
            </div>

            {/* Grid rows */}
            {WACC_DELTAS.map((wd, wi) => {
              const absWacc = (baseWacc + wd) * 100
              const isBaseRow = wi === BASE_WACC_IDX
              return (
                <div key={wi} className="flex items-stretch mb-0.5">
                  {/* WACC row label */}
                  <div className="shrink-0 pr-3 flex flex-col justify-center text-right w-[64px] sm:w-[90px]">
                    <div className={cn(
                      'text-[10px] font-bold font-mono leading-tight',
                      isBaseRow ? 'text-blue-400' : 'text-slate-300'
                    )}>
                      {absWacc.toFixed(1)}%
                    </div>
                    <div className={cn(
                      'text-[9px] leading-none',
                      isBaseRow ? 'text-blue-400' : 'text-slate-400'
                    )}>
                      {wd === 0 ? 'base' : `${wd > 0 ? '+' : ''}${(wd * 100).toFixed(1)}pp`}
                    </div>
                  </div>

                  {/* Cells */}
                  <div className="flex-1 grid gap-0.5" style={{ gridTemplateColumns: `repeat(${CAGR_DELTAS.length}, 1fr)` }}>
                    {grid[wi].map((cell, ci) => {
                      const isBase = wi === BASE_WACC_IDX && ci === BASE_CAGR_IDX
                      return (
                        <div
                          key={ci}
                          className={cn(
                            'rounded-sm py-2 px-0.5 text-center transition-opacity',
                            cell ? upside2Color(cell.upside) : 'bg-[#1a1a1a] text-slate-400',
                            isBase && 'ring-2 ring-blue-400 ring-offset-1 ring-offset-[#0d1117] relative z-10',
                          )}
                          title={cell
                            ? `Fair Value: ${sym}${cell.fv.toFixed(2)}\nUpside: ${(cell.upside * 100).toFixed(1)}%`
                            : 'N/A (wacc ≤ terminalG)'
                          }
                        >
                          {cell ? (
                            <>
                              <div className="text-[10px] font-bold font-mono leading-tight">
                                {fmt(cell.fv, sym)}
                              </div>
                              <div className="text-[9px] leading-none opacity-85">
                                {cell.upside >= 0 ? '+' : ''}{(cell.upside * 100).toFixed(0)}%
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px]">—</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-[#222]">
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Upside vs current price:</span>
              {[
                { cls: 'bg-red-600',     label: '< −30%'     },
                { cls: 'bg-orange-400',  label: '−15% to −30%' },
                { cls: 'bg-amber-200',   label: '−5% to −15%'  },
                { cls: 'bg-slate-100',   label: 'Fair ±5%'     },
                { cls: 'bg-emerald-200', label: '+5% to +15%'  },
                { cls: 'bg-emerald-500', label: '+15% to +30%' },
                { cls: 'bg-emerald-600', label: '> +30%'       },
              ].map(({ cls, label }) => (
                <span key={label} className="flex items-center gap-1">
                  <span className={cn('w-2.5 h-2.5 rounded-sm flex-shrink-0', cls)} />
                  <span className="text-[9px] text-slate-400">{label}</span>
                </span>
              ))}
            </div>

            <p className="text-[9px] text-slate-400 mt-2">
              {terminalMethod === 'multiple'
                ? `Terminal value via FCF × ${exitMultiple.toFixed(1)}× exit multiple on final projected year FCF.`
                : 'Computed via Gordon Growth Model on projected terminal FCF.'
              }{' '}
              {isLevered ? 'Levered: LFCF is an equity measure — no cash/debt bridge applied.' : 'Does not account for dilution or changing capex ratios.'}{' '}
              Base case (⬤) matches current model assumptions.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
