'use client'

import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InfoTooltip } from "@/components/ui/info-tooltip"

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerdictType =
  | 'Undervalued'
  | 'Attractive'
  | 'Fairly Priced'
  | 'Expensive'
  | 'Overvalued'
  | 'Uncertain'
  | 'Insufficient Data'

export type ConfidenceLevel = 'high' | 'medium' | 'low'

interface VerdictAction {
  label: string
  href?: string
  onClick?: () => void
}

interface VerdictCardProps extends React.HTMLAttributes<HTMLDivElement> {
  verdict: VerdictType
  confidence?: ConfidenceLevel
  fairValue?: number | null
  currentPrice?: number | null
  upsidePct?: number | null
  currency?: string
  scenarioBear?: number | null
  scenarioBase?: number | null
  scenarioBull?: number | null
  modelCount?: number
  explanation?: string
  primaryAction?: VerdictAction
  /** 'full' renders the complete card; 'compact' renders a smaller inline badge/summary */
  size?: 'full' | 'compact'
}

// ── Design tokens per verdict ─────────────────────────────────────────────────

const VERDICT_CONFIG: Record<VerdictType, {
  badge: 'brand' | 'positive' | 'negative' | 'warning' | 'informational' | 'neutral'
  bg: string
  border: string
  valueColor: string
  label: string
}> = {
  'Undervalued':        { badge: 'brand',         bg: '#F6F9EC', border: '#EDF3DD', valueColor: '#5F790B', label: 'Undervalued' },
  'Attractive':         { badge: 'brand',         bg: '#F6F9EC', border: '#EDF3DD', valueColor: '#5F790B', label: 'Attractive' },
  'Fairly Priced':      { badge: 'informational', bg: '#EAF1FF', border: '#93B4F5', valueColor: '#2563EB', label: 'Fairly Priced' },
  'Expensive':          { badge: 'warning',       bg: '#FFF4DA', border: '#F3D391', valueColor: '#B56A00', label: 'Expensive' },
  'Overvalued':         { badge: 'negative',      bg: '#FCEAEA', border: '#F0B8B8', valueColor: '#D83B3B', label: 'Overvalued' },
  'Uncertain':          { badge: 'neutral',       bg: '#F0F1F6', border: '#E3E1DA', valueColor: '#566174', label: 'Uncertain' },
  'Insufficient Data':  { badge: 'neutral',       bg: '#F0F1F6', border: '#E3E1DA', valueColor: '#566174', label: 'Insufficient Data' },
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high:   'High confidence',
  medium: 'Moderate confidence',
  low:    'Low confidence',
}

// ── Helper: format price ──────────────────────────────────────────────────────

