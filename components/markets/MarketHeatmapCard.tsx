'use client'
import { cn } from '@/lib/utils'
import type { MarketInstrument } from '@/app/api/markets/data/route'

interface Props {
  sectors: MarketInstrument[]
}

const SECTOR_WEIGHTS: Record<string, number> = {
  XLK:  32,
  XLF:  13,
  XLV:  12,
  XLY:  10,
  XLC:   9,
  XLI:   9,
  XLP:   6,
  XLE:   4,
  XLB:  2.5,
  XLRE:  2,
  XLU:  2.5,
}

const SHORT_NAMES: Record<string, string> = {
  XLK:  'Tech',
  XLF:  'Financials',
  XLV:  'Health',
  XLY:  'Cons. Disc.',
  XLC:  'Comm.',
  XLI:  'Industrials',
  XLP:  'Staples',
  XLE:  'Energy',
  XLB:  'Materials',
  XLRE: 'Real Estate',
  XLU:  'Utilities',
}

function heatColor(changePct: number | null): string {
  if (changePct == null) return 'bg-[#F4F3EF] text-[#566174]'
  if (changePct >=  2.5) return 'bg-[#0D6B46] text-white'
  if (changePct >=  1.5) return 'bg-[#11875D] text-white'
  if (changePct >=  0.5) return 'bg-[#11875D] text-white'
  if (changePct >=  0)   return 'bg-[#E8F7EF] text-[#0D6B46]'
  if (changePct >= -0.5) return 'bg-[#FCEAEA] text-[#991B1B]'
  if (changePct >= -1.5) return 'bg-[#D83B3B] text-white'
  if (changePct >= -2.5) return 'bg-[#FCEAEA]0 text-white'
  return 'bg-[#991B1B] text-white'
}

function statusTag(changePct: number | null): { label: string; cls: string } {
  if (changePct == null) return { label: '—', cls: 'opacity-60' }
  if (changePct >=  2)   return { label: 'Leader',   cls: '' }
  if (changePct >=  0.5) return { label: 'Strong',   cls: '' }
  if (changePct >=  0)   return { label: 'Positive', cls: '' }
  if (changePct >= -0.5) return { label: 'Neutral',  cls: '' }
  return { label: 'Lagging', cls: '' }
}

function pct(v: number | null) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

export default function MarketHeatmapCard({ sectors }: Props) {
  const sorted = [...sectors].sort(
    (a, b) => (SECTOR_WEIGHTS[b.symbol] ?? 1) - (SECTOR_WEIGHTS[a.symbol] ?? 1)
  )

  return (
    <div className="bg-white rounded-2xl border border-[#E3E1DA] shadow-sm overflow-hidden h-full">
      <div className="px-4 py-2.5 border-b border-[#E3E1DA] flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-[#566174] uppercase tracking-wider">Market Heatmap</span>
          <p className="text-[10px] text-[#8A95A6] mt-0.5">S&P 500 sectors · daily performance</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#566174]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#E8F7EF]0 inline-block" /> Adv.</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#FCEAEA]0 inline-block" /> Dec.</span>
        </div>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {sorted.map(s => {
            const isLarge  = s.symbol === 'XLK'
            const colSpan  = isLarge ? 'col-span-2 sm:col-span-2' : 'col-span-1'
            const minH     = isLarge ? 'min-h-[60px] sm:min-h-[80px]' : 'min-h-[52px] sm:min-h-[62px]'
            const textSize = isLarge ? 'text-[10px] sm:text-[11px]' : 'text-[10px] sm:text-[11px]'
            const numSize  = isLarge ? 'text-[11px] sm:text-[13px]' : 'text-[10px] sm:text-[11px]'
            const { label } = statusTag(s.changePct)
            return (
              <div
                key={s.symbol}
                className={cn(
                  'rounded-xl p-2 flex flex-col justify-between transition-all hover:scale-[1.02]',
                  colSpan, minH,
                  heatColor(s.changePct)
                )}
              >
                <p className={cn('font-bold leading-tight', textSize)}>
                  {SHORT_NAMES[s.symbol] ?? s.name}
                </p>
                <div>
                  <p className={cn('font-bold tabular-nums', numSize)}>
                    {pct(s.changePct)}
                  </p>
                  <p className={cn('text-[8px] font-semibold opacity-80 mt-0.5 hidden sm:block', textSize)}>
                    {label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
          <span className="text-[11px] text-[#8A95A6] mr-1">Perf:</span>
          {[
            { label: '–2%+', cls: 'bg-[#991B1B]' },
            { label: '–1%',  cls: 'bg-[#D83B3B]' },
            { label: '–½%',  cls: 'bg-[#FCEAEA]' },
            { label: '0',    cls: 'bg-[#F4F3EF]' },
            { label: '+½%',  cls: 'bg-[#E8F7EF]' },
            { label: '+1%',  cls: 'bg-[#11875D]' },
            { label: '+2%+', cls: 'bg-emerald-700' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex flex-col items-center">
              <div className={cn('w-5 h-2.5 rounded-sm', cls)} />
              <span className="text-[8px] text-[#8A95A6] mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
