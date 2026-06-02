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
          aria-label={`Remove ${entry.ticker} from watchlist`}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <ValueScoreBadge score={entry.valueScore} />

      {/* Flat 2×2 metric grid — no nested cards */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3">
        <div>
          <p className="text-[11px] text-slate-400">P/E</p>
          <p className="text-[13px] font-semibold font-mono text-slate-700 mt-0.5">{pe}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Yield</p>
          <p className="text-[13px] font-semibold font-mono text-slate-700 mt-0.5">{yld}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">Exp. ratio</p>
          <p className="text-[13px] font-semibold font-mono text-slate-700 mt-0.5">{er}</p>
        </div>
        <div>
          <p className="text-[11px] text-slate-400">AUM</p>
          <p className="text-[13px] font-semibold font-mono text-slate-700 mt-0.5">{aum}</p>
        </div>
      </div>

      <Link
        href={`/etf/${entry.ticker}`}
        aria-label={`View ${entry.ticker} ETF details`}
        className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-500 text-xs font-semibold py-2.5 transition-colors border border-slate-100 min-h-[44px]"
      >
        <ExternalLink size={11} />
        View details
      </Link>
    </div>
  )
}
