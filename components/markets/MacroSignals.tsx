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
  return 'text-[#111111]'
}

function toneBadgeClass(tone: MacroSignalTile['tone']): string {
  if (tone === 'positive') return 'bg-[#E8F7EF] text-[#11875D] border-[#E5E5E5]'
  if (tone === 'negative') return 'bg-[#FCEAEA] text-[#D83B3B] border-[#E5E5E5]'
  if (tone === 'warning')  return 'bg-[#FFF4DA] text-[#B56A00] border-[#E5E5E5]'
  return 'bg-[#E3E1DA] text-[#6B6B6B] border-[#E5E5E5]'
}

function iconForSignal(label: string): { icon: React.ReactNode; bg: string } {
  const l = label.toLowerCase()
  if (l.includes('vix'))
    return { icon: <Activity size={14} className="text-[#D83B3B]" />, bg: 'bg-[#FCEAEA]' }
  if (l.includes('10y') || l.includes('10-year') || (l.includes('treasury') && !l.includes('2y')))
    return { icon: <Landmark size={14} className="text-[#B56A00]" />, bg: 'bg-[#FFF4DA]' }
  if (l.includes('2y') || l.includes('2-year'))
    return { icon: <TrendingDown size={14} className="text-[#2563EB]" />, bg: 'bg-[#EAF1FF]' }
  if (l.includes('yield curve'))
    return { icon: <BarChart2 size={14} className="text-[#2563EB]" />, bg: 'bg-[#EAF1FF]' }
  if (l.includes('spread') || l.includes('hy') || l.includes('credit'))
    return { icon: <AlertTriangle size={14} className="text-[#B56A00]" />, bg: 'bg-[#FFF4DA]' }
  if (l.includes('usd') || l.includes('dollar') || l.includes('dxy'))
    return { icon: <DollarSign size={14} className="text-[#11875D]" />, bg: 'bg-[#E8F7EF]' }
  return { icon: <Percent size={14} className="text-[#6B6B6B]" />, bg: 'bg-[#E3E1DA]' }
}

export default function MacroSignals({ signals }: Props) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-3 flex-1">
        {signals.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[120px]">
            <p className="text-[12px] text-[#6B6B6B]">No macro signals available</p>
          </div>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {signals.map(sig => {
            const { icon, bg } = iconForSignal(sig.label)
            return (
              <div key={sig.id} className="rounded-xl bg-[#F5F5F5] border border-[#E5E5E5] px-2.5 py-2 flex flex-col">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center shrink-0', bg)}>
                    {icon}
                  </div>
                  <p className="text-[11px] font-bold text-[#6B6B6B] leading-tight truncate">{sig.label}</p>
                </div>
                <p className={cn('text-[16px] font-bold tabular-nums leading-none', toneValueClass(sig.tone))}>
                  {sig.value}
                </p>
                {sig.sub && <p className="text-[11px] text-[#6B6B6B] mt-0.5">{sig.sub}</p>}
                <span className={cn(
                  'inline-flex items-center self-start mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                  toneBadgeClass(sig.tone)
                )}>
                  {sig.regimeLabel}
                </span>
                {sig.equityImplication && (
                  <p className="text-[9.5px] text-[#6B6B6B] mt-1.5 leading-snug">{sig.equityImplication}</p>
                )}
              </div>
            )
          })}
        </div>
        )}
      </div>
    </div>
  )
}
