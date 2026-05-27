'use client'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import type { MarketInstrument } from '@/app/api/markets/data/route'

interface Props {
  sectors: MarketInstrument[]
}

export default function MarketBreadthCard({ sectors }: Props) {
  const valid      = sectors.filter(s => s.changePct != null)
  const advancing  = valid.filter(s => (s.changePct ?? 0) > 0).length
  const declining  = valid.filter(s => (s.changePct ?? 0) < 0).length
  const unchanged  = valid.length - advancing - declining

  const total   = valid.length || 1
  const advPct  = Math.round((advancing / total) * 100)
  const decPct  = Math.round((declining / total) * 100)
  const unchPct = 100 - advPct - decPct

  function getInterpretation(): { text: string; tone: 'green' | 'amber' | 'red' } {
    if (advPct >= 70) return { text: 'Broad-based advance — gains are widely distributed across sectors.', tone: 'green' }
    if (advPct >= 50) return { text: 'Majority of sectors are advancing. Risk appetite appears constructive.', tone: 'green' }
    if (advPct >= 40) return { text: 'Mixed breadth — market leadership is split. Monitor for narrowing.', tone: 'amber' }
    return { text: 'Most sectors are declining. Market weakness may be broad rather than isolated.', tone: 'red' }
  }

  const { text, tone } = getInterpretation()
  const interpretBg   = { green: 'bg-emerald-50/80 border-emerald-100', amber: 'bg-amber-50/80 border-amber-100', red: 'bg-red-50/80 border-red-100' }[tone]
  const interpretText = { green: 'text-emerald-800', amber: 'text-amber-800', red: 'text-red-800' }[tone]

  const HealthIcon = tone === 'green'
    ? <CheckCircle size={13} className="text-emerald-600 shrink-0" />
    : tone === 'amber'
    ? <AlertCircle size={13} className="text-amber-600 shrink-0" />
    : <XCircle size={13} className="text-red-500 shrink-0" />

  const healthLabel = tone === 'green' ? 'Healthy' : tone === 'amber' ? 'Mixed' : 'Weak'
  const healthCls   = { green: 'text-emerald-700 bg-emerald-50 border-emerald-200', amber: 'text-amber-700 bg-amber-50 border-amber-200', red: 'text-red-700 bg-red-50 border-red-200' }[tone]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Market Breadth</span>
          <p className="text-[10px] text-slate-400 mt-0.5">S&P 500 sector ETF performance today</p>
        </div>
        <span className={cn('flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border', healthCls)}>
          {HealthIcon}
          {healthLabel}
        </span>
      </div>

      <div className="px-5 py-4 space-y-4">

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[22px] font-bold tabular-nums text-emerald-600">{advPct}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Advancing</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{advancing} of {total}</p>
          </div>
          <div>
            <p className="text-[22px] font-bold tabular-nums text-red-500">{decPct}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Declining</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{declining} of {total}</p>
          </div>
          <div>
            <p className="text-[22px] font-bold tabular-nums text-slate-400">{unchPct}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Unchanged</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{unchanged} of {total}</p>
          </div>
        </div>

        <div className="h-3 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full transition-all" style={{ width: `${advPct}%` }} />
          <div className="bg-slate-200 h-full transition-all"  style={{ width: `${unchPct}%` }} />
          <div className="bg-red-400 h-full transition-all"    style={{ width: `${decPct}%` }} />
        </div>

        <div className={cn('rounded-xl border p-3', interpretBg)}>
          <p className={cn('text-[11px] leading-snug', interpretText)}>{text}</p>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Healthy breadth = gains are distributed across sectors, not concentrated in a few mega-caps.
          </p>
        </div>

      </div>
    </div>
  )
}
