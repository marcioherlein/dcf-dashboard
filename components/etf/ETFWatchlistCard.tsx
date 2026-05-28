'use client'

import Link from 'next/link'
import { Trash2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtLarge, fmtPctAbs } from '@/lib/formatters'
import type { ETFEntry } from '@/lib/data/etfTypes'

function ValueScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-slate-400">—</span>
  const color =
    score >= 70 ? 'bg-emerald-100 text-emerald-700' :
    score >= 50 ? 'bg-blue-100 text-blue-700' :
    score >= 30 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-600'
  const label =
    score >= 70 ? 'Deep Value' :
    score >= 50 ? 'Fair' :
    score >= 30 ? 'Stretched' :
    'Expensive'
  return (
    <div className={cn('flex items-center gap-1.5 rounded-lg px-2 py-1', color)}>
      <span className="text-lg font-black font-mono">{score}</span>
      <span className="text-[10px] font-semibold">{label}</span>
    </div>
  )
}

interface Props {
  entry: ETFEntry
  onDelete: (ticker: string) => void
}

export function ETFWatchlistCard({ entry, onDelete }: Props) {
  const er = entry.expenseRatio != null ? (entry.expenseRatio * 100).toFixed(2) + '%' : '—'
  const yld = entry.yield != null ? fmtPctAbs(entry.yield) : '—'
  const pe = entry.peRatio != null ? entry.peRatio.toFixed(1) + 'x' : '—'
  const aum = entry.totalAssets != null ? fmtLarge(entry.totalAssets) : '—'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3 hover:border-blue-200 hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-base font-black font-mono text-slate-900">{entry.ticker}</span>
          {entry.name && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[160px]">{entry.name}</p>}
        </div>
        <button
          onClick={() => onDelete(entry.ticker)}
          className="text-slate-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Remove"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <ValueScoreBadge score={entry.valueScore} />

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-50 rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">P/E</p>
          <p className="text-xs font-semibold font-mono text-slate-700 mt-0.5">{pe}</p>
        </div>
        <div className="bg-slate-50 rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">Yield</p>
          <p className="text-xs font-semibold font-mono text-slate-700 mt-0.5">{yld}</p>
        </div>
        <div className="bg-slate-50 rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">Exp. Ratio</p>
          <p className="text-xs font-semibold font-mono text-slate-700 mt-0.5">{er}</p>
        </div>
        <div className="bg-slate-50 rounded-lg px-2.5 py-2">
          <p className="text-[9px] text-slate-400 uppercase tracking-wider">AUM</p>
          <p className="text-xs font-semibold font-mono text-slate-700 mt-0.5">{aum}</p>
        </div>
      </div>

      <Link
        href={`/etf/${entry.ticker}`}
        className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-500 text-xs font-semibold py-2 transition-colors border border-slate-100"
      >
        <ExternalLink size={11} />
        Open
      </Link>
    </div>
  )
}
