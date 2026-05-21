'use client'
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Bookmark, Share2, Check, DollarSign, Shield, BarChart2, ArrowRight } from 'lucide-react'
import { motion, useMotionValue, animate } from 'motion/react'
import { cn } from '@/lib/utils'
import { fmtPct, fmtLargeCurrency, fmtPrice, upsideZone, zoneBadgeClass } from '@/lib/formatters'
import { NABadge } from '@/components/ui/na-badge'
import ArcGauge from '@/components/ui/arc-gauge'

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

function gradeColors(grade: string): { bg: string; text: string; badge: string; hex: string } {
  const g = grade.replace('+', '').replace('-', '')
  if (g === 'A')  return { bg: 'bg-emerald-100 border border-emerald-300', text: 'text-emerald-800', badge: 'border-emerald-300', hex: '#059669' }
  if (g === 'B')  return { bg: 'bg-blue-100 border border-blue-300',       text: 'text-blue-800',   badge: 'border-blue-300',   hex: '#2563EB' }
  if (g === 'C')  return { bg: 'bg-amber-100 border border-amber-300',     text: 'text-amber-800',  badge: 'border-amber-300',  hex: '#D97706' }
  return           { bg: 'bg-red-100 border border-red-300',               text: 'text-red-800',    badge: 'border-red-300',    hex: '#DC2626' }
}

function gradeToValue(grade: string): number {
  const map: Record<string, number> = {
    'A+': 97, 'A': 90, 'A-': 83,
    'B+': 77, 'B': 70, 'B-': 63,
    'C+': 57, 'C': 50, 'C-': 43,
    'D+': 37, 'D': 30, 'D-': 23,
    'F': 10,
  }
  return map[grade] ?? 50
}

function pillIcon(type: 'profit' | 'debt' | 'growth') {
  if (type === 'profit') return <DollarSign size={14} className="shrink-0" />
  if (type === 'debt')   return <Shield      size={14} className="shrink-0" />
  return                        <BarChart2   size={14} className="shrink-0" />
}

