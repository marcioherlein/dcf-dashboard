'use client'

import { useState, useEffect, useCallback } from 'react'

interface PricePoint { date: string; value: number }
interface PriceData { ticker: string; range: string; stock: PricePoint[]; spy: PricePoint[] }

const RANGES = ['YTD', '1Y', '3Y', '5Y', '10Y', 'MAX'] as const
type Range = typeof RANGES[number]

interface PriceChartProps {
  ticker: string
  defaultRange?: Range
  height?: number
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
const W = 600
const H = 200
const PAD = { top: 16, right: 12, bottom: 28, left: 44 }
const IW = W - PAD.left - PAD.right
const IH = H - PAD.top - PAD.bottom

function scalePoints(points: PricePoint[], minV: number, maxV: number, minD: number, maxD: number) {
  return points.map(p => {
    const x = PAD.left + ((new Date(p.date).getTime() - minD) / (maxD - minD || 1)) * IW
    const y = PAD.top + IH - ((p.value - minV) / (maxV - minV || 1)) * IH
    return { x, y }
  })
}

function toPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return ''
  return pts.reduce((d, p, i) => d + (i === 0 ? `M${p.x.toFixed(1)},${p.y.toFixed(1)}` : ` L${p.x.toFixed(1)},${p.y.toFixed(1)}`), '')
}

function toAreaPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return ''
  const line = toPath(pts)
  const last = pts[pts.length - 1]
  const first = pts[0]
  return `${line} L${last.x.toFixed(1)},${(PAD.top + IH).toFixed(1)} L${first.x.toFixed(1)},${(PAD.top + IH).toFixed(1)} Z`
}

// ── Return color: green if last > first, red otherwise ───────────────────────
function returnColor(points: PricePoint[]) {
  if (points.length < 2) return '#1f6feb'
  return points[points.length - 1].value >= points[0].value ? '#1f6feb' : '#cf222e'
}

