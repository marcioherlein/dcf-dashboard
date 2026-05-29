'use client'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const CARDS = [
  {
    ticker: 'NVDA', name: 'NVIDIA', grade: 'A+', up: true,
    verdict: '+38% upside · Dominant AI infrastructure', sector: 'Semiconductors',
    price: 118.20, fairValue: 163.5,
    sparkData: [74, 82, 79, 95, 108, 101, 115, 118, 124, 118],
    low52: 47.32, high52: 153.13,
  },
  {
    ticker: 'MSFT', name: 'Microsoft', grade: 'A', up: true,
    verdict: '+22% upside · Cloud moat intact', sector: 'Software',
    price: 415.10, fairValue: 506.4,
    sparkData: [310, 325, 318, 342, 355, 348, 370, 390, 408, 415],
    low52: 309.45, high52: 468.35,
  },
  {
    ticker: 'GOOGL', name: 'Alphabet', grade: 'A', up: true,
    verdict: '+18% upside · Search + AI synergy', sector: 'Internet',
    price: 174.50, fairValue: 205.8,
    sparkData: [130, 138, 142, 151, 159, 154, 162, 168, 171, 174],
    low52: 129.40, high52: 207.05,
  },
  {
    ticker: 'META', name: 'Meta Platforms', grade: 'B+', up: true,
    verdict: '+12% upside · Ad revenue resilient', sector: 'Social Media',
    price: 573.20, fairValue: 641.0,
    sparkData: [420, 445, 438, 468, 490, 505, 522, 548, 560, 573],
    low52: 414.50, high52: 638.40,
  },
  {
    ticker: 'AMZN', name: 'Amazon', grade: 'B+', up: true,
    verdict: '+15% upside · AWS margin expansion', sector: 'E-Commerce',
    price: 196.30, fairValue: 225.7,
    sparkData: [152, 162, 158, 170, 178, 185, 188, 192, 194, 196],
    low52: 151.61, high52: 242.52,
  },
  {
    ticker: 'JPM', name: 'JPMorgan', grade: 'B', up: true,
    verdict: 'Fairly priced · Best-in-class bank', sector: 'Financials',
    price: 214.60, fairValue: 218.3,
    sparkData: [178, 185, 182, 190, 195, 198, 204, 208, 212, 214],
    low52: 172.96, high52: 280.25,
  },
  {
    ticker: 'TSLA', name: 'Tesla', grade: 'C', up: false,
    verdict: '-24% downside · Margin pressure ahead', sector: 'EVs',
    price: 177.80, fairValue: 134.5,
    sparkData: [245, 228, 210, 195, 208, 192, 185, 180, 178, 177],
    low52: 138.80, high52: 488.54,
  },
  {
    ticker: 'BRK.B', name: 'Berkshire B', grade: 'B', up: false,
    verdict: 'Fairly priced · Long-term anchor', sector: 'Conglomerates',
    price: 456.20, fairValue: 462.0,
    sparkData: [410, 418, 422, 430, 440, 445, 450, 454, 457, 456],
    low52: 397.36, high52: 497.27,
  },
]

function gradeColor(grade: string) {
  const g = grade.replace('+', '').replace('-', '')
  if (g === 'A') return { bg: 'bg-emerald-500/20 border border-emerald-500/30', text: 'text-emerald-300' }
  if (g === 'B') return { bg: 'bg-blue-500/20 border border-blue-500/30',       text: 'text-blue-300' }
  if (g === 'C') return { bg: 'bg-amber-500/20 border border-amber-500/30',     text: 'text-amber-300' }
  return { bg: 'bg-red-500/20 border border-red-500/30',                        text: 'text-red-300' }
}

