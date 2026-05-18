'use client'
import { cn } from '@/lib/utils'
import type { MacroSignalTile } from '@/lib/market-context/types'

interface Props {
  signals: MacroSignalTile[]
}

function toneBadgeClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'bg-emerald-100 text-emerald-700'
  if (tone === 'negative') return 'bg-red-100 text-red-700'
  if (tone === 'warning')  return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

function toneValueClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'text-emerald-700'
  if (tone === 'negative') return 'text-red-700'
  if (tone === 'warning')  return 'text-amber-700'
  return 'text-slate-800'
}

export default function MacroSignals({ signals }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-slate-900">Macro Signals</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {signals.map(sig => (
          <div key={sig.id} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{sig.label}</p>
            <p className={cn('text-lg font-bold font-mono tabular-nums mt-0.5', toneValueClass(sig.tone))}>
              {sig.value}
            </p>
            {sig.sub && <p className="text-[9px] text-slate-400 -mt-0.5">{sig.sub}</p>}
            <span className={cn('inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider', toneBadgeClass(sig.tone))}>
              {sig.regimeLabel}
            </span>
            {sig.equityImplication && (
              <p className="text-[10px] text-slate-500 mt-1 leading-tight">{sig.equityImplication}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
