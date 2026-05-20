'use client'
import { TrendingUp, TrendingDown, Bookmark, DollarSign, Shield, BarChart2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPct, fmtLargeCurrency, fmtPrice, upsideZone, zoneBadgeClass } from '@/lib/formatters'
import { NABadge } from '@/components/ui/na-badge'

interface Props {
  ticker: string
  companyName: string
  sector: string
  price: number
  change: number
  changePct: number
  currency: string
  // Grade
  grade: string
  gradeLabel: string
  // Fair value
  fairValue: number | null
  upsidePct: number | null   // positive = undervalued, negative = overvalued
  // Health pills (plain-English one-sentence summaries)
  profitabilitySummary: string
  liquiditySummary: string
  growthSummary: string
  // Stat grid
  marketCap: number
  high52: number
  low52: number
  analystTarget: number
  // Key drivers (short strings shown as chips)
  drivers?: string[]
  // Actions
  onSave?: () => void
  onViewDetails?: () => void   // navigate to Valuation tab
  // Layout variant
  compact?: boolean  // true = 1-line strip (used on valuation tab)
}

function gradeColors(grade: string): { bg: string; text: string; badge: string } {
  const g = grade.replace('+', '').replace('-', '')
  if (g === 'A')  return { bg: 'bg-emerald-600',   text: 'text-white', badge: 'border-emerald-700' }
  if (g === 'B')  return { bg: 'bg-[#0F2A5E]',     text: 'text-white', badge: 'border-[#0a1f47]'  }
  if (g === 'C')  return { bg: 'bg-amber-500',      text: 'text-white', badge: 'border-amber-600'  }
  return           { bg: 'bg-[#B91C1C]',            text: 'text-white', badge: 'border-red-900'    }
}

function pillIcon(type: 'profit' | 'debt' | 'growth') {
  if (type === 'profit') return <DollarSign size={14} className="shrink-0" />
  if (type === 'debt')   return <Shield      size={14} className="shrink-0" />
  return                        <BarChart2   size={14} className="shrink-0" />
}

