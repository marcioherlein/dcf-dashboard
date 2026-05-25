'use client'
import { cn } from '@/lib/utils'
import type { MacroSignalTile } from '@/lib/market-context/types'

interface Props {
  signals: MacroSignalTile[]
}

function toneBadgeClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'bg-emerald-50 text-emerald-700'
  if (tone === 'negative') return 'bg-red-50 text-red-700'
  if (tone === 'warning')  return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

function toneValueClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'text-emerald-700'
  if (tone === 'negative') return 'text-red-600'
  if (tone === 'warning')  return 'text-amber-700'
  return 'text-slate-900'
}

function toneTileClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'border-l-4 border-l-emerald-400 bg-emerald-50/60 border border-emerald-100'
  if (tone === 'negative') return 'border-l-4 border-l-red-400 bg-red-50/60 border border-red-100'
  if (tone === 'warning')  return 'border-l-4 border-l-amber-400 bg-amber-50/60 border border-amber-100'
  return 'border-l-4 border-l-slate-300 bg-slate-50/80 border border-slate-100'
}

export default function MacroSignals({ signals }: Props) {
  return (
    <div className="rounded-xl glass-card-light overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Macro Signals</span>
      </div>
      <div className="px-5 py-4">
      <div className="grid grid-cols-2 gap-2.5">
        {signals.map(sig => (
          <div key={sig.id} className={cn('rounded-xl px-3 py-2.5', toneTileClass(sig.tone))}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{sig.label}</p>
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
    </div>
  )
}