function StatBox({ label, value, hidden }: { label: string; value: React.ReactNode; hidden?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-slate-50 border border-slate-200 px-4 py-3', hidden && 'hidden sm:block')}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
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
  const gaugeValue = gradeToValue(grade)

  const [copied, setCopied] = useState(false)
  const handleShare = useCallback(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams({
      ticker,
      price: price.toFixed(2),
      ...(fairValue != null ? { fv: fairValue.toFixed(2) } : {}),
      ...(upsidePct != null ? { upside: upsidePct.toFixed(4) } : {}),
      currency,
      ...(companyName ? { name: companyName } : {}),
    })
    const shareUrl = `${window.location.origin}/stock/${ticker}?${params.toString()}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [ticker, price, fairValue, upsidePct, currency, companyName])

  // Animated fair value counter
  const fvMotion = useMotionValue(0)
  const [displayFV, setDisplayFV] = useState(0)
  useEffect(() => {
    if (fairValue == null) return
    const controls = animate(fvMotion, fairValue, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplayFV(v),
    })
    return controls.stop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fairValue])

  const verdict = upsidePct == null || fairValue == null
    ? null
    : isUndervalued
      ? `Our valuation model suggests this may be undervalued — trading ${Math.abs(upsidePct * 100).toFixed(0)}% below our estimate. See the assumptions.`
      : `Our valuation model flags this as potentially overvalued — trading ${Math.abs(upsidePct * 100).toFixed(0)}% above our estimate. Check if you agree.`

  // ── Compact 1-line strip (valuation tab) ──────────────────────────────────
  if (compact) {
    return (
      <div className="rounded-xl card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0', colors.bg, colors.text)}>
            {grade.replace('+', '').replace('-', '')}
          </div>
          <span className="font-bold text-sm text-slate-900">{ticker}</span>
          <span className="text-xs text-slate-500 truncate hidden sm:inline">{companyName}</span>
          <span className="text-sm font-bold tabular-nums text-slate-900">
            {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={cn('text-xs font-semibold', up ? 'text-emerald-600' : 'text-red-600')}>
            {up ? '+' : ''}{fmtPct(changePct / 100)}
          </span>
          {fairValue != null && upsidePct != null && (
            <>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="text-xs text-slate-500 hidden sm:inline">Blended: {currSymbol}{fairValue.toFixed(2)}</span>
              <span className={cn('text-xs font-bold', upsidePct >= 0 ? 'text-emerald-600' : 'text-amber-700')}>
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
    <div className="rounded-xl card overflow-hidden">
      {/* ── STATE 1: always visible ── */}
      <div className="p-5">
        <div className="flex items-start gap-4">

          {/* Grade arc gauge */}
          <motion.div
            initial={{ scale: 0.55, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.05 }}
            className="shrink-0 animate-glow-pulse"
            style={{ borderRadius: '50%' }}
          >
            <ArcGauge
              value={gaugeValue}
              size={84}
              strokeWidth={7}
              color={colors.hex}
              displayValue={grade}
            />
          </motion.div>

          {/* Company + price */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-bold text-blue-700 tracking-wide">
                    {ticker}
                  </span>
                  {sector && <span className="text-[11px] text-slate-500">{sector}</span>}
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
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.2 }}
                className={cn(
                  'mt-3 text-[12px] leading-relaxed rounded-lg px-3 py-2',
                  isUndervalued
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200',
                )}
              >
                {verdict}
              </motion.p>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded details — always visible ── */}
      <div className="border-t border-slate-200 px-5 pb-5 pt-4 space-y-4 bg-slate-50">

          {/* Fair value row */}
          {fairValue != null && (
            <div className="flex items-center gap-3 rounded-xl card-tinted px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">You pay</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">
                  {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <ArrowRight size={14} className="text-slate-400" />
                {zone && (
                  <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap', zoneBadgeClass(zone))}>
                    {zone}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Fair Value Estimate</p>
                <p className={cn('mt-0.5 text-xl font-bold tabular-nums', isUndervalued ? 'text-emerald-600' : 'text-amber-700')}>
                  {currSymbol}{displayFV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {upsidePct != null && (
                  <p className={cn('text-xs font-semibold', isUndervalued ? 'text-emerald-600' : 'text-amber-700')}>
                    {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Health pills */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Health check</p>
            {[
              { type: 'profit' as const, label: 'Profitability', summary: profitabilitySummary },
              { type: 'debt'   as const, label: 'Financial Health', summary: liquiditySummary   },
              { type: 'growth' as const, label: 'Growth',            summary: growthSummary      },
            ].map(({ type, label, summary }) => (
              <div key={type} className="flex items-start gap-2.5 rounded-xl card-tinted px-3 py-2.5" style={{ minHeight: '48px' }}>
                <span className="text-blue-600 mt-0.5">{pillIcon(type)}</span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-800">{label}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{summary}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Key Drivers */}
          {drivers && drivers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Key drivers</p>
              <div className="flex flex-col gap-1.5">
                {drivers.slice(0, 2).map((d, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md card-tinted border-l-4 border-l-blue-500 px-3 py-2">
                    <p className="text-[11px] text-slate-700 leading-snug">{d.split(' — ')[0]}</p>
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
                className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold text-white transition-all bg-gradient-to-r from-blue-600 to-blue-500 shadow-sm hover:from-blue-700 hover:to-blue-600 active:scale-95"
              >
                Explore full valuation →
              </button>
            )}
            {onSave && (
              <button
                onClick={onSave}
                title="Save to Watchlist"
                className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Bookmark size={16} />
              </button>
            )}
            <button
              onClick={handleShare}
              title="Copy share link"
              className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              {copied ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
            </button>
          </div>
      </div>

      {/* ── Stat grid — always visible ── */}
      <div className="border-t border-slate-200 px-5 py-4">
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
