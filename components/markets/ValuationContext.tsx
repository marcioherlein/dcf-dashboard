'use client'
import { cn } from '@/lib/utils'
import type { MarketContextPayload } from '@/lib/market-context/types'

interface Props {
  valuation: MarketContextPayload['valuation']
}

function bandBarClass(b: { label: string; current?: boolean }): string {
  if (b.current) return 'bg-blue-600 text-white font-bold'
  if (b.label.startsWith('Cheap'))      return 'bg-emerald-50 text-emerald-700'
  if (b.label.startsWith('Fair'))       return 'bg-slate-100 text-slate-600'
  if (b.label.startsWith('Elevated'))   return 'bg-amber-50 text-amber-700'
  if (b.label.startsWith('Attractive')) return 'bg-emerald-50 text-emerald-700'
  if (b.label.startsWith('Compressed')) return 'bg-amber-50 text-amber-700'
  if (b.label.startsWith('Negative'))   return 'bg-red-50 text-red-600'
  return 'bg-red-50 text-red-600'
}

function erpLabel(erp: number | null): string {
  if (erp == null) return '—'
  const pct = erp * 100
  if (pct > 3.5) return 'Attractive'
  if (pct > 2)   return 'Fair'
  if (pct > 0)   return 'Compressed'
  return 'Negative'
}

function erpColor(erp: number | null): string {
  if (erp == null) return 'text-slate-500'
  const pct = erp * 100
  if (pct > 3.5) return 'text-emerald-700'
  if (pct > 2)   return 'text-slate-700'
  if (pct > 0)   return 'text-amber-700'
  return 'text-red-600'
}

export default function ValuationContext({ valuation }: Props) {
  const { spyForwardPE, erp, forwardPEBands, erpBands } = valuation

  return (
    <div className="rounded-xl glass-card-light overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Valuation Context</span>
      </div>
      <div className="px-5 py-4 space-y-4">

      {/* Forward P/E */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SPY Forward P/E</p>
          <p className="text-[14px] font-bold text-slate-900">
            {spyForwardPE != null ? `${spyForwardPE.toFixed(1)}×` : '—'}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {forwardPEBands.map((b, i) => (
            <div key={i} className={cn('rounded px-1 py-1.5 text-center text-[9px] leading-tight', bandBarClass(b))}>
              {b.label}
            </div>
          ))}
        </div>
      </div>

      {/* ERP */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Equity Risk Premium</p>
          <div className="text-right">
            <span className={cn('text-[14px] font-bold tabular-nums', erpColor(erp))}>
              {erp != null ? `${(erp * 100).toFixed(2)}%` : '—'}
            </span>
            {erp != null && (
              <span className={cn('text-xs ml-1.5 font-semibold', erpColor(erp))}>
                — {erpLabel(erp)}
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {erpBands.map((b, i) => (
            <div key={i} className={cn('rounded px-1 py-1.5 text-center text-[9px] leading-tight', bandBarClass(b))}>
              {b.label}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">ERP = 1 / Forward P/E − 10Y yield. Positive = stocks offer premium vs bonds.</p>
      </div>
      </div>
    </div>
  )
}
