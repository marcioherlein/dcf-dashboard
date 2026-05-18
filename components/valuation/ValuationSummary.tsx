'use client'

import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts'
import { fmtPrice, fmtPct, upsideZone, zoneBadgeClass } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { TrendBadge } from '@/components/ui/trend-badge'
import { NumberDisplay } from '@/components/ui/number-display'

export interface MethodResult {
  id: string
  label: string
  fairValue: number | null
  bullFairValue?: number | null
  bearFairValue?: number | null
  upsidePct: number | null
  weight: number
}

interface Props {
  methods: MethodResult[]
  currentPrice: number
  currency?: string
}

function computeConsensus(methods: MethodResult[], price: number) {
  const valid = methods.filter(m => m.fairValue != null && m.weight > 0)
  if (!valid.length) return { weightedFV: null, weightedBearFV: null, weightedBullFV: null, weightedUpside: null, zone: null }

  const totalWeight    = valid.reduce((s, m) => s + m.weight, 0)
  const weightedFV     = valid.reduce((s, m) => s + m.fairValue! * m.weight, 0) / totalWeight
  const weightedBearFV = valid.reduce((s, m) => s + (m.bearFairValue ?? m.fairValue! * 0.85) * m.weight, 0) / totalWeight
  const weightedBullFV = valid.reduce((s, m) => s + (m.bullFairValue ?? m.fairValue! * 1.15) * m.weight, 0) / totalWeight
  const weightedUpside = price > 0 ? (weightedFV - price) / price : null
  const zone           = upsideZone(weightedUpside)

  return { weightedFV, weightedBearFV, weightedBullFV, weightedUpside, zone }
}

