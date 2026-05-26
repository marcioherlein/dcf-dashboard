'use client'
import { cn } from '@/lib/utils'
import type { MarketInstrument } from '@/app/api/markets/data/route'

interface Props {
  sectors: MarketInstrument[]
}

export default function MarketBreadthCard({ sectors }: Props) {
  const valid = sectors.filter(s => s.changePct != null)
  const advancing  = valid.filter(s => (s.changePct ?? 0) > 0).length
  const declining  = valid.filter(s => (s.changePct ?? 0) < 0).length
  const unchanged  = valid.length - advancing - declining

  const total = valid.length || 1
  const advPct = Math.round((advancing / total) * 100)
  const decPct = Math.round((declining / total) * 100)
  const unchPct = 100 - advPct - decPct

  function interpretation(): { text: string; tone: 'green' | 'amber' | 'red' } {
    if (advPct >= 70) return { text: 'Broad-based advance — gains are widely distributed across sectors.', tone: 'green' }
    if (advPct >= 50) return { text: 'Majority of sectors are advancing. Risk appetite appears constructive.', tone: 'green' }
    if (advPct >= 40) return { text: 'Mixed breadth — market leadership is split. Monitor for narrowing.', tone: 'amber' }
    return { text: 'Most sectors are declining. Market weakness may be broad rather than isolated.', tone: 'red' }
  }

  const { text, tone } = interpretation()

  const interpretBg = {
    green: 'bg-emerald-50/80 border-emerald-100',
    amber: 'bg-amber-50/80 border-amber-100',
    red:   'bg-red-50/80 border-red-100',
  }[tone]

  const interpretText = {
    green: 'text-emerald-800',
    amber: 'text-amber-800',
    red:   'text-red-800',
  }[tone]

  return (
    <div className="glass-card-light rounded-2xl overflow-hidden h-full">
      <div className="px-4 py-2.5 border-b border-white/60">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Market Breadth</span>
        <p className="text-[10px] text-slate-400 mt-0.5">Based on S&P 500 sector ETF performance today</p>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Large percentage stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-3xl font-bold tabular-nums text-emerald-600">{advPct}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Advancing</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{advancing} of {total} sectors</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums text-red-500">{decPct}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Declining</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{declining} of {total} sectors</p>
          </div>
          <div>
            <p className="text-3xl font-bold tabular-nums text-slate-400">{unchPct}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">Unchanged</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{unchanged} of {total} sectors</p>
          </div>
        </div>

        {/* Stacked bar */}
        <div className="h-3 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all"
            style={{ width: `${advPct}%` }}
          />
          <div
            className="bg-slate-200 h-full transition-all"
            style={{ width: `${unchPct}%` }}
          />
          <div
            className="bg-red-400 h-full transition-all"
            style={{ width: `${decPct}%` }}
          />
        </div>

        {/* Interpretation */}
        <div className={cn('rounded-xl border p-3', interpretBg)}>
          <p className={cn('text-[11.5px] leading-snug', interpretText)}>{text}</p>
          <p className="text-[10px] text-slate-400 mt-1.5">
            Healthy breadth = gains are broadly distributed, not concentrated in a few mega-caps.
          </p>
        </div>

        {/* Sector detail rows */}
        <div className="space-y-1">
          {[...sectors]
            .filter(s => s.changePct != null)
            .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
            .map(s => {
              const p = s.changePct ?? 0
              const barW = Math.min(Math.abs(p) * 10, 100)
              return (
                <div key={s.symbol} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 w-28 shrink-0 truncate">{s.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', p >= 0 ? 'bg-emerald-400' : 'bg-red-400')}
                      style={{ width: `${barW}%`, marginLeft: p < 0 ? `${100 - barW}%` : 0 }}
                    />
                  </div>
                  <span className={cn('text-[10px] font-mono font-semibold w-12 text-right tabular-nums shrink-0',
                    p > 0 ? 'text-emerald-600' : p < 0 ? 'text-red-500' : 'text-slate-400'
                  )}>
                    {p >= 0 ? '+' : ''}{p.toFixed(2)}%
                  </span>
                </div>
              )
            })
          }
        </div>

      </div>
    </div>
  )
}