function fmt(value: number, currency = '$') {
  return `${currency}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(value: number) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

// ── Scenario range slider ─────────────────────────────────────────────────────

function ScenarioRange({
  bear, base, bull, currentPrice, currency,
}: {
  bear: number; base: number; bull: number; currentPrice: number; currency: string
}) {
  const lo = Math.min(bear, bull)
  const hi = Math.max(bear, bull)
  const range = hi - lo
  if (range <= 0) return null

  const pct = (v: number) => Math.max(2, Math.min(98, ((v - lo) / range) * 100))
  const basePct = pct(base)
  const currentPct = Math.max(0, Math.min(100, ((currentPrice - lo) / range) * 100))
  const currentOutside = currentPrice < lo || currentPrice > hi

  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-semibold text-[#8A95A6] mb-1.5">
        <span>Bear {fmt(bear, currency)}</span>
        <span>Base {fmt(base, currency)}</span>
        <span>Bull {fmt(bull, currency)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-[#F0B8B8] via-[#FFF4DA] to-[#A3D9BE]">
        {/* Base case dot */}
        <div
          className="absolute top-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#5F790B] shadow-sm z-10"
          style={{ left: `${basePct}%`, transform: 'translate(-50%, -50%)' }}
          title={`Base: ${fmt(base, currency)}`}
        />
        {/* Current price tick */}
        {!currentOutside && (
          <div
            className="absolute top-0 h-full w-px bg-[#8A95A6] opacity-60"
            style={{ left: `${currentPct}%` }}
            title={`Current: ${fmt(currentPrice, currency)}`}
          />
        )}
      </div>
    </div>
  )
}

// ── VerdictCard ───────────────────────────────────────────────────────────────

export function VerdictCard({
  verdict,
  confidence,
  fairValue,
  currentPrice,
  upsidePct,
  currency = '$',
  scenarioBear,
  scenarioBase,
  scenarioBull,
  modelCount,
  explanation,
  primaryAction,
  size = 'full',
  className,
  ...props
}: VerdictCardProps) {
  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG['Uncertain']
  const hasScenario = scenarioBear != null && scenarioBase != null && scenarioBull != null && currentPrice != null
  const upside = upsidePct != null ? fmtPct(upsidePct) : null
  const upsidePositive = upsidePct != null && upsidePct >= 0

  if (size === 'compact') {
    return (
      <div className={cn("flex items-center gap-2 flex-wrap", className)} {...props}>
        <Badge tone={config.badge}>{config.label}</Badge>
        {fairValue != null && (
          <span className="text-[13px] font-semibold tabular-nums" style={{ color: config.valueColor }}>
            FV {fmt(fairValue, currency)}
          </span>
        )}
        {upside && (
          <span className={cn(
            "text-[12px] font-medium tabular-nums",
            upsidePositive ? "text-[#11875D]" : "text-[#D83B3B]"
          )}>
            {upside}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-5 flex flex-col gap-4",
        "shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
        className
      )}
      style={{ background: config.bg, borderColor: config.border }}
      {...props}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={config.badge} className="text-[12px] px-3 h-6">
            {config.label}
          </Badge>
          {confidence && (
            <span className="text-[11px] text-[#566174]">
              {CONFIDENCE_LABEL[confidence]}
            </span>
          )}
          {modelCount != null && modelCount > 0 && (
            <span className="text-[11px] text-[#8A95A6]">
              {modelCount} model{modelCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <InfoTooltip text="Verdict is a model output, not a financial prediction. It reflects assumptions — not certainties." />
      </div>

      {/* Fair value + current price */}
      {(fairValue != null || currentPrice != null) && (
        <div className="flex items-baseline gap-4 flex-wrap">
          {fairValue != null && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A95A6] mb-0.5">
                Fair Value
              </p>
              <p
                className="text-[32px] font-bold leading-none tabular-nums"
                style={{ color: config.valueColor }}
              >
                {fmt(fairValue, currency)}
              </p>
            </div>
          )}
          {currentPrice != null && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A95A6] mb-0.5">
                Current Price
              </p>
              <p className="text-[20px] font-semibold leading-none tabular-nums text-[#06101F]">
                {fmt(currentPrice, currency)}
              </p>
            </div>
          )}
          {upside && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A95A6] mb-0.5">
                Implied Upside
              </p>
              <p className={cn(
                "text-[20px] font-semibold leading-none tabular-nums",
                upsidePositive ? "text-[#11875D]" : "text-[#D83B3B]"
              )}>
                {upside}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Scenario range */}
      {hasScenario && (
        <ScenarioRange
          bear={scenarioBear!}
          base={scenarioBase!}
          bull={scenarioBull!}
          currentPrice={currentPrice!}
          currency={currency}
        />
      )}

      {/* Explanation */}
      {explanation && (
        <p className="text-[13px] text-[#566174] leading-snug border-t border-current border-opacity-20 pt-3" style={{ borderColor: config.border }}>
          {explanation}
        </p>
      )}

      {/* Primary action */}
      {primaryAction && (
        <div>
          {primaryAction.href ? (
            <a
              href={primaryAction.href}
              className="inline-flex items-center justify-center h-9 gap-1 rounded-[9px] px-3.5 text-[13px] font-semibold border border-[#CDD1C8] bg-white text-[#06101F] hover:bg-[#F6F9EC] hover:border-[#5F790B] transition-colors"
            >
              {primaryAction.label}
            </a>
          ) : (
            <Button variant="outline" size="sm" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
