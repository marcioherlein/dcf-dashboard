'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

interface Props {
  data: AnyData
}

function gradeChipClass(grade: string): string {
  const g = grade.replace('+', '').replace('-', '')
  if (g === 'A') return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (g === 'B') return 'text-blue-700 bg-blue-50 border-blue-200'
  if (g === 'C') return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

export default function MobileKeyInsights({ data }: Props) {
  const [open, setOpen] = useState(true)
  if (!data) return null

  const { quote, analystRecommendation, ratings, valuationMethods, cagrAnalysis } = data
  const { price, fiftyTwoWeekHigh, fiftyTwoWeekLow, analystTargetMean, currency } = quote
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : (currency + ' ')

  const recNorm = (analystRecommendation ?? '').toLowerCase()
  const isBuy  = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
  const recBg    = isBuy  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                 : isSell ? 'text-red-700 bg-red-50 border-red-200'
                 : 'text-amber-700 bg-amber-50 border-amber-200'

  const blendedFV: number | null     = valuationMethods?.triangulatedFairValue ?? null
  const blendedUpside: number | null = valuationMethods?.triangulatedUpsidePct ?? null

  const rangeSpan = fiftyTwoWeekHigh - fiftyTwoWeekLow
  const pricePct  = rangeSpan > 0 ? Math.max(0, Math.min(1, (price - fiftyTwoWeekLow) / rangeSpan)) : 0.5

  const healthCats = [
    { label: 'Profitability', key: 'profitability' },
    { label: 'Fin. Health',   key: 'liquidity'     },
    { label: 'Growth',        key: 'growth'        },
  ] as const

  return (
    <div className="rounded-xl card overflow-hidden lg:hidden mt-3 min-w-0">
      {/* Summary row — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 gap-2 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[11px] font-semibold text-slate-500 shrink-0">Quick insights</span>
          <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0', recBg)}>
            {recLabel}
          </span>
          {analystTargetMean > 0 && (
            <span className="text-[11px] text-slate-600 tabular-nums shrink-0">
              Target: <span className="font-semibold">{sym}{analystTargetMean.toFixed(2)}</span>
            </span>
          )}
          {blendedFV != null && (
            <span className="text-[11px] text-slate-600 tabular-nums shrink-0">
              FV: <span className={cn('font-semibold', blendedUpside != null && blendedUpside >= 0 ? 'text-emerald-600' : 'text-amber-600')}>
                {sym}{blendedFV.toFixed(2)}
              </span>
              {blendedUpside != null && (
                <span className={cn('ml-0.5', blendedUpside >= 0 ? 'text-emerald-600' : 'text-amber-600')}>
                  ({blendedUpside >= 0 ? '+' : ''}{(blendedUpside * 100).toFixed(0)}%)
                </span>
              )}
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-slate-400 transition-transform duration-200', open ? 'rotate-180' : '')}
        />
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
          {/* 52-week range */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">52-Week Range</p>
            <div className="relative h-1.5 rounded-full bg-slate-200">
              <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-400/60 via-amber-400/60 to-emerald-400/60 w-full" />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-500 shadow-sm"
                style={{ left: `calc(${pricePct * 100}% - 5px)` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] tabular-nums">
              <span className="text-slate-400">{sym}{fiftyTwoWeekLow.toFixed(2)}</span>
              <span className="font-semibold text-slate-700">{sym}{price.toFixed(2)}</span>
              <span className="text-slate-400">{sym}{fiftyTwoWeekHigh.toFixed(2)}</span>
            </div>
          </div>

          {/* Financial health grades */}
          {ratings && healthCats.some(({ key }) => !!ratings[key]) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Financial Health</p>
              <div className="grid grid-cols-3 gap-2">
                {healthCats.map(({ label, key }) => {
                  const cat = ratings[key]
                  if (!cat) return null
                  return (
                    <div key={key} className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-center">
                      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                      <span className={cn('text-xs font-bold px-1.5 py-0 rounded border leading-5', gradeChipClass(cat.grade))}>
                        {cat.grade}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Analyst count */}
          {cagrAnalysis?.numAnalysts > 0 && (
            <p className="text-[10px] text-slate-400 text-center">
              Based on {cagrAnalysis.numAnalysts} analyst estimate{cagrAnalysis.numAnalysts !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
