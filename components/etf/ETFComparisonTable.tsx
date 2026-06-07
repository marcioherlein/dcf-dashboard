'use client'

import { cn } from '@/lib/utils'
import { fmtLarge, fmtPctAbs, fmtMultiple } from '@/lib/formatters'
import { scoreColor, scoreLabel } from '@/lib/data/etfScore'
import type { ETFProfileResponse } from '@/lib/data/etfTypes'

interface Props {
  profiles: ETFProfileResponse[]
}

type MetricDef = {
  key: keyof ETFProfileResponse
  label: string
  format: (v: number) => string
  bestDir: 'low' | 'high'
}

const METRICS: MetricDef[] = [
  { key: 'peRatio',      label: 'P/E Ratio',     format: (v) => fmtMultiple(v),               bestDir: 'low'  },
  { key: 'pbRatio',      label: 'P/B Ratio',     format: (v) => fmtMultiple(v),               bestDir: 'low'  },
  { key: 'psRatio',      label: 'P/S Ratio',     format: (v) => fmtMultiple(v),               bestDir: 'low'  },
  { key: 'pcfRatio',     label: 'P/CF Ratio',    format: (v) => fmtMultiple(v),               bestDir: 'low'  },
  { key: 'yield',        label: 'Yield',         format: (v) => fmtPctAbs(v),                 bestDir: 'high' },
  { key: 'expenseRatio', label: 'Expense Ratio', format: (v) => (v * 100).toFixed(2) + '%',  bestDir: 'low'  },
  { key: 'aum',          label: 'AUM',           format: (v) => fmtLarge(v),                  bestDir: 'high' },
  { key: 'valueScore',   label: 'Value Score',   format: (v) => String(Math.round(v)),         bestDir: 'high' },
]

function getBestIdx(profiles: ETFProfileResponse[], key: keyof ETFProfileResponse, dir: 'low' | 'high'): number {
  let bestIdx = -1
  let bestVal: number | null = null
  profiles.forEach((p, i) => {
    const v = p[key] as number | null
    if (v == null) return
    if (bestVal == null) { bestIdx = i; bestVal = v; return }
    if (dir === 'low' && v < bestVal) { bestIdx = i; bestVal = v }
    if (dir === 'high' && v > bestVal) { bestIdx = i; bestVal = v }
  })
  return bestIdx
}

export function ETFComparisonTable({ profiles }: Props) {
  if (profiles.length === 0) return null

  return (
    <div className="glass-card-light rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E3E1DA]/60 bg-[#F4F3EF]/60">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#566174] w-32">Metric</th>
              {profiles.map((p) => (
                <th key={p.ticker} className="px-4 py-3 text-center">
                  <span className="font-black font-mono text-[#06101F] text-sm">{p.ticker}</span>
                  <span className="block text-[10px] text-[#8A95A6] mt-0.5 truncate max-w-[120px] mx-auto">{p.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F4F3EF]">
            {METRICS.map((m) => {
              const bestIdx = getBestIdx(profiles, m.key, m.bestDir)
              return (
                <tr key={m.key} className="hover:bg-[#F4F3EF]/60 transition-colors">
                  <td className="px-4 py-3 text-xs font-semibold text-[#566174]">{m.label}</td>
                  {profiles.map((p, i) => {
                    const raw = p[m.key] as number | null
                    const isBest = i === bestIdx && raw != null
                    const isScore = m.key === 'valueScore'
                    return (
                      <td
                        key={p.ticker}
                        className={cn(
                          'px-4 py-3 text-center font-mono text-xs font-semibold tabular-nums',
                          isBest && 'bg-[#E8F7EF]',
                          isScore && raw != null ? scoreColor(raw as number) : 'text-[#06101F]',
                        )}
                      >
                        {raw != null ? m.format(raw) : <span className="text-[#8A95A6]">—</span>}
                        {isScore && raw != null && (
                          <span className="block text-[10px] font-semibold text-[#8A95A6] mt-0.5">{scoreLabel(raw as number)}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
