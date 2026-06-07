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
  return <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A95A6] mb-2">{children}</p>
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-[#E3E1DA] px-4 py-3">
      {children}
    </div>
  )
}

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]'
  if (grade === 'B+' || grade === 'B') return 'text-[#2563EB] bg-[#EAF1FF] border-[#93B4F5]'
  if (grade === 'C')                   return 'text-[#B56A00] bg-[#FFF4DA] border-[#F3D391]'
  if (grade === 'D')                   return 'text-orange-600 bg-orange-50 border-orange-200'
  return 'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]'
}

export default function RisksSidebar({ ratings, scores, ownership }: Props) {
  const piotroski = scores?.piotroski
  const altman    = scores?.altman
  const beneish   = scores?.beneish

  const altmanColor = altman?.zone === 'Safe' ? 'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]'
    : altman?.zone === 'Distress' ? 'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]'
    : 'text-[#B56A00] bg-[#FFF4DA] border-[#F3D391]'

  const beneishColor = beneish?.flag === 'Clean' ? 'text-[#11875D] bg-[#E8F7EF] border-[#A3D9BE]'
    : beneish?.flag === 'Manipulator' ? 'text-[#D83B3B] bg-[#FCEAEA] border-[#F0B8B8]'
    : 'text-[#B56A00] bg-[#FFF4DA] border-[#F3D391]'

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
                  <span className="text-[13px] text-[#8A95A6]">Piotroski F-Score</span>
                  <span className={cn(
                    'text-xs font-bold tabular-nums',
                    piotroski.score >= 7 ? 'text-[#11875D]' : piotroski.score >= 4 ? 'text-[#B56A00]' : 'text-[#D83B3B]'
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
                          ? piotroski.score >= 7 ? 'bg-[#11875D]' : piotroski.score >= 4 ? 'bg-[#B56A00]' : 'bg-[#D83B3B]'
                          : 'bg-[#E3E1DA]'
                      )}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-[#566174] mt-1">
                  {piotroski.score >= 7 ? 'Financially strong' : piotroski.score >= 4 ? 'Average health' : 'Financially weak'}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {altman && (
                <div className={cn('flex flex-col items-center px-3 py-1.5 rounded-lg border', altmanColor)}>
                  <span className="text-[10px] text-current opacity-70 uppercase tracking-wider">Altman Z</span>
                  <span className="text-xs font-bold">{altman.zScore.toFixed(1)}</span>
                  <span className="text-[10px] font-semibold">{altman.zone}</span>
                </div>
              )}
              {beneish && (
                <div className={cn('flex flex-col items-center px-3 py-1.5 rounded-lg border', beneishColor)}>
                  <span className="text-[10px] text-current opacity-70 uppercase tracking-wider">Beneish</span>
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
        <div className="space-y-0 divide-y divide-[#E3E1DA]">
          {ratingCategories.map(({ label, key }) => {
            const cat = ratings[key]
            return (
              <div key={key} className="flex items-center justify-between py-2.5 min-h-[44px]">
                <span className="text-[13px] text-[#566174]">{label}</span>
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
          <div className="space-y-0 divide-y divide-[#E3E1DA]">
            {ownership.shortPct != null && (
              <div className="flex items-center justify-between py-2.5 min-h-[44px]">
                <span className="text-[13px] text-[#8A95A6]">Short Float</span>
                <span className={cn(
                  'text-[13px] font-semibold tabular-nums',
                  ownership.shortPct > 0.1 ? 'text-[#B56A00]' : 'text-[#06101F]'
                )}>
                  {(ownership.shortPct * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {ownership.shortRatio != null && (
              <div className="flex items-center justify-between py-2.5 min-h-[44px]">
                <span className="text-[13px] text-[#8A95A6]">Short Ratio (days)</span>
                <span className="text-[13px] font-semibold text-[#06101F] tabular-nums">
                  {ownership.shortRatio.toFixed(1)}
                </span>
              </div>
            )}
            {ownership.insiderPct != null && (
              <div className="flex items-center justify-between py-2.5 min-h-[44px]">
                <span className="text-[13px] text-[#8A95A6]">Insider Ownership</span>
                <span className="text-[13px] font-semibold text-[#06101F] tabular-nums">
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
