'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EpsSurprise {
  quarter:         string | null
  date:            string | null
  epsActual:       number | null
  epsEstimate:     number | null
  epsDifference:   number | null
  surprisePercent: number | null
}

interface Props {
  surprises:          EpsSurprise[]
  currency?:          string
  epsGrowthYoy?:      number | null
  revenueGrowthYoy?:  number | null
  netIncomeGrowthYoy?:number | null
}

// ─── Quarter label from date or raw quarter string ────────────────────────────

function resolveLabel(s: EpsSurprise): string {
  // Prefer date field (most reliable)
  if (s.date) {
    try {
      const d = new Date(s.date)
      const yr = d.getUTCFullYear()
      const mo = d.getUTCMonth()
      const q  = mo < 3 ? 'Q1' : mo < 6 ? 'Q2' : mo < 9 ? 'Q3' : 'Q4'
      return `${q} '${String(yr).slice(2)}`
    } catch { /* fall through */ }
  }
  // Try parsing quarter field e.g. "2025-Q1", "Q1FY2025"
  const raw = s.quarter ?? ''
  const m1 = raw.match(/(\d{4}).*(Q[1-4])/i) || raw.match(/(Q[1-4]).*(\d{4})/i)
  if (m1) {
    const yr = m1.find(x => x && x.length === 4) ?? ''
    const q  = m1.find(x => x && /^Q[1-4]/i.test(x)) ?? ''
    return `${q.toUpperCase()} '${String(yr).slice(2)}`
  }
  // Relative labels like "-1q" → map to "Latest", "−1Q", etc
  if (raw === '0q' || raw === '0') return 'Latest'
  if (raw.match(/^-?\d+q$/i)) {
    const n = parseInt(raw)
    if (n === -1) return '−1Q'
    if (n === -2) return '−2Q'
    if (n === -3) return '−3Q'
    if (n === -4) return '−4Q'
  }
  return raw || '—'
}

// ─── Chart bars (recharts) ────────────────────────────────────────────────────

