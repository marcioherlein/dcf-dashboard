'use client'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'
import type { YieldCurvePoint } from '@/lib/data/fredClient'

function isInverted(curve: YieldCurvePoint[]): boolean {
  const two  = curve.find(p => p.tenor === '2Y')?.yield
  const ten  = curve.find(p => p.tenor === '10Y')?.yield
  return two != null && ten != null && two > ten
}

function getSpread(curve: YieldCurvePoint[]): number | null {
  const two = curve.find(p => p.tenor === '2Y')?.yield
  const ten = curve.find(p => p.tenor === '10Y')?.yield
  if (two == null || ten == null) return null
  return +(ten - two).toFixed(3)
}

export default function BondYieldsCard({ yieldCurve }: { yieldCurve: YieldCurvePoint[] }) {
  const hasData = yieldCurve.some(p => p.yield != null)
  const inverted = isInverted(yieldCurve)
  const spread = getSpread(yieldCurve)
  const chartData = yieldCurve.filter(p => p.yield != null).map(p => ({ tenor: p.tenor, yield: p.yield }))
  const spreadColor = spread == null ? 'text-[#6B6B6B]' : spread >= 0.5 ? 'text-[#11875D]' : spread >= 0 ? 'text-[#B56A00]' : 'text-[#D83B3B]'

  return (
    <div className="rounded-xl glass-card-light">
      <div className="px-3 py-2 border-b border-[#E5E5E5] flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#6B6B6B]">Government Bonds</span>
        <div className="flex items-center gap-2">
          {spread != null && (
            <span className={cn('text-[10px] font-mono font-bold', spreadColor)}>
              10Y−2Y: {spread >= 0 ? '+' : ''}{spread.toFixed(2)}%
            </span>
          )}
          {hasData && (
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full',
              inverted ? 'bg-[#FCEAEA] text-[#D83B3B]' : 'bg-[#E8F7EF] text-[#11875D]'
            )}>
              {inverted ? 'Inverted' : 'Normal'}
            </span>
          )}
        </div>
      </div>

      {/* Mini yield curve chart */}
      {hasData && (
        <div className="px-2 pt-2 h-[72px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="yieldGradLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={inverted ? '#ef4444' : '#3b82f6'} stopOpacity={0.12} />
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
                    <div className="bg-white/95 border border-[#E5E5E5] rounded-lg shadow-sm px-2 py-1 text-[10px]">
                      <span className="text-[#6B6B6B]">{d.payload.tenor}: </span>
                      <span className="font-mono font-bold text-[#111111]">{(d.value as number).toFixed(3)}%</span>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="yield"
                stroke={inverted ? '#ef4444' : '#3b82f6'}
                strokeWidth={1.5}
                fill="url(#yieldGradLight)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Yield table */}
      <div className="divide-y divide-[#E3E1DA]">
        {yieldCurve.map(p => (
          <div key={p.tenor} className="px-3 py-1.5 flex items-center justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#111111]">US{p.tenor}</span>
              <span className="ml-2 text-[10px] text-[#6B6B6B]">{p.label} Bond Yield</span>
            </div>
            <span className="text-[12px] font-mono font-semibold text-[#6B6B6B]">
              {p.yield != null ? `${p.yield.toFixed(3)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
