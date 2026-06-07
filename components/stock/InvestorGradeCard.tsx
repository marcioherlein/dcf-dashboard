'use client'
import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Bookmark, Share2, Check, Bell, BellOff } from 'lucide-react'
import { motion, useMotionValue, animate } from 'motion/react'
import { cn } from '@/lib/utils'
import { fmtPct, fmtPrice, upsideZone, zoneBadgeClass } from '@/lib/formatters'
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
  // Health pills (kept for API compat, not rendered)
  profitabilitySummary: string
  liquiditySummary: string
  growthSummary: string
  // Stat grid (kept for API compat, not rendered)
  marketCap: number
  high52: number
  low52: number
  analystTarget: number
  // Key drivers (kept for API compat, not rendered)
  drivers?: string[]
  // Scenario range
  scenarios?: {
    bear: { fairValue: number }
    base: { fairValue: number }
    bull: { fairValue: number }
  }
  // Actions
  onSave?: () => void
  onViewDetails?: () => void
  // Layout variant
  compact?: boolean  // true = 1-line strip (used on valuation tab)
}

function gradeColors(grade: string): { bg: string; text: string; hex: string } {
  const g = grade.replace('+', '').replace('-', '')
  if (g === 'A')  return { bg: 'bg-[#E8F7EF] border border-[#A3D9BE]', text: 'text-[#0D6B46]', hex: '#059669' }
  if (g === 'B')  return { bg: 'bg-[#EAF1FF] border border-[#93B4F5]',       text: 'text-blue-800',   hex: '#2563EB' }
  if (g === 'C')  return { bg: 'bg-[#FFF4DA] border border-amber-300',     text: 'text-[#854D0E]',  hex: '#D97706' }
  return           { bg: 'bg-[#FCEAEA] border border-[#F0B8B8]',               text: 'text-[#991B1B]',    hex: '#DC2626' }
}