function StatBox({ label, value, hidden }: { label: string; value: React.ReactNode; hidden?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-slate-50 border border-slate-100 px-4 py-3', hidden && 'hidden sm:block')}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

export default function InvestorGradeCard({
  ticker, companyName, sector, price, change, changePct, currency,
  grade, gradeLabel, fairValue, upsidePct,
  profitabilitySummary, liquiditySummary, growthSummary,
  marketCap, high52, low52, analystTarget,
  drivers,
  onSave, onViewDetails,
  compact = false,
}: Props) {
  const up = change >= 0
  const colors = gradeColors(grade)
  const currSymbol = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  const isUndervalued = (upsidePct ?? 0) > 0
  const zone = upsidePct != null ? upsideZone(upsidePct) : null

  const verdict = upsidePct == null || fairValue == null
    ? null
    : isUndervalued
      ? `Our valuation model suggests this may be undervalued — trading ${Math.abs(upsidePct * 100).toFixed(0)}% below our estimate. See the assumptions.`
      : `Our valuation model flags this as potentially overvalued — trading ${Math.abs(upsidePct * 100).toFixed(0)}% above our estimate. Check if you agree.`

  // ── Compact 1-line strip (valuation tab) ──────────────────────────────────
  if (compact) {
    return (
      <div className="rounded-xl bg-white shadow-card border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0', colors.bg, colors.text)}>
            {grade.replace('+', '').replace('-', '')}
          </div>
          <span className="font-bold text-sm text-slate-800">{ticker}</span>
          <span className="text-xs text-slate-400 truncate hidden sm:inline">{companyName}</span>
          <span className="text-sm font-bold tabular-nums text-slate-900">
            {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={cn('text-xs font-semibold', up ? 'text-emerald-600' : 'text-red-600')}>
            {up ? '+' : ''}{fmtPct(changePct / 100)}
          </span>
          {fairValue != null && upsidePct != null && (
            <>
              <span className="text-slate-200 hidden sm:inline">|</span>
              <span className="text-xs text-slate-500 hidden sm:inline">Blended: {currSymbol}{fairValue.toFixed(2)}</span>
              <span className={cn('text-xs font-bold', upsidePct >= 0 ? 'text-emerald-600' : 'text-amber-600')}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
              </span>
              {zone && (
                <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap', zoneBadgeClass(zone))}>
                  {zone}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Full card ─────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl bg-white shadow-card border border-slate-200 overflow-hidden">
      {/* ── STATE 1: always visible ── */}
      <div className="p-5">
        <div className="flex items-start gap-4">

          {/* Grade badge — pre-attentive size pop-out */}
          <div
            className={cn(
              'w-[72px] h-[72px] shrink-0 rounded-2xl flex items-center justify-center',
              colors.bg, colors.text,
            )}
          >
            <span className="text-[2.75rem] font-extrabold leading-none tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
              {grade}
            </span>
          </div>

          {/* Company + price */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 tracking-wide">
                    {ticker}
                  </span>
                  {sector && <span className="text-[11px] text-slate-400">{sector}</span>}
                </div>
                <h1 className="mt-1.5 text-lg font-bold text-slate-900 leading-tight truncate">{companyName}</h1>
                <p className="mt-0.5 text-[11px] text-slate-500">{gradeLabel} overall</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-extrabold text-slate-900 tabular-nums leading-none">
                  {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={cn('mt-1 flex items-center justify-end gap-1 text-sm font-semibold', up ? 'text-emerald-600' : 'text-red-600')}>
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  <span>{up ? '+' : ''}{change.toFixed(2)}</span>
                  <span className="text-xs opacity-75">({up ? '+' : ''}{fmtPct(changePct / 100)})</span>
                </div>
              </div>
            </div>

            {/* One-sentence verdict */}
            {verdict && (
              <p className={cn(
                'mt-3 text-[12px] leading-relaxed rounded-lg px-3 py-2',
                isUndervalued
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                  : 'bg-amber-50 text-amber-800 border border-amber-100',
              )}>
                {verdict}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded details — always visible ── */}
      <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4 bg-slate-50/60">

          {/* Fair value row — asymmetric: current price (small) → zone badge → DCF estimate (dominant) */}
          {fairValue != null && (
            <div className="flex items-center gap-3 rounded-xl bg-white border border-slate-200 px-4 py-3">
              {/* Left: current price (secondary) */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">You pay</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-600 tabular-nums">
                  {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              {/* Center: arrow + zone badge */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <ArrowRight size={14} className="text-slate-300" />
                {zone && (
                  <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap', zoneBadgeClass(zone))}>
                    {zone}
                  </span>
                )}
              </div>
              {/* Right: fair value (dominant) */}
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fair Value Estimate</p>
                <p className={cn('mt-0.5 text-xl font-bold tabular-nums', isUndervalued ? 'text-emerald-700' : 'text-amber-700')}>
                  {currSymbol}{fairValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {upsidePct != null && (
                  <p className={cn('text-xs font-semibold', isUndervalued ? 'text-emerald-600' : 'text-amber-600')}>
                    {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Health pills — 3 items, Gestalt similarity group */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Health check</p>
            {[
              { type: 'profit' as const, label: 'Profitability', summary: profitabilitySummary },
              { type: 'debt'   as const, label: 'Financial Health', summary: liquiditySummary   },
              { type: 'growth' as const, label: 'Growth',            summary: growthSummary      },
            ].map(({ type, label, summary }) => (
              <div key={type} className="flex items-start gap-2.5 rounded-xl bg-white border border-slate-100 px-3 py-2.5" style={{ minHeight: '48px' }}>
                <span className="text-slate-500 mt-0.5">{pillIcon(type)}</span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-700">{label}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{summary}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Key Drivers — 2 chips + overflow count */}
          {drivers && drivers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Key drivers</p>
              <div className="flex flex-col gap-1.5">
                {drivers.slice(0, 2).map((d, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md bg-white border border-slate-100 border-l-4 border-l-blue-300 px-3 py-2">
                    <p className="text-[11px] text-slate-600 leading-snug">{d.split(' — ')[0]}</p>
                  </div>
                ))}
                {drivers.length > 2 && (
                  <p className="text-[11px] text-slate-400 px-1">and {drivers.length - 2} more</p>
                )}
              </div>
            </div>
          )}

          {/* Escalation hook */}
          <div className="flex items-center justify-between gap-4">
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-colors"
                style={{ background: '#0F2A5E' }}
              >
                Explore full valuation →
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                title="Save to Watchlist"
                className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Bookmark size={16} />
              </button>
            )}
          </div>
      </div>

      {/* ── Stat grid — always visible ── */}
      <div className="border-t border-slate-100 px-5 py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatBox label="Market Cap"     value={fmtLargeCurrency(marketCap, currency)} />
          <StatBox label="52-wk High"     value={fmtPrice(high52, currency)} />
          <StatBox label="52-wk Low"      value={fmtPrice(low52, currency)} hidden />
          <StatBox label="Analyst Target" value={analystTarget ? fmtPrice(analystTarget, currency) : <NABadge reason="no-coverage" />} />
        </div>
      </div>
    </div>
  )
}
