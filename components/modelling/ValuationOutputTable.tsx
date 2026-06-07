'use client'

import { fmtM, fmtPrice, fmtPct } from '@/lib/valuation/formatValuation'
import { NABadge } from '@/components/ui/na-badge'

interface ValuationOutputTableProps {
  // UFCF path
  ufcfEV: number | null
  ufcfEquityValue: number | null
  ufcfFairValue: number | null
  ufcfUpside: number | null
  // LFCF path
  lfcfEquityValue: number | null
  lfcfFairValue: number | null
  lfcfUpside: number | null
  // Bridge components
  cashM: number | null
  debtM: number | null
  sharesM: number | null
  currentPrice: number
  currency: string
  isFinancialSector?: boolean
  financialCurrencyNote?: string | null
}

function Row({ label, value, bold, highlight }: { label: string; value: React.ReactNode; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 text-xs border-b border-white/8 last:border-0 ${highlight ? 'bg-[#EAF1FF]0/10 -mx-4 px-4' : ''}`}>
      <span className={bold ? 'font-semibold text-[#E3E1DA]' : 'text-[#8A95A6]'}>{label}</span>
      <span className={`font-mono ${bold ? 'font-semibold text-[#E3E1DA]' : 'text-[#CDD1C8]'}`}>{value}</span>
    </div>
  )
}

function UpsideChip({ upside }: { upside: number | null }) {
  if (upside == null) return <NABadge reason="calc-error" />
  const positive = upside >= 0
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${positive ? 'bg-[#E8F7EF] text-[#11875D]' : 'bg-[#FCEAEA] text-[#D83B3B]'}`}>
      {positive ? '+' : ''}{(upside * 100).toFixed(1)}%
    </span>
  )
}

export default function ValuationOutputTable({
  ufcfEV, ufcfEquityValue, ufcfFairValue, ufcfUpside,
  lfcfEquityValue, lfcfFairValue, lfcfUpside,
  cashM, debtM, sharesM, currentPrice,
  currency, isFinancialSector, financialCurrencyNote,
}: ValuationOutputTableProps) {
  const curr = currency === 'USD' ? '$' : currency + ' '

  return (
    <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 bg-white/5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8A95A6]">Valuation Output</h3>
      </div>

      <div className="grid grid-cols-2 divide-x divide-[#E3E1DA]">
        {/* UFCF column */}
        <div className={`px-4 py-4 ${isFinancialSector ? 'opacity-50' : ''}`}>
          <p className="text-[11px] font-semibold text-[#8A95A6] mb-2 uppercase tracking-wide">
            Unlevered DCF {isFinancialSector && <span className="ml-1 text-[#B56A00] normal-case">(not reliable)</span>}
          </p>
          <Row label="Enterprise Value" value={`${curr}${fmtM(ufcfEV)}`} />
          <Row label="+ Net Cash" value={`${curr}${fmtM(cashM ? cashM - (debtM ?? 0) : null)}`} />
          <Row label="= Equity Value" value={`${curr}${fmtM(ufcfEquityValue)}`} bold />
          <Row label="÷ Shares" value={sharesM != null ? `${(sharesM / 1000).toFixed(0)}B` : <NABadge reason="no-data" />} />
          {financialCurrencyNote ? (
            <div className="mt-2 text-[11px] text-[#B56A00] bg-[#FFF4DA] rounded px-2 py-1.5">FX adjusted — see main DCF</div>
          ) : (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#CDD1C8]">Fair Value</span>
              <span className="font-mono font-bold text-base text-[#E3E1DA]">{`${curr}${fmtPrice(ufcfFairValue, '')}`}</span>
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-[#8A95A6]">vs {curr}{currentPrice.toFixed(2)}</span>
            <UpsideChip upside={ufcfUpside} />
          </div>
        </div>

        {/* LFCF column */}
        <div className="px-4 py-4">
          <p className="text-[11px] font-semibold text-[#8A95A6] mb-2 uppercase tracking-wide">
            Levered DCF {isFinancialSector && <span className="ml-1 text-[#2563EB] normal-case">(primary)</span>}
          </p>
          <Row label="Equity Value (PV)" value={`${curr}${fmtM(lfcfEquityValue)}`} bold />
          <Row label="÷ Shares" value={sharesM != null ? `${(sharesM / 1000).toFixed(0)}B` : <NABadge reason="no-data" />} />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#CDD1C8]">Fair Value</span>
            <span className="font-mono font-bold text-base text-[#E3E1DA]">
              {financialCurrencyNote ? <NABadge reason="not-applicable" /> : `${curr}${fmtPrice(lfcfFairValue, '')}`}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="text-[#8A95A6]">vs {curr}{currentPrice.toFixed(2)}</span>
            <UpsideChip upside={lfcfUpside} />
          </div>
        </div>
      </div>

      <div className="px-5 py-2.5 border-t border-white/8 bg-white/5 text-[11px] text-[#8A95A6]">
        {fmtPct(ufcfUpside, true)} UFCF · {fmtPct(lfcfUpside, true)} LFCF vs current price of {curr}{currentPrice.toFixed(2)}
      </div>
    </div>
  )
}
