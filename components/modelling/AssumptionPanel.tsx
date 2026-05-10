'use client'

import { useState } from 'react'
import type { AssumptionSet } from '@/lib/valuation/assumptions'

interface AssumptionPanelProps {
  assumptions: AssumptionSet
  onChange: (field: string, value: number) => void
}

const SOURCE_LABELS: Record<string, string> = {
  analyst:   'Analyst',
  '3y_median': '3Y Median',
  model:     'Model',
  fallback:  'Default',
}
const SOURCE_COLORS: Record<string, string> = {
  analyst:   'bg-blue-100 text-blue-700',
  '3y_median': 'bg-violet-100 text-violet-700',
  model:     'bg-slate-100 text-slate-600',
  fallback:  'bg-amber-100 text-amber-700',
}

function SourceBadge({ source }: { source: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_COLORS[source] ?? 'bg-slate-100 text-slate-600'}`}>
      {SOURCE_LABELS[source] ?? source}
    </span>
  )
}

function AssumptionRow({
  label, value, source, sourceLabel, editable, pct, onChange,
}: {
  label: string; value: number; source: string; sourceLabel: string
  editable: boolean; pct?: boolean; onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const display = pct ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(1)}x`

  if (!editable) {
    return (
      <div className="flex items-center justify-between py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-600">{label}</span>
          <SourceBadge source={source} />
        </div>
        <span className="font-mono text-slate-500">{display}</span>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center justify-between py-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-600">{label}</span>
        </div>
        <input
          autoFocus
          className="w-20 rounded border border-blue-400 bg-blue-50 px-2 py-0.5 text-right font-mono text-xs text-blue-700 focus:outline-none"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const parsed = parseFloat(draft.replace('%', '').trim())
              if (!isNaN(parsed)) onChange(pct ? parsed / 100 : parsed)
              setEditing(false)
            }
            if (e.key === 'Escape') { setEditing(false) }
          }}
          onBlur={() => {
            const parsed = parseFloat(draft.replace('%', '').trim())
            if (!isNaN(parsed)) onChange(pct ? parsed / 100 : parsed)
            setEditing(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-xs group">
      <div className="flex items-center gap-2">
        <span className="text-slate-600">{label}</span>
        <SourceBadge source={source} />
        <span className="hidden group-hover:block text-slate-400 text-[9px]" title={sourceLabel}>
          {sourceLabel.slice(0, 40)}{sourceLabel.length > 40 ? '…' : ''}
        </span>
      </div>
      <button
        onClick={() => { setDraft(pct ? (value * 100).toFixed(1) : value.toFixed(1)); setEditing(true) }}
        className="font-mono text-slate-800 hover:text-blue-600 hover:underline"
        title="Click to edit"
      >
        {display}
      </button>
    </div>
  )
}

export default function AssumptionPanel({ assumptions, onChange }: AssumptionPanelProps) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-5 py-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Assumptions</h3>
      <div className="divide-y divide-slate-100">
        <AssumptionRow
          label="Revenue CAGR" value={assumptions.cagr.value} source={assumptions.cagr.source}
          sourceLabel={assumptions.cagr.label} editable pct
          onChange={v => onChange('cagr', v)}
        />
        <AssumptionRow
          label="WACC" value={assumptions.wacc.value} source={assumptions.wacc.source}
          sourceLabel={assumptions.wacc.label} editable pct
          onChange={v => onChange('wacc', v)}
        />
        <AssumptionRow
          label="Terminal Growth" value={assumptions.terminalG.value} source={assumptions.terminalG.source}
          sourceLabel={assumptions.terminalG.label} editable pct
          onChange={v => onChange('terminalG', v)}
        />
        <AssumptionRow
          label="Tax Rate" value={assumptions.taxRate.value} source={assumptions.taxRate.source}
          sourceLabel={assumptions.taxRate.label} editable={false} pct
          onChange={v => onChange('taxRate', v)}
        />
        <AssumptionRow
          label="Exit Multiple" value={assumptions.exitMultiple.value} source={assumptions.exitMultiple.source}
          sourceLabel={assumptions.exitMultiple.label} editable
          onChange={v => onChange('exitMultiple', v)}
        />
      </div>
    </div>
  )
}
