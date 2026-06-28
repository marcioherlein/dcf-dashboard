'use client'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { MarketInstrument } from '@/app/api/markets/data/route'

interface Props {
  sectors: MarketInstrument[]
}

const SECTOR_WEIGHTS: Record<string, number> = {
  XLK:  32, XLF:  13, XLV:  12, XLY:  10, XLC:   9,
  XLI:   9, XLP:   6, XLE:   4, XLB:  2.5, XLRE:  2, XLU:  2.5,
}

const SHORT_NAMES: Record<string, string> = {
  XLK: 'Tech', XLF: 'Financials', XLV: 'Health', XLY: 'Cons. Disc.',
  XLC: 'Comm.', XLI: 'Industrials', XLP: 'Staples', XLE: 'Energy',
  XLB: 'Materials', XLRE: 'Real Estate', XLU: 'Utilities',
}

// Threshold bands scale with timeframe
function heatColor(v: number | null, range: number): string {
  if (v == null) return 'bg-[#F5F5F5] text-[#6B6B6B]'
  const t = range / 5
  if (v >=  t * 2) return 'bg-[#0D6B46] text-white'
  if (v >=  t)     return 'bg-[#11875D] text-white'
  if (v >=  0)     return 'bg-[#E8F7EF] text-[#0D6B46]'
  if (v >= -t)     return 'bg-[#FCEAEA] text-[#991B1B]'
  if (v >= -t * 2) return 'bg-[#D83B3B] text-white'
  return 'bg-[#991B1B] text-white'
}

function pct(v: number | null) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

type Tf = '1D' | '1W' | '1M' | '6M' | 'YTD' | '1Y'
const TIMEFRAMES: Tf[] = ['1D', '1W', '1M', '6M', 'YTD', '1Y']

const TF_RANGE: Record<Tf, number> = {
  '1D': 5, '1W': 10, '1M': 20, '6M': 30, 'YTD': 40, '1Y': 50,
}

export default function MarketHeatmapCard({ sectors }: Props) {
  const [tf, setTf] = useState<Tf>('1D')
  const [histData, setHistData] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (tf === '1D') return // daily already in props
    const symbols = sectors.map(s => s.symbol).join(',')
    const rangeMap: Record<Tf, string> = {
      '1D': '1d', '1W': '5d', '1M': '1mo', '6M': '6mo', 'YTD': 'ytd', '1Y': '1y',
    }
    setLoading(true)
    fetch(`/api/markets/sector-history?symbols=${symbols}&range=${rangeMap[tf]}`)
      .then(r => r.json())
      .then((d: Record<string, number | null>) => setHistData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tf, sectors])

  const sorted = [...sectors].sort(
    (a, b) => (SECTOR_WEIGHTS[b.symbol] ?? 1) - (SECTOR_WEIGHTS[a.symbol] ?? 1)
  )

  const range = TF_RANGE[tf]

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm [overflow:clip] h-full flex flex-col">
      <div className="px-4 py-2.5 border-b border-[#E5E5E5] flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-bold text-[#6B6B6B]">Sector Heatmap</span>
          <p className="text-[10px] text-[#6B6B6B] mt-0.5">S&P 500 sectors · {tf === '1D' ? 'daily' : tf} performance</p>
        </div>
        {/* Timeframe selector */}
        <div className="flex items-center gap-0.5 bg-[#F5F5F5] rounded-lg p-0.5">
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              data-no-min-h
              onClick={() => setTf(t)}
              className={cn(
                'px-2 py-1 text-[10px] font-[650] rounded-md transition-colors',
                tf === t ? 'bg-white text-[#111111] shadow-sm' : 'text-[#9B9B9B] hover:text-[#566174]'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('p-3 transition-opacity flex-1 min-h-0 overflow-y-auto', loading ? 'opacity-50' : '')}>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {sorted.map(s => {
            const changePct = tf === '1D' ? s.changePct : (histData[s.symbol] ?? null)
            const isLarge = s.symbol === 'XLK'
            return (
              <div
                key={s.symbol}
                className={cn(
                  'rounded-xl p-2 flex flex-col justify-between transition-all hover:scale-[1.02]',
                  isLarge ? 'col-span-2 min-h-[60px] sm:min-h-[80px]' : 'col-span-1 min-h-[52px] sm:min-h-[62px]',
                  heatColor(changePct, range),
                )}
              >
                <p className="text-[10px] sm:text-[11px] font-bold leading-tight">
                  {SHORT_NAMES[s.symbol] ?? s.name}
                </p>
                <p className="text-[10px] sm:text-[12px] font-bold tabular-nums mt-auto">
                  {pct(changePct)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
