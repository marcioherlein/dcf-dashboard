'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { cn } from '@/lib/utils'
import type { SectorBar } from '@/lib/market-context/types'

interface Props {
  sectors: SectorBar[]
}

function barColor(tone: SectorBar['tone']): string {
  if (tone === 'positive') return '#10b981'
  if (tone === 'negative') return '#ef4444'
  return '#94a3b8'
}

export default function SectorRotation({ sectors }: Props) {
  const data = sectors.map(s => ({
    sector: s.sector,
    momentum: +(s.momentum * 100).toFixed(2),
    tone: s.tone,
    raw: s.momentum,
  }))

  const sorted = [...data].sort((a, b) => b.momentum - a.momentum)
  const top3    = sorted.slice(0, 3)
  const bottom3 = sorted.slice(-3).reverse()

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
      <div className="px-4 py-2.5 border-b border-slate-100">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sector Rotation</span>
        <p className="text-[10px] text-slate-400 mt-0.5">Relative strength score vs S&P 500 — last 40 trading days</p>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4">
        {/* Chart */}
        <div style={{ height: 'clamp(180px, 28vw, 220px)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 4, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="sector" tick={{ fontSize: 10, fill: '#475569' }} width={90} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => [`${(v as number).toFixed(2)}`, 'RS Score']}
                labelStyle={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}
                contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              />
              <ReferenceLine x={0} stroke="#e2e8f0" strokeWidth={1} />
              <Bar dataKey="momentum" radius={[0, 3, 3, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={barColor(entry.tone)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leaders / Laggards */}
        <div className="xl:w-36 flex xl:flex-col gap-3">
          <div className="flex-1 xl:flex-none">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 mb-1.5">Top Leaders</p>
            <div className="space-y-1">
              {top3.map((d, i) => (
                <div key={d.sector} className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-emerald-600 w-3 shrink-0">{i + 1}</span>
                  <span className={cn(
                    'text-[10px] font-semibold truncate flex-1',
                    d.tone === 'positive' ? 'text-emerald-700' : 'text-slate-500'
                  )}>{d.sector}</span>
                  <span className="text-[9px] font-bold tabular-nums text-emerald-600 shrink-0">
                    +{d.momentum.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 xl:flex-none">
            <p className="text-[9px] font-bold uppercase tracking-wider text-red-500 mb-1.5">Top Laggards</p>
            <div className="space-y-1">
              {bottom3.map((d, i) => (
                <div key={d.sector} className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-red-400 w-3 shrink-0">{i + 1}</span>
                  <span className={cn(
                    'text-[10px] font-semibold truncate flex-1',
                    d.tone === 'negative' ? 'text-red-700' : 'text-slate-500'
                  )}>{d.sector}</span>
                  <span className="text-[9px] font-bold tabular-nums text-red-500 shrink-0">
                    {d.momentum.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 border-t border-slate-50 pt-2">
        <p className="text-[9px] text-slate-400">RS score = relative outperformance ratio vs S&P 500. Not a % return.</p>
      </div>
    </div>
  )
}
