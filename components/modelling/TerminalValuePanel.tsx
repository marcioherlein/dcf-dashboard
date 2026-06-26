'use client'

import { fmtM } from '@/lib/valuation/formatValuation'

interface TerminalValuePanelProps {
  perpetuityTV: number | null
  perpetuityTVDiscounted: number | null
  exitMultipleTV: number | null
  exitMultipleTVDiscounted: number | null
  primaryMethod: 'perpetuity' | 'exitMultiple'
  perpetuityResidualPct: number | null
  exitMultipleResidualPct: number | null
  guardError: string | null
  terminalG: number
  wacc: number
  exitMultiple: number
  currency: string
}

export default function TerminalValuePanel({
  perpetuityTV, perpetuityTVDiscounted,
  exitMultipleTV, exitMultipleTVDiscounted,
  primaryMethod,
  perpetuityResidualPct, exitMultipleResidualPct,
  guardError,
  terminalG, wacc, exitMultiple, currency,
}: TerminalValuePanelProps) {
  return (
    <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 bg-white/5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#566174]">Terminal Value</h3>
        <p className="mt-0.5 text-[11px] text-[#8A95A6]">Both methods computed — primary is highlighted</p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-[#E3E1DA]">
        {/* Perpetuity Growth */}
        <div className={`px-5 py-4 ${primaryMethod === 'perpetuity' ? 'bg-[#EAF1FF]/10' : 'bg-white/5'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#CDD1C8]">Perpetuity Growth</span>
            {primaryMethod === 'perpetuity' && (
              <span className="rounded-full bg-[#EAF1FF] px-2 py-0.5 text-[10px] font-medium text-[#2563EB]">Primary</span>
            )}
          </div>
          <div className="text-[11px] text-[#566174] mb-3">
            FCF × (1+g) / (WACC−g) &nbsp;·&nbsp; g={( terminalG * 100).toFixed(1)}%
          </div>
          {guardError ? (
            <div className="text-xs text-[#D83B3B] font-medium">{guardError}</div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#566174]">Terminal Value</span>
                <span className="font-mono font-semibold text-[#E3E1DA]">{currency}{fmtM(perpetuityTV)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#566174]">PV (discounted)</span>
                <span className={`font-mono font-semibold ${primaryMethod === 'perpetuity' ? 'text-[#2563EB]' : 'text-[#E3E1DA]'}`}>
                  {currency}{fmtM(perpetuityTVDiscounted)}
                </span>
              </div>
              {perpetuityResidualPct != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#8A95A6]">% of EV</span>
                  <span className={`font-mono text-[11px] ${perpetuityResidualPct > 0.75 ? 'text-amber-400 font-semibold' : 'text-[#566174]'}`}>
                    {(perpetuityResidualPct * 100).toFixed(0)}%
                    {perpetuityResidualPct > 0.75 && <span className="ml-1 text-[10px]">⚠ high</span>}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Exit Multiple */}
        <div className={`px-5 py-4 ${primaryMethod === 'exitMultiple' ? 'bg-[#EAF1FF]/10' : 'bg-white/5'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#CDD1C8]">Exit Multiple</span>
            {primaryMethod === 'exitMultiple' && (
              <span className="rounded-full bg-[#EAF1FF] px-2 py-0.5 text-[10px] font-medium text-[#2563EB]">Primary</span>
            )}
          </div>
          <div className="text-[11px] text-[#566174] mb-3">
            FCF × {exitMultiple.toFixed(1)}x &nbsp;·&nbsp; WACC={( wacc * 100).toFixed(1)}%
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[#566174]">Terminal Value</span>
              <span className="font-mono font-semibold text-[#E3E1DA]">{currency}{fmtM(exitMultipleTV)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#566174]">PV (discounted)</span>
              <span className={`font-mono font-semibold ${primaryMethod === 'exitMultiple' ? 'text-[#2563EB]' : 'text-[#E3E1DA]'}`}>
                {currency}{fmtM(exitMultipleTVDiscounted)}
              </span>
            </div>
            {exitMultipleResidualPct != null && (
              <div className="flex justify-between text-xs">
                <span className="text-[#8A95A6]">% of EV</span>
                <span className={`font-mono text-[11px] ${exitMultipleResidualPct > 0.75 ? 'text-amber-400 font-semibold' : 'text-[#566174]'}`}>
                  {(exitMultipleResidualPct * 100).toFixed(0)}%
                  {exitMultipleResidualPct > 0.75 && <span className="ml-1 text-[10px]">⚠ high</span>}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
