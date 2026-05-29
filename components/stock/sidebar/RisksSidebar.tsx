'use client'
import { cn } from '@/lib/utils'

interface CategoryRating {
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F'
  summary: string
}

interface Ratings {
  profitability: CategoryRating
  liquidity: CategoryRating
  growth: CategoryRating
  moat: CategoryRating
  valuation: CategoryRating
}

interface Scores {
  piotroski?: { score: number }
  altman?: { zScore: number; zone: 'Safe' | 'Grey' | 'Distress' } | null
  beneish?: { flag: 'Clean' | 'Warning' | 'Manipulator' } | null
}

interface Ownership {
  insiderPct: number | null
  institutionalPct: number | null
  shortPct: number | null
  shortRatio: number | null
}

interface Props {
  ratings: Ratings
  scores?: Scores
  ownership?: Ownership
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{children}</p>
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
      {children}
    </div>
  )
}

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  if (grade === 'B+' || grade === 'B') return 'text-blue-600 bg-blue-50 border-blue-200'
  if (grade === 'C')                   return 'text-amber-600 bg-amber-50 border-amber-200'
  if (grade === 'D')                   return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

export default function RisksSidebar({ ratings, scores, ownership }: Props) {
  const piotroski = scores?.piotroski
  const altman    = scores?.altman
  const beneish   = scores?.beneish

  const altmanColor = altman?.zone === 'Safe' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : altman?.zone === 'Distress' ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-amber-600 bg-amber-50 border-amber-200'

  const beneishColor = beneish?.flag === 'Clean' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : beneish?.flag === 'Manipulator' ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-amber-600 bg-amber-50 border-amber-200'

  const ratingCategories: { label: string; key: keyof Ratings }[] = [
    { label: 'Profitability', key: 'profitability' },
    { label: 'Liquidity',     key: 'liquidity' },
    { label: 'Growth',        key: 'growth' },
    { label: 'Moat',          key: 'moat' },
    { label: 'Valuation',     key: 'valuation' },
  ]

  return (
    <div className="space-y-3">

      {/* Quality Scores */}
      {(piotroski || altman || beneish) && (
        <Card>
          <SectionLabel>Quality Scores</SectionLabel>
          <div className="space-y-3">

            {piotroski && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-slate-400">Piotroski F-Score</span>
                  <span className={cn(
                    'text-xs font-bold tabular-nums',
                    piotroski.score >= 7 ? 'text-emerald-600' : piotroski.score >= 4 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {piotroski.score} / 9
                  </span>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1.5 flex-1 rounded-full',
                        i < piotroski.score
                          ? piotroski.score >= 7 ? 'bg-emerald-400' : piotroski.score >= 4 ? 'bg-amber-400' : 'bg-red-400'
                          : 'bg-slate-200'
                      )}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {piotroski.score >= 7 ? 'Financially strong' : piotroski.score >= 4 ? 'Average health' : 'Financially weak'}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {altman && (
                <div className={cn('flex flex-col items-center px-3 py-1.5 rounded-lg border', altmanColor)}>
                  <span className="text-[9px] text-current opacity-70 uppercase tracking-wider">Altman Z</span>
                  <span className="text-xs font-bold">{altman.zScore.toFixed(1)}</span>
                  <span className="text-[9px] font-semibold">{altman.zone}</span>
                </div>
              )}
              {beneish && (
                <div className={cn('flex flex-col items-center px-3 py-1.5 rounded-lg border', beneishColor)}>
                  <span className="text-[9px] text-current opacity-70 uppercase tracking-wider">Beneish</span>
                  <span className="text-xs font-bold">{beneish.flag}</span>
                </div>
              )}
            </div>

          </div>
        </Card>
      )}

      {/* Ratings by Category */}
      <Card>
        <SectionLabel>Category Grades</SectionLabel>
        <div className="space-y-0 divide-y divide-slate-100">
          {ratingCategories.map(({ label, key }) => {
            const cat = ratings[key]
            return (
              <div key={key} className="flex items-center justify-between py-2.5 min-h-[44px]">
                <span className="text-[12px] text-slate-500">{label}</span>
                <span className={cn('text-[12px] font-bold px-2 py-0.5 rounded border leading-5', gradeColor(cat.grade))}>
                  {cat.grade}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Short Interest */}
      {ownership && (ownership.shortPct != null || ownership.shortRatio != null) && (
        <Card>
          <SectionLabel>Short Interest</SectionLabel>
          <div className="space-y-0 divide-y divide-slate-100">
            {ownership.shortPct != null && (
              <div className="flex items-center justify-between py-2.5 min-h-[44px]">
                <span className="text-[12px] text-slate-400">Short Float</span>
                <span className={cn(
                  'text-[12px] font-semibold tabular-nums',
                  ownership.shortPct > 0.1 ? 'text-amber-600' : 'text-slate-700'
                )}>
                  {(ownership.shortPct * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {ownership.shortRatio != null && (
              <div className="flex items-center justify-between py-2.5 min-h-[44px]">
                <span className="text-[12px] text-slate-400">Short Ratio (days)</span>
                <span className="text-[12px] font-semibold text-slate-700 tabular-nums">
                  {ownership.shortRatio.toFixed(1)}
                </span>
              </div>
            )}
            {ownership.insiderPct != null && (
              <div className="flex items-center justify-between py-2.5 min-h-[44px]">
                <span className="text-[12px] text-slate-400">Insider Ownership</span>
                <span className="text-[12px] font-semibold text-slate-700 tabular-nums">
                  {(ownership.insiderPct * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

    </div>
  )
}
