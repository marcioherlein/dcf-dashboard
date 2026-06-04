'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import type { AssumptionAudit, AuditResult } from '@/lib/valuation/assumptionAuditor'
import type { ValuationAssumptions } from '@/lib/valuation/cockpit'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  audit: AssumptionAudit
  assumptions: ValuationAssumptions
  onChange: (next: ValuationAssumptions) => void
  analystForwardPE?: number | null
}

// ─── Visual config ────────────────────────────────────────────────────────────

const GRADE_CFG = {
  A: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Reliable' },
  B: { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Good'     },
  C: { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Review'   },
  D: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Caution'  },
}

const SEVERITY_CFG = {
  ok:    { icon: CheckCircle2, color: 'text-emerald-500', rowBg: '',              chipBg: 'bg-emerald-50 border-emerald-200',  chipText: 'text-emerald-700' },
  warn:  { icon: AlertTriangle, color: 'text-amber-500',  rowBg: 'bg-amber-50/40', chipBg: 'bg-amber-50 border-amber-200',     chipText: 'text-amber-700'  },
  error: { icon: XCircle,       color: 'text-red-500',    rowBg: 'bg-red-50/40',   chipBg: 'bg-red-50 border-red-200',         chipText: 'text-red-700'    },
}

function fmt(key: AuditResult['key'], value: number | null): string {
  if (value == null) return '—'
  if (key === 'cagr') return `${(value * 100).toFixed(1)}%`
  if (key === 'netMargin') return `${(value * 100).toFixed(1)}%`
  if (key === 'terminalG') return `${(value * 100).toFixed(1)}%`
  if (key === 'wacc' || key === 'ke') return `${(value * 100).toFixed(1)}%`
  if (key === 'revenueMultiple') return `${value.toFixed(1)}×`
  if (key === 'exitPE') return `${value.toFixed(0)}×`
  if (key === 'quality') return `${value.toFixed(0)}/9`
  return `${value.toFixed(1)}`
}

function fmtSuggested(key: AuditResult['key'], value: number): string {
  return fmt(key, value)
}

// ─── Single audit row ─────────────────────────────────────────────────────────

function AuditRow({
  result,
  assumptions,
  onChange,
}: {
  result: AuditResult
  assumptions: ValuationAssumptions
  onChange: (next: ValuationAssumptions) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CFG[result.severity]
  const Icon = cfg.icon
  const canApply = result.suggestedValue != null && result.key !== 'quality'
  const hasDetail = result.reason.length > 0

  function apply() {
    if (result.suggestedValue == null || result.key === 'quality') return
    onChange({ ...assumptions, [result.key]: result.suggestedValue })
  }

  return (
    <div className={`rounded-lg border ${result.severity !== 'ok' ? 'border-slate-200' : 'border-transparent'} ${cfg.rowBg} overflow-hidden`}>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {/* Icon */}
        <Icon size={14} className={`${cfg.color} mt-0.5 shrink-0`} />

        {/* Label + signal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-semibold text-slate-700">{result.label}</span>
            {result.currentValue != null && (
              <span className="text-[11px] text-slate-500">{fmt(result.key, result.currentValue)}</span>
            )}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cfg.chipBg} ${cfg.chipText}`}>
              {result.signal}
            </span>
          </div>

          {/* Benchmark reference */}
          {result.benchmark && (
            <p className="text-[10px] text-slate-400 mt-0.5">
              vs. {result.benchmark.label}: {fmt(result.key, result.benchmark.value)}
            </p>
          )}

          {/* Expanded reason */}
          {expanded && result.reason && (
            <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
              {result.reason}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {canApply && (
            <button
              onClick={apply}
              className="text-[10px] font-semibold px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap"
            >
              Use {fmtSuggested(result.key, result.suggestedValue!)}
            </button>
          )}
          {hasDetail && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AssumptionHealthPanel({ audit, assumptions, onChange, analystForwardPE }: Props) {
  const [open, setOpen] = useState(true)
  const gradeCfg = GRADE_CFG[audit.grade]

  // Separate issues from clean results for display ordering
  const issues = audit.results.filter(r => r.severity !== 'ok')
  const clean = audit.results.filter(r => r.severity === 'ok')
  const hasIssues = issues.length > 0

  function applyAll() {
    let next = { ...assumptions }
    for (const r of audit.results) {
      if (r.suggestedValue != null && r.key !== 'quality') {
        next = { ...next, [r.key]: r.suggestedValue }
      }
    }
    onChange(next)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden mb-4">

      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <Sparkles size={13} className="text-blue-500 shrink-0" />
        <span className="text-[12px] font-semibold text-slate-700 flex-1">Assumption Check</span>

        {/* Grade badge */}
        <div className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${gradeCfg.bg} ${gradeCfg.border}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${gradeCfg.dot}`} />
          <span className={`text-[10px] font-bold ${gradeCfg.text}`}>
            {audit.grade} · {gradeCfg.label}
          </span>
        </div>

        {/* Issue counts */}
        {hasIssues && (
          <span className="text-[10px] text-slate-400">
            {audit.errorCount > 0 && `${audit.errorCount} error${audit.errorCount > 1 ? 's' : ''}`}
            {audit.errorCount > 0 && audit.warnCount > 0 && ', '}
            {audit.warnCount > 0 && `${audit.warnCount} warning${audit.warnCount > 1 ? 's' : ''}`}
          </span>
        )}

        {/* Analyst fwd P/E badge */}
        {analystForwardPE != null && (
          <span
            className="text-[10px] text-slate-400 hidden sm:inline cursor-help"
            title={`Analyst consensus implies a ${analystForwardPE.toFixed(1)}× 1-year forward P/E based on next-year EPS estimates.`}
          >
            Fwd P/E {analystForwardPE.toFixed(0)}×
          </span>
        )}

        {open ? <ChevronUp size={13} className="text-slate-400 shrink-0" /> : <ChevronDown size={13} className="text-slate-400 shrink-0" />}
      </button>

      {/* Body */}
      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {/* Issues first */}
          {issues.map(r => (
            <AuditRow key={r.key} result={r} assumptions={assumptions} onChange={onChange} />
          ))}

          {/* Clean results (collapsed into a summary row when no issues) */}
          {clean.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {clean.map(r => (
                <span
                  key={r.key}
                  className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5"
                  title={r.signal}
                >
                  <CheckCircle2 size={9} />
                  {r.label}
                </span>
              ))}
            </div>
          )}

          {/* Apply all button — only if there are suggestions */}
          {issues.some(r => r.suggestedValue != null && r.key !== 'quality') && (
            <div className="pt-1 border-t border-slate-100 mt-2">
              <button
                onClick={applyAll}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Apply all suggestions →
              </button>
              <span className="text-[10px] text-slate-400 ml-2">Updates the model with suggested values</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
