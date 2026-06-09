'use client'

import { InfoTooltip } from '@/components/ui/info-tooltip'
import { fmtPrice } from '@/lib/formatters'

interface Props {
  epvPerShare: number | null
  growthPremiumPct: number | null
  fcfYield: number | null
  rfRate: number | null
  capitalIntensityLabel: string | null
  currency: string
  currentPrice: number
}

interface ChipProps {
  label: string
  tooltip: string
  children: React.ReactNode
}

function Chip({ label, tooltip, children }: ChipProps) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[11px] font-[700] text-[#566174] uppercase tracking-wider whitespace-nowrap flex items-center gap-0.5">
        {label}
        <InfoTooltip text={tooltip} />
      </span>
      <span className="text-[11px] font-[650] text-[#06101F] whitespace-nowrap">{children}</span>
    </div>
  )
}

function Divider() {
  return <span className="text-[#CDD1C8] text-[10px] select-none hidden sm:inline">·</span>
}

export default function CrossCheckStrip({
  epvPerShare,
  growthPremiumPct,
  fcfYield,
  rfRate,
  capitalIntensityLabel,
  currency,
  currentPrice,
}: Props) {
  const fcfVsRfr = fcfYield != null && rfRate != null ? fcfYield - rfRate : null

  return (
    <div className="bg-white rounded-[14px] border border-[#E6ECF5] shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

        {/* EPV floor */}
        <Chip
          label="No-growth floor"
          tooltip="What this company is worth today if it stopped growing — a conservative baseline. The gap to current price is what you pay for future growth."
        >
          {epvPerShare != null && epvPerShare > 0 ? (
            <span>
              {fmtPrice(epvPerShare, currency)}
              {growthPremiumPct != null && growthPremiumPct > 0 && currentPrice > 0 && (
                <span className="text-[10px] text-[#B56A00] font-[600] ml-1">
                  ({(growthPremiumPct * 100).toFixed(0)}% priced as growth)
                </span>
              )}
            </span>
          ) : (
            <span className="text-[#8A95A6]">—</span>
          )}
        </Chip>

        <Divider />

        {/* FCF Yield */}
        <Chip
          label="FCF yield"
          tooltip="Free cash flow as a percentage of market price — like a savings rate. Higher is better. Compare to the risk-free rate below."
        >
          {fcfYield != null ? (
            <span className={fcfYield >= 0.04 ? 'text-[#11875D]' : fcfYield >= 0.02 ? 'text-[#B56A00]' : 'text-[#D83B3B]'}>
              {(fcfYield * 100).toFixed(1)}%
            </span>
          ) : (
            <span className="text-[#8A95A6]">—</span>
          )}
        </Chip>

        {/* vs RFR */}
        {fcfVsRfr != null && (
          <>
            <Divider />
            <Chip
              label="vs treasury"
              tooltip="Spread between FCF yield and the 10-year US Treasury yield. Positive means you earn more than a risk-free bond. Negative means you'd do better in a bond."
            >
              <span className={fcfVsRfr > 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}>
                {fcfVsRfr >= 0 ? '+' : ''}{(fcfVsRfr * 100).toFixed(1)}pp
              </span>
            </Chip>
          </>
        )}

        <Divider />

        {/* Capital intensity */}
        <Chip
          label="Capital intensity"
          tooltip="How much of reported earnings translates into real cash for shareholders. Asset-light businesses keep more — capital-intensive ones spend more maintaining assets."
        >
          {capitalIntensityLabel != null ? (
            <span className={
              capitalIntensityLabel.toLowerCase().includes('light') ? 'text-[#11875D]' :
              capitalIntensityLabel.toLowerCase().includes('intensive') ? 'text-[#B56A00]' :
              'text-[#566174]'
            }>
              {capitalIntensityLabel}
            </span>
          ) : (
            <span className="text-[#8A95A6]">—</span>
          )}
        </Chip>

      </div>
    </div>
  )
}
