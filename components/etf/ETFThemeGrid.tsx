'use client'

import {
  ETFGroup,
  ETFMeta,
  groupLabel,
  BROAD_META,
  SECTOR_META,
  GEO_META,
  STYLE_META,
  BOND_META,
  DIVIDEND_META,
  THEMATIC_META,
  COMMODITY_META,
} from '@/lib/data/etfUniverse'
import { ETFBatchItem } from '@/lib/data/etfTypes'
import { Sparkline } from '@/components/ui/Sparkline'
import { cn } from '@/lib/utils'

interface Props {
  data: Record<string, ETFBatchItem | null>
  sparklines: Record<string, number[] | null>
  onViewGroup: (group: ETFGroup) => void
  loading: boolean
}

interface GroupConfig {
  group: ETFGroup
  metas: ETFMeta[]
}

const GROUP_CONFIGS: GroupConfig[] = [
  { group: 'broad',     metas: BROAD_META },
  { group: 'sector',    metas: SECTOR_META },
  { group: 'geo',       metas: GEO_META },
  { group: 'style',     metas: STYLE_META },
  { group: 'bond',      metas: BOND_META },
  { group: 'dividend',  metas: DIVIDEND_META },
  { group: 'thematic',  metas: THEMATIC_META },
  { group: 'commodity', metas: COMMODITY_META },
]

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#E3E1DA] bg-white p-3 overflow-hidden">
      <div className="h-3 w-20 rounded bg-[#F0F1F6] animate-pulse" />
      <div className="h-2.5 w-10 rounded bg-[#F0F1F6] animate-pulse mt-1" />
      <div className="h-[32px] w-full rounded bg-[#F0F1F6] animate-pulse mt-2" />
      <div className="flex items-center justify-between mt-2">
        <div className="h-3 w-14 rounded bg-[#F0F1F6] animate-pulse" />
        <div className="h-2.5 w-12 rounded bg-[#F0F1F6] animate-pulse" />
      </div>
    </div>
  )
}

interface CardProps {
  config: GroupConfig
  data: Record<string, ETFBatchItem | null>
  sparklines: Record<string, number[] | null>
  onViewGroup: (group: ETFGroup) => void
}

function ThemeCard({ config, data, sparklines, onViewGroup }: CardProps) {
  const { group, metas } = config

  const items = metas.map((m) => data[m.ticker]).filter(Boolean) as ETFBatchItem[]

  const returns = items.map((i) => i.return1Y).filter((v): v is number => v !== null)
  const yields = items.map((i) => i.yield).filter((v): v is number => v !== null && v > 0)

  const avgReturn = avg(returns)
  const avgYield = avg(yields)

  const repSparklineTicker = metas.find((m) => sparklines[m.ticker] && (sparklines[m.ticker]?.length ?? 0) > 1)?.ticker ?? null
  const repSparkline = repSparklineTicker ? sparklines[repSparklineTicker] : null
  const sparklineUp = avgReturn !== null ? avgReturn >= 0 : true

  const returnStr =
    avgReturn !== null
      ? `${avgReturn >= 0 ? '+' : ''}${(avgReturn * 100).toFixed(1)}% YTD`
      : '—'

  const returnColor =
    avgReturn === null
      ? 'text-[#9B9B9B]'
      : avgReturn >= 0
      ? 'text-emerald-600'
      : 'text-red-600'

  return (
    <div
      className="relative rounded-xl border border-[#E3E1DA] bg-white p-3 cursor-pointer hover:border-[#BFD2A1] hover:shadow-sm transition-all group overflow-hidden"
      onClick={() => onViewGroup(group)}
    >
      <p className="text-[12px] font-[700] text-[#111111] group-hover:text-olive-700 transition-colors leading-tight">
        {groupLabel(group)}
      </p>
      <p className="text-[10px] text-[#9B9B9B] mt-0.5">{metas.length} ETFs</p>

      <div className="h-[32px] w-full mt-2">
        {repSparkline && repSparkline.length > 1 ? (
          <Sparkline
            prices={repSparkline}
            up={sparklineUp}
            width={120}
            height={32}
            className="w-full h-[32px]"
          />
        ) : (
          <div className="w-full h-[32px]" />
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className={cn('text-[11px] font-[700] tabular-nums', returnColor)}>
          {returnStr}
        </span>
        {avgYield !== null && avgYield > 0 && (
          <span className="text-[10px] text-[#6B6B6B]">
            {(avgYield * 100).toFixed(1)}% yield
          </span>
        )}
      </div>

      <span className="text-[10px] text-olive-700 opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2 right-3">
        View all →
      </span>
    </div>
  )
}

export function ETFThemeGrid({ data, sparklines, onViewGroup, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {GROUP_CONFIGS.map((c) => (
          <SkeletonCard key={c.group} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {GROUP_CONFIGS.map((config) => (
        <ThemeCard
          key={config.group}
          config={config}
          data={data}
          sparklines={sparklines}
          onViewGroup={onViewGroup}
        />
      ))}
    </div>
  )
}