// ── Format date for x-axis label ──────────────────────────────────────────────
function fmtDate(iso: string, range: Range) {
  const d = new Date(iso)
  if (range === 'YTD' || range === '1Y') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export default function PriceChart({ ticker, defaultRange = '1Y', height = 220 }: PriceChartProps) {
  const [range, setRange] = useState<Range>(defaultRange)
  const [data, setData] = useState<PriceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<{ x: number; stockVal: number; spyVal: number; date: string } | null>(null)

  const load = useCallback(async (r: Range) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/price-history?ticker=${ticker}&range=${r}`)
      if (!res.ok) throw new Error('Failed to load')
      const d: PriceData = await res.json()
      setData(d)
    } catch {
      setError('Could not load price history')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  useEffect(() => { load(range) }, [range, load])

  // ── Build chart geometry ────────────────────────────────────────────────────
  const stock = data?.stock ?? []
  const spy   = data?.spy ?? []

  const allValues = [...stock.map(p => p.value), ...spy.map(p => p.value)]
  const minV = allValues.length ? Math.min(...allValues) * 0.98 : 90
  const maxV = allValues.length ? Math.max(...allValues) * 1.02 : 110

  const allDates = [...stock.map(p => new Date(p.date).getTime()), ...spy.map(p => new Date(p.date).getTime())]
  const minD = allDates.length ? Math.min(...allDates) : 0
  const maxD = allDates.length ? Math.max(...allDates) : 1

  const stockPts  = scalePoints(stock, minV, maxV, minD, maxD)
  const spyPts    = scalePoints(spy,   minV, maxV, minD, maxD)
  const stockColor = returnColor(stock)

  // Y-axis grid lines (4 labels)
  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const frac = i / 3
    const v = minV + (maxV - minV) * frac
    const y = PAD.top + IH * (1 - frac)
    return { y, label: v.toFixed(0) }
  })

  // X-axis tick positions (5 labels)
  const xTicks = Array.from({ length: 5 }, (_, i) => {
    const frac = i / 4
    const t = minD + (maxD - minD) * frac
    const x = PAD.left + frac * IW
    const iso = new Date(t).toISOString().split('T')[0]
    return { x, label: fmtDate(iso, range) }
  })

  // Return %
  const stockReturn = stock.length >= 2 ? stock[stock.length - 1].value - 100 : null
  const spyReturn   = spy.length >= 2   ? spy[spy.length - 1].value - 100     : null

  // Mouse move handler for crosshair
  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (stock.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const frac = Math.max(0, Math.min(1, (svgX - PAD.left) / IW))
    const targetT = minD + frac * (maxD - minD)
    // Find nearest stock point
    let nearest = stock[0]
    let minDiff = Infinity
    for (const p of stock) {
      const diff = Math.abs(new Date(p.date).getTime() - targetT)
      if (diff < minDiff) { minDiff = diff; nearest = p }
    }
    // Find matching SPY point
    let nearestSpy = spy[0]
    let minDiffSpy = Infinity
    for (const p of spy) {
      const diff = Math.abs(new Date(p.date).getTime() - new Date(nearest.date).getTime())
      if (diff < minDiffSpy) { minDiffSpy = diff; nearestSpy = p }
    }
    const cx = PAD.left + ((new Date(nearest.date).getTime() - minD) / (maxD - minD || 1)) * IW
    setHover({ x: cx, stockVal: nearest.value, spyVal: nearestSpy?.value ?? 100, date: nearest.date })
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Range selector + returns legend */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Legend */}
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: stockColor }} />
            <span className="text-[11px] font-semibold text-[#2D2C31]">{ticker}</span>
            {stockReturn != null && (
              <span className={`text-[11px] font-mono ${stockReturn >= 0 ? 'text-[#1f6feb]' : 'text-[#cf222e]'}`}>
                {stockReturn >= 0 ? '+' : ''}{stockReturn.toFixed(1)}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded border-b border-dashed border-[#9a6700]" style={{ background: 'transparent' }} />
            <svg width="14" height="4" className="inline-block"><line x1="0" y1="2" x2="14" y2="2" stroke="#9a6700" strokeWidth="1.5" strokeDasharray="3,2" /></svg>
            <span className="text-[11px] font-semibold text-[#6B6A72]">S&amp;P 500</span>
            {spyReturn != null && (
              <span className={`text-[11px] font-mono ${spyReturn >= 0 ? 'text-[#9a6700]' : 'text-[#cf222e]'}`}>
                {spyReturn >= 0 ? '+' : ''}{spyReturn.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        {/* Range buttons */}
        <div className="flex gap-0.5 bg-[#F7F6F1] rounded-lg p-0.5">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                range === r
                  ? 'bg-white text-[#2D2C31] shadow-sm'
                  : 'text-[#6B6A72] hover:text-[#2D2C31]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[#DCE6F5] border-t-[#1f6feb] rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-[#6B6A72]">{error}</p>
          </div>
        )}
        {!loading && !error && stock.length > 0 && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-full"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stockColor} stopOpacity="0.15" />
                <stop offset="100%" stopColor={stockColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {yTicks.map(t => (
              <g key={t.y}>
                <line x1={PAD.left} y1={t.y} x2={PAD.left + IW} y2={t.y}
                  stroke="#E8E6E0" strokeWidth="0.5" />
                <text x={PAD.left - 6} y={t.y + 3} textAnchor="end"
                  fontSize="9" fill="#9a9a9a">{t.label}</text>
              </g>
            ))}

            {/* Baseline at 100 */}
            {(() => {
              const y = PAD.top + IH - ((100 - minV) / (maxV - minV || 1)) * IH
              return <line x1={PAD.left} y1={y} x2={PAD.left + IW} y2={y}
                stroke="#C8C6C0" strokeWidth="0.8" strokeDasharray="3,3" />
            })()}

            {/* X-axis labels */}
            {xTicks.map((t, i) => (
              <text key={i} x={t.x} y={H - 6} textAnchor="middle"
                fontSize="9" fill="#9a9a9a">{t.label}</text>
            ))}

            {/* SPY area + line (dashed, behind stock) */}
            {spyPts.length > 0 && (
              <>
                <path d={toPath(spyPts)} fill="none" stroke="#9a6700"
                  strokeWidth="1.5" strokeDasharray="5,3" opacity="0.6" />
              </>
            )}

            {/* Stock area */}
            {stockPts.length > 0 && (
              <>
                <path d={toAreaPath(stockPts)} fill={`url(#grad-${ticker})`} />
                <path d={toPath(stockPts)} fill="none" stroke={stockColor} strokeWidth="2" />
              </>
            )}

            {/* Hover crosshair */}
            {hover && (
              <>
                <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={PAD.top + IH}
                  stroke="#6B6A72" strokeWidth="1" strokeDasharray="3,2" opacity="0.5" />
                {/* Tooltip */}
                <g transform={`translate(${Math.min(hover.x + 8, W - 100)}, ${PAD.top + 4})`}>
                  <rect x="0" y="0" width="92" height="48" rx="5"
                    fill="white" stroke="#E8E6E0" strokeWidth="1" />
                  <text x="6" y="14" fontSize="9" fill="#6B6A72">
                    {fmtDate(hover.date, range)}
                  </text>
                  <text x="6" y="28" fontSize="10" fill={stockColor} fontWeight="600">
                    {ticker}: {hover.stockVal >= 100 ? '+' : ''}{(hover.stockVal - 100).toFixed(1)}%
                  </text>
                  <text x="6" y="42" fontSize="10" fill="#9a6700">
                    SPY: {hover.spyVal >= 100 ? '+' : ''}{(hover.spyVal - 100).toFixed(1)}%
                  </text>
                </g>
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  )
}
