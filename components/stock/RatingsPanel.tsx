'use client'
import type { StockRatings, CategoryRating } from '@/lib/dcf/calculateRatings'

interface Props { ratings: StockRatings }

const colorMap: Record<string, {
  bg: string; text: string; border: string; bar: string; badge: string
}> = {
  emerald: {
    bg:     'bg-emerald-50',
    text:   'text-emerald-700',
    border: 'border-emerald-200',
    bar:    'bg-emerald-500',
    badge:  'bg-emerald-100 text-emerald-700',
  },
  green: {
    bg:     'bg-green-50',
    text:   'text-green-700',
    border: 'border-green-200',
    bar:    'bg-green-500',
    badge:  'bg-green-100 text-green-700',
  },
  blue: {
    bg:     'bg-blue-50',
    text:   'text-blue-700',
    border: 'border-blue-200',
    bar:    'bg-blue-500',
    badge:  'bg-blue-100 text-blue-700',
  },
  amber: {
    bg:     'bg-amber-50',
    text:   'text-amber-700',
    border: 'border-amber-200',
    bar:    'bg-amber-400',
    badge:  'bg-amber-100 text-amber-700',
  },
  orange: {
    bg:     'bg-orange-50',
    text:   'text-orange-700',
    border: 'border-orange-200',
    bar:    'bg-orange-400',
    badge:  'bg-orange-100 text-orange-700',
  },
  red: {
    bg:     'bg-red-50',
    text:   'text-red-700',
    border: 'border-red-200',
    bar:    'bg-red-500',
    badge:  'bg-red-100 text-red-700',
  },
}

function ScoreBar({ score }: { score: number }) {
  const pct = ((score - 1) / 4) * 100
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div
        className="h-1.5 rounded-full bg-slate-700 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function MetricRow({ name, value, score }: { name: string; value: string; score: number }) {
  const dots = Math.round(score)
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 min-h-[44px] gap-2">
      <span className="text-[13px] text-slate-500 min-w-0">{name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[13px] font-medium text-slate-700 tabular-nums">{value}</span>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${i <= dots ? 'bg-slate-700' : 'bg-slate-200'}`}
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
    <div className={`rounded-2xl border ${c.border} ${c.bg} px-4 py-4 sm:p-5`}>
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-0.5 text-[14px] font-semibold leading-snug ${c.text}`}>{rating.label}</p>
        </div>
        <div className={`rounded-xl px-3 py-1.5 text-xl font-bold shrink-0 ${c.badge}`}>
          {rating.grade}
        </div>
      </div>

      <ScoreBar score={rating.score} />

      <div className="mt-3 space-y-0">
        {rating.metrics.map((m) => (
          <MetricRow key={m.name} name={m.name} value={m.value} score={m.score} />
        ))}
      </div>

      <p className={`mt-3 text-[13px] leading-relaxed ${c.text} opacity-80`}>{rating.summary}</p>
    </div>
  )
}

export default function RatingsPanel({ ratings }: Props) {
  const oc = colorMap[ratings.overall.color] ?? colorMap.blue

  return (
    <div className="rounded-xl card px-4 py-4 sm:p-6">
      <div className="flex items-start sm:items-center justify-between mb-5 sm:mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-headline font-semibold text-slate-900">Analysis Ratings</h2>
          <p className="mt-0.5 text-[12px] text-slate-400">Profitability · Liquidity · Growth · MOAT · Valuation</p>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border ${oc.border} ${oc.bg} px-4 py-2.5 min-h-[44px]`}>
          <div>
            <p className="text-[11px] font-medium text-slate-500">Overall</p>
            <p className={`text-[13px] font-bold ${oc.text}`}>{ratings.overall.label}</p>
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