function ConsensusRangeBar({
  bear, base, bull, price, currency,
}: { bear: number; base: number; bull: number; price: number; currency: string }) {
  const lo   = Math.min(bear, price) * 0.94
  const hi   = Math.max(bull, price) * 1.06
  const span = hi - lo
  if (span <= 0) return null

  const p = (v: number) => Math.max(1, Math.min(99, ((v - lo) / span) * 100))
  const isUnder = price <= base

  const bearPct = p(bear)
  const basePct = p(base)
  const bullPct = p(bull)
  const nowPct  = p(price)

  return (
    <div className="px-1 pt-3 pb-1 select-none">
      {/* "Current" label above the bar */}
      <div className="relative h-8 mb-0.5">
        <div className="absolute -translate-x-1/2 flex flex-col items-center pointer-events-none"
          style={{ left: `${nowPct}%` }}>
          <span className="text-[11px] font-bold font-mono text-slate-900 leading-tight">
            {fmtPrice(price, currency)}
          </span>
          <span className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">Current</span>
          {/* Connector line down to the bar */}
          <span className="w-px h-2 bg-slate-400 mt-0.5" />
        </div>
      </div>

      {/* Track */}
      <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
        {/* Bear → Base fill */}
        <div
          className="absolute inset-y-0 bg-amber-300/70"
          style={{ left: `${bearPct}%`, width: `${basePct - bearPct}%` }}
        />
        {/* Base → Bull fill */}
        <div
          className="absolute inset-y-0 bg-emerald-300/70"
          style={{ left: `${basePct}%`, width: `${bullPct - basePct}%` }}
        />
        {/* Base divider */}
        <div
          className="absolute inset-y-0 w-0.5 bg-slate-400"
          style={{ left: `${basePct}%`, transform: 'translateX(-50%)' }}
        />
        {/* Current price marker */}
        <div
          className={cn('absolute inset-y-0 w-[3px] rounded-sm', isUnder ? 'bg-emerald-700' : 'bg-red-600')}
          style={{ left: `${nowPct}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Bear / Base / Bull labels below track */}
      <div className="relative h-8 mt-1">
        {([
          { v: bear, label: 'Bear', cls: 'text-amber-600' },
          { v: base, label: 'Base', cls: 'text-slate-700 font-semibold' },
          { v: bull, label: 'Bull', cls: 'text-emerald-600' },
        ] as const).map(({ v, label, cls }) => (
          <div key={label}
            className="absolute -translate-x-1/2 text-center pointer-events-none"
            style={{ left: `${p(v)}%` }}
          >
            <div className={cn('text-[10px] font-mono leading-tight', cls)}>{fmtPrice(v, currency)}</div>
            <div className={cn('text-[9px] uppercase tracking-wide leading-none', cls)}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RangeTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = payload[0]?.payload as Record<string, any>
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-float px-4 py-3 text-xs min-w-[160px]">
      <div className="font-bold text-slate-800 mb-2">{d.label}</div>
      {d.base != null && <div className="text-slate-600 flex justify-between gap-4"><span>Base</span><span className="font-semibold font-mono text-slate-900">${d.base.toFixed(2)}</span></div>}
      {d.high > 0 && <div className="text-emerald-600 flex justify-between gap-4"><span>Bull</span><span className="font-mono">${(d.base + d.range).toFixed(2)}</span></div>}
      {d.low > 0  && <div className="text-red-500 flex justify-between gap-4"><span>Bear</span><span className="font-mono">${d.low.toFixed(2)}</span></div>}
      {d.upside != null && (
        <div className={cn('mt-2 font-bold text-sm', d.upside >= 0 ? 'text-emerald-600' : 'text-red-500')}>
          {fmtPct(d.upside)} upside
        </div>
      )}
    </div>
  )
}

export default function ValuationSummary({ methods, currentPrice, currency = 'USD' }: Props) {
  const { weightedFV, weightedBearFV, weightedBullFV, weightedUpside, zone } = computeConsensus(methods, currentPrice)

  const zoneStyle = zone === 'Attractive'
    ? { wrap: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' }
    : zone === 'Fair Value'
    ? { wrap: 'bg-blue-50 border-blue-200', text: 'text-blue-700' }
    : zone === 'Expensive'
    ? { wrap: 'bg-red-50 border-red-200', text: 'text-red-700' }
    : { wrap: 'bg-slate-50 border-slate-200', text: 'text-slate-600' }

  const chartData = methods
    .filter(m => m.fairValue != null)
    .map(m => ({
      label:  m.label,
      base:   m.fairValue!,
      low:    m.bearFairValue ?? m.fairValue! * 0.85,
      range:  Math.max(0, (m.bullFairValue ?? m.fairValue! * 1.15) - (m.bearFairValue ?? m.fairValue! * 0.85)),
      upside: m.upsidePct,
    }))

  const allPrices = chartData.flatMap(d => [d.low, d.low + d.range, currentPrice]).filter(v => v > 0)
  const chartMin  = allPrices.length ? Math.min(...allPrices) * 0.88 : 0
  const chartMax  = allPrices.length ? Math.max(...allPrices) * 1.08 : 100

  return (
    <div className="space-y-4">

      {/* ── Weighted consensus hero ───────────────────────────────────────────── */}
      {weightedFV != null && (
        <div className={cn('rounded-xl border px-6 py-5', zoneStyle.wrap)}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-label uppercase tracking-wider text-slate-500 mb-1">Weighted Consensus Fair Value</p>
              <NumberDisplay value={fmtPrice(weightedFV, currency)} size="xl" />
              <p className="text-micro text-slate-500 mt-1.5">vs. {fmtPrice(currentPrice, currency)} current price</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {zone && (
                <span className={cn('rounded-full border px-4 py-1.5 text-sm font-bold', zoneBadgeClass(zone))}>
                  {zone}
                </span>
              )}
              {weightedUpside != null && (
                <TrendBadge value={weightedUpside} size="lg" />
              )}
            </div>
          </div>
          {/* Bear / Base / Bull consensus range bar */}
          {weightedBearFV != null && weightedBullFV != null && (
            <div className="mt-3 pt-3 border-t border-current/10">
              <ConsensusRangeBar
                bear={weightedBearFV}
                base={weightedFV}
                bull={weightedBullFV}
                price={currentPrice}
                currency={currency}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Range bar chart ──────────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <p className="text-label uppercase tracking-wider text-slate-400 mb-4">Fair Value Range by Method</p>
          <div style={{ height: Math.max(180, chartData.length * 56) }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                layout="vertical"
                data={chartData}
                margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
              >
                <XAxis
                  type="number"
                  domain={[chartMin, chartMax]}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#374151', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  width={112}
                />
                <Tooltip content={<RangeTooltip />} cursor={{ fill: '#f1f5f9' }} />

                {/* Transparent offset bar (0 → low) */}
                <Bar dataKey="low" stackId="r" fill="transparent" isAnimationActive={false} />

                {/* Visible range bar */}
                <Bar dataKey="range" stackId="r" isAnimationActive={false} radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => {
                    const fill = entry.upside != null
                      ? entry.upside >= 0.15 ? '#10b981'
                      : entry.upside >= 0   ? '#6366f1'
                      : '#ef4444'
                      : '#94a3b8'
                    return <Cell key={i} fill={fill} fillOpacity={0.8} />
                  })}
                </Bar>

                <ReferenceLine
                  x={currentPrice}
                  stroke="#1e293b"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  label={{
                    value: `$${currentPrice.toFixed(0)}`,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: '#475569',
                    fontWeight: 600,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-micro text-slate-400 mt-2">Range shows bull/bear sensitivity (±15% unless method provides explicit scenarios).</p>
        </div>
      )}

      {/* ── Method breakdown table ───────────────────────────────────────────── */}
      {methods.length > 0 && (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-label uppercase tracking-wider text-slate-400 font-bold">Method</th>
                <th className="text-right px-4 py-3 text-label uppercase tracking-wider text-slate-400 font-bold">Fair Value</th>
                <th className="text-right px-4 py-3 text-label uppercase tracking-wider text-slate-400 font-bold">Upside</th>
                <th className="text-right px-4 py-3 text-label uppercase tracking-wider text-slate-400 font-bold">Weight</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m, i) => (
                <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className="px-4 py-3 font-medium text-slate-700">{m.label}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                    {m.fairValue != null ? fmtPrice(m.fairValue, currency) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.upsidePct != null
                      ? <TrendBadge value={m.upsidePct} size="sm" />
                      : <span className="text-slate-300">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right text-micro text-slate-400 font-mono">
                    {(m.weight * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
            <p className="text-micro text-slate-400">
              Weights reflect relative confidence in each method. Adjust assumptions in method drawers to refine.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
