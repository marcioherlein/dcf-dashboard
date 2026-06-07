'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

interface Holding {
  rank: number
  symbol: string
  name: string
  weight: number | null
}

interface Props {
  holdings: Holding[]
}

export function ETFHoldingsTable({ holdings }: Props) {
  if (!holdings.length) {
    return (
      <div className="glass-card-light rounded-xl p-4">
        <p className="text-sm font-semibold text-[#06101F] mb-2">Top Holdings</p>
        <p className="text-sm text-[#8A95A6] py-2">Holdings data unavailable.</p>
      </div>
    )
  }

  const maxWeight = Math.max(...holdings.map((h) => h.weight ?? 0), 0.001)

  return (
    <div className="glass-card-light rounded-xl">
      <div className="px-4 py-3 border-b border-[#E3E1DA]/60">
        <p className="text-sm font-semibold text-[#06101F]">Top Holdings</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E3E1DA] bg-[#F4F3EF]/60">
              <th className="text-left px-4 py-2 text-xs text-[#566174] font-semibold w-8">#</th>
              <th className="text-left px-4 py-2 text-xs text-[#566174] font-semibold">Ticker</th>
              <th className="text-left px-4 py-2 text-xs text-[#566174] font-semibold">Name</th>
              <th className="text-right px-4 py-2 text-xs text-[#566174] font-semibold">Weight</th>
              <th className="px-4 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.symbol} className="border-b border-[#F4F3EF] last:border-0 hover:bg-[#F4F3EF]/60 transition-colors group">
                <td className="px-4 py-2.5 text-xs text-[#8A95A6] font-mono">{h.rank}</td>
                <td className="px-4 py-2.5">
                  <span className="font-black font-sans text-[#06101F] text-xs">{h.symbol}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-[#566174] max-w-[200px] truncate">{h.name}</td>
                <td className="px-4 py-2.5 text-right">
                  {h.weight != null ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-[#F4F3EF] rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full bg-olive-700 rounded-full"
                          style={{ width: `${(h.weight / maxWeight) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-semibold text-[#06101F]">
                        {(h.weight * 100).toFixed(2)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-[#8A95A6]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {h.symbol && (
                    <Link
                      href={`/stock/${h.symbol}`}
                      className="inline-flex items-center gap-1 text-[#566174] hover:text-olive-700 transition-colors focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:outline-none rounded"
                      aria-label={`Open DCF analysis for ${h.symbol}`}
                    >
                      <ExternalLink size={12} />
                      <span className="text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">DCF</span>
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
