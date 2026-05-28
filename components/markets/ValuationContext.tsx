'use client'
import { cn } from '@/lib/utils'
import type { MarketContextPayload } from '@/lib/market-context/types'

interface Props {
  valuation: MarketContextPayload['valuation']
}

function bandBarClass(b: { label: string; current?: boolean }): string {
  if (b.current) return 'bg-blue-600 text-white font-bold ring-2 ring-blue-300'
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

function peTakeaway(bands: { label: string; current?: boolean }[]): string {
  const idx = bands.findIndex(b => b.current)
  if (idx < 0) return 'Valuation context unavailable.'
  const label = bands[idx].label
  if (label.startsWith('Cheap'))    return 'Market is trading below historical norms — a tailwind for DCF upside.'
  if (label.startsWith('Fair'))     return 'Market P/E is near fair value. Moderate margin of safety is appropriate.'
  if (label.startsWith('Elevated')) return 'Elevated valuations leave less room for error in growth assumptions.'
  return 'Stretched multiples — tighten growth and margin assumptions in DCF models.'
}

function erpTakeaway(erp: number | null): string {
  if (erp == null) return ''
  const pct = erp * 100
  if (pct > 3.5) return 'Stocks offer a meaningful premium vs bonds — supportive for equity risk.'
  if (pct > 2)   return 'Equity risk premium is fair. Bonds provide modest competition for capital.'
  if (pct > 0)   return 'Compressed risk premium — equities offer little buffer over bonds.'
  return 'Negative ERP: bonds now yield more than equities on a forward basis.'
}

export default function ValuationContext({ valuation }: Props) {
  const { spyForwardPE, erp, forwardPEBands, erpBands } = valuation

  const peIdx      = forwardPEBands.findIndex(b => b.current)
  const peN        = forwardPEBands.length
  const peMarker   = peIdx >= 0 ? ((peIdx + 0.5) / peN) * 100 : null

  const erpIdx     = erpBands.findIndex(b => b.current)
  const erpN       = erpBands.length
  const erpMarker  = erpIdx >= 0 ? ((erpIdx + 0.5) / erpN) * 100 : null

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Valuation Context</span>
      </div>
      <div className="px-5 py-4 space-y-5">

        {/* Forward P/E */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SPY Forward P/E</p>
            <p className={cn('text-[14px] font-bold', spyForwardPE != null ? 'text-slate-900' : 'text-slate-400')}>
              {spyForwardPE != null ? `${spyForwardPE.toFixed(1)}×` : '—'}
            </p>
          </div>
          {spyForwardPE == null && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 mb-2 flex items-start gap-2">
              <span className="text-[10px] text-slate-400 leading-snug">
                Live forward P/E data unavailable. Showing historical band thresholds for reference.
              </span>
            </div>
          )}
          <div className="relative mt-4 mb-2">
            {peMarker != null && (
              <div
                className="absolute -top-3.5 flex justify-center"
                style={{ left: `calc(${peMarker}% - 6px)` }}
              >
                <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
              </div>
            )}
            <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-1', spyForwardPE == null && 'opacity-50')}>
              {forwardPEBands.map((b, i) => (
                <div key={i} className={cn('rounded px-1 py-1.5 text-center text-[9px] leading-tight', bandBarClass(b))}>
                  {b.label}
                </div>
              ))}
            </div>
          </div>
          {spyForwardPE != null && (
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <p className="text-[10px] text-slate-600 leading-snug">{peTakeaway(forwardPEBands)}</p>
            </div>
          )}
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
          {erp == null && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 mb-2">
              <span className="text-[10px] text-slate-400 leading-snug">
                ERP requires live forward P/E. Showing band thresholds for reference.
              </span>
            </div>
          )}
          <div className="relative mt-4 mb-2">
            {erpMarker != null && (
              <div
                className="absolute -top-3.5 flex justify-center"
                style={{ left: `calc(${erpMarker}% - 6px)` }}
              >
                <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
              </div>
            )}
            <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-1', erp == null && 'opacity-50')}>
              {erpBands.map((b, i) => (
                <div key={i} className={cn('rounded px-1 py-1.5 text-center text-[9px] leading-tight', bandBarClass(b))}>
                  {b.label}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">ERP = 1 / Forward P/E − 10Y yield. Positive = stocks offer premium vs bonds.</p>
          {erp != null && (
            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <p className="text-[10px] text-slate-600 leading-snug">{erpTakeaway(erp)}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
