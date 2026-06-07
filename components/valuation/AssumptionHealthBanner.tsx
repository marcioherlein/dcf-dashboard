'use client'

/**
 * AssumptionHealthBanner
 *
 * Surfaces the server-computed assumptionAudit results inline in ValuationLab so
 * users know whether the model's pre-set values are well-supported or need review.
 *
 * Two display modes:
 *   - Collapsed (default): grade badge + warn/error count + "Review" button
 *   - Expanded: one row per assumption with icon, signal, reason, and snap-to-fix
 */

import React, { useState } from 'react'
import type { AssumptionAudit, AuditResult } from '@/lib/valuation/assumptionAuditor'
import { cn } from '@/lib/utils'

interface AssumptionHealthBannerProps {
  audit: AssumptionAudit | null | undefined
  onApplySuggestion: (key: string, value: number) => void
  className?: string
}

// ── Grade badge ───────────────────────────────────────────────────────────────

function gradeBg(grade: string) {
  if (grade === 'A') return 'bg-[#E8F7EF] text-[#11875D] border-[#B7E5C8]'
  if (grade === 'B') return 'bg-[#EAF1FF] text-[#2563EB] border-[#BFDBFE]'
  if (grade === 'C') return 'bg-[#FFF4DA] text-[#B56A00] border-[#F3DFA0]'
  return 'bg-[#FCEAEA] text-[#D83B3B] border-[#FECACA]'
}

// ── Row severity icons ────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: AuditResult['severity'] }) {
  if (severity === 'error') return <span className="text-[#D83B3B] text-[13px] font-bold shrink-0">✗</span>
  if (severity === 'warn')  return <span className="text-[#B56A00] text-[13px] font-bold shrink-0">⚠</span>
  return <span className="text-[#11875D] text-[13px] shrink-0">✓</span>
}

// ── Confidence label ──────────────────────────────────────────────────────────

function ConfidencePill({ confidence }: { confidence: AuditResult['confidence'] }) {
  if (confidence === 'low') {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FFF4DA] text-[#B56A00] border border-[#F3DFA0] font-semibold uppercase tracking-wide shrink-0">
        low confidence
      </span>
    )
  }
  return null
}

// ── Individual audit row ──────────────────────────────────────────────────────

