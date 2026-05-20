'use client'
import { cn } from '@/lib/utils'
import type { MacroSignalTile } from '@/lib/market-context/types'

interface Props {
  signals: MacroSignalTile[]
}

function toneBadgeClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'bg-emerald-500/10 text-emerald-400'
  if (tone === 'negative') return 'bg-red-500/10 text-red-400'
  if (tone === 'warning')  return 'bg-amber-500/10 text-amber-400'
  return 'bg-white/8 text-slate-300'
}

function toneValueClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'text-emerald-400'
  if (tone === 'negative') return 'text-red-400'
  if (tone === 'warning')  return 'text-amber-400'
  return 'text-slate-100'
}

export default function MacroSignals({ signals }: Props) {
  return (
    <div className="rounded-xl border border-[rgba(59,130,246,0.15)] glass-card px-5 py-4">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-slate-100">Macro Signals</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {signals.map(sig => (
          <div key={sig.id} className="rounded-xl bg-white/[0.06] border border-[rgba(59,130,246,0.15)] px-3 py-2.5">
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
