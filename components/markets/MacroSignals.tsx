'use client'
import { cn } from '@/lib/utils'
import { Activity, Landmark, TrendingDown, BarChart2, AlertTriangle, DollarSign, Percent } from 'lucide-react'
import type { MacroSignalTile } from '@/lib/market-context/types'

interface Props {
  signals: MacroSignalTile[]
}

function toneValueClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'text-emerald-700'
  if (tone === 'negative') return 'text-red-600'
  if (tone === 'warning')  return 'text-amber-700'
  return 'text-slate-900'
}

function toneBadgeClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (tone === 'negative') return 'bg-red-50 text-red-700 border-red-200'
  if (tone === 'warning')  return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function iconForSignal(label: string): { icon: React.ReactNode; bg: string } {
  const l = label.toLowerCase()
  if (l.includes('vix'))
    return { icon: <Activity size={14} className="text-rose-600" />, bg: 'bg-rose-50' }
  if (l.includes('10y') || l.includes('10-year') || (l.includes('treasury') && !l.includes('2y')))
    return { icon: <Landmark size={14} className="text-amber-600" />, bg: 'bg-amber-50' }
  if (l.includes('2y') || l.includes('2-year'))
    return { icon: <TrendingDown size={14} className="text-blue-600" />, bg: 'bg-blue-50' }
  if (l.includes('yield curve'))
    return { icon: <BarChart2 size={14} className="text-indigo-600" />, bg: 'bg-indigo-50' }
  if (l.includes('spread') || l.includes('hy') || l.includes('credit'))
    return { icon: <AlertTriangle size={14} className="text-orange-600" />, bg: 'bg-orange-50' }
  if (l.includes('usd') || l.includes('dollar') || l.includes('dxy'))
    return { icon: <DollarSign size={14} className="text-emerald-600" />, bg: 'bg-emerald-50' }
  return { icon: <Percent size={14} className="text-slate-600" />, bg: 'bg-slate-100' }
}

export default function MacroSignals({ signals }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-slate-100">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Macro Environment</span>
        <p className="text-[10px] text-slate-400 mt-0.5">Key signals that influence discount rates, risk appetite, and valuations.</p>
      </div>

      <div className="p-3 flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {signals.map(sig => {
            const { icon, bg } = iconForSignal(sig.label)
            return (
              <div key={sig.id} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5 flex flex-col">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', bg)}>
                    {icon}
                  </div>
                  <p className="text-[9px] font-bold text-slate-500 leading-tight uppercase tracking-wider truncate">{sig.label}</p>
                </div>
                <p className={cn('text-[16px] font-bold tabular-nums leading-none', toneValueClass(sig.tone))}>
                  {sig.value}
                </p>
                {sig.sub && <p className="text-[9px] text-slate-400 mt-0.5">{sig.sub}</p>}
                <span className={cn(
                  'inline-flex items-center self-start mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider',
                  toneBadgeClass(sig.tone)
                )}>
                  {sig.regimeLabel}
                </span>
                {sig.equityImplication && (
                  <p className="text-[9.5px] text-slate-500 mt-1.5 leading-snug">{sig.equityImplication}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
