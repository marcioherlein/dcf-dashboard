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
  trend:        RatingPeriod[]
  numAnalysts?: number | null
  currentPrice?:number | null
  targetMean?:  number | null
  targetLow?:   number | null
  targetHigh?:  number | null
  currency?:    string
}

// ─── Period label: convert "-2m" → "Apr '25" etc ─────────────────────────────

function periodToLabel(p: string): string {
  // Relative format: "0m", "-1m", "-2m", "-3m"
  const match = p.match(/^(-?\d+)m$/)
  if (match) {
    const offset = parseInt(match[1])
    const d = new Date()
    d.setMonth(d.getMonth() + offset)
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
  }
  // Already human-readable
  return p
}

// ─── Stacked bar chart ────────────────────────────────────────────────────────

const StackedBars = dynamic(
  () => import('recharts').then(m => {
    const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip } = m

    const COLORS = {
      strongBuy:  '#0D6B46',
      buy:        '#11875D',
      hold:       '#B56A00',
      sell:       '#D83B3B',
      strongSell: '#991B1B',
    }

    const LABELS: Record<string, string> = {
      strongBuy: 'Strong Buy',
      buy: 'Buy',
      hold: 'Hold',
      sell: 'Sell',
      strongSell: 'Strong Sell',
    }

    return function StackedBarsInner({ data }: { data: RatingPeriod[] }) {
      const withLabels = data.map(d => ({ ...d, _label: periodToLabel(d.period) }))

      function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string }) {
        if (!active || !payload?.length) return null
        const total = payload.reduce((s, p) => s + (p.value ?? 0), 0)
        return (
          <div className="bg-white border border-[#E3E1DA] rounded-xl px-3 py-2.5 shadow-lg text-[11px]">
            <p className="font-[700] text-[#111111] mb-1.5">{label}</p>
            {[...payload].reverse().map(p => (
              <div key={p.name} className="flex items-center justify-between gap-4 mb-0.5">
                <span className="flex items-center gap-1.5 text-[#6B6B6B]">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: p.fill }} />
                  {LABELS[p.name] ?? p.name}
                </span>
                <span className="font-[650] text-[#111111] tabular-nums">{p.value}</span>
              </div>
            ))}
            <div className="border-t border-[#F0F0F0] pt-1 mt-1 flex justify-between">
              <span className="text-[#9B9B9B]">Total</span>
              <span className="font-[700] text-[#111111]">{total}</span>
            </div>
          </div>
        )
      }

      return (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={withLabels} barCategoryGap="20%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="_label"
              tick={{ fontSize: 11, fill: '#6B6B6B', fontFamily: 'Inter, system-ui, sans-serif' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip content={(props) => <CustomTooltip {...(props as unknown as { active?: boolean; payload?: { name: string; value: number; fill: string }[]; label?: string })} />} cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 4 }} />
            {(['strongBuy','buy','hold','sell','strongSell'] as const).map((key) => {
              const isTop = key === 'strongSell'
              const isBottom = key === 'strongBuy'
              return (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={COLORS[key]}
                  radius={isTop ? [4,4,0,0] : isBottom ? [0,0,4,4] : undefined}
                  isAnimationActive={false}
                >
                  {withLabels.map((_, i) => <Cell key={i} fill={COLORS[key]} />)}
                </Bar>
              )
            })}
          </BarChart>
        </ResponsiveContainer>
      )
    }
  }),
  { ssr: false, loading: () => <div className="h-[160px] bg-[#F5F5F5] animate-pulse rounded-lg" /> }
)

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalystRecommendationsChart({
  trend, numAnalysts, currency = 'USD',
  currentPrice, targetMean, targetLow, targetHigh,
}: Props) {
  if (!trend || trend.length === 0) return null

  // Compute current consensus from most recent period
  const latest = trend[0]
  const totalLatest = (latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell) || 1
  const bullPct = Math.round(((latest.strongBuy + latest.buy) / totalLatest) * 100)
  const bearPct = Math.round(((latest.sell + latest.strongSell) / totalLatest) * 100)
  const holdPct = 100 - bullPct - bearPct

  const consensusLabel = bullPct >= 60 ? 'Buy' : bullPct >= 40 ? 'Mixed' : 'Hold/Sell'
  const consensusColor = bullPct >= 60 ? 'text-[#11875D]' : bullPct >= 40 ? 'text-[#B56A00]' : 'text-[#D83B3B]'
  const consensusBg    = bullPct >= 60 ? 'bg-[#E8F7EF]' : bullPct >= 40 ? 'bg-[#FFF4DA]' : 'bg-[#FCEAEA]'

  // Show oldest on left → newest on right (reverse the array)
  const chartData = [...trend].reverse()

  const LEGEND = [
    { key: 'strongBuy',  label: 'Strong Buy',  color: '#0D6B46' },
    { key: 'buy',        label: 'Buy',          color: '#11875D' },
    { key: 'hold',       label: 'Hold',         color: '#B56A00' },
    { key: 'sell',       label: 'Sell',         color: '#D83B3B' },
    { key: 'strongSell', label: 'Strong Sell',  color: '#991B1B' },
  ]

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 h-full flex flex-col">
      {/* Header — title + consensus badge */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <p className="text-[13px] font-[700] text-[#111111] leading-tight">Analyst Recommendations</p>
          {numAnalysts != null && numAnalysts > 0 && (
            <p className="text-[11px] text-[#9B9B9B] mt-0.5">{numAnalysts} analyst{numAnalysts !== 1 ? 's' : ''} covering</p>
          )}
        </div>
        <span className={`shrink-0 text-[11px] font-[700] px-2.5 py-1 rounded-full ${consensusBg} ${consensusColor}`}>
          {consensusLabel}
        </span>
      </div>

      {/* Analyst price target strip — shown when data available */}
      {targetMean != null && currentPrice != null && currentPrice > 0 && (() => {
        const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
        const fmt = (v: number) => Math.abs(v) >= 1000
          ? sym + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
          : sym + v.toFixed(2)
        const upside = (targetMean - currentPrice) / currentPrice * 100
        const isUp = upside >= 0
        const hasRange = targetLow != null && targetHigh != null && targetHigh > targetLow
        const range = hasRange ? targetHigh! - targetLow! : 1
        const curPct  = hasRange ? Math.max(0, Math.min(100, ((currentPrice - targetLow!) / range) * 100)) : 50
        const meanPct = hasRange ? Math.max(0, Math.min(100, ((targetMean  - targetLow!) / range) * 100)) : 50
        return (
          <div className="rounded-lg bg-[#F9F9F9] border border-[#E5E5E5] px-3 py-2.5 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] text-[#9B9B9B] leading-none mb-0.5">Analyst price target</p>
                <p className={`text-[15px] font-[700] leading-none tabular-nums ${isUp ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                  {fmt(targetMean)}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-[13px] font-[700] tabular-nums ${isUp ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                  {isUp ? '+' : ''}{upside.toFixed(1)}%
                </p>
                <p className="text-[10px] text-[#9B9B9B]">vs current price</p>
              </div>
            </div>
            {hasRange && (
              <>
                <div className="relative h-2 rounded-full bg-[#E5E5E5]">
                  {isUp ? (
                    <div className="absolute inset-y-0 rounded-full bg-[#11875D]/50"
                      style={{ left: `${curPct}%`, width: `${Math.max(0, meanPct - curPct)}%` }} />
                  ) : (
                    <div className="absolute inset-y-0 rounded-full bg-[#D83B3B]/50"
                      style={{ left: `${meanPct}%`, width: `${Math.max(0, curPct - meanPct)}%` }} />
                  )}
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#111111] border-2 border-white shadow-sm z-10"
                    style={{ left: `${curPct}%` }} />
                  <div className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${isUp ? 'bg-[#11875D]' : 'bg-[#D83B3B]'}`}
                    style={{ left: `${meanPct}%` }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[9px] text-[#9B9B9B] tabular-nums">
                  <span>{fmt(targetLow!)}</span>
                  <span>{fmt(targetHigh!)}</span>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Consensus breakdown */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-2 rounded-full overflow-hidden flex">
          <div className="bg-[#11875D] h-full transition-all" style={{ width: `${bullPct}%` }} />
          <div className="bg-[#B56A00] h-full transition-all" style={{ width: `${holdPct}%` }} />
          <div className="bg-[#D83B3B] h-full transition-all" style={{ width: `${bearPct}%` }} />
        </div>
        <div className="flex items-center gap-2 text-[10px] shrink-0">
          <span className="text-[#11875D] font-[700]">{bullPct}% Buy</span>
          <span className="text-[#9B9B9B]">{holdPct}% Hold</span>
          {bearPct > 0 && <span className="text-[#D83B3B]">{bearPct}% Sell</span>}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
        {LEGEND.map(l => (
          <span key={l.key} className="flex items-center gap-1 text-[10px] text-[#6B6B6B]">
            <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1">
        <StackedBars data={chartData} />
      </div>
    </div>
  )
}
