'use client'

import dynamic from 'next/dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RatingPeriod {
  period:    string
  strongBuy: number
  buy:       number
  hold:      number
  sell:      number
  strongSell:number
}

interface Props {
  trend:            RatingPeriod[]
  numAnalysts?:     number | null
  currentPrice?:    number | null
  targetMean?:      number | null
  targetLow?:       number | null
  targetHigh?:      number | null
  currency?:        string
}

// ─── Stacked bar (dynamic recharts) ──────────────────────────────────────────

const StackedBars = dynamic(
  () => import('recharts').then(m => {
    const { ResponsiveContainer, BarChart, Bar, XAxis, Cell, Tooltip } = m

    const COLORS = {
      strongBuy:  '#16A34A',
      buy:        '#22C55E',
      hold:       '#EAB308',
      sell:       '#F97316',
      strongSell: '#EF4444',
    }

    return function StackedBarsInner({ data }: { data: RatingPeriod[] }) {
      const reversed = [...data].reverse() // oldest → newest (left → right)

      // Custom label for period — convert "0m" → month abbreviation
      function periodLabel(p: string): string {
        if (p === '0m') return 'Now'
        if (p === '-1m') return '-1M'
        if (p === '-2m') return '-2M'
        if (p === '-3m') return '-3M'
        return p
      }

      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={reversed} barCategoryGap="20%" margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="period"
              tickFormatter={periodLabel}
              tick={{ fontSize: 10, fill: '#9B9B9B' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E5E5', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [String(value), String(name ?? '').replace(/([A-Z])/g, ' $1').trim()] as any}
            />
            {(['strongBuy','buy','hold','sell','strongSell'] as const).map(key => (
              <Bar key={key} dataKey={key} stackId="a" fill={COLORS[key]} radius={key === 'strongSell' ? [4,4,0,0] : undefined} isAnimationActive={false}>
                {reversed.map((_, i) => <Cell key={i} fill={COLORS[key]} />)}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )
    }
  }),
  { ssr: false, loading: () => <div className="h-[200px] bg-[#F5F5F5] animate-pulse rounded-xl" /> }
)

// ─── Price target slider ──────────────────────────────────────────────────────

function PriceTargetSlider({
  current, mean, low, high, currency, numAnalysts, upside,
}: {
  current:     number
  mean:        number
  low:         number
  high:        number
  currency:    string
  numAnalysts: number | null
  upside:      number | null
}) {
  const sym   = currency === 'USD' ? '$' : currency + ' '
  const range = high - low
  const safeRange = range > 0 ? range : 1
  const currentPct = Math.max(0, Math.min(100, ((current - low) / safeRange) * 100))
  const meanPct    = Math.max(0, Math.min(100, ((mean    - low) / safeRange) * 100))
  const isUpside   = mean > current

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <p className="text-[15px] font-bold text-[#111111]">Analyst Price Targets</p>
          {numAnalysts != null && numAnalysts > 0 && (
            <p className="text-[11px] text-[#9B9B9B] mt-0.5">Based on {numAnalysts} analyst{numAnalysts !== 1 ? 's' : ''}</p>
          )}
        </div>
        {upside != null && (
          <div className="text-right">
            <p className={`text-[16px] font-bold tabular-nums ${isUpside ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {isUpside ? '+' : ''}{(upside * 100).toFixed(1)}%
            </p>
            <p className="text-[11px] text-[#9B9B9B]">Upside</p>
          </div>
        )}
      </div>

      {/* Avg target label */}
      <div className="flex flex-col items-center mb-3 mt-2">
        <p className="text-[11px] text-[#9B9B9B]">Avg Target</p>
        <p className={`text-[22px] font-bold tabular-nums ${isUpside ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
          {sym}{mean.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Slider track */}
      <div className="relative h-3 rounded-full bg-[#E5E5E5] mx-2">
        {/* Green fill from current to mean (or red if below) */}
        {isUpside ? (
          <div
            className="absolute top-0 bottom-0 rounded-full bg-[#22C55E]"
            style={{ left: `${currentPct}%`, width: `${meanPct - currentPct}%` }}
          />
        ) : (
          <div
            className="absolute top-0 bottom-0 rounded-full bg-[#EF4444]"
            style={{ left: `${meanPct}%`, width: `${currentPct - meanPct}%` }}
          />
        )}
        {/* Current price dot — black */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#111111] border-2 border-white shadow-sm z-10"
          style={{ left: `${currentPct}%` }}
        />
        {/* Mean target dot — green/red */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-white shadow-sm z-10 ${isUpside ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}
          style={{ left: `${meanPct}%` }}
        />
      </div>

      {/* Current price label below slider */}
      <div className="relative mt-1 mx-2 h-9">
        <div
          className="absolute -translate-x-1/2 text-center"
          style={{ left: `${currentPct}%` }}
        >
          <p className="text-[14px] font-bold text-[#111111] tabular-nums">
            {sym}{current.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-[#9B9B9B]">Current</p>
        </div>
      </div>

      {/* Low / High labels */}
      <div className="flex justify-between mx-2 mt-1">
        <div>
          <p className="text-[12px] font-semibold text-[#9B9B9B] tabular-nums">
            {sym}{low.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-[#9B9B9B]">Low</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-semibold text-[#9B9B9B] tabular-nums">
            {sym}{high.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-[#9B9B9B]">High</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalystRecommendationsChart({
  trend, numAnalysts, currentPrice, targetMean, targetLow, targetHigh, currency = 'USD',
}: Props) {
  const hasTrend  = trend && trend.length > 0
  const hasTarget = targetMean != null && targetLow != null && targetHigh != null && currentPrice != null

  // Legend for stacked bar
  const LEGEND = [
    { key: 'Strong Buy',  color: '#16A34A' },
    { key: 'Buy',         color: '#22C55E' },
    { key: 'Hold',        color: '#EAB308' },
    { key: 'Underperform',color: '#F97316' },
    { key: 'Sell',        color: '#EF4444' },
  ]

  // Upside
  const upside = hasTarget && currentPrice > 0
    ? (targetMean! - currentPrice) / currentPrice
    : null

  return (
    <div className="flex flex-col gap-4">
      {/* Stacked bar chart */}
      {hasTrend && (
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
          <p className="text-[15px] font-bold text-[#111111] mb-3">Analyst Recommendations</p>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
            {LEGEND.map(l => (
              <span key={l.key} className="flex items-center gap-1.5 text-[11px] text-[#6B6B6B]">
                <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: l.color }} />
                {l.key}
              </span>
            ))}
          </div>
          <StackedBars data={trend} />
        </div>
      )}

      {/* Price target slider */}
      {hasTarget && (
        <PriceTargetSlider
          current={currentPrice!}
          mean={targetMean!}
          low={targetLow!}
          high={targetHigh!}
          currency={currency}
          numAnalysts={numAnalysts ?? null}
          upside={upside}
        />
      )}
    </div>
  )
}
