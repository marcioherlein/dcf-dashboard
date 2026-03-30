'use client'

import { useState } from 'react'
import type { RankedInstrument } from '@/app/api/factor-ranking/route'

interface Props {
  instruments: RankedInstrument[]
}

const W = 520
const H = 360
const PAD = { top: 20, right: 16, bottom: 44, left: 48 }

// X = RS/momentum score (0-100), Y = dist from 52w high (negative %, clipped -100..0)
function getCoords(inst: RankedInstrument) {
  const scores = inst.factorScores as unknown as Record<string, number>
  const rsScore = scores.momentum ?? 50

  const distRaw = (inst.keyMetrics?.['Dist 52w Hi'] as number | null) ?? null
  // Dist 52w Hi stored as negative percentage (e.g. -15 means 15% below high)
  const dist = distRaw !== null ? Math.max(-100, Math.min(0, distRaw)) : -50

  const x = PAD.left + (rsScore / 100) * (W - PAD.left - PAD.right)
  const y = PAD.top + ((dist + 100) / 100) * (H - PAD.top - PAD.bottom)
  // y=top → dist=0 (AT HIGH), y=bottom → dist=-100 (far from high)
  const yFlipped = H - PAD.bottom - (y - PAD.top)

  return { x, y: yFlipped, rsScore, dist }
}

function bubbleColor(rsScore: number): { fill: string; stroke: string } {
  if (rsScore >= 70) return { fill: 'rgba(63,185,80,0.25)', stroke: '#3fb950' }
  if (rsScore >= 40) return { fill: 'rgba(210,153,34,0.25)', stroke: '#d2991f' }
  return { fill: 'rgba(248,81,73,0.2)', stroke: '#f85149' }
}

export default function BubbleMap({ instruments }: Props) {
  const [hovered, setHovered] = useState<RankedInstrument | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  if (instruments.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#8b949e] text-xs">
        No data
      </div>
    )
  }

  // X grid lines at 20, 40, 60, 80
  const xGridValues = [20, 40, 60, 80]
  // Y grid lines at 0, -25, -50, -75 (distance from 52w high)
  const yGridValues = [0, -25, -50, -75]

  function xToPixel(v: number) {
    return PAD.left + (v / 100) * (W - PAD.left - PAD.right)
  }
  function yToPixel(v: number) {
    // v is dist (0 to -100), 0 = at high = top
    return H - PAD.bottom - ((v + 100) / 100) * (H - PAD.top - PAD.bottom)
  }

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Background */}
        <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom} fill="#161b22" rx="4" />

        {/* X grid + labels */}
        {xGridValues.map((v) => {
          const x = xToPixel(v)
          return (
            <g key={`xg-${v}`}>
              <line x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom} stroke="#21262d" strokeWidth={1} />
              <text x={x} y={H - PAD.bottom + 14} textAnchor="middle" fill="#6e7681" fontSize="10">{v}</text>
            </g>
          )
        })}

        {/* Y grid + labels */}
        {yGridValues.map((v) => {
          const y = yToPixel(v)
          return (
            <g key={`yg-${v}`}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#21262d" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="#6e7681" fontSize="10">{v === 0 ? '0%' : `${v}%`}</text>
            </g>
          )
        })}

        {/* Axis labels */}
        <text x={W / 2} y={H - 4} textAnchor="middle" fill="#8b949e" fontSize="10">RS Score (Momentum)</text>
        <text
          x={12}
          y={(PAD.top + H - PAD.bottom) / 2}
          textAnchor="middle"
          fill="#8b949e"
          fontSize="10"
          transform={`rotate(-90, 12, ${(PAD.top + H - PAD.bottom) / 2})`}
        >
          Dist. 52w High
        </text>

        {/* Bubbles */}
        {instruments.map((inst) => {
          const { x, y, rsScore } = getCoords(inst)
          const { fill, stroke } = bubbleColor(rsScore)
          const r = 5 + (inst.finalScore / 100) * 6
          const isHovered = hovered?.ticker === inst.ticker

          return (
            <g key={inst.ticker}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? r + 2 : r}
                fill={fill}
                stroke={stroke}
                strokeWidth={isHovered ? 2 : 1}
                className="cursor-pointer transition-all"
                onMouseEnter={(e) => {
                  setHovered(inst)
                  const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect()
                  setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                }}
                onMouseMove={(e) => {
                  const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect()
                  setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
                }}
              />
              {(isHovered || inst.finalScore >= 75) && (
                <text
                  x={x}
                  y={y - r - 3}
                  textAnchor="middle"
                  fill={isHovered ? '#e6edf3' : stroke}
                  fontSize="9"
                  fontWeight="600"
                >
                  {inst.displayTicker}
                </text>
              )}
            </g>
          )
        })}

        {/* Quadrant shading: top-right = "sweet spot" */}
        <rect
          x={xToPixel(65)}
          y={PAD.top}
          width={W - PAD.right - xToPixel(65)}
          height={yToPixel(-25) - PAD.top}
          fill="rgba(63,185,80,0.04)"
          pointerEvents="none"
        />
        <text x={xToPixel(82)} y={PAD.top + 12} fill="rgba(63,185,80,0.4)" fontSize="9">Best</text>
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute z-20 pointer-events-none bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-xs shadow-xl"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 24,
            transform: tooltipPos.x > W * 0.65 ? 'translateX(-110%)' : undefined,
          }}
        >
          <div className="font-bold text-[#e6edf3]">{hovered.displayTicker}</div>
          <div className="text-[#8b949e]">{hovered.name.slice(0, 28)}</div>
          <div className="mt-1 flex gap-3">
            <span className="text-[#8b949e]">Score <span className="text-[#e6edf3] font-semibold">{hovered.finalScore}</span></span>
            <span className="text-[#8b949e]">RS <span className="text-[#e6edf3] font-semibold">{(hovered.factorScores as unknown as Record<string, number>).momentum?.toFixed(0) ?? '—'}</span></span>
            <span className="text-[#8b949e]">52w <span className="text-[#e6edf3] font-semibold">{(hovered.keyMetrics?.['Dist 52w Hi'] as number | null)?.toFixed(1) ?? '—'}%</span></span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1">
        {[
          { color: '#3fb950', label: 'RS ≥ 70' },
          { color: '#d2991f', label: 'RS 40–70' },
          { color: '#f85149', label: 'RS < 40' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: color, background: `${color}33` }} />
            <span className="text-[10px] text-[#8b949e]">{label}</span>
          </div>
        ))}
        <span className="text-[10px] text-[#8b949e] ml-auto">Bubble size = score</span>
      </div>
    </div>
  )
}
