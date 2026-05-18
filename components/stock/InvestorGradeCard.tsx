'use client'
import { useState } from 'react'
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Bookmark, DollarSign, Shield, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPct, fmtLargeCurrency, fmtPrice } from '@/lib/formatters'

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
  peRatio: number
  high52: number
  low52: number
  analystTarget: number
  // Actions
  onSave?: () => void
  onViewDetails?: () => void   // navigate to Valuation tab
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

function StatBox({ label, value, hidden }: { label: string; value: string; hidden?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-slate-50 border border-slate-100 px-4 py-3', hidden && 'hidden sm:block')}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold font-mono text-slate-800">{value}</p>
    </div>
  )
}

export default function InvestorGradeCard({
  ticker, companyName, sector, price, change, changePct, currency,
  grade, gradeLabel, fairValue, upsidePct,
  profitabilitySummary, liquiditySummary, growthSummary,
  marketCap, peRatio, high52, low52, analystTarget,
  onSave, onViewDetails,
}: Props) {
  const [expanded, setExpanded] = useState(false)

  const up = change >= 0
  const colors = gradeColors(grade)
  const currSymbol = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  const isUndervalued = (upsidePct ?? 0) > 0

  const verdict = upsidePct == null || fairValue == null
    ? null
    : isUndervalued
      ? `Our DCF model suggests this may be undervalued — trading ${Math.abs(upsidePct * 100).toFixed(0)}% below our estimate. See the assumptions.`
      : `Our DCF model flags this as potentially overvalued — trading ${Math.abs(upsidePct * 100).toFixed(0)}% above our estimate. Check if you agree.`

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
                <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums leading-none">
                  {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={cn('mt-1 flex items-center justify-end gap-1 text-sm font-semibold', up ? 'text-emerald-600' : 'text-red-600')}>
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  <span>{up ? '+' : ''}{change.toFixed(2)}</span>
                  <span className="text-xs opacity-75">({up ? '+' : ''}{fmtPct(changePct / 100)})</span>
                </div>
              </div>
            </div>

            {/* One-sentence verdict (max 4 chunks at first render) */}
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

        {/* Expand trigger */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 w-full flex items-center justify-between text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <span>{expanded ? 'Hide details' : 'See full picture — profitability, debt & growth'}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── STATE 2: expanded ── */}
      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4 bg-slate-50/60">

          {/* Fair value row */}
          {fairValue != null && (
            <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-4 py-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What you pay today</p>
                <p className="mt-0.5 text-lg font-bold font-mono text-slate-900 tabular-nums">
                  {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-slate-300 text-lg font-light">vs</div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Our DCF model&apos;s estimate</p>
                <p className={cn('mt-0.5 text-lg font-bold font-mono tabular-nums', isUndervalued ? 'text-emerald-700' : 'text-amber-700')}>
                  {currSymbol}{fairValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
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

          {/* Escalation hook */}
          <div className="flex items-center justify-between gap-4">
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-colors"
                style={{ background: '#0F2A5E' }}
              >
                See what&apos;s behind this grade →
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
      )}

      {/* ── Stat grid — always visible below the fold ── */}
      <div className="border-t border-slate-100 px-5 py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatBox label="Market Cap"     value={fmtLargeCurrency(marketCap, currency)} />
          <StatBox label="P/E Ratio"      value={peRatio ? peRatio.toFixed(1) + '×' : '—'} />
          <StatBox label="52-wk High"     value={fmtPrice(high52, currency)} />
          <StatBox label="52-wk Low"      value={fmtPrice(low52, currency)} hidden />
          <StatBox label="Analyst Target" value={analystTarget ? fmtPrice(analystTarget, currency) : '—'} />
        </div>
      </div>
    </div>
  )
}
