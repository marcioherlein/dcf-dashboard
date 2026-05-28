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
    return <p className="text-sm text-slate-400 py-4">Holdings data unavailable.</p>
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Top Holdings</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-2 text-[10px] text-slate-400 uppercase tracking-wider font-semibold w-8">#</th>
              <th className="text-left px-4 py-2 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Ticker</th>
              <th className="text-left px-4 py-2 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Name</th>
              <th className="text-right px-4 py-2 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Weight</th>
              <th className="px-4 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <tr key={h.symbol} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{h.rank}</td>
                <td className="px-4 py-2.5">
                  <span className="font-black font-mono text-slate-900 text-xs">{h.symbol}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[200px] truncate">{h.name}</td>
                <td className="px-4 py-2.5 text-right">
                  {h.weight != null ? (
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className="h-full bg-blue-400 rounded-full"
                          style={{ width: `${Math.min(100, h.weight * 100 * 3)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-semibold text-slate-700">
                        {(h.weight * 100).toFixed(2)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {h.symbol && (
                    <Link
                      href={`/stock/${h.symbol}`}
                      className="text-slate-300 hover:text-blue-500 transition-colors"
                      title={`Analyze ${h.symbol}`}
                    >
                      <ExternalLink size={12} />
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
