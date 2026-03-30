'use client'

import { useState } from 'react'
import type { RankedInstrument } from '@/app/api/factor-ranking/route'

interface Props {
  instruments: RankedInstrument[]
}

// Criteria checks — returns true/false for each criterion
function getCriteria(inst: RankedInstrument) {
  const scores = inst.factorScores as unknown as Record<string, number>
  const km = inst.keyMetrics as Record<string, number | null>

  const rsScore = scores.momentum ?? 50
  const vs200MA = km['vs 200MA'] ?? null    // % above 200MA
  const vs50MA  = km['vs 50MA'] ?? null     // % above 50MA
  const dist52w = km['Dist 52w Hi'] ?? null // negative %
  const volCont = km['Vol Contract'] ?? null // < 1 means contracting

  return {
    RS:       rsScore >= 65,
    EMA200:   vs200MA !== null ? vs200MA > 0 : false,
    SMA50:    vs50MA  !== null ? vs50MA > 0 : false,
    MAX52W:   dist52w !== null ? dist52w > -25 : false,  // within 25% of 52w high
    VOLRED:   volCont !== null ? volCont < 0.9 : false,  // volume contracting (tight)
  }
}

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-10">
      <div className={`w-2 h-2 rounded-full ${on ? 'bg-[#3fb950] shadow-[0_0_4px_#3fb950]' : 'bg-[#30363d]'}`} />
      <span className="text-[8px] text-[#6e7681] font-medium leading-none">{label}</span>
    </div>
  )
}

type SortKey = 'finalScore' | 'change1DPct' | 'rank' | 'criteria'

export default function WarrenTable({ instruments }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('finalScore')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const sorted = [...instruments].sort((a, b) => {
    let va: number
    let vb: number
    if (sortKey === 'criteria') {
      const ca = Object.values(getCriteria(a)).filter(Boolean).length
      const cb = Object.values(getCriteria(b)).filter(Boolean).length
      va = ca; vb = cb
    } else if (sortKey === 'change1DPct') {
      va = a.change1DPct; vb = b.change1DPct
    } else if (sortKey === 'rank') {
      va = a.rank; vb = b.rank
      return sortDir === 'asc' ? va - vb : vb - va
    } else {
      va = a.finalScore; vb = b.finalScore
    }
    return sortDir === 'desc' ? vb - va : va - vb
  })

  const total = sorted.length
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function SortHeader({ label, id }: { label: string; id: SortKey }) {
    const active = sortKey === id
    return (
      <th
        className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#8b949e] cursor-pointer hover:text-[#e6edf3] whitespace-nowrap select-none"
        onClick={() => handleSort(id)}
      >
        {label}
        {active && <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>}
      </th>
    )
  }

  function scoreColor(score: number) {
    if (score >= 70) return '#3fb950'
    if (score >= 50) return '#d2991f'
    return '#f85149'
  }

  function changeColor(pct: number) {
    return pct >= 0 ? '#3fb950' : '#f85149'
  }

  function marketBadgeColor(market: string) {
    switch (market) {
      case 'MERVAL': return 'bg-[#1f3a5f] text-[#79b8ff]'
      case 'NYSE':   return 'bg-[#1b2d1b] text-[#56d364]'
      case 'NASDAQ': return 'bg-[#2d1b3d] text-[#d2a8ff]'
      case 'ROFEX':  return 'bg-[#3d2b00] text-[#ffa657]'
      default:       return 'bg-[#21262d] text-[#8b949e]'
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[#0d1117]">
            <tr className="border-b border-[#21262d]">
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#8b949e] w-8">#</th>
              <SortHeader label="Ticker" id="rank" />
              <SortHeader label="Score" id="finalScore" />
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#8b949e] w-36">Signal</th>
              <SortHeader label="1D %" id="change1DPct" />
              <SortHeader label="Criteria" id="criteria" />
              <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#8b949e] text-center w-48">
                RS · EMA200 · SMA50 · 52wHI · VOL
              </th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((inst, i) => {
              const cr = getCriteria(inst)
              const passCount = Object.values(cr).filter(Boolean).length
              const sc = scoreColor(inst.finalScore)
              const barWidth = inst.finalScore
              const globalRank = page * PAGE_SIZE + i + 1

              return (
                <tr
                  key={inst.ticker}
                  className="border-b border-[#21262d] hover:bg-[#161b22] transition-colors"
                >
                  {/* Rank */}
                  <td className="px-3 py-2 text-[11px] text-[#6e7681]">{globalRank}</td>

                  {/* Ticker */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-[#e6edf3] leading-none">{inst.displayTicker}</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-[9px] font-semibold px-1 rounded ${marketBadgeColor(inst.market)}`}>{inst.market}</span>
                        {inst.isCedear && <span className="text-[9px] text-[#ffa657]">CEDEAR</span>}
                      </div>
                    </div>
                  </td>

                  {/* Score with bar */}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${barWidth}%`, background: sc }}
                        />
                      </div>
                      <span className="text-xs font-bold" style={{ color: sc }}>{inst.finalScore}</span>
                    </div>
                  </td>

                  {/* Signal bar */}
                  <td className="px-3 py-2">
                    <div className="w-full h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${inst.finalScore}%`,
                          background: `linear-gradient(90deg, #f85149 0%, #d2991f 35%, #3fb950 70%)`,
                          clipPath: `inset(0 ${100 - inst.finalScore}% 0 0)`,
                        }}
                      />
                    </div>
                  </td>

                  {/* Change */}
                  <td className="px-3 py-2 text-xs font-semibold" style={{ color: changeColor(inst.change1DPct) }}>
                    {inst.change1DPct >= 0 ? '+' : ''}{inst.change1DPct.toFixed(2)}%
                  </td>

                  {/* Criteria count */}
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-bold ${passCount >= 4 ? 'text-[#3fb950]' : passCount >= 2 ? 'text-[#d2991f]' : 'text-[#6e7681]'}`}>
                      {passCount}/5
                    </span>
                  </td>

                  {/* Dot indicators */}
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Dot on={cr.RS}     label="RS" />
                      <Dot on={cr.EMA200} label="EMA200" />
                      <Dot on={cr.SMA50}  label="SMA50" />
                      <Dot on={cr.MAX52W} label="+25%H" />
                      <Dot on={cr.VOLRED} label="VOL" />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-[#21262d] text-[11px] text-[#8b949e]">
          <span>{total} instruments</span>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </button>
            <span>{page + 1} / {Math.ceil(total / PAGE_SIZE)}</span>
            <button
              className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