function compactBadgeCls(grade: string): string {
  const g = grade.replace('+', '').replace('-', '')
  if (g === 'A') return 'bg-[#11875D] text-white'
  if (g === 'B') return 'bg-blue-600 text-white'
  if (g === 'C') return 'bg-[#FFF4DA]0 text-white'
  return 'bg-red-600 text-white'
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

export default function InvestorGradeCard({
  ticker, companyName, sector, price, change, changePct, currency,
  grade, gradeLabel, fairValue, upsidePct,
  onSave, onViewDetails, scenarios,
  compact = false,
}: Props) {
  const up = change >= 0
  const colors = gradeColors(grade)
  const currSymbol = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  const isUndervalued = (upsidePct ?? 0) > 0
  const zone = upsidePct != null ? upsideZone(upsidePct) : null
  const gaugeValue = gradeToValue(grade)

  const [copied, setCopied] = useState(false)
  const [alertActive, setAlertActive] = useState(false)
  const [alertTriggered, setAlertTriggered] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(`fv_alert_${ticker}`)
      if (!stored) return
      const parsed = JSON.parse(stored) as { fairValue: number; threshold: number }
      setAlertActive(true)
      if (fairValue != null && Math.abs((price - fairValue) / fairValue) <= parsed.threshold) {
        setAlertTriggered(true)
      }
    } catch {}
  }, [ticker, price, fairValue])

  function toggleAlert() {
    if (typeof window === 'undefined') return
    if (alertActive) {
      localStorage.removeItem(`fv_alert_${ticker}`)
      setAlertActive(false)
      setAlertTriggered(false)
    } else {
      if (fairValue == null) return
      localStorage.setItem(`fv_alert_${ticker}`, JSON.stringify({ fairValue, threshold: 0.10 }))
      setAlertActive(true)
    }
  }

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

  const verdict = upsidePct == null || fairValue == null || zone == null
    ? null
    : zone === 'Undervalued'
      ? `Our model estimates ${Math.abs(upsidePct * 100).toFixed(0)}% upside — trading below our fair value estimate.`
      : zone === 'Fairly Valued'
        ? `Our model estimates this trades near fair value (${upsidePct >= 0 ? '+' : ''}${(upsidePct * 100).toFixed(0)}%).`
        : `Our model estimates this may be overvalued — trading ${Math.abs(upsidePct * 100).toFixed(0)}% above our estimate.`

  // ── Compact 1-line strip (valuation tab) ──────────────────────────────────
  if (compact) {
    return (
      <div className="rounded-xl card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0', compactBadgeCls(grade))}>
            {grade.replace('+', '').replace('-', '')}
          </div>
          <span className="font-bold text-sm text-[#06101F]">{ticker}</span>
          <span className="text-xs text-[#566174] truncate hidden sm:inline">{companyName}</span>
          <span className="text-sm font-bold tabular-nums text-[#06101F]">
            {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={cn('text-xs font-semibold', up ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
            {up ? '+' : ''}{fmtPct(changePct / 100)}
          </span>
          {fairValue != null && upsidePct != null && (
            <>
              <span className="text-[#8A95A6] hidden sm:inline">|</span>
              <span className="text-xs text-[#566174] hidden sm:inline">Blended: {currSymbol}{fairValue.toFixed(2)}</span>
              <span className={cn('text-xs font-bold', upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
              </span>
              {zone && (
                <span className={cn('text-[10px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap', zoneBadgeClass(zone))}>
                  {zone === 'Undervalued' ? 'Attractive' : zone === 'Fairly Valued' ? 'Fair' : 'Expensive'}
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
      {/* Identity + price */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">

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
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-[#EAF1FF] border border-[#93B4F5] px-2 py-0.5 text-xs font-bold text-[#2563EB] tracking-wide">
                    {ticker}
                  </span>
                  {sector && <span className="text-[11px] text-[#566174] truncate">{sector}</span>}
                </div>
                <h1 className="mt-1.5 text-[16px] sm:text-lg font-bold text-[#06101F] leading-tight truncate max-w-[160px] sm:max-w-none">{companyName}</h1>
                <p className="mt-0.5 text-[12px] text-[#566174]">{gradeLabel} overall</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[20px] sm:text-2xl font-bold text-[#06101F] tabular-nums leading-none">
                  {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={cn('mt-1 flex items-center justify-end gap-1 text-sm font-semibold', up ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  <span>{up ? '+' : ''}{change.toFixed(2)}</span>
                  <span className="text-xs opacity-75">({up ? '+' : ''}{fmtPct(changePct / 100)})</span>
                </div>
              </div>
            </div>

            {/* One-sentence verdict */}
            {verdict && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.2 }}
              >
                <p
                  className={cn(
                    'mt-3 text-[12px] leading-relaxed rounded-lg px-3 py-2',
                    zone === 'Undervalued'
                      ? 'bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]'
                      : zone === 'Fairly Valued'
                        ? 'bg-[#EAF1FF] text-[#2563EB] border border-[#93B4F5]'
                        : 'bg-[#FCEAEA] text-[#D83B3B] border border-[#F0B8B8]',
                  )}
                >
                  {verdict}
                </p>
                <p className="mt-1.5 text-[11px] text-[#8A95A6] px-1">
                  Preliminary estimate — adjust assumptions in the Valuation tab.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Fair value visual + actions */}
      <div className="border-t border-[#E3E1DA] px-4 sm:px-5 pb-4 sm:pb-5 pt-4 space-y-4 bg-[#F4F3EF]">

        {/* Alert triggered banner */}
        {alertTriggered && fairValue != null && (
          <div className="flex items-center gap-2 rounded-xl bg-[#EAF1FF] border border-[#93B4F5] px-3 py-2">
            <Bell size={13} className="text-[#2563EB] shrink-0" />
            <p className="text-[11px] text-[#2563EB] font-medium">
              {ticker} is now within 10% of your fair value alert ({fmtPrice(fairValue, currency)})
            </p>
          </div>
        )}

        {/* Fair value visual */}
        {fairValue != null && (
          <div className="rounded-xl card-tinted px-4 py-4 space-y-3">
            {/* Price vs Fair Value numbers */}
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#566174] mb-1">Current Price</p>
                <p className="text-2xl font-bold text-[#06101F] tabular-nums leading-none">
                  {currSymbol}{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              {/* Upside badge centered */}
              {upsidePct != null && zone && (
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className={cn('text-sm font-bold tabular-nums px-3 py-1 rounded-full border whitespace-nowrap', zoneBadgeClass(zone))}>
                    {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-[#8A95A6]">{zone}</span>
                </div>
              )}

              <div className="text-right min-w-0">
                <div className="flex items-center justify-end gap-1.5 mb-1">
                  <p className="text-[11px] font-medium text-[#566174]">Fair Value Est.</p>
                  <button
                    onClick={toggleAlert}
                    title={alertActive ? 'Remove fair value alert' : 'Alert me when price nears fair value'}
                    className={cn(
                      'rounded-md border p-1 transition-colors shrink-0',
                      alertActive
                        ? 'bg-[#EAF1FF] border-[#93B4F5] text-[#2563EB]'
                        : 'bg-white border-[#E3E1DA] text-[#8A95A6] hover:border-[#93B4F5] hover:text-[#2563EB]',
                    )}
                  >
                    {alertActive ? <BellOff size={13} /> : <Bell size={13} />}
                  </button>
                </div>
                <p className={cn('text-2xl font-bold tabular-nums leading-none', isUndervalued ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                  {currSymbol}{displayFV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-[#566174] mt-1">Blended from multiple models</p>
              </div>
            </div>

            {/* Bear–Base–Bull scenario range */}
            {scenarios && (
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] text-[#8A95A6] uppercase tracking-wide font-medium">Bear</span>
                  <span className="text-[12px] font-bold text-[#D83B3B] tabular-nums">{currSymbol}{scenarios.bear.fairValue.toFixed(2)}</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-red-200 via-slate-200 to-emerald-200" />
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] text-[#8A95A6] uppercase tracking-wide font-medium">Base</span>
                  <span className="text-[12px] font-bold text-[#2563EB] tabular-nums">{currSymbol}{scenarios.base.fairValue.toFixed(2)}</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-slate-200 via-emerald-200 to-emerald-200" />
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[11px] text-[#8A95A6] uppercase tracking-wide font-medium">Bull</span>
                  <span className="text-[12px] font-bold text-[#11875D] tabular-nums">{currSymbol}{scenarios.bull.fairValue.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Progress bar: how far current price is toward fair value */}
            <div>
              <div className="h-2 rounded-full bg-[#E3E1DA] overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', isUndervalued ? 'bg-[#E8F7EF]0' : 'bg-[#FCEAEA]0')}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(4, (price / Math.max(price, fairValue)) * 100))}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-[#8A95A6]">Today</span>
                <span className={cn('text-[11px] font-medium', isUndervalued ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                  Fair Value
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between gap-4">
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="flex-1 rounded-xl py-3 min-h-[44px] text-[14px] font-semibold text-white transition-all bg-olive-700 shadow-sm hover:bg-olive-600 active:scale-95"
            >
              Explore full valuation →
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              title="Save to Watchlist"
              className="rounded-xl border border-[#E3E1DA] p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8A95A6] hover:border-[#5F790B] hover:text-[#2563EB] hover:bg-[#EAF1FF] transition-colors"
            >
              <Bookmark size={16} />
            </button>
          )}
          <button
            onClick={handleShare}
            title="Copy share link"
            className="rounded-xl border border-[#E3E1DA] p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8A95A6] hover:border-[#5F790B] hover:text-[#2563EB] hover:bg-[#EAF1FF] transition-colors"
          >
            {copied ? <Check size={16} className="text-[#11875D]" /> : <Share2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
