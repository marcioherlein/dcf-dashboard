'use client'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const ITEMS = [
  'Does the current price assume growth I believe is achievable?',
  'Is the company in the "safe zone" on the Altman Z-Score?',
  'Have I reviewed the Beneish score for earnings quality?',
  'Does my scenario (Bear/Base/Bull) show adequate upside at my risk tolerance?',
  'Have I read the business model and understand what drives revenue?',
]

interface Props {
  ticker: string
  onSaveToWatchlist?: () => void
}

export default function PreTradeChecklist({ ticker, onSaveToWatchlist }: Props) {
  const storageKey = `pre_trade_checklist_${ticker}`
  const [checked, setChecked] = useState<boolean[]>(new Array(ITEMS.length).fill(false))

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) setChecked(JSON.parse(saved))
      else setChecked(new Array(ITEMS.length).fill(false))
    } catch {
      setChecked(new Array(ITEMS.length).fill(false))
    }
  }, [ticker, storageKey])

  function toggle(i: number) {
    const next = checked.map((v, idx) => (idx === i ? !v : v))
    setChecked(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  const checkedCount = checked.filter(Boolean).length
  const allChecked = checkedCount === ITEMS.length

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Pre-Trade</p>
          <h3 className="mt-0.5 text-base font-semibold text-slate-900">Decision Checklist</h3>
        </div>
        <span className={cn(
          'text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
          allChecked
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-slate-50 border-slate-200 text-slate-500',
        )}>
          {checkedCount}/{ITEMS.length}
        </span>
      </div>

      {/* Items */}
      <div className="px-5 py-3 space-y-1">
        {ITEMS.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="w-full flex items-start gap-3 text-left rounded-xl px-3 py-3 hover:bg-slate-50 transition-colors group"
          >
            <div className={cn(
              'w-5 h-5 shrink-0 mt-0.5 rounded-md border-2 flex items-center justify-center transition-colors',
              checked[i]
                ? 'bg-emerald-500 border-emerald-500'
                : 'border-slate-300 group-hover:border-blue-400',
            )}>
              {checked[i] && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={cn(
              'text-sm leading-relaxed transition-colors',
              checked[i] ? 'text-slate-400 line-through' : 'text-slate-700',
            )}>
              {item}
            </span>
          </button>
        ))}
      </div>

      {/* Completion CTA */}
      {allChecked && (
        <div className="px-5 py-4 bg-emerald-50 border-t border-emerald-100">
          <p className="text-sm text-emerald-700 font-medium mb-3">
            ✓ All checks complete — ready to save this analysis?
          </p>
          {onSaveToWatchlist && (
            <button
              onClick={onSaveToWatchlist}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 transition-colors active:scale-95"
            >
              Save to My Valuations →
            </button>
          )}
        </div>
      )}

      {/* Hint */}
      {!allChecked && (
        <div className="px-5 py-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-400">
            Check each box as you complete your research. This checklist resets between sessions.
          </p>
        </div>
      )}
    </div>
  )
}
