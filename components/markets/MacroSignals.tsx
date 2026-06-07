'use client'
import { cn } from '@/lib/utils'
import { Activity, Landmark, TrendingDown, BarChart2, AlertTriangle, DollarSign, Percent } from 'lucide-react'
import type { MacroSignalTile } from '@/lib/market-context/types'

interface Props {
  signals: MacroSignalTile[]
}

function toneValueClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'text-[#11875D]'
  if (tone === 'negative') return 'text-[#D83B3B]'
  if (tone === 'warning')  return 'text-[#B56A00]'
  return 'text-[#06101F]'
}

function toneBadgeClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'bg-[#E8F7EF] text-[#11875D] border-[#CDD1C8]'
  if (tone === 'negative') return 'bg-[#FCEAEA] text-[#D83B3B] border-[#E3E1DA]'
  if (tone === 'warning')  return 'bg-[#FFF4DA] text-[#B56A00] border-[#E3E1DA]'
  return 'bg-[#E3E1DA] text-[#566174] border-[#E3E1DA]'
}

function iconForSignal(label: string): { icon: React.ReactNode; bg: string } {
  const l = label.toLowerCase()
  if (l.includes('vix'))
    return { icon: <Activity size={14} className="text-rose-600" />, bg: 'bg-rose-50' }
  if (l.includes('10y') || l.includes('10-year') || (l.includes('treasury') && !l.includes('2y')))
    return { icon: <Landmark size={14} className="text-[#B56A00]" />, bg: 'bg-[#FFF4DA]' }
  if (l.includes('2y') || l.includes('2-year'))
    return { icon: <TrendingDown size={14} className="text-[#2563EB]" />, bg: 'bg-[#EAF1FF]' }
  if (l.includes('yield curve'))
    return { icon: <BarChart2 size={14} className="text-indigo-600" />, bg: 'bg-indigo-50' }
  if (l.includes('spread') || l.includes('hy') || l.includes('credit'))
    return { icon: <AlertTriangle size={14} className="text-orange-600" />, bg: 'bg-orange-50' }
  if (l.includes('usd') || l.includes('dollar') || l.includes('dxy'))
    return { icon: <DollarSign size={14} className="text-[#11875D]" />, bg: 'bg-[#E8F7EF]' }
  return { icon: <Percent size={14} className="text-[#566174]" />, bg: 'bg-[#E3E1DA]' }
}

export default function MacroSignals({ signals }: Props) {
  return (
    <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-[#E3E1DA]">
        <span className="text-[11px] font-bold text-[#566174] uppercase tracking-wider">Macro Environment</span>
        <p className="text-[11px] text-[#8A95A6] mt-0.5">Key signals that influence discount rates, risk appetite, and valuations.</p>
      </div>

      <div className="p-3 flex-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {signals.map(sig => {
            const { icon, bg } = iconForSignal(sig.label)
            return (
              <div key={sig.id} className="rounded-xl bg-[#F4F3EF] border border-[#E3E1DA] px-3 py-2.5 flex flex-col">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', bg)}>
                    {icon}
                  </div>
                  <p className="text-[11px] font-bold text-[#566174] leading-tight uppercase tracking-wider truncate">{sig.label}</p>
                </div>
                <p className={cn('text-[16px] font-bold tabular-nums leading-none', toneValueClass(sig.tone))}>
                  {sig.value}
                </p>
                {sig.sub && <p className="text-[11px] text-[#8A95A6] mt-0.5">{sig.sub}</p>}
                <span className={cn(
                  'inline-flex items-center self-start mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider',
                  toneBadgeClass(sig.tone)
                )}>
                  {sig.regimeLabel}
                </span>
                {sig.equityImplication && (
                  <p className="text-[9.5px] text-[#566174] mt-1.5 leading-snug">{sig.equityImplication}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
