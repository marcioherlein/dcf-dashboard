'use client'

import { AlertTriangle, ArrowRight, DollarSign } from 'lucide-react'
import { ETFBatchItem, ETFEntry } from '@/lib/data/etfTypes'
import { ALL_META, ETFMeta, CATEGORY_AVG_EXPENSE, groupLabel } from '@/lib/data/etfUniverse'
import { fmtPctAbs } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface Props {
  watchlist: ETFEntry[]
  batchData: Record<string, ETFBatchItem | null>
}

interface Idea {
  message: string
  severity: 'warning' | 'info'
  icon: 'AlertTriangle' | 'DollarSign' | 'ArrowRight'
}

export function ETFRebalanceIdeas({ watchlist, batchData }: Props) {
  if (!watchlist.length) return null

  const ideas: Idea[] = []

  // Idea 1 — Concentration risk
  const aumsWithTicker = watchlist.map((e) => ({
    ticker: e.ticker,
    aum: batchData[e.ticker]?.aum ?? null,
  }))
  const validAums = aumsWithTicker.filter((x) => x.aum !== null && x.aum > 0)
  if (validAums.length > 0) {
    const totalAum = validAums.reduce((sum, x) => sum + (x.aum as number), 0)
    for (const { ticker, aum } of validAums) {
      const share = (aum as number) / totalAum
      if (share > 0.4) {
        ideas.push({
          message: `${ticker} is ${(share * 100).toFixed(0)}% of your watchlist by AUM. Consider diversifying.`,
          severity: 'warning',
          icon: 'AlertTriangle',
        })
        break
      }
    }
  }

  // Idea 2 — High cost ETF
  for (const entry of watchlist) {
    const batch = batchData[entry.ticker]
    const er = batch?.expenseRatio ?? null
    if (er !== null && er > 0.005) {
      const meta = ALL_META.find((m) => m.ticker === entry.ticker)
      const group = meta?.group
      const categoryAvg = group ? CATEGORY_AVG_EXPENSE[group] : null
      const multiple =
        categoryAvg && categoryAvg > 0 ? Math.round(er / categoryAvg) : null
      const multipleStr = multiple !== null && multiple > 1 ? ` — ${multiple}x the category average` : ''
      ideas.push({
        message: `${entry.ticker} costs ${fmtPctAbs(er)}/year${multipleStr}.`,
        severity: 'warning',
        icon: 'DollarSign',
      })
      break
    }
  }

  // Idea 3 — Low diversification
  const metaMap = new Map<string, ETFMeta>(ALL_META.map((m) => [m.ticker, m]))
  const groupsInWatchlist = new Set<string>()
  const groupCounts: Record<string, number> = {}
  for (const entry of watchlist) {
    const meta = metaMap.get(entry.ticker)
    if (meta) {
      groupsInWatchlist.add(meta.group)
      groupCounts[meta.group] = (groupCounts[meta.group] ?? 0) + 1
    }
  }
  if (groupsInWatchlist.size > 0 && groupsInWatchlist.size < 3) {
    const dominantGroup = Object.entries(groupCounts).sort((a, b) => b[1] - a[1])[0][0]
    const label = groupLabel(dominantGroup as ReturnType<typeof groupLabel> extends string ? any : any)
    ideas.push({
      message: `Your watchlist is concentrated in ${label}. Consider adding bonds, international, or income exposure.`,
      severity: 'info',
      icon: 'ArrowRight',
    })
  }

  if (!ideas.length) return null

  return (
    <div className="flex flex-col gap-2">
      {ideas.map((idea, i) => (
        <div
          key={i}
          className={cn(
            'flex items-start gap-3 rounded-xl border px-4 py-3',
            idea.severity === 'warning'
              ? 'border-[#FDE68A] bg-[#FFFBEB]'
              : 'border-[#BFDBFE] bg-[#EFF6FF]',
          )}
        >
          <span
            className={cn(
              'shrink-0 mt-0.5',
              idea.severity === 'warning' ? 'text-[#92580A]' : 'text-[#2563EB]',
            )}
          >
            {idea.icon === 'AlertTriangle' && <AlertTriangle size={14} />}
            {idea.icon === 'DollarSign' && <DollarSign size={14} />}
            {idea.icon === 'ArrowRight' && <ArrowRight size={14} />}
          </span>
          <p className="text-[12px] text-[#4B5563] leading-snug">{idea.message}</p>
        </div>
      ))}
    </div>
  )
}
