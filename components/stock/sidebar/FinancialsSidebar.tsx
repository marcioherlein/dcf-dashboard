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
  roic?: { roic: number | null; spread: number | null } | null
}

interface IncomeRow {
  year: string
  revenue: number | null
  netIncome: number | null
  ebitda: number | null
  operatingMargin: number | null
  isProjected: boolean
}

interface CashFlowRow {
  year: string
  freeCashFlow: number | null
  operatingCF: number | null
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
  financialStatements?: {
    incomeStatement: IncomeRow[]
    cashFlow: CashFlowRow[]
  }
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

function MarginBar({ label, value }: { label: string; value: number | null }) {
  const pct = value != null ? Math.min(100, Math.max(0, value * 100)) : null
  const color = pct == null ? 'bg-slate-100'
    : pct >= 30 ? 'bg-emerald-500/70'
    : pct >= 15 ? 'bg-emerald-400/60'
    : pct >= 5  ? 'bg-amber-400/60'
    : 'bg-red-400/60'

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
          {pct != null ? pct.toFixed(1) + '%' : '—'}
        </span>
      </div>
      <div className="h-1 rounded-full bg-slate-100">
        {pct != null && (
          <div className={cn('h-1 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  )
}

function fmtM(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1000) return (v < 0 ? '-' : '') + '$' + (abs / 1000).toFixed(1) + 'B'
  return (v < 0 ? '-' : '') + '$' + abs.toFixed(0) + 'M'
}

function BarSparkline({ data, colorFn, label }: {
  data: { year: string; value: number }[]
  colorFn: (v: number) => string
  label?: string
}) {
  if (data.length < 2) return null
  const maxAbs = Math.max(...data.map(d => Math.abs(d.value)))
  if (maxAbs === 0) return null

  return (
    <div>
      {label && <SectionLabel>{label}</SectionLabel>}
      <div className="flex items-end gap-1.5 h-10">
        {data.map((d, i) => {
          const h = Math.max(3, (Math.abs(d.value) / maxAbs) * 100)
          const isLatest = i === data.length - 1
          return (
            <div key={d.year} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              <div
                className={cn('w-full rounded-sm', colorFn(d.value), isLatest ? 'opacity-90' : 'opacity-50')}
                style={{ height: `${h}%` }}
              />
              <span className="text-[9px] text-slate-500">{d.year.slice(-2)}</span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-0.5 text-[9px] text-slate-500 tabular-nums">
        {data.map(d => (
          <span key={d.year}>{fmtM(d.value)}</span>
        ))}
      </div>
    </div>
  )
}

function RevenueBarChart({ rows }: { rows: IncomeRow[] }) {
  const hist = rows.filter(r => !r.isProjected && r.revenue != null).slice(-4)
  if (hist.length < 2) return null

  const values = hist.map(r => r.revenue as number)
  const max = Math.max(...values)
  const range = max || 1

  return (
    <Card>
      <SectionLabel>Revenue Trend</SectionLabel>
      <div className="flex items-end gap-1.5 h-12">
        {hist.map((r, i) => {
          const h = Math.max(4, (r.revenue! / range) * 100)
          const isLatest = i === hist.length - 1
          return (
            <div key={r.year} className="flex-1 flex flex-col items-center justify-end gap-0.5">
              <div
                className={cn('w-full rounded-sm', isLatest ? 'bg-blue-400/70' : 'bg-slate-200')}
                style={{ height: `${h}%` }}
              />
              <span className="text-[9px] text-slate-500">{r.year.slice(-2)}</span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-0.5 text-[9px] text-slate-500 tabular-nums">
        {hist.map(r => (
          <span key={r.year}>
            {r.revenue! >= 1e9 ? '$' + (r.revenue! / 1e9).toFixed(0) + 'B' : '$' + (r.revenue! / 1e6).toFixed(0) + 'M'}
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
  const roic      = scores?.roic

  const altmanColor = altman?.zone === 'Safe' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : altman?.zone === 'Distress' ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-amber-600 bg-amber-50 border-amber-200'

  const beneishColor = beneish?.flag === 'Clean' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : beneish?.flag === 'Manipulator' ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-amber-600 bg-amber-50 border-amber-200'

  const isRows = financialStatements?.incomeStatement ?? []
  const cfRows = financialStatements?.cashFlow ?? []

  // EBITDA margin from latest historical income statement row
  const latestActual = [...isRows].filter(r => !r.isProjected).slice(-1)[0]
  const ebitdaMargin = latestActual?.revenue && latestActual.revenue > 0 && latestActual.ebitda != null
    ? latestActual.ebitda / latestActual.revenue
    : null

  // Build sparkline data
  const niData = isRows
    .filter(r => !r.isProjected && r.netIncome != null)
    .slice(-4)
    .map(r => ({ year: r.year, value: r.netIncome as number }))

  const fcfData = cfRows
    .filter(r => !r.isProjected && r.freeCashFlow != null)
    .slice(-4)
    .map(r => ({ year: r.year, value: r.freeCashFlow as number }))

  // Operating margin trend (last 4 historical rows that have it)
  const omData = isRows
    .filter(r => !r.isProjected && r.operatingMargin != null)
    .slice(-4)
    .map(r => ({ year: r.year, value: (r.operatingMargin as number) * 100 }))

  return (
    <div className="space-y-3">

      {/* Profit Margins */}
      <Card>
        <SectionLabel>Profit Margins</SectionLabel>
        <div className="space-y-2.5">
          <MarginBar label="Gross Margin"   value={businessProfile.grossMargin} />
          <MarginBar label="EBITDA Margin"  value={ebitdaMargin} />
          <MarginBar label="Net Margin"     value={businessProfile.netMargin} />
          <MarginBar label="FCF Margin"     value={businessProfile.fcfMargin} />
        </div>
      </Card>

      {/* Revenue Trend */}
      {isRows.length >= 2 && <RevenueBarChart rows={isRows} />}

      {/* Net Income Trend */}
      {niData.length >= 2 && (
        <Card>
          <BarSparkline
            data={niData}
            colorFn={v => v >= 0 ? 'bg-emerald-400' : 'bg-red-400'}
            label="Net Income"
          />
        </Card>
      )}

      {/* Free Cash Flow Trend */}
      {fcfData.length >= 2 && (
        <Card>
          <BarSparkline
            data={fcfData}
            colorFn={v => v >= 0 ? 'bg-blue-400' : 'bg-red-400'}
            label="Free Cash Flow"
          />
        </Card>
      )}

      {/* Operating Margin Trend */}
      {omData.length >= 2 && (
        <Card>
          <SectionLabel>Operating Margin %</SectionLabel>
          <div className="flex items-end gap-1.5 h-10">
            {omData.map((d, i) => {
              const isLatest = i === omData.length - 1
              return (
                <div key={d.year} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                  <div
                    className={cn(
                      'w-full rounded-sm',
                      d.value >= 15 ? 'bg-emerald-400' : d.value >= 5 ? 'bg-amber-400' : 'bg-red-400',
                      isLatest ? 'opacity-90' : 'opacity-45'
                    )}
                    style={{ height: `${Math.max(4, Math.min(100, d.value * 2))}%` }}
                  />
                  <span className="text-[9px] text-slate-500">{d.year.slice(-2)}</span>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-0.5 text-[9px] text-slate-500 tabular-nums">
            {omData.map(d => (
              <span key={d.year}>{d.value.toFixed(1)}%</span>
            ))}
          </div>
        </Card>
      )}

      {/* ROIC */}
      {roic?.roic != null && (
        <Card>
          <SectionLabel>Capital Returns</SectionLabel>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">ROIC</span>
              <span className={cn(
                'text-[11px] font-semibold tabular-nums',
                roic.roic >= 0.15 ? 'text-emerald-600' : roic.roic >= 0.08 ? 'text-amber-600' : 'text-red-600'
              )}>
                {(roic.roic * 100).toFixed(1)}%
              </span>
            </div>
            {roic.spread != null && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">ROIC − WACC spread</span>
                <span className={cn(
                  'text-[11px] font-semibold tabular-nums',
                  roic.spread > 0 ? 'text-emerald-600' : 'text-red-600'
                )}>
                  {roic.spread > 0 ? '+' : ''}{(roic.spread * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {roic.spread != null && (
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                {roic.spread > 0.05 ? 'Value creation: earning well above cost of capital'
                  : roic.spread > 0 ? 'Modest value creation above cost of capital'
                  : 'Returns below cost of capital — value erosion risk'}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Quality Scores */}
      {(piotroski || altman || beneish) && (
        <Card>
          <SectionLabel>Quality Scores</SectionLabel>
          <div className="space-y-2">
            {piotroski && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-slate-500">Piotroski F-Score</span>
                  <span className={cn(
                    'text-[11px] font-bold tabular-nums',
                    piotroski.score >= 7 ? 'text-emerald-600' : piotroski.score >= 4 ? 'text-amber-600' : 'text-red-600'
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
                          : 'bg-slate-200'
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
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
                <span className="text-[11px] text-slate-500">{label}</span>
                <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
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
