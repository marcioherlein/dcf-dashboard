'use client'

import { cn } from '@/lib/utils'
import { Target } from 'lucide-react'

interface Props {
  high52: number
  low52: number
  price: number
  currency?: string
}

function fmtP(v: number, currency = 'USD') {
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  if (Math.abs(v) >= 1000) return sym + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return sym + v.toFixed(2)
}

export default function TradingRangeCard({ high52, low52, price, currency = 'USD' }: Props) {
  const range = high52 - low52
  const pct = range > 0 ? Math.max(0, Math.min(100, ((price - low52) / range) * 100)) : 50
  const isValid = isFinite(high52) && isFinite(low52) && high52 > 0 && low52 > 0 && high52 >= low52

  return (
    <div
      className="bg-white rounded-2xl p-5"
      style={{
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-[#F1F7E5] flex items-center justify-center shrink-0">
          <Target size={14} className="text-[#5F790B]" />
        </div>
        <h3 className="text-[15px] font-[700] text-[#111827]">Trading Range (52-Week)</h3>
      </div>

      {!isValid ? (
        <p className="text-[13px] text-[#667085] text-center py-2">Range data unavailable</p>
      ) : (
        <>
          {/* Low / High labels */}
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[12px] font-[700] text-[#111827] tabular-nums">{fmtP(low52, currency)}</p>
              <p className="text-[11px] text-[#9B9B9B]">52-Week Low</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-[700] text-[#111827] tabular-nums">{fmtP(high52, currency)}</p>
              <p className="text-[11px] text-[#9B9B9B]">52-Week High</p>
            </div>
          </div>

          {/* Track + marker */}
          <div className="relative h-[8px] rounded-full mx-1" style={{ background: '#e8ebe3' }}>
            {/* Filled portion */}
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ width: `${pct}%`, background: '#5F790B' }}
            />
            {/* Current price circle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-[3px] border-[#5F790B] shadow-sm"
              style={{ left: `${pct}%` }}
            />
          </div>

          {/* Current price label */}
          <div className="mt-3 flex justify-center">
            <div className="text-center">
              <p className={cn('text-[18px] font-[800] tabular-nums tracking-tight', 'text-[#5F790B]')}>
                {fmtP(price, currency)}
              </p>
              <p className="text-[11px] text-[#9B9B9B]">Current</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
