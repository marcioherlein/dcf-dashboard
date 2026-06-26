'use client'
import type { StockRatings, CategoryRating } from '@/lib/dcf/calculateRatings'

interface Props { ratings: StockRatings }

const colorMap: Record<string, {
  bg: string; text: string; border: string; bar: string; badge: string
}> = {
  emerald: {
    bg:     'bg-[#E8F7EF]',
    text:   'text-[#11875D]',
    border: 'border-[#A3D9BE]',
    bar:    'bg-[#E8F7EF]',
    badge:  'bg-[#E8F7EF] text-[#11875D]',
  },
  green: {
    bg:     'bg-[#E8F7EF]',
    text:   'text-[#11875D]',
    border: 'border-green-200',
    bar:    'bg-[#E8F7EF]',
    badge:  'bg-[#E8F7EF] text-[#11875D]',
  },
  blue: {
    bg:     'bg-[#EAF1FF]',
    text:   'text-[#2563EB]',
    border: 'border-[#93B4F5]',
    bar:    'bg-[#EAF1FF]',
    badge:  'bg-[#EAF1FF] text-[#2563EB]',
  },
  amber: {
    bg:     'bg-[#FFF4DA]',
    text:   'text-[#B56A00]',
    border: 'border-[#F3D391]',
    bar:    'bg-[#B56A00]',
    badge:  'bg-[#FFF4DA] text-[#B56A00]',
  },
  orange: {
    bg:     'bg-orange-50',
    text:   'text-orange-700',
    border: 'border-orange-200',
    bar:    'bg-orange-400',
    badge:  'bg-orange-100 text-orange-700',
  },
  red: {
    bg:     'bg-[#FCEAEA]',
    text:   'text-[#D83B3B]',
    border: 'border-[#F0B8B8]',
    bar:    'bg-[#FCEAEA]',
    badge:  'bg-[#FCEAEA] text-[#D83B3B]',
  },
}

function ScoreBar({ score }: { score: number }) {
  const pct = ((score - 1) / 4) * 100
  return (
    <div className="h-1.5 w-full rounded-full bg-[#F0F1F6] flex-1">
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
    <div className="flex items-center justify-between py-2.5 border-b border-[#E3E1DA] last:border-0 min-h-[44px] gap-2">
      <span className="text-[13px] text-[#566174] min-w-0 flex-1">{name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[13px] font-medium text-[#06101F] tabular-nums shrink-0">{value}</span>
        <div className="flex gap-0.5 shrink-0">
          {[1,2,3,4,5].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${i <= dots ? 'bg-slate-700' : 'bg-[#E3E1DA]'}`}
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
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-[700] uppercase tracking-wider text-[#566174]">{title}</p>
          <p className={`mt-0.5 text-[14px] font-semibold leading-snug ${c.text}`}>{rating.label}</p>
        </div>
        <div className={`rounded-xl px-3 py-1.5 text-[32px] font-bold shrink-0 ${c.badge}`}>
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
    <div className="rounded-xl card p-4 sm:p-5">
      <div className="flex items-start sm:items-center justify-between mb-5 sm:mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-headline font-semibold text-[#06101F]">Analysis Ratings</h2>
          <p className="mt-0.5 text-[12px] text-[#8A95A6]">Profitability · Liquidity · Growth · MOAT · Valuation</p>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border ${oc.border} ${oc.bg} px-4 py-2.5 min-h-[44px]`}>
          <div>
            <p className="text-[11px] font-medium text-[#566174]">Overall</p>
            <p className={`text-[13px] font-bold ${oc.text}`}>{ratings.overall.label}</p>
          </div>
          <span className={`text-[32px] font-bold ${oc.text}`}>{ratings.overall.grade}</span>
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
