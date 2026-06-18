'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

interface Props {
  data: AnyData
  hideBlendedFV?: boolean
}

function gradeChipClass(grade: string): string {
  const g = grade.replace('+', '').replace('-', '')
  if (g === 'A') return 'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]'
  if (g === 'B') return 'text-[#2563EB] bg-[#EAF1FF] border-[#93B4F5]'
  if (g === 'C') return 'text-[#B56A00] bg-[#FFF4DA] border-[#F3D391]'
  return 'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]'
}

export default function MobileKeyInsights({ data, hideBlendedFV = false }: Props) {
  const [open, setOpen] = useState(true)
  if (!data) return null

  const { quote, analystRecommendation, ratings, valuationMethods, cagrAnalysis } = data
  const { price, fiftyTwoWeekHigh, fiftyTwoWeekLow, analystTargetMean, currency } = quote
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : (currency + ' ')

  const recNorm = (analystRecommendation ?? '').toLowerCase()
  const isBuy  = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
  const recBg    = isBuy  ? 'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]'
                 : isSell ? 'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]'
                 : 'text-[#B56A00] bg-[#FFF4DA] border-[#F3D391]'

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
        className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] gap-2 text-left"
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[12px] font-semibold text-[#566174] shrink-0">Quick insights</span>
          <span className={cn('text-[12px] font-bold px-2.5 py-0.5 rounded-full border shrink-0', recBg)}>
            {recLabel}
          </span>
          {analystTargetMean > 0 && (
            <span className="text-[12px] text-[#566174] tabular-nums shrink-0">
              Target: <span className="font-semibold">{sym}{analystTargetMean.toFixed(2)}</span>
            </span>
          )}
          {blendedFV != null && !hideBlendedFV && (
            <span className="text-[12px] text-[#566174] tabular-nums shrink-0">
              FV: <span className={cn('font-semibold', blendedUpside != null && blendedUpside >= 0 ? 'text-[#11875D]' : 'text-[#B56A00]')}>
                {sym}{blendedFV.toFixed(2)}
              </span>
              {blendedUpside != null && (
                <span className={cn('ml-0.5', blendedUpside >= 0 ? 'text-[#11875D]' : 'text-[#B56A00]')}>
                  ({blendedUpside >= 0 ? '+' : ''}{(blendedUpside * 100).toFixed(0)}%)
                </span>
              )}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-[#8A95A6] transition-transform duration-200', open ? 'rotate-180' : '')}
        />
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-[#E3E1DA] px-4 pb-4 pt-3 space-y-4">
          {/* 52-week range */}
          <div>
          <p className="text-[11px] font-[600] text-[#566174] mb-2">52-Week Range</p>
            <div className="relative h-2 rounded-full bg-[#E3E1DA]">
              <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-400/60 via-amber-400/60 to-emerald-400/60 w-full" />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-[#F4F3EF]0 shadow-sm"
                style={{ left: `calc(${pricePct * 100}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] tabular-nums">
              <span className="text-[#8A95A6]">{sym}{fiftyTwoWeekLow.toFixed(2)}</span>
              <span className="font-semibold text-[#06101F]">{sym}{price.toFixed(2)}</span>
              <span className="text-[#8A95A6]">{sym}{fiftyTwoWeekHigh.toFixed(2)}</span>
            </div>
          </div>

          {/* Financial health grades */}
          {ratings && healthCats.some(({ key }) => !!ratings[key]) && (
            <div>
              <p className="text-[11px] font-[600] text-[#566174] mb-2">Financial Health</p>
              <div className="grid grid-cols-3 gap-2">
                {healthCats.map(({ label, key }) => {
                  const cat = ratings[key]
                  if (!cat) return null
                  return (
                    <div key={key} className="rounded-lg bg-[#F0F1F6] border border-[#E3E1DA] px-2 py-3 text-center min-h-[60px] flex flex-col items-center justify-center">
                      <p className="text-[11px] text-[#566174] mb-1">{label}</p>
                      <span className={cn('text-[11px] font-[600] px-2.5 py-0.5 rounded-full border leading-5', gradeChipClass(cat.grade))}>
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
            <p className="text-[11px] text-[#8A95A6] text-center">
              Based on {cagrAnalysis.numAnalysts} analyst estimate{cagrAnalysis.numAnalysts !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
