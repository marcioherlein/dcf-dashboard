'use client'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import type { YieldCurvePoint } from '@/lib/data/fredClient'

function isInverted(curve: YieldCurvePoint[]): boolean {
  const two  = curve.find(p => p.tenor === '2Y')?.yield
  const ten  = curve.find(p => p.tenor === '10Y')?.yield
  return two != null && ten != null && two > ten
}

export default function BondYieldsCard({ yieldCurve }: { yieldCurve: YieldCurvePoint[] }) {
  const hasData = yieldCurve.some(p => p.yield != null)
  const inverted = isInverted(yieldCurve)
  const chartData = yieldCurve.filter(p => p.yield != null).map(p => ({ tenor: p.tenor, yield: p.yield }))

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Government Bonds</span>
        {hasData && (
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full',
            inverted ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
          )}>
            {inverted ? 'Inverted' : 'Normal Curve'}
          </span>
        )}
      </div>

      {/* Mini yield curve chart */}
      {hasData && (
        <div className="px-2 pt-2" style={{ height: 72 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={inverted ? '#ef4444' : '#3b82f6'} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={inverted ? '#ef4444' : '#3b82f6'} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <XAxis dataKey="tenor" tick={{ fontSize: 8, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow px-2 py-1 text-[10px]">
                      <span className="text-slate-500">{d.payload.tenor}: </span>
                      <span className="font-mono font-bold text-slate-900">{(d.value as number).toFixed(3)}%</span>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="yield"
                stroke={inverted ? '#ef4444' : '#3b82f6'}
                strokeWidth={1.5}
                fill="url(#yieldGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Yield table */}
      <div className="divide-y divide-slate-50">
        {yieldCurve.map(p => (
          <div key={p.tenor} className="px-3 py-1.5 flex items-center justify-between">
            <div>
              <span className="text-[12px] font-bold text-slate-800">US{p.tenor}</span>
              <span className="ml-2 text-[10px] text-slate-400">{p.label} Bond Yield</span>
            </div>
            <span className="text-[12px] font-mono font-semibold text-slate-700">
              {p.yield != null ? `${p.yield.toFixed(3)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
