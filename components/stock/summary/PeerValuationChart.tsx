'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Maximize2, Info, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import InfoTooltip from '@/components/ui/InfoTooltip'
import PeerValuationChartCore, {
  computeChartDomain,
  PeerChartLegend,
  type PlotPoint,
} from './PeerValuationChartCore'
import { CHART_COLORS } from '@/lib/chartColors'
import type { PeersResponse } from '@/app/api/peers/route'

// Dynamically import the heavy dialog to avoid bundling recharts twice at SSR
const ExpandedPeerChartDialog = dynamic(
  () => import('./ExpandedPeerChartDialog'),
  { ssr: false },
)

// ─── Constants ────────────────────────────────────────────────────────────────

const PEER_TOOLTIP_TEXT =
  "Peers are sourced from Yahoo Finance's 'People also watch' list — stocks frequently viewed together with this one. These are behaviorally similar, not analyst-defined industry peers. Use as a directional comparison, not a precise peer group."

const CARD = 'bg-white border border-[#E5E5E5] rounded-xl shadow-card p-4 sm:p-5'

interface PeerValuationChartProps {
  ticker: string
  isFinancialSector?: boolean
}

export default function PeerValuationChart({ ticker, isFinancialSector = false }: PeerValuationChartProps) {
  const [data, setData]         = useState<PeersResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(() => {
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`/api/peers?ticker=${encodeURIComponent(ticker)}`, { signal: controller.signal })
      .then(r => r.json())
      .then((d: PeersResponse & { error?: string }) => {
        if (cancelled) return
        if (d.error) { setError(d.error); return }
        setData(d)
      })
      .catch(e => { if (!cancelled && e?.name !== 'AbortError') setError('Failed to load peer data') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true; controller.abort() }
  }, [ticker])

  useEffect(() => load(), [load])

  // Build inline chart points: anchor always slot 0 (blue), peers from slot 1
  const points: PlotPoint[] = useMemo(() => {
    if (!data) return []
    return [
      {
        x: data.anchor.forwardPE,
        y: data.anchor.epsGrowth * 100,
        ticker: data.anchor.ticker,
        name: data.anchor.name,
        marketCap: data.anchor.marketCap,
        analystCount: data.anchor.analystCount,
        isAnchor: true,
        color: CHART_COLORS[0],
      },
      ...data.peers.map((p, i) => ({
        x: p.forwardPE,
        y: p.epsGrowth * 100,
        ticker: p.ticker,
        name: p.name,
        marketCap: p.marketCap,
        analystCount: p.analystCount,
        isAnchor: false,
        color: CHART_COLORS[(i + 1) % CHART_COLORS.length],
      })),
    ].filter(p => isFinite(p.x) && isFinite(p.y))
  }, [data])

  const domain = useMemo(() => computeChartDomain(points), [points])

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={CARD}>
        <div className="flex items-center justify-between mb-3">
          <div className="h-3.5 w-36 rounded bg-[#F4F3EF] motion-safe:animate-pulse" />
          <div className="h-3 w-20 rounded bg-[#F4F3EF] motion-safe:animate-pulse" />
        </div>
        <div className="h-[260px] rounded-xl bg-[#F4F3EF] motion-safe:animate-pulse" />
        <div className="mt-3 h-3 w-48 rounded bg-[#F4F3EF] motion-safe:animate-pulse" />
      </div>
    )
  }

  // ── Error / no data ────────────────────────────────────────────────────────
  if (error || !data || data.peers.length === 0) {
    const msg = error === 'Failed to fetch peer data'
      ? 'Unable to load peer data right now. Try refreshing.'
      : (error ?? 'No comparable peers found for this stock on Yahoo Finance.')
    return (
      <div className={cn(CARD, 'flex items-center gap-3 py-5')}>
        <div className="w-7 h-7 rounded-lg bg-[#F4F3EF] border border-[#E3E1DA] flex items-center justify-center shrink-0">
          <Info className="w-3.5 h-3.5 text-[#8A95A6]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#566174]">Peer comparison unavailable</p>
          <p className="text-[11px] text-[#8A95A6] mt-0.5 truncate">{msg}</p>
        </div>
        {error && (
          <button type="button" onClick={load} aria-label="Retry loading peer data"
            className="text-[#8A95A6] hover:text-[#566174] transition-colors shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  // ── Chart ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={CARD} role="region" aria-label={`P/E vs EPS growth peer comparison for ${ticker}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-[13px] font-[700] text-[#111111] leading-tight flex-1">
            P/E vs. next-12-month EPS growth — peer comparison
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1 text-[11px] font-[600] text-[#566174]">
              <span>Yahoo peers</span>
              <InfoTooltip content={PEER_TOOLTIP_TEXT} />
            </div>
            <button
              type="button"
              onClick={load}
              aria-label="Refresh peer data"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#8A95A6] hover:text-[#566174] transition-colors rounded-lg hover:bg-[#F5F5F5]"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            {/* Expand button */}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Expand chart"
              title="Expand chart"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#6B6B6B] hover:text-[#111111] hover:bg-[#F5F5F5] transition-colors rounded-lg -mr-1"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[#8A95A6] mb-3">
          Forward P/E (x) vs. consensus next-12-month EPS growth (%).
          {isFinancialSector && (
            <span className="ml-1 text-[#B56A00]">P/E and EPS growth are less reliable for financials — interpret with caution.</span>
          )}
        </p>

        <PeerValuationChartCore
          points={points}
          domain={domain}
          isFinancialSector={isFinancialSector}
        />

        {/* Legend row */}
        <div className="mt-2">
          <PeerChartLegend points={points} />
        </div>

        {/* Accessible data table */}
        <table className="sr-only">
          <caption>P/E vs EPS growth peer comparison for {ticker}</caption>
          <thead>
            <tr>
              <th>Ticker</th><th>Company</th><th>Forward P/E</th><th>NTM EPS Growth</th><th>Analysts</th>
            </tr>
          </thead>
          <tbody>
            {points.map(p => (
              <tr key={p.ticker}>
                <td>{p.ticker}</td>
                <td>{p.name}</td>
                <td>{p.x != null ? `${p.x.toFixed(1)}x` : '—'}</td>
                <td>{p.y != null ? `${p.y >= 0 ? '+' : ''}${p.y.toFixed(1)}%` : '—'}</td>
                <td>{p.analystCount ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expanded dialog */}
      <ExpandedPeerChartDialog
        open={expanded}
        onClose={() => setExpanded(false)}
        anchorTicker={ticker}
        initialData={data}
        isFinancialSector={isFinancialSector}
      />
    </>
  )
}
