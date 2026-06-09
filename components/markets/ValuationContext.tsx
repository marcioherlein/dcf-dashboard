'use client'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'
import type { MarketContextPayload } from '@/lib/market-context/types'

interface Props {
  valuation: MarketContextPayload['valuation']
}

function bandBarClass(b: { label: string; current?: boolean }): string {
  if (b.current) return 'bg-olive-700 text-white font-bold ring-2 ring-olive-700/30'
  if (b.label.startsWith('Cheap'))      return 'bg-[#E8F7EF] text-[#11875D]'
  if (b.label.startsWith('Fair'))       return 'bg-[#E3E1DA] text-[#6B6B6B]'
  if (b.label.startsWith('Elevated'))   return 'bg-[#FFF4DA] text-[#B56A00]'
  if (b.label.startsWith('Attractive')) return 'bg-[#E8F7EF] text-[#11875D]'
  if (b.label.startsWith('Compressed')) return 'bg-[#FFF4DA] text-[#B56A00]'
  if (b.label.startsWith('Negative'))   return 'bg-[#FCEAEA] text-[#D83B3B]'
  return 'bg-[#FCEAEA] text-[#D83B3B]'
}

function erpLabel(erp: number | null): string {
  if (erp == null) return '—'
  const pct = erp * 100
  if (pct > 3.5) return 'Attractive (>3.5%)'
  if (pct > 2)   return 'Fair (2–3.5%)'
  if (pct > 0)   return 'Compressed (0–2%)'
  return 'Negative (<0%)'
}

function erpColor(erp: number | null): string {
  if (erp == null) return 'text-[#6B6B6B]'
  const pct = erp * 100
  if (pct > 3.5) return 'text-[#11875D]'
  if (pct > 2)   return 'text-[#11875D]'
  if (pct > 0)   return 'text-[#B56A00]'
  return 'text-[#D83B3B]'
}

function peLabel(spyForwardPE: number | null, bands: { label: string; current?: boolean }[]): string {
  if (spyForwardPE == null) return ''
  const band = bands.find(b => b.current)
  if (!band) return ''
  if (band.label.startsWith('Cheap'))    return 'Cheap'
  if (band.label.startsWith('Fair'))     return 'Fair value'
  if (band.label.startsWith('Elevated')) return 'Elevated'
  return 'Expensive'
}

function computeTakeaway(spyForwardPE: number | null, erp: number | null): string | null {
  if (spyForwardPE == null) return null
  const erpPct = erp != null ? erp * 100 : null
  const elevated = spyForwardPE >= 18
  const erpAttr  = erpPct != null && erpPct > 3.5
  const erpFair  = erpPct != null && erpPct > 2 && erpPct <= 3.5
  const erpComp  = erpPct != null && erpPct <= 2

  if (elevated && erpAttr)  return 'Valuations are above average, but the equity risk premium remains attractive. This supports selectivity and demands a healthy margin of safety.'
  if (elevated && erpFair)  return 'Elevated P/E with a fair risk premium — tighten your DCF assumptions and require a wider margin of safety on new positions.'
  if (elevated && erpComp)  return 'Stretched multiples and compressed equity risk premium leave little buffer. Apply conservative growth and terminal value assumptions.'
  if (!elevated && erpAttr) return 'Fair valuation with an attractive risk premium vs bonds — a constructive setup for long-term equity investors.'
  if (!elevated && erpFair) return 'Market is fairly valued. Use long-run average assumptions in your DCF models.'
  return 'Monitor evolving risk premium vs current multiples before deploying capital.'
}

