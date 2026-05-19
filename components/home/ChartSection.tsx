'use client'
import { useEffect, useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart, Cell,
} from 'recharts'

const REVENUE_DATA = [
  { year: '2020', revenue: 10.4, type: 'actual' },
  { year: '2021', revenue: 16.7, type: 'actual' },
  { year: '2022', revenue: 26.9, type: 'actual' },
  { year: '2023', revenue: 44.9, type: 'actual' },
  { year: '2024', revenue: 61.0, type: 'actual' },
  { year: '2025E', revenue: 84.5, type: 'projected' },
  { year: '2026E', revenue: 109.2, type: 'projected' },
  { year: '2027E', revenue: 138.0, type: 'projected' },
]

const FAIR_VALUE_DATA = [
  { month: 'Jan', price: 78, fair: 112 },
  { month: 'Feb', price: 85, fair: 115 },
  { month: 'Mar', price: 98, fair: 119 },
  { month: 'Apr', price: 105, fair: 122 },
  { month: 'May', price: 118, fair: 126 },
  { month: 'Jun', price: 124, fair: 130 },
  { month: 'Jul', price: 132, fair: 134 },
  { month: 'Aug', price: 143, fair: 138 },
  { month: 'Sep', price: 156, fair: 142 },
  { month: 'Oct', price: 148, fair: 146 },
  { month: 'Nov', price: 159, fair: 151 },
  { month: 'Dec', price: 163, fair: 156 },
]

const HEALTH_BARS = [
  { label: 'Profitability', score: 92, color: '#0B7A5E' },
  { label: 'Liquidity',     score: 78, color: '#4a9eff' },
  { label: 'Growth',        score: 88, color: '#0F2A5E' },
  { label: 'Moat',          score: 85, color: '#C9A84C' },
  { label: 'Valuation',     score: 61, color: '#d4a017' },
]

function RevenueChart({ animate }: { animate: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Revenue growth</p>
      <h3 className="text-base font-bold text-white mb-4">Actual vs. projected revenue</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={REVENUE_DATA} barSize={22} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#222" />
          <XAxis dataKey="year" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}B`} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#e2e2e2' }}
            formatter={(v) => [`$${v}B`, 'Revenue']}
          />
          <Bar
            dataKey="revenue"
            radius={[4, 4, 0, 0]}
            isAnimationActive={animate}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {REVENUE_DATA.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.type === 'projected' ? '#1e3a6e' : '#0F2A5E'}
                opacity={entry.type === 'projected' ? 0.75 : 1}
              />
            ))}
          </Bar>
          <ReferenceLine x="2025E" stroke="#4a9eff" strokeDasharray="3 3" strokeOpacity={0.5} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-slate-500">
        <span className="inline-block w-2 h-2 rounded-sm bg-[#0F2A5E] mr-1.5 align-middle" />Actual
        <span className="inline-block w-2 h-2 rounded-sm bg-[#1e3a6e] ml-3 mr-1.5 align-middle opacity-75" />Projected
      </p>
    </div>
  )
}

function FairValueChart({ animate }: { animate: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Valuation model</p>
      <h3 className="text-base font-bold text-white mb-4">Market price vs. fair value</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={FAIR_VALUE_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradFair" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0B7A5E" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#0B7A5E" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4a9eff" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#4a9eff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#222" />
          <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#e2e2e2' }}
          />
          <Area
            type="monotone"
            dataKey="fair"
            stroke="#0B7A5E"
            strokeWidth={2}
            fill="url(#gradFair)"
            name="Fair Value"
            isAnimationActive={animate}
            animationDuration={900}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#4a9eff"
            strokeWidth={2}
            fill="url(#gradPrice)"
            name="Market Price"
            isAnimationActive={animate}
            animationDuration={900}
            animationBegin={150}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-slate-500">
        <span className="inline-block w-2 h-2 rounded-sm bg-[#0B7A5E] mr-1.5 align-middle" />Fair Value
        <span className="inline-block w-2 h-2 rounded-sm bg-[#4a9eff] ml-3 mr-1.5 align-middle" />Market Price
      </p>
    </div>
  )
}

function HealthScoreChart({ animate }: { animate: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Business health</p>
      <h3 className="text-base font-bold text-white mb-4">Score breakdown</h3>
      <div className="space-y-3">
        {HEALTH_BARS.map((item, i) => (
          <div key={item.label}>
            <div className="flex justify-between mb-1">
              <span className="text-[11px] text-slate-400">{item.label}</span>
              <span className="text-[11px] font-mono font-semibold text-slate-300">{item.score}</span>
            </div>
            <div className="h-2 rounded-full bg-[#222]">
              <div
                className="h-2 rounded-full transition-all ease-out"
                style={{
                  width: animate ? `${item.score}%` : '0%',
                  background: item.color,
                  transitionDuration: '700ms',
                  transitionDelay: `${i * 100}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl bg-[#1a1a1a] border border-[#222] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <span className="text-lg font-extrabold text-white leading-none" style={{ fontFamily: 'Manrope, system-ui' }}>A</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-white">NVDA · Overall Grade</p>
            <p className="text-[11px] text-slate-400">Excellent — all key metrics above threshold</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChartSection() {
  const ref = useRef<HTMLDivElement>(null)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setAnimate(true); obs.disconnect() } },
      { threshold: 0.2 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      className="py-20"
      style={{ background: '#0a0a0a' }}
    >
      <div className="max-w-7xl mx-auto px-4">

        {/* Headline */}
        <div className="text-center mb-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Under the hood
          </p>
          <h2 className="text-3xl font-bold text-white">
            Built on real financial data
          </h2>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
            Every grade is backed by quantitative models — revenue growth, fair value discounting,
            liquidity ratios. No black boxes.
          </p>
        </div>

        {/* Chart grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="rounded-2xl bg-[#111] border border-[#222] p-6">
            <RevenueChart animate={animate} />
          </div>

          <div className="rounded-2xl bg-[#111] border border-[#222] p-6">
            <FairValueChart animate={animate} />
          </div>

          <div className="rounded-2xl bg-[#111] border border-[#222] p-6">
            <HealthScoreChart animate={animate} />
          </div>

        </div>

        {/* Bottom stat row */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: '50,000+', label: 'stocks analyzed' },
            { value: '15 years', label: 'historical data' },
            { value: '6 metrics', label: 'per rating' },
            { value: '3 markets', label: 'US · BR · UK' },
          ].map(stat => (
            <div key={stat.label} className="text-center rounded-xl bg-[#111] border border-[#222] py-4 px-3">
              <p className="text-xl font-bold text-white font-mono">{stat.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
