'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import type { SectorBar } from '@/lib/market-context/types'

interface Props {
  sectors: SectorBar[]
}

function barColor(tone: SectorBar['tone']): string {
  if (tone === 'positive') return '#10b981'
  if (tone === 'negative') return '#ef4444'
  return '#94a3b8'
}

function trendLabel(momentum: number): { text: string; cls: string } {
  if (momentum > 0.05)  return { text: '↑ Leader',    cls: 'text-emerald-700 font-bold' }
  if (momentum > 0.01)  return { text: '↑ Improving', cls: 'text-emerald-600' }
  if (momentum < -0.05) return { text: '↓ Lagging',   cls: 'text-red-700 font-bold' }
  if (momentum < -0.01) return { text: '↓ Weakening', cls: 'text-red-500' }
  return { text: '→ Neutral', cls: 'text-slate-500' }
}

export default function SectorRotation({ sectors }: Props) {
  const data = sectors.map(s => ({
    sector: s.sector,
    momentum: +(s.momentum * 100).toFixed(2),
    tone: s.tone,
    raw: s.momentum,
  }))

  return (
    <div className="rounded-xl glass-card-light overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sector Rotation</span>
        <p className="text-[10px] text-slate-400 mt-0.5">RS momentum vs S&P 500 — last 40 trading days</p>
      </div>
      <div className="px-5 py-4">
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 4, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="sector" tick={{ fontSize: 11, fill: '#475569' }} width={90} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v) => [`${(v as number).toFixed(2)}%`, 'RS Momentum']}
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
      {/* Trend legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {data.map((d, i) => {
          const trend = trendLabel(d.raw)
          return (
            <div key={i} className="flex items-center justify-between">
              <span className="text-[10px] text-slate-500 truncate">{d.sector}</span>
              <span className={`text-[9.5px] ${trend.cls} shrink-0 ml-1`}>{trend.text}</span>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}
