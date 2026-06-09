'use client'

const SECTOR_COLORS: Record<string, string> = {
  'Technology': '#3b82f6',
  'Healthcare': '#10b981',
  'Financial Services': '#f59e0b',
  'Consumer Cyclical': '#ef4444',
  'Industrials': '#8b5cf6',
  'Communication Services': '#06b6d4',
  'Consumer Defensive': '#84cc16',
  'Energy': '#f97316',
  'Real Estate': '#ec4899',
  'Basic Materials': '#78716c',
  'Utilities': '#a3a3a3',
}

function getColor(sector: string): string {
  for (const [key, color] of Object.entries(SECTOR_COLORS)) {
    if (sector.toLowerCase().includes(key.toLowerCase())) return color
  }
  return '#8A95A6'
}

interface SectorWeight {
  sector: string
  weight: number
}

interface Props {
  sectorWeights: SectorWeight[]
}

export function ETFSectorAllocation({ sectorWeights }: Props) {
  if (!sectorWeights.length) {
    return (
      <div className="bg-white border border-[#E3E1DA] rounded-xl p-4">
        <p className="text-[13px] font-[700] text-[#111111] mb-2">Sector Allocation</p>
        <p className="text-sm text-[#8A95A6]">Sector breakdown not available for this ETF.</p>
      </div>
    )
  }

  const total = sectorWeights.reduce((sum, s) => sum + s.weight, 0)

  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl p-4">
      <p className="text-[13px] font-[700] text-[#111111] mb-4">Sector Allocation</p>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-4">
        {sectorWeights.map((s) => (
          <div
            key={s.sector}
            style={{
              width: `${(s.weight / total) * 100}%`,
              backgroundColor: getColor(s.sector),
            }}
            title={`${s.sector}: ${(s.weight * 100).toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {sectorWeights.map((s) => (
          <div key={s.sector} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: getColor(s.sector) }}
            />
            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs text-[#566174] truncate">{s.sector}</span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-20 h-1 bg-[#F4F3EF] rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(s.weight / sectorWeights[0].weight) * 100}%`,
                      backgroundColor: getColor(s.sector),
                    }}
                  />
                </div>
                <span className="text-xs font-mono font-semibold text-[#06101F] w-10 text-right">
                  {(s.weight * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
