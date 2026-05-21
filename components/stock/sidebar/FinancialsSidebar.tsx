'use client'
import { cn } from '@/lib/utils'

interface BusinessProfile {
  grossMargin: number | null
  netMargin: number | null
  fcfMargin: number | null
}

interface Scores {
  piotroski?: { score: number }
  altman?: { score: number; zone: 'Safe' | 'Grey' | 'Distress' } | null
  beneish?: { flag: 'Clean' | 'Warning' | 'Manipulator' } | null
}

interface IncomeRow {
  year: string
  revenue: number | null
  isProjected: boolean
}

interface Ownership {
  insiderPct: number | null
  institutionalPct: number | null
  shortPct: number | null
}

interface Props {
  businessProfile: BusinessProfile
  scores?: Scores
  financialStatements?: { incomeStatement: IncomeRow[] }
  ownership?: Ownership
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{children}</p>
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] px-4 py-3">
      {children}
    </div>
  )
}

function MarginBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? Math.min(100, Math.max(0, value * 100)) : null
  const color = pct == null ? 'bg-white/10'
    : pct >= 30 ? 'bg-emerald-500/70'
    : pct >= 15 ? 'bg-emerald-400/60'
    : pct >= 5  ? 'bg-amber-400/60'
    : 'bg-red-400/60'

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="text-[11px] font-semibold text-slate-200 tabular-nums">
          {pct != null ? pct.toFixed(1) + '%' : '—'}
        </span>
      </div>
      <div className="h-1 rounded-full bg-white/8">
        {pct != null && (
          <div className={cn('h-1 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  )
}

function RevenueSparkline({ rows }: { rows: IncomeRow[] }) {
  const historical = rows.filter(r => !r.isProjected && r.revenue != null).slice(-4)
  if (historical.length < 2) return null

  const values = historical.map(r => r.revenue as number)
  const max    = Math.max(...values)
  const min    = Math.min(0, Math.min(...values))
  const range  = max - min || 1

  const W = 220; const H = 40; const BAR_W = 38; const GAP = 8

  return (
    <Card>
      <SectionLabel>Revenue Trend</SectionLabel>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} className="overflow-visible">
        {values.map((v, i) => {
          const barH = Math.max(2, ((v - min) / range) * H)
          const x    = i * (BAR_W + GAP)
          const y    = H - barH
          const isLatest = i === values.length - 1
          return (
            <g key={i}>
              <rect
                x={x} y={y} width={BAR_W} height={barH}
                rx={3}
                fill={isLatest ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.12)'}
              />
              <text
                x={x + BAR_W / 2} y={H + 14}
                textAnchor="middle"
                fontSize={9}
                fill="rgba(148,163,184,0.8)"
              >
                {historical[i].year.slice(-2)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between mt-0.5 text-[9px] text-slate-500">
        {values.map((v, i) => (
          <span key={i} className="tabular-nums">
            {v >= 1e9 ? '$' + (v / 1e9).toFixed(0) + 'B' : '$' + (v / 1e6).toFixed(0) + 'M'}
          </span>
        ))}
      </div>
    </Card>
  )
}

export default function FinancialsSidebar({ businessProfile, scores, financialStatements, ownership }: Props) {
  const piotroski = scores?.piotroski
  const altman    = scores?.altman
  const beneish   = scores?.beneish

  const altmanColor = altman?.zone === 'Safe' ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20'
    : altman?.zone === 'Distress' ? 'text-red-400 bg-red-500/15 border-red-500/20'
    : 'text-amber-400 bg-amber-500/15 border-amber-500/20'

  const beneishColor = beneish?.flag === 'Clean' ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20'
    : beneish?.flag === 'Manipulator' ? 'text-red-400 bg-red-500/15 border-red-500/20'
    : 'text-amber-400 bg-amber-500/15 border-amber-500/20'

  return (
    <div className="space-y-3">

      {/* Margins */}
      <Card>
        <SectionLabel>Profit Margins</SectionLabel>
        <div className="space-y-2.5">
          <MarginBar label="Gross Margin"  value={businessProfile.grossMargin} />
          <MarginBar label="Net Margin"    value={businessProfile.netMargin} />
          <MarginBar label="FCF Margin"    value={businessProfile.fcfMargin} />
        </div>
      </Card>

      {/* Revenue sparkline */}
      {financialStatements?.incomeStatement && (
        <RevenueSparkline rows={financialStatements.incomeStatement} />
      )}

      {/* Quality Scores */}
      {(piotroski || altman || beneish) && (
        <Card>
          <SectionLabel>Quality Scores</SectionLabel>
          <div className="space-y-2">

            {/* Piotroski */}
            {piotroski && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-400">Piotroski F-Score</span>
                  <span className={cn(
                    'text-[11px] font-bold tabular-nums',
                    piotroski.score >= 7 ? 'text-emerald-400' : piotroski.score >= 4 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {piotroski.score}/9
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
                          : 'bg-white/10'
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Altman + Beneish chips */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {altman && (
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', altmanColor)}>
                  Altman: {altman.zone}
                </span>
              )}
              {beneish && (
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', beneishColor)}>
                  {beneish.flag}
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Ownership */}
      {ownership && (
        <Card>
          <SectionLabel>Ownership</SectionLabel>
          <div className="space-y-1.5">
            {[
              { label: 'Insider',       value: ownership.insiderPct },
              { label: 'Institutional', value: ownership.institutionalPct },
              { label: 'Short Float',   value: ownership.shortPct },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{label}</span>
                <span className="text-[11px] font-semibold text-slate-200 tabular-nums">
                  {value != null ? (value * 100).toFixed(1) + '%' : '—'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  )
}
