'use client'
import { cn } from '@/lib/utils'
import type { MarketInstrument } from '@/app/api/markets/data/route'

interface Props {
  sectors: MarketInstrument[]
}

// Approximate S&P 500 sector weights for sizing tiles
const SECTOR_WEIGHTS: Record<string, number> = {
  XLK:  32,  // Technology
  XLF:  13,  // Financials
  XLV:  12,  // Health Care
  XLY:  10,  // Cons. Discretionary
  XLC:   9,  // Communications
  XLI:   9,  // Industrials
  XLP:   6,  // Cons. Staples
  XLE:   4,  // Energy
  XLB:  2.5, // Materials
  XLRE:  2,  // Real Estate
  XLU:  2.5, // Utilities
}

// Short display names for heatmap tiles
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
  if (changePct == null) return 'bg-slate-100 text-slate-500'
  if (changePct >=  2.5) return 'bg-emerald-700 text-white'
  if (changePct >=  1.5) return 'bg-emerald-600 text-white'
  if (changePct >=  0.5) return 'bg-emerald-400 text-white'
  if (changePct >=  0)   return 'bg-emerald-100 text-emerald-800'
  if (changePct >= -0.5) return 'bg-red-100 text-red-800'
  if (changePct >= -1.5) return 'bg-red-400 text-white'
  if (changePct >= -2.5) return 'bg-red-500 text-white'
  return 'bg-red-700 text-white'
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
    <div className="glass-card-light rounded-2xl overflow-hidden h-full">
      <div className="px-4 py-2.5 border-b border-white/60 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Market Heatmap</span>
          <p className="text-[10px] text-slate-400 mt-0.5">S&P 500 sectors · daily performance</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-semibold">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Advancing</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Declining</span>
        </div>
      </div>

      <div className="p-3">
        {/* Main grid — large sectors get 2 cols, small get 1 */}
        <div className="grid grid-cols-6 gap-1.5">
          {sorted.map(s => {
            const w = SECTOR_WEIGHTS[s.symbol] ?? 2
            const colSpan = w >= 20 ? 'col-span-2' : w >= 9 ? 'col-span-2' : 'col-span-1'
            const tallClass = w >= 20 ? 'min-h-[72px]' : w >= 9 ? 'min-h-[64px]' : 'min-h-[56px]'
            return (
              <div
                key={s.symbol}
                className={cn(
                  'rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.02]',
                  colSpan, tallClass,
                  heatColor(s.changePct)
                )}
              >
                <p className={cn(
                  'font-bold leading-tight',
                  w >= 9 ? 'text-[11px]' : 'text-[10px]'
                )}>
                  {SHORT_NAMES[s.symbol] ?? s.name}
                </p>
                <p className={cn(
                  'font-bold font-mono tabular-nums mt-auto',
                  w >= 9 ? 'text-[13px]' : 'text-[11px]'
                )}>
                  {pct(s.changePct)}
                </p>
              </div>
            )
          })}
        </div>

        {/* Scale legend */}
        <div className="mt-3 flex items-center gap-1">
          <span className="text-[9px] text-slate-400 mr-1">Perf:</span>
          {[
            { label: '–2%+', cls: 'bg-red-700' },
            { label: '–1%', cls: 'bg-red-400' },
            { label: '–½%', cls: 'bg-red-100' },
            { label: '0', cls: 'bg-slate-100' },
            { label: '+½%', cls: 'bg-emerald-100' },
            { label: '+1%', cls: 'bg-emerald-400' },
            { label: '+2%+', cls: 'bg-emerald-700' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex flex-col items-center">
              <div className={cn('w-5 h-2.5 rounded-sm', cls)} />
              <span className="text-[8px] text-slate-400 mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
