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

export default function SectorRotation({ sectors }: Props) {
  const data = sectors.map(s => ({
    sector: s.sector,
    momentum: +(s.momentum * 100).toFixed(2),
    tone: s.tone,
  }))

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-slate-900">Sector Rotation</h2>
        <p className="text-[10px] text-slate-400 mt-0.5">RS momentum vs S&P 500 — last 40 trading days</p>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, left: 4, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${v}%`} />
            <YAxis type="category" dataKey="sector" tick={{ fontSize: 11 }} width={90} />
            <Tooltip
              formatter={(v) => [`${(v as number).toFixed(2)}%`, 'RS Momentum']}
              labelStyle={{ fontSize: 12, fontWeight: 600 }}
            />
            <ReferenceLine x={0} stroke="#e2e8f0" />
            <Bar dataKey="momentum" radius={[0, 3, 3, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={barColor(entry.tone)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