const BarsChart = dynamic(
  () => import('recharts').then(m => {
    const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList, Tooltip } = m

    interface BarDatum {
      label: string
      actual: number
      estimate: number
      beat: boolean
      miss: boolean
      diff: number | null
      sym: string
    }

    function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: BarDatum }[]; label?: string }) {
      if (!active || !payload?.length) return null
      const d = payload[0].payload
      const sym = d.sym
      return (
        <div className="bg-white border border-[#E3E1DA] rounded-xl px-3 py-2.5 shadow-lg text-[11px]">
          <p className="font-[700] text-[#111111] mb-1.5">{label}</p>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#6B6B6B]">Actual EPS</span>
              <span className="font-[700] text-[#111111] tabular-nums">{sym}{d.actual.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[#6B6B6B]">Estimate</span>
              <span className="font-[650] text-[#9B9B9B] tabular-nums">{sym}{d.estimate.toFixed(2)}</span>
            </div>
            {d.diff != null && (
              <div className="flex items-center justify-between gap-4 border-t border-[#F0F0F0] pt-1 mt-0.5">
                <span className="text-[#6B6B6B]">Surprise</span>
                <span className={`font-[700] tabular-nums ${d.beat ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                  {d.beat ? '+' : ''}{sym}{Math.abs(d.diff).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      )
    }

    return function EpsBarChart({ data, sym }: { data: BarDatum[]; sym: string }) {
      if (!data.length) return null
      const allVals = data.flatMap(d => [d.actual, d.estimate])
      const minV = Math.min(...allVals)
      const yMin = Math.max(0, minV * 0.85)

      return (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barCategoryGap="28%" margin={{ top: 20, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6B6B6B', fontFamily: 'Inter, system-ui, sans-serif' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, 'auto']}
              tick={{ fontSize: 10, fill: '#9B9B9B', fontFamily: 'Inter, system-ui, sans-serif' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `${sym}${v.toFixed(1)}`}
              width={40}
            />
            <Tooltip content={(props) => <CustomTooltip {...(props as unknown as { active?: boolean; payload?: { payload: BarDatum }[]; label?: string })} />} cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 4 }} />
            {/* Estimate bar — subtle background */}
            <Bar dataKey="estimate" fill="#E5E5E5" radius={[3,3,0,0]} maxBarSize={36} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill="#E9E9E9" />)}
            </Bar>
            {/* Actual bar — colored */}
            <Bar dataKey="actual" radius={[3,3,0,0]} maxBarSize={36} isAnimationActive={false}>
              <LabelList
                dataKey="actual"
                position="top"
                style={{ fontSize: 10, fontWeight: 650, fontFamily: 'Inter, system-ui, sans-serif' }}
                formatter={(v: unknown) => `${sym}${(v as number).toFixed(2)}`}
                fill="#566174"
              />
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.beat ? '#11875D' : d.miss ? '#D83B3B' : '#9B9B9B'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )
    }
  }),
  { ssr: false, loading: () => <div className="h-[160px] bg-[#F5F5F5] animate-pulse rounded-lg" /> }
)

// ─── Main component ───────────────────────────────────────────────────────────

export default function EpsBeatMissChart({ surprises, currency = 'USD' }: Props) {
  

  const earlyReturn = !surprises || surprises.length === 0
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency + ' '

  const data = useMemo(() => {
    // Show up to 4 quarters, most recent on right
    return [...surprises]
      .filter(s => s.epsActual != null && s.epsEstimate != null)
      .slice(0, 4)
      .reverse()
      .map(s => ({
        label:    resolveLabel(s),
        actual:   s.epsActual   ?? 0,
        estimate: s.epsEstimate ?? 0,
        beat:     (s.surprisePercent ?? 0) > 0,
        miss:     (s.surprisePercent ?? 0) < 0,
        diff:     s.epsDifference,
        sym,
      }))
  }, [surprises, sym])

  if (earlyReturn || data.length === 0) return null
  const _latest = data[data.length - 1]
  const beats  = data.filter(d => d.beat).length
  const total  = data.length

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 sm:p-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <p className="text-[13px] font-[700] text-[#111111] leading-tight">EPS Beat / Miss</p>
          <p className="text-[11px] text-[#9B9B9B] mt-0.5">Actual vs consensus estimate</p>
        </div>
        {/* Beat rate pill */}
        {total > 0 && (
          <span className={`shrink-0 text-[11px] font-[700] px-2.5 py-1 rounded-full ${
            beats === total ? 'bg-[#E8F7EF] text-[#11875D]' :
            beats >= total * 0.5 ? 'bg-[#E8F7EF] text-[#11875D]' :
            'bg-[#FCEAEA] text-[#D83B3B]'
          }`}>
            {beats}/{total} beat
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-[11px] text-[#6B6B6B]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-[#E9E9E9]" />
          Estimate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-[#11875D]" />
          Actual (Beat)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-[#D83B3B]" />
          Actual (Miss)
        </span>
      </div>

      {/* Bar chart */}
      <div className="flex-1">
        <BarsChart data={data} sym={sym} />
      </div>

      {/* Per-quarter beat/miss row */}
      <div className="grid mt-2 border-t border-[#F0F0F0] pt-3" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className={`text-[11px] font-[700] ${d.beat ? 'text-[#11875D]' : d.miss ? 'text-[#D83B3B]' : 'text-[#9B9B9B]'}`}>
              {d.beat ? 'Beat' : d.miss ? 'Miss' : 'In line'}
            </span>
            {d.diff != null && (
              <span className={`text-[10px] font-[600] tabular-nums ${d.beat ? 'text-[#11875D]' : d.miss ? 'text-[#D83B3B]' : 'text-[#9B9B9B]'}`}>
                {d.beat ? '+' : d.miss ? '−' : ''}{sym}{Math.abs(d.diff).toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
