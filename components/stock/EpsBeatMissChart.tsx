'use client'

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
  surprises:   EpsSurprise[]
  currency?:   string
  // YoY growth summary (from financialStatements)
  revenueGrowthYoy?: number | null
  netIncomeGrowthYoy?: number | null
  epsGrowthYoy?: number | null
}

// ─── Quarter label ────────────────────────────────────────────────────────────

function quarterLabel(s: EpsSurprise): string {
  if (s.date) {
    const d = new Date(s.date)
    const yr = String(d.getUTCFullYear()).slice(2)
    const mo = d.getUTCMonth()
    const q  = mo < 3 ? 'Q1' : mo < 6 ? 'Q2' : mo < 9 ? 'Q3' : 'Q4'
    return `${q} FY${yr}`
  }
  return s.quarter ?? '—'
}

// ─── Dot chart (rendered inside dynamic import) ───────────────────────────────

const DotChart = dynamic(
  () => Promise.resolve(function DotChartInner({
    data,
    sym,
  }: {
    data: Array<{ label: string; actual: number; estimate: number; beat: boolean; miss: boolean; diff: number | null }>
    sym: string
  }) {
    if (data.length === 0) return null

    // Chart dimensions
    const W = 280
    const H = 180
    const PAD_L = 44
    const PAD_R = 16
    const PAD_T = 16
    const PAD_B = 8
    const chartW = W - PAD_L - PAD_R
    const chartH = H - PAD_T - PAD_B

    const allVals = data.flatMap(d => [d.actual, d.estimate])
    const minV = Math.min(...allVals)
    const maxV = Math.max(...allVals)
    const pad  = (maxV - minV) * 0.20 || 0.5
    const lo   = minV - pad
    const hi   = maxV + pad

    const scaleY = (v: number) => PAD_T + ((hi - v) / (hi - lo)) * chartH
    const scaleX = (i: number) => PAD_L + (i / Math.max(data.length - 1, 1)) * chartW

    // 3 reference lines
    const refs = [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.75]
      .map(v => ({ v, y: scaleY(v) }))

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {/* Dashed grid lines */}
        {refs.map(r => (
          <g key={r.v}>
            <line x1={PAD_L} y1={r.y} x2={W - PAD_R} y2={r.y}
              stroke="#E5E5E5" strokeWidth={1} strokeDasharray="4 3" />
            <text x={PAD_L - 4} y={r.y + 4} textAnchor="end"
              fontSize={8} fill="#9B9B9B" fontFamily="system-ui">
              {sym}{r.v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Dots */}
        {data.map((d, i) => {
          const x  = scaleX(i)
          const ya = scaleY(d.actual)
          const ye = scaleY(d.estimate)
          return (
            <g key={i}>
              {/* Connector line */}
              <line x1={x} y1={ya} x2={x} y2={ye}
                stroke="#E5E5E5" strokeWidth={1} />
              {/* Estimate — open circle */}
              <circle cx={x} cy={ye} r={9} fill="white"
                stroke={d.beat ? '#9B9B9B' : '#9B9B9B'} strokeWidth={2} />
              {/* Actual — filled */}
              <circle cx={x} cy={ya} r={9}
                fill={d.beat ? '#22C55E' : d.miss ? '#EF4444' : '#9B9B9B'} />
            </g>
          )
        })}
      </svg>
    )
  }),
  { ssr: false }
)

// ─── Main component ───────────────────────────────────────────────────────────

export default function EpsBeatMissChart({ surprises, currency = 'USD', revenueGrowthYoy, netIncomeGrowthYoy, epsGrowthYoy }: Props) {
  if (!surprises || surprises.length === 0) return null

  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency + ' '

  // Oldest → newest (oldest on left, newest = rightmost = latest actual)
  const ordered = [...surprises].reverse()
  const data = ordered.map(s => ({
    label:    quarterLabel(s),
    actual:   s.epsActual   ?? 0,
    estimate: s.epsEstimate ?? 0,
    beat:     (s.surprisePercent ?? 0) > 0,
    miss:     (s.surprisePercent ?? 0) < 0,
    diff:     s.epsDifference,
  }))

  // Latest quarter for header
  const latest = ordered[ordered.length - 1]
  const latestActual   = latest?.epsActual   ?? null
  const latestEstimate = latest?.epsEstimate ?? null

  // Next earnings slot — one column beyond latest
  // (kept as placeholder, shown greyed)
  const hasYoY = revenueGrowthYoy != null || netIncomeGrowthYoy != null || epsGrowthYoy != null

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
      {/* Header */}
      <p className="text-[15px] font-bold text-[#111111] mb-0.5">EPS Beat / Miss</p>
      <div className="flex items-center gap-3 mb-4 text-[12px] text-[#6B6B6B]">
        {latestEstimate != null && (
          <span className="flex items-center gap-1.5">
            {/* Open circle */}
            <svg width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="5" fill="white" stroke="#9B9B9B" strokeWidth="2" />
            </svg>
            Estimate {sym}{latestEstimate.toFixed(2)}
          </span>
        )}
        {latestActual != null && (
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="6" fill="#22C55E" />
            </svg>
            Actual {sym}{latestActual.toFixed(2)}
          </span>
        )}
      </div>

      {/* Dot chart */}
      <DotChart data={data} sym={sym} />

      {/* Quarter labels + Beat/Miss labels */}
      <div className="flex mt-1" style={{ paddingLeft: 44, paddingRight: 16 }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-[#9B9B9B] text-center leading-tight">{d.label}</span>
            <span className={`text-[10px] font-bold ${d.beat ? 'text-[#22C55E]' : d.miss ? 'text-[#EF4444]' : 'text-[#9B9B9B]'}`}>
              {d.beat ? 'Beat' : d.miss ? 'Miss' : 'In line'}
            </span>
            {d.diff != null && (
              <span className={`text-[9px] font-semibold tabular-nums ${d.beat ? 'text-[#22C55E]' : d.miss ? 'text-[#EF4444]' : 'text-[#9B9B9B]'}`}>
                {d.beat ? '+' : ''}{sym}{Math.abs(d.diff).toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* YoY growth footer */}
      {hasYoY && (
        <>
          <div className="border-t border-[#E5E5E5] mt-4 pt-3">
            <p className="text-[11px] text-[#9B9B9B] text-center mb-2">YoY Growth (latest fiscal year)</p>
            <div className="grid grid-cols-3 gap-2">
              {revenueGrowthYoy != null && (
                <div className="text-center">
                  <p className={`text-[16px] font-bold tabular-nums ${revenueGrowthYoy >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {revenueGrowthYoy >= 0 ? '+' : ''}{(revenueGrowthYoy * 100).toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-[#9B9B9B] mt-0.5">Revenue</p>
                </div>
              )}
              {netIncomeGrowthYoy != null && (
                <div className="text-center">
                  <p className={`text-[16px] font-bold tabular-nums ${netIncomeGrowthYoy >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {netIncomeGrowthYoy >= 0 ? '+' : ''}{(netIncomeGrowthYoy * 100).toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-[#9B9B9B] mt-0.5">Net Income</p>
                </div>
              )}
              {epsGrowthYoy != null && (
                <div className="text-center">
                  <p className={`text-[16px] font-bold tabular-nums ${epsGrowthYoy >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                    {epsGrowthYoy >= 0 ? '+' : ''}{(epsGrowthYoy * 100).toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-[#9B9B9B] mt-0.5">EPS</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
