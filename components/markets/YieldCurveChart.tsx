'use client'
import { cn } from '@/lib/utils'
import type { YieldCurvePoint } from '@/lib/data/fredClient'

interface Props {
  points: YieldCurvePoint[]
}

export default function YieldCurveChart({ points }: Props) {
  const valid = points.filter(p => p.yield != null)
  if (valid.length < 3) return null

  const yields  = valid.map(p => p.yield as number)
  const minY    = Math.min(...yields)
  const maxY    = Math.max(...yields)
  const range   = maxY - minY || 0.5

  // Detect inversion: 2Y > 10Y
  const y2  = valid.find(p => p.tenor === '2Y')?.yield ?? null
  const y10 = valid.find(p => p.tenor === '10Y')?.yield ?? null
  const inverted = y2 != null && y10 != null && y2 > y10
  const spread = y2 != null && y10 != null ? ((y10 - y2) * 100).toFixed(0) : null

  // SVG path for the curve
  const W = 400
  const H = 80
  const PAD = { l: 0, r: 0, t: 8, b: 4 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const pts = valid.map((p, i) => {
    const x = PAD.l + (i / (valid.length - 1)) * innerW
    const y = PAD.t + (1 - ((p.yield as number) - minY) / range) * innerH
    return { x, y, p }
  })

  const pathD = pts.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ')
  const fillD = `${pathD} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`

  const lineColor = inverted ? '#D83B3B' : '#2563EB'
  const fillColor = inverted ? 'rgba(216,59,59,0.08)' : 'rgba(37,99,235,0.06)'

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E5E5E5] flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold text-[#6B6B6B]">US Treasury Yield Curve</span>
          <p className="text-[10px] text-[#6B6B6B] mt-0.5">Spot yields across maturities — inversion signals recession risk</p>
        </div>
        {inverted ? (
          <span className="shrink-0 text-[10px] font-[700] px-2 py-0.5 rounded-full bg-[#FCEAEA] text-[#D83B3B] border border-[#F0B8B8]">
            ⚠ Inverted
          </span>
        ) : (
          <span className="shrink-0 text-[10px] font-[700] px-2 py-0.5 rounded-full bg-[#EAF1FF] text-[#2563EB] border border-[#C7D9FC]">
            Normal
          </span>
        )}
      </div>

      <div className="px-4 pt-3 pb-2">
        {/* SVG chart */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 80 }}
          aria-label="Yield curve"
        >
          <path d={fillD} fill={fillColor} />
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map(({ x, y, p }) => (
            <circle key={p.tenor} cx={x} cy={y} r={3} fill={lineColor} />
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1">
          {valid.map(p => (
            <span key={p.tenor} className="text-[9px] text-[#9B9B9B] font-mono">{p.tenor}</span>
          ))}
        </div>
      </div>

      {/* Key yields + spread */}
      <div className="px-4 py-2.5 border-t border-[#E5E5E5] flex items-center gap-4 flex-wrap">
        {[y2 != null ? { label: '2Y', value: y2 } : null,
          y10 != null ? { label: '10Y', value: y10 } : null,
          valid.find(p => p.tenor === '30Y') ? { label: '30Y', value: valid.find(p => p.tenor === '30Y')!.yield as number } : null,
        ].filter(Boolean).map(item => item && (
          <div key={item.label} className="flex items-baseline gap-1">
            <span className="text-[10px] text-[#6B6B6B]">{item.label}</span>
            <span className="text-[12px] font-[750] tabular-nums text-[#111111]">{item.value.toFixed(2)}%</span>
          </div>
        ))}
        {spread != null && (
          <div className={cn('flex items-baseline gap-1 ml-auto', inverted ? 'text-[#D83B3B]' : 'text-[#11875D]')}>
            <span className="text-[10px]">10Y–2Y spread</span>
            <span className="text-[12px] font-[750] tabular-nums">{inverted ? '' : '+'}{spread}bps</span>
          </div>
        )}
      </div>
    </div>
  )
}