function sparklinePath(data: number[], w: number, h: number): { line: string; area: string } {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return [x, y] as [number, number]
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)},${h} L 0,${h} Z`
  return { line, area }
}

function PriceRangeBar({ low, high, current }: { low: number; high: number; current: number }) {
  const pct = Math.max(0, Math.min(1, (current - low) / (high - low))) * 100
  return (
    <div className="mt-2">
      <div className="relative h-1 rounded-full bg-white/10">
        <div className="absolute left-0 top-0 h-1 rounded-full bg-white/5" style={{ width: '100%' }} />
        <div
          className="absolute left-0 top-0 h-1 rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(to right, #3B82F6, #10B981)',
          }}
        />
        <div
          className="absolute -top-0.5 -translate-x-1/2 w-2 h-2 rounded-full bg-[#050D1F] border-2 border-blue-400"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-mono text-slate-400 tabular-nums">
        <span>${low.toFixed(0)}</span>
        <span className="text-slate-500 font-semibold">${current.toFixed(0)}</span>
        <span>${high.toFixed(0)}</span>
      </div>
    </div>
  )
}

function StockCard({ card, index, visible }: { card: typeof CARDS[0]; index: number; visible: boolean }) {
  const [hovered, setHovered] = useState(false)
  const colors = gradeColor(card.grade)
  const W = 120, H = 40
  const paths = sparklinePath(card.sparkData, W, H)
  const pathLen = 300
  const isUnder = card.fairValue > card.price
  const sparkColor = isUnder ? '#10B981' : '#EF4444'
  const areaId = `area-${card.ticker}`

  return (
    <div
      className={cn(
        'shrink-0 w-[220px] rounded-2xl glass-card border border-[rgba(59,130,246,0.18)] overflow-hidden',
        'transition-all duration-300 hover:border-[rgba(59,130,246,0.45)] hover:shadow-glow-sm hover:-translate-y-0.5 cursor-pointer',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      style={{
        animation: visible ? `card-slide-in 0.45s cubic-bezier(0.16,1,0.3,1) forwards` : 'none',
        animationDelay: visible ? `${index * 70}ms` : '0ms',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-400 tracking-wide">
                {card.ticker}
              </span>
              <span className="text-[10px] text-slate-500 truncate">{card.sector}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-200 leading-tight truncate">{card.name}</p>
          </div>
          <div
            className={cn(
              'w-10 h-10 shrink-0 rounded-xl flex items-center justify-center',
              colors.bg, colors.text,
            )}
          >
            <span className="text-base font-extrabold leading-none" style={{ fontFamily: 'var(--font-display, Space Grotesk), system-ui, sans-serif' }}>
              {card.grade}
            </span>
          </div>
        </div>

        {/* Verdict pill */}
        <p className={cn(
          'mt-2.5 text-[11px] font-medium leading-snug rounded-lg px-2.5 py-1.5',
          isUnder ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300',
        )}>
          {card.verdict}
        </p>
      </div>

      {/* Sparkline */}
      <div className="px-4">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={sparkColor} stopOpacity="0.15" />
              <stop offset="100%" stopColor={sparkColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Area fill */}
          <path d={paths.area} fill={`url(#${areaId})`} />
          {/* Line — animated stroke-dashoffset on hover */}
          <path
            d={paths.line}
            fill="none"
            stroke={sparkColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLen}
            strokeDashoffset={hovered ? 0 : 0}
            style={{
              strokeDashoffset: hovered ? 0 : pathLen,
              transition: hovered
                ? 'stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)'
                : 'stroke-dashoffset 0.2s ease-in',
            }}
          />
        </svg>
      </div>

      {/* 52-week range bar */}
      <div className="px-4 pb-4">
        <PriceRangeBar low={card.low52} high={card.high52} current={card.price} />
      </div>
    </div>
  )
}

export default function StockCardStrip() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-14">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">Live analysis</p>
            <h2 className="text-2xl font-bold text-slate-100">Stocks investors are analyzing</h2>
          </div>
          <a
            href="/screener"
            className="text-sm font-semibold text-blue-400 hover:underline shrink-0 hidden sm:block"
          >
            View screener →
          </a>
        </div>

        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {CARDS.map((card, i) => (
              <StockCard key={card.ticker} card={card} index={i} visible={visible} />
            ))}
          </div>
        </div>

        {/* Mobile hint */}
        <p className="mt-3 text-center text-[11px] text-slate-400 sm:hidden">Scroll to see more →</p>
      </div>
    </section>
  )
}