function AuditRow({
  result,
  onApply,
}: {
  result: AuditResult
  onApply: (key: string, value: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasReason = result.reason.length > 0
  const hasDetail = hasReason || result.suggestedValue != null || result.benchmark != null

  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 text-[11px]',
        result.severity === 'error'
          ? 'bg-[#FEF2F2] border-[#FECACA]'
          : result.severity === 'warn'
          ? 'bg-[#FFFBEB] border-[#FDE68A]'
          : 'bg-[#F9FAFB] border-[#E3E1DA]',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          <SeverityIcon severity={result.severity} />
          <div className="min-w-0">
            <span className={cn(
              'font-semibold',
              result.severity === 'error' ? 'text-[#D83B3B]' :
              result.severity === 'warn'  ? 'text-[#B56A00]' :
              'text-[#1A2535]',
            )}>
              {result.label}
            </span>
            {result.currentValue != null && (
              <span className="text-[#566174] ml-1 tabular-nums">
                {result.key === 'quality'
                  ? `${result.currentValue}/9`
                  : result.key === 'ke' || result.key === 'cagr' || result.key === 'netMargin' || result.key === 'terminalG'
                  ? `${(result.currentValue * 100).toFixed(1)}%`
                  : result.key === 'exitPE'
                  ? `${result.currentValue.toFixed(0)}×`
                  : result.key === 'revenueMultiple'
                  ? `${result.currentValue.toFixed(1)}×`
                  : result.currentValue.toFixed(1)}
              </span>
            )}
            <span className={cn(
              'ml-1.5',
              result.severity === 'error' ? 'text-[#D83B3B]' :
              result.severity === 'warn'  ? 'text-[#B56A00]' :
              'text-[#566174]',
            )}>
              — {result.signal}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ConfidencePill confidence={result.confidence} />
          {hasDetail && (
            <button
              onClick={() => setExpanded(p => !p)}
              className="text-[10px] text-[#566174] hover:text-[#1A2535] underline decoration-dotted"
            >
              {expanded ? 'less' : 'why?'}
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="mt-2 space-y-2 pl-5">
          {/* Benchmark context */}
          {result.benchmark && (
            <p className="text-[#566174]">
              vs. <span className="font-medium text-[#1A2535]">{result.benchmark.label}</span>
              {': '}
              <span className="tabular-nums font-semibold">
                {result.key === 'exitPE' || result.key === 'revenueMultiple'
                  ? `${result.benchmark.value.toFixed(1)}×`
                  : `${(result.benchmark.value * 100).toFixed(1)}%`}
              </span>
            </p>
          )}
          {/* Reason text */}
          {hasReason && (
            <p className={cn(
              'leading-relaxed',
              result.severity === 'error' ? 'text-[#D83B3B]' :
              result.severity === 'warn'  ? 'text-[#92400E]' :
              'text-[#566174]',
            )}>
              {result.reason}
            </p>
          )}
          {/* Suggested fix */}
          {result.suggestedValue != null && result.key !== 'quality' && (
            <button
              onClick={() => onApply(result.key, result.suggestedValue!)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#1A2535] text-white hover:bg-[#2C3E55] transition-colors"
            >
              → Use{' '}
              {result.key === 'exitPE' || result.key === 'revenueMultiple'
                ? `${result.suggestedValue.toFixed(1)}×`
                : `${(result.suggestedValue * 100).toFixed(1)}%`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main banner ───────────────────────────────────────────────────────────────

export function AssumptionHealthBanner({
  audit,
  onApplySuggestion,
  className,
}: AssumptionHealthBannerProps) {
  const [expanded, setExpanded] = useState(false)

  if (!audit) return null

  const { grade, score, warnCount, errorCount, results } = audit
  const issueCount = warnCount + errorCount
  const allOk = issueCount === 0

  // Non-quality results only — quality row isn't a direct assumption
  const assumptionResults = results.filter(r => r.key !== 'quality')
  const qualityResult     = results.find(r => r.key === 'quality')

  return (
    <div className={cn('rounded-xl border overflow-hidden', className,
      errorCount > 0 ? 'border-[#FECACA]' :
      warnCount  > 0 ? 'border-[#FDE68A]' :
      'border-[#D1FAE5]',
    )}>
      {/* ── Collapsed header ── */}
      <button
        onClick={() => setExpanded(p => !p)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
          errorCount > 0 ? 'bg-[#FEF2F2] hover:bg-[#FDECEA]' :
          warnCount  > 0 ? 'bg-[#FFFBEB] hover:bg-[#FFF4DA]' :
          'bg-[#F0FDF4] hover:bg-[#E8F7EF]',
        )}
      >
        <div className="flex items-center gap-2.5">
          {/* Grade badge */}
          <span className={cn(
            'text-[11px] font-extrabold px-2 py-0.5 rounded-full border tracking-wider',
            gradeBg(grade),
          )}>
            {grade}
          </span>
          <span className={cn(
            'text-[12px] font-semibold',
            errorCount > 0 ? 'text-[#D83B3B]' :
            warnCount  > 0 ? 'text-[#B56A00]' :
            'text-[#11875D]',
          )}>
            Assumption Health
          </span>
          {allOk ? (
            <span className="text-[10px] text-[#11875D]">— all values cross-validated ✓</span>
          ) : (
            <span className={cn(
              'text-[10px]',
              errorCount > 0 ? 'text-[#D83B3B]' : 'text-[#B56A00]',
            )}>
              — {errorCount > 0 && `${errorCount} error${errorCount > 1 ? 's' : ''}`}
              {errorCount > 0 && warnCount > 0 && ', '}
              {warnCount  > 0 && `${warnCount} warning${warnCount > 1 ? 's' : ''}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#566174] tabular-nums">{score}/100</span>
          <span className={cn(
            'text-[10px] font-medium underline decoration-dotted',
            errorCount > 0 ? 'text-[#D83B3B]' :
            warnCount  > 0 ? 'text-[#B56A00]' :
            'text-[#566174]',
          )}>
            {expanded ? 'collapse' : 'review'}
          </span>
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className={cn(
          'px-4 pb-4 pt-3 space-y-2',
          errorCount > 0 ? 'bg-[#FEF2F2]' :
          warnCount  > 0 ? 'bg-[#FFFBEB]' :
          'bg-[#F0FDF4]',
        )}>
          <p className="text-[10px] text-[#566174] mb-3">
            These values were cross-validated against analyst estimates, peer medians, and trailing financials.
            Click <strong>why?</strong> on any row to see the rationale. Click <strong>→ Use X%</strong> to apply the suggested value.
          </p>

          {/* Assumption rows (sorted: errors first, then warns, then ok) */}
          {[...assumptionResults]
            .sort((a, b) => {
              const order = { error: 0, warn: 1, ok: 2 }
              return order[a.severity] - order[b.severity]
            })
            .map(r => (
              <AuditRow
                key={r.key}
                result={r}
                onApply={onApplySuggestion}
              />
            ))}

          {/* Quality gate row (separate, below assumptions) */}
          {qualityResult && qualityResult.severity !== 'ok' && (
            <>
              <div className="border-t border-[#E3E1DA] my-2" />
              <AuditRow
                key="quality"
                result={qualityResult}
                onApply={onApplySuggestion}
              />
            </>
          )}

          {/* Grade explanation */}
          <p className="text-[9px] text-[#8A95A6] pt-1">
            Score: {score}/100 (−20 per error, −8 per warning) · Grade {grade}
            {grade === 'A' && ' — assumptions are well-supported'}
            {grade === 'B' && ' — minor concerns, review flagged items'}
            {grade === 'C' && ' — several assumptions need review'}
            {grade === 'D' && ' — significant issues found, verify before relying on this estimate'}
          </p>
        </div>
      )}
    </div>
  )
}