export default function ValuationContext({ valuation }: Props) {
  const { spyForwardPE, erp, forwardPEBands, erpBands } = valuation

  const peIdx     = forwardPEBands.findIndex(b => b.current)
  const peN       = forwardPEBands.length
  const peMarker  = peIdx >= 0 ? ((peIdx + 0.5) / peN) * 100 : null

  const erpIdx    = erpBands.findIndex(b => b.current)
  const erpN      = erpBands.length
  const erpMarker = erpIdx >= 0 ? ((erpIdx + 0.5) / erpN) * 100 : null

  const takeaway  = computeTakeaway(spyForwardPE, erp)

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E5E5E5]">
        <span className="text-[10px] font-bold text-[#6B6B6B]">Valuation Context</span>
        <p className="text-[10px] text-[#6B6B6B] mt-0.5">How current market prices compare to historical ranges — and what it means for your DCF.</p>
      </div>

      {/* Two panels side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#E3E1DA]">

        {/* P/E Panel */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-bold text-[#6B6B6B] mb-2">SPY Forward P/E</p>
          {spyForwardPE != null ? (
            <>
              <p className="text-[26px] font-bold tabular-nums text-[#11875D] leading-none">{spyForwardPE.toFixed(1)}×</p>
              <p className="text-[11px] text-[#6B6B6B] mt-1">{peLabel(spyForwardPE, forwardPEBands)}</p>
              <div className="relative mt-4 mb-1">
                {peMarker != null && (
                  <div className="absolute -top-3 flex justify-center" style={{ left: `calc(${peMarker}% - 5px)` }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-olive-700 border-2 border-white shadow" />
                  </div>
                )}
                <div className="grid grid-cols-4 gap-0.5">
                  {forwardPEBands.map((b, i) => (
                    <div key={i} className={cn(
                      'py-1.5 text-center text-[8px] leading-tight rounded',
                      bandBarClass(b)
                    )}>
                      {b.label}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-[#6B6B6B] mt-2">10Y range: 11.3× – 26.4×</p>
            </>
          ) : (
            <>
              <p className="text-[26px] font-bold text-[#6B6B6B] leading-none">—</p>
              <div className="rounded-lg bg-[#F5F5F5] border border-[#E5E5E5] px-3 py-2 mt-3">
                <p className="text-[10px] text-[#6B6B6B] leading-snug">Live forward P/E data unavailable. Showing historical band thresholds for reference.</p>
              </div>
              <div className="grid grid-cols-4 gap-0.5 mt-3 opacity-40">
                {forwardPEBands.map((b, i) => (
                  <div key={i} className={cn('py-1.5 text-center text-[8px] leading-tight rounded', bandBarClass(b))}>
                    {b.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ERP Panel */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-bold text-[#6B6B6B] mb-2">Equity Risk Premium</p>
          {erp != null ? (
            <>
              <p className={cn('text-[26px] font-bold tabular-nums leading-none', erpColor(erp))}>
                {(erp * 100).toFixed(2)}%
              </p>
              <p className="text-[11px] text-[#6B6B6B] mt-1">{erpLabel(erp)}</p>
              <div className="relative mt-4 mb-1">
                {erpMarker != null && (
                  <div className="absolute -top-3 flex justify-center" style={{ left: `calc(${erpMarker}% - 5px)` }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-olive-700 border-2 border-white shadow" />
                  </div>
                )}
                <div className="grid grid-cols-4 gap-0.5">
                  {erpBands.map((b, i) => (
                    <div key={i} className={cn(
                      'py-1.5 text-center text-[8px] leading-tight rounded',
                      bandBarClass(b)
                    )}>
                      {b.label}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-[#6B6B6B] mt-2">ERP = 1 / Forward P/E − 10Y yield. Positive = stocks offer premium vs bonds.</p>
            </>
          ) : (
            <>
              <p className="text-[26px] font-bold text-[#6B6B6B] leading-none">—</p>
              <div className="rounded-lg bg-[#F5F5F5] border border-[#E5E5E5] px-3 py-2 mt-3">
                <p className="text-[10px] text-[#6B6B6B] leading-snug">ERP requires live forward P/E. Showing band thresholds for reference.</p>
              </div>
              <div className="grid grid-cols-4 gap-0.5 mt-3 opacity-40">
                {erpBands.map((b, i) => (
                  <div key={i} className={cn('py-1.5 text-center text-[8px] leading-tight rounded', bandBarClass(b))}>
                    {b.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Combined takeaway */}
      {takeaway && (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl bg-[#EAF1FF] border border-[#93B4F5] px-4 py-3">
          <Info size={13} className="text-[#2563EB] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#2563EB] leading-snug">
            <span className="font-bold">Takeaway:</span> {takeaway}
          </p>
        </div>
      )}
    </div>
  )
}
