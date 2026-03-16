'use client'
import type { StockRatings, CategoryRating } from '@/lib/dcf/calculateRatings'

interface Props { ratings: StockRatings }

const colorMap: Record<string, {
  bg: string; text: string; border: string; bar: string; badge: string
}> = {
  emerald: {
    bg:     'bg-emerald-50 dark:bg-emerald-500/10',
    text:   'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-500/20',
    bar:    'bg-emerald-500',
    badge:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  },
  green: {
    bg:     'bg-green-50 dark:bg-green-500/10',
    text:   'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-500/20',
    bar:    'bg-green-500',
    badge:  'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
  },
  blue: {
    bg:     'bg-blue-50 dark:bg-blue-500/10',
    text:   'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-500/20',
    bar:    'bg-blue-500',
    badge:  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  },
  amber: {
    bg:     'bg-amber-50 dark:bg-amber-500/10',
    text:   'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-500/20',
    bar:    'bg-amber-400',
    badge:  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  },
  orange: {
    bg:     'bg-orange-50 dark:bg-orange-500/10',
    text:   'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-500/20',
    bar:    'bg-orange-400',
    badge:  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
  },
  red: {
    bg:     'bg-red-50 dark:bg-red-500/10',
    text:   'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-500/20',
    bar:    'bg-red-500',
    badge:  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
  },
}

function ScoreBar({ score }: { score: number }) {
  const pct = ((score - 1) / 4) * 100
  return (
    <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-white/10">
      <div
        className="h-1.5 rounded-full bg-gray-700 dark:bg-white/60 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function MetricRow({ name, value, score }: { name: string; value: string; score: number }) {
  const dots = Math.round(score)
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-white/5 last:border-0">
      <span className="text-xs text-gray-500 dark:text-white/40">{name}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700 dark:text-white/60 tabular-nums">{value}</span>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map((i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i <= dots ? 'bg-gray-700 dark:bg-white/60' : 'bg-gray-200 dark:bg-white/10'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CategoryCard({ title, rating }: { title: string; rating: CategoryRating }) {
  const c = colorMap[rating.color] ?? colorMap.blue
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40">{title}</p>
          <p className={`mt-0.5 text-sm font-semibold ${c.text}`}>{rating.label}</p>
        </div>
        <div className={`rounded-xl px-3 py-1.5 text-xl font-bold ${c.badge}`}>
          {rating.grade}
        </div>
      </div>

      <ScoreBar score={rating.score} />

      <div className="mt-3 space-y-0">
        {rating.metrics.map((m) => (
          <MetricRow key={m.name} name={m.name} value={m.value} score={m.score} />
        ))}
      </div>

      <p className={`mt-3 text-xs leading-relaxed ${c.text} opacity-80`}>{rating.summary}</p>
    </div>
  )
}

export default function RatingsPanel({ ratings }: Props) {
  const oc = colorMap[ratings.overall.color] ?? colorMap.blue

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70">Analysis Ratings</h2>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-white/25">Profitability · Liquidity · Growth · MOAT · Valuation</p>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border ${oc.border} ${oc.bg} px-5 py-3`}>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-white/40">Overall</p>
            <p className={`text-sm font-bold ${oc.text}`}>{ratings.overall.label}</p>
          </div>
          <span className={`text-3xl font-bold ${oc.text}`}>{ratings.overall.grade}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CategoryCard title="Profitability" rating={ratings.profitability} />
        <CategoryCard title="Liquidity" rating={ratings.liquidity} />
        <CategoryCard title="Growth" rating={ratings.growth} />
        <CategoryCard title="Economic Moat" rating={ratings.moat} />
        <CategoryCard title="Valuation" rating={ratings.valuation} />
      </div>
    </div>
  )
}
