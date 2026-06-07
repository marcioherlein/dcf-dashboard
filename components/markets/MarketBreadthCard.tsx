'use client'
import { cn } from '@/lib/utils'
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react'
import type { MarketInstrument } from '@/app/api/markets/data/route'

interface Props {
  sectors: MarketInstrument[]
}

export default function MarketBreadthCard({ sectors }: Props) {
  const valid     = sectors.filter(s => s.changePct != null)
  const advancing = valid.filter(s => (s.changePct ?? 0) > 0).length
  const declining = valid.filter(s => (s.changePct ?? 0) < 0).length
  const unchanged = valid.length - advancing - declining

  const total   = valid.length || 1
  const advPct  = Math.round((advancing / total) * 100)
  const decPct  = Math.round((declining / total) * 100)
  const unchPct = 100 - advPct - decPct

  function getHealthTier(): { tone: 'green' | 'blue' | 'amber' | 'red'; badge: string; text: string } {
    if (advPct > 65) return {
      tone: 'green',
      badge: 'Breadth is healthy',
      text: 'Broad-based advance — gains are widely distributed across sectors.',
    }
    if (advPct >= 55) return {
      tone: 'blue',
      badge: 'Breadth is constructive',
      text: 'More sectors are advancing than declining. Risk appetite appears constructive.',
    }
    if (advPct >= 45) return {
      tone: 'amber',
      badge: 'Mixed breadth',
      text: 'Mixed sector breadth — leadership is split. Monitor for narrowing participation.',
    }
    return {
      tone: 'red',
      badge: 'Breadth is weak',
      text: 'Most sectors are declining. Weakness appears broad rather than isolated.',
    }
  }

  const { tone, badge, text } = getHealthTier()

  const BadgeIcon = tone === 'green'
    ? <CheckCircle size={14} className="text-[#11875D] shrink-0 mt-0.5" />
    : tone === 'blue'
    ? <Info size={14} className="text-[#2563EB] shrink-0 mt-0.5" />
    : tone === 'amber'
    ? <AlertCircle size={14} className="text-[#B56A00] shrink-0 mt-0.5" />
    : <XCircle size={14} className="text-[#D83B3B] shrink-0 mt-0.5" />

  const badgeTextCls = {
    green: 'text-[#11875D]',
    blue:  'text-[#2563EB]',
    amber: 'text-[#B56A00]',
    red:   'text-[#D83B3B]',
  }[tone]

  return (
    <div className="bg-white rounded-2xl border border-[#E3E1DA] shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-[#E3E1DA]">
        <span className="text-[10px] font-bold text-[#566174] uppercase tracking-wider">Market Breadth</span>
        <p className="text-[10px] text-[#8A95A6] mt-0.5">Advancing vs declining sectors today</p>
      </div>

      <div className="px-5 py-4 flex-1 flex flex-col gap-4">

        {/* Stats: Advancing + Declining */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-[28px] font-bold tabular-nums text-[#11875D] leading-none">{advPct}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A95A6] mt-1.5">Advancing</p>
            <p className="text-[10px] text-[#566174] mt-0.5">{advancing} of {total}</p>
          </div>
          <div>
            <p className="text-[28px] font-bold tabular-nums text-[#D83B3B] leading-none">{decPct}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A95A6] mt-1.5">Declining</p>
            <p className="text-[10px] text-[#566174] mt-0.5">{declining} of {total}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 rounded-full overflow-hidden flex">
            <div className="bg-[#11875D] h-full transition-all" style={{ width: `${advPct}%` }} />
            <div className="bg-[#E3E1DA] h-full transition-all"  style={{ width: `${unchPct}%` }} />
            <div className="bg-[#D83B3B] h-full transition-all"    style={{ width: `${decPct}%` }} />
          </div>
          <p className="text-[10px] text-[#8A95A6]">Unchanged: {unchanged} of {total} ({unchPct}%)</p>
        </div>

        {/* Health indicator */}
        <div className={cn(
          'flex items-start gap-2 rounded-xl px-3 py-2.5',
          tone === 'green' ? 'bg-[#E8F7EF]'
          : tone === 'blue' ? 'bg-[#EAF1FF]'
          : tone === 'amber' ? 'bg-[#FFF4DA]'
          : 'bg-[#FCEAEA]'
        )}>
          {BadgeIcon}
          <div>
            <p className={cn('text-[12px] font-bold leading-tight', badgeTextCls)}>{badge}</p>
            <p className="text-[11px] text-[#566174] mt-0.5 leading-snug">{text}</p>
          </div>
        </div>

      </div>
    </div>
  )
}
