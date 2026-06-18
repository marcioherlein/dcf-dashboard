'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createChart, ColorType, LineStyle, CrosshairMode,
  AreaSeries, LineSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type Time,
} from 'lightweight-charts'

// ─────────────────────────────────────────────────────────────────────────────
const PERIODS = ['5d', '1mo', '3mo', '6mo', '1y', '5y', 'max'] as const
type Period = typeof PERIODS[number]
const PERIOD_LABELS: Record<Period, string> = {
  '5d': '5D', '1mo': '1M', '3mo': '3M', '6mo': '6M', '1y': '1Y', '5y': '5Y', 'max': 'Max',
}
const COMPARE_COLORS = ['#f97316', '#a855f7', '#06b6d4'] as const

interface ValuationLevels {
  triangulatedFairValue?: number | null
  analystTarget?: number | null
  userModelFairValue?: number | null
}
interface Props extends ValuationLevels {
  ticker: string
  isDark?: boolean
  initialPeriod?: Period
  /** Controlled period — when provided with onPeriodChange, overrides internal state */
  period?: Period
  onPeriodChange?: (p: Period) => void
  /** Called whenever rawBars loads with the period return pct (null if unavailable) */
  onPeriodReturnChange?: (pct: number | null) => void
}

interface OHLCVBar {
  time: Time
  open: number; high: number; low: number; close: number; volume: number
}

// ── Technical indicators ──────────────────────────────────────────────────────
function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    return closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  })
}
function calcEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1); const out: (number | null)[] = []; let ema: number | null = null
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { out.push(null); continue }
    ema = ema === null ? closes.slice(0, period).reduce((a, b) => a + b, 0) / period : closes[i] * k + ema * (1 - k)
    out.push(Math.round(ema * 100) / 100)
  }
  return out
}
function calcRSI(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(period).fill(null)
  let ag = 0, al = 0
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i-1]; if (d > 0) ag += d; else al += Math.abs(d) }
  ag /= period; al /= period
  out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al))
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1]; const g = d > 0 ? d : 0; const l = d < 0 ? Math.abs(d) : 0
    ag = (ag * (period-1) + g) / period; al = (al * (period-1) + l) / period
    out.push(al === 0 ? 100 : Math.round((100 - 100 / (1 + ag / al)) * 10) / 10)
  }
  return out
}
function calcBB(closes: number[], period = 20, sd = 2) {
  return closes.map((_, i) => {
    if (i < period - 1) return { upper: null as number|null, lower: null as number|null }
    const s = closes.slice(i - period + 1, i + 1)
    const mean = s.reduce((a, b) => a + b, 0) / period
    const std = Math.sqrt(s.reduce((a, b) => a + (b - mean)**2, 0) / period)
    return { upper: Math.round((mean + sd * std) * 100) / 100, lower: Math.round((mean - sd * std) * 100) / 100 }
  })
}

// ── Chart theme ───────────────────────────────────────────────────────────────
const BASE_OPTS = {
  layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: 'rgba(71,85,105,0.9)', fontSize: 11 },
  grid: { vertLines: { color: 'rgba(0,0,0,0.05)' }, horzLines: { color: 'rgba(0,0,0,0.05)' } },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: 'rgba(100,116,139,0.4)', width: 1 as const, style: LineStyle.Dashed, labelBackgroundColor: '#1e293b' },
    horzLine: { color: 'rgba(100,116,139,0.4)', width: 1 as const, style: LineStyle.Dashed, labelBackgroundColor: '#1e293b' },
  },
  rightPriceScale: { borderColor: 'rgba(0,0,0,0.08)', textColor: 'rgba(71,85,105,0.9)' },
  timeScale: { borderColor: 'rgba(0,0,0,0.08)', textColor: 'rgba(71,85,105,0.9)', rightOffset: 8, fixLeftEdge: true },
  handleScroll: { mouseWheel: true, pressedMouseMove: true },
  handleScale: { mouseWheel: true, pinch: true },
}

const MA_INDICATORS = [
  { key: 'sma20'  as const, label: 'SMA 20',  color: '#f59e0b', calc: (c: number[]) => calcSMA(c, 20)  },
  { key: 'sma50'  as const, label: 'SMA 50',  color: '#3b82f6', calc: (c: number[]) => calcSMA(c, 50)  },
  { key: 'sma200' as const, label: 'SMA 200', color: '#ef4444', calc: (c: number[]) => calcSMA(c, 200) },
  { key: 'ema20'  as const, label: 'EMA 20',  color: '#10b981', calc: (c: number[]) => calcEMA(c, 20)  },
]
type MAKey = typeof MA_INDICATORS[number]['key']

const VAL_LINES = [
  { key: 'triangulatedFairValue' as const, label: 'Cockpit Estimate', color: '#8b5cf6' },
  { key: 'analystTarget'         as const, label: 'Analyst Target',   color: '#f59e0b' },
  { key: 'userModelFairValue'    as const, label: 'Your Model',       color: '#10b981' },
]
type SubPanel = 'volume' | 'rsi'

// ─────────────────────────────────────────────────────────────────────────────
export default function PriceChart({ ticker, triangulatedFairValue, analystTarget, userModelFairValue, initialPeriod, period: controlledPeriod, onPeriodChange, onPeriodReturnChange }: Props) {
  // state — use controlled period if provided, else internal
  const [internalPeriod, setInternalPeriod] = useState<Period>(controlledPeriod ?? initialPeriod ?? '1y')
  const period = controlledPeriod ?? internalPeriod
  const setPeriod = (p: Period) => {
    if (onPeriodChange) onPeriodChange(p)
    else setInternalPeriod(p)
  }
  const [rawBars, setRawBars]           = useState<OHLCVBar[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeMA, setActiveMA]         = useState<Set<MAKey>>(new Set(['sma50', 'sma200'] as MAKey[]))
  const [showBB, setShowBB]             = useState(false)
  const [subPanel, setSubPanel]         = useState<SubPanel>('volume')
  const [showSubPanel, setShowSubPanel] = useState(true)
  const [compareTickers, setCompareTickers] = useState<string[]>([])
  const [compareInput, setCompareInput]     = useState('')
  const [compareRaw, setCompareRaw]         = useState<Record<string, OHLCVBar[]>>({})
  const [compareMode, setCompareMode]       = useState<'price' | 'percent'>('price')
  const [indicatorsOpen, setIndicatorsOpen] = useState(false)
  const compareInputRef = useRef<HTMLInputElement>(null)
  const indicatorsRef   = useRef<HTMLDivElement>(null)

  // DOM refs
  const mainRef    = useRef<HTMLDivElement>(null)
  const subRef     = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // chart instances
  const mainChart = useRef<IChartApi | null>(null)
  const subChart  = useRef<IChartApi | null>(null)

  // series refs — v5: addSeries(AreaSeries) returns ISeriesApi<'Area'>
  const areaSeries   = useRef<ISeriesApi<'Area'>   | null>(null)
  const volSeries    = useRef<ISeriesApi<'Histogram'> | null>(null)
  const rsiSeries    = useRef<ISeriesApi<'Area'>   | null>(null)
  const bbUpperRef   = useRef<ISeriesApi<'Line'>   | null>(null)
  const bbLowerRef   = useRef<ISeriesApi<'Line'>   | null>(null)
  const maSeries     = useRef<Map<MAKey, ISeriesApi<'Line'>>>(new Map())
  const cmpSeries    = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())
  const priceLinesRef = useRef<ReturnType<ISeriesApi<'Area'>['createPriceLine']>[]>([])
  const rawBarsRef   = useRef<OHLCVBar[]>([])

  // keep a ref of rawBars for tooltip access without re-creating the effect
  useEffect(() => { rawBarsRef.current = rawBars }, [rawBars])

  // Close indicators dropdown on outside click
  useEffect(() => {
    if (!indicatorsOpen) return
    function handleOutside(e: MouseEvent) {
      if (indicatorsRef.current && !indicatorsRef.current.contains(e.target as Node)) {
        setIndicatorsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [indicatorsOpen])

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    fetch(`/api/historical?ticker=${ticker}&period=${period}`)
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((raw: any[]) => {
        setRawBars(raw.map(p => ({
          time: new Date(p.date).toISOString().split('T')[0] as Time,
          open: p.open ?? p.close, high: p.high ?? p.close,
          low: p.low ?? p.close, close: p.close, volume: p.volume ?? 0,
        })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [ticker, period])

  useEffect(() => {
    for (const ct of compareTickers) {
      if (compareRaw[ct]) continue
      fetch(`/api/historical?ticker=${ct}&period=${period}`)
        .then(r => r.json())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((raw: any[]) => {
          setCompareRaw(prev => ({ ...prev, [ct]: raw.map(p => ({
            time: new Date(p.date).toISOString().split('T')[0] as Time,
            open: p.open ?? p.close, high: p.high ?? p.close,
            low: p.low ?? p.close, close: p.close, volume: p.volume ?? 0,
          })) }))
        }).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareTickers, period])

  useEffect(() => { setCompareRaw({}) }, [period])

  // ── Create charts (once) ────────────────────────────────────────────────
  useEffect(() => {
    if (!mainRef.current || !subRef.current) return

    // ── Main chart ──
    const mc = createChart(mainRef.current, {
      ...BASE_OPTS,
      width: mainRef.current.clientWidth,
      height: mainRef.current.clientHeight || 340,
      rightPriceScale: { ...BASE_OPTS.rightPriceScale, scaleMargins: { top: 0.08, bottom: 0.04 } },
    })
    mainChart.current = mc

    // Price area
    areaSeries.current = mc.addSeries(AreaSeries, {
      lineColor: '#10b981', topColor: 'rgba(16,185,129,0.12)', bottomColor: 'rgba(16,185,129,0)',
      lineWidth: 2, crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      priceLineVisible: false, lastValueVisible: true,
    })

    // Volume histogram (overlay at bottom 18% of main chart)
    volSeries.current = mc.addSeries(HistogramSeries, {
      color: 'rgba(255,255,255,0.1)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    })
    mc.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    // MA lines
    for (const ind of MA_INDICATORS) {
      const s = mc.addSeries(LineSeries, {
        color: ind.color, lineWidth: 1,
        crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: false,
      })
      maSeries.current.set(ind.key, s)
    }

    // Bollinger Bands
    const bbOpts = { color: '#a78bfa', lineWidth: 1 as const, lineStyle: LineStyle.Dashed, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false, visible: false }
    bbUpperRef.current = mc.addSeries(LineSeries, bbOpts)
    bbLowerRef.current = mc.addSeries(LineSeries, bbOpts)

    // ── Sub chart (RSI) ──
    const sc = createChart(subRef.current, {
      ...BASE_OPTS,
      width: subRef.current.clientWidth,
      height: 80,
      rightPriceScale: { ...BASE_OPTS.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { ...BASE_OPTS.timeScale, visible: false },
      crosshair: {
        ...BASE_OPTS.crosshair,
        horzLine: { ...BASE_OPTS.crosshair.horzLine, visible: false, labelVisible: false },
      },
    })
    subChart.current = sc

    rsiSeries.current = sc.addSeries(AreaSeries, {
      lineColor: '#8b5cf6', topColor: 'rgba(139,92,246,0.15)', bottomColor: 'rgba(139,92,246,0)',
      lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    })
    for (const [p, col] of [[70, '#ef444488'], [50, 'rgba(255,255,255,0.1)'], [30, '#10b98188']] as [number, string][]) {
      rsiSeries.current.createPriceLine({ price: p, color: col, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: p !== 50, title: '' })
    }

    // Sync time scales
    mc.timeScale().subscribeVisibleLogicalRangeChange(range => { if (range) sc.timeScale().setVisibleLogicalRange(range) })
    sc.timeScale().subscribeVisibleLogicalRangeChange(range => { if (range) mc.timeScale().setVisibleLogicalRange(range) })

    // Crosshair sync main → sub (v5: setCrosshairPosition(price, time, series))
    mc.subscribeCrosshairMove(param => {
      if (!param.time || !rsiSeries.current) return
      try { sc.setCrosshairPosition(50, param.time, rsiSeries.current) } catch { /* ignore */ }
    })

    // Custom floating tooltip
    mc.subscribeCrosshairMove(param => {
      const el = tooltipRef.current
      if (!el || !mainRef.current) return
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) { el.style.display = 'none'; return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aData = param.seriesData.get(areaSeries.current!) as any
      const close = aData?.value as number | undefined
      if (close == null) { el.style.display = 'none'; return }

      const timeStr = param.time as string
      const bar = rawBarsRef.current.find(b => b.time === timeStr)
      const chartW = mainRef.current.clientWidth
      const left   = param.point.x > chartW - 160 ? param.point.x - 155 : param.point.x + 12
      const top    = Math.max(4, param.point.y - 70)

      el.style.display = 'block'
      el.style.left    = left + 'px'
      el.style.top     = top + 'px'
      el.innerHTML = `
        <div style="color:rgba(255,255,255,0.4);font-size:10px;margin-bottom:3px">${timeStr}</div>
        ${bar ? `
          <div><span style="color:rgba(255,255,255,0.4)">O </span><span style="color:#fff;font-weight:600">$${bar.open.toFixed(2)}</span></div>
          <div><span style="color:rgba(255,255,255,0.4)">H </span><span style="color:#10b981;font-weight:600">$${bar.high.toFixed(2)}</span></div>
          <div><span style="color:rgba(255,255,255,0.4)">L </span><span style="color:#ef4444;font-weight:600">$${bar.low.toFixed(2)}</span></div>
          <div><span style="color:rgba(255,255,255,0.4)">C </span><span style="color:#fff;font-weight:700">$${bar.close.toFixed(2)}</span></div>
          ${bar.volume > 0 ? `<div style="margin-top:2px"><span style="color:rgba(255,255,255,0.4)">Vol </span><span style="color:#fff">${(bar.volume / 1e6).toFixed(2)}M</span></div>` : ''}
        ` : `<div style="color:#fff;font-weight:700">$${close.toFixed(2)}</div>`}
      `
    })

    // Resize observer — update both chart width AND main chart height
    const ro = new ResizeObserver(() => {
      if (mainRef.current) {
        const h = mainRef.current.clientHeight
        mc.applyOptions({ width: mainRef.current.clientWidth, ...(h > 0 ? { height: h } : {}) })
      }
      if (subRef.current)  sc.applyOptions({ width: subRef.current.clientWidth })
    })
    ro.observe(mainRef.current)
    ro.observe(subRef.current)

    // Force a size update on next frame in case clientWidth was 0 at mount
    // (happens when the chart is inside a flex/grid container that hasn't painted)
    const raf = requestAnimationFrame(() => {
      if (mainRef.current && mainRef.current.clientWidth > 0) {
        const h = mainRef.current.clientHeight
        mc.applyOptions({ width: mainRef.current.clientWidth, ...(h > 0 ? { height: h } : {}) })
      }
    })

    return () => { cancelAnimationFrame(raf); ro.disconnect(); mc.remove(); sc.remove() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update data when rawBars change ──────────────────────────────────────
  useEffect(() => {
    if (!areaSeries.current || !rawBars.length) return
    const closes = rawBars.map(b => b.close)
    const up = closes[closes.length - 1] >= closes[0]
    // Report period return to parent if callback provided
    if (onPeriodReturnChange) {
      const ret = closes.length >= 2 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : null
      onPeriodReturnChange(ret)
    }
    areaSeries.current.applyOptions({
      lineColor: up ? '#10b981' : '#ef4444',
      topColor:  up ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
    })
    areaSeries.current.setData(rawBars.map(b => ({ time: b.time, value: b.close })))

    volSeries.current?.setData(rawBars.map((b, i) => ({
      time: b.time, value: b.volume,
      color: i > 0 && b.close < rawBars[i-1].close ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.12)',
    })))

    for (const ind of MA_INDICATORS) {
      const vals = ind.calc(closes)
      const s = maSeries.current.get(ind.key)
      if (s) s.setData(rawBars.filter((_, i) => vals[i] != null).map((b) => {
        const idx = rawBars.indexOf(b)
        return { time: b.time, value: vals[idx] as number }
      }))
    }

    const bb = calcBB(closes)
    bbUpperRef.current?.setData(rawBars.filter((_, i) => bb[i].upper != null).map((b) => {
      const idx = rawBars.indexOf(b); return { time: b.time, value: bb[idx].upper as number }
    }))
    bbLowerRef.current?.setData(rawBars.filter((_, i) => bb[i].lower != null).map((b) => {
      const idx = rawBars.indexOf(b); return { time: b.time, value: bb[idx].lower as number }
    }))

    const rsiVals = calcRSI(closes)
    rsiSeries.current?.setData(rawBars.filter((_, i) => rsiVals[i] != null).map((b) => {
      const idx = rawBars.indexOf(b); return { time: b.time, value: rsiVals[idx] as number }
    }))
  }, [rawBars, onPeriodReturnChange])

  // ── MA visibility ────────────────────────────────────────────────────────
  useEffect(() => {
    for (const ind of MA_INDICATORS) {
      maSeries.current.get(ind.key)?.applyOptions({ visible: activeMA.has(ind.key) })
    }
  }, [activeMA])

  // ── BB visibility ────────────────────────────────────────────────────────
  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: showBB })
    bbLowerRef.current?.applyOptions({ visible: showBB })
  }, [showBB])

  // ── Volume visibility (sub-panel toggle) ──────────────────────────────────
  useEffect(() => {
    volSeries.current?.applyOptions({ visible: showSubPanel && subPanel === 'volume' && compareTickers.length === 0 })
  }, [showSubPanel, subPanel, compareTickers])

  // ── Valuation price lines ─────────────────────────────────────────────────
  useEffect(() => {
    const series = areaSeries.current
    if (!series) return
    for (const pl of priceLinesRef.current) { try { series.removePriceLine(pl) } catch { /* ignore */ } }
    priceLinesRef.current = []
    const levels: Record<string, number | null | undefined> = { triangulatedFairValue, analystTarget, userModelFairValue }

    // Build active lines, sort by value descending (highest = highest priority for axis label)
    const activeLines = VAL_LINES
      .map(vl => ({ ...vl, value: levels[vl.key] }))
      .filter((l): l is typeof l & { value: number } => !!(l.value && l.value > 0))
    activeLines.sort((a, b) => b.value - a.value)

    // Suppress axis label on lower-priority lines within 3% of a higher-priority line
    const suppressed = new Set<number>()
    for (let i = 0; i < activeLines.length; i++) {
      if (suppressed.has(i)) continue
      for (let j = i + 1; j < activeLines.length; j++) {
        if (Math.abs(activeLines[i].value - activeLines[j].value) / activeLines[i].value < 0.03) {
          suppressed.add(j)
        }
      }
    }

    for (let i = 0; i < activeLines.length; i++) {
      const l = activeLines[i]
      priceLinesRef.current.push(series.createPriceLine({
        price: l.value, color: l.color, lineWidth: 1, lineStyle: LineStyle.Dashed,
        axisLabelVisible: !suppressed.has(i), title: l.label,
      }))
    }
  }, [triangulatedFairValue, analystTarget, userModelFairValue])

  // ── Compare tickers ───────────────────────────────────────────────────────
  useEffect(() => {
    const chart = mainChart.current
    if (!chart) return

    // Remove stale
    Array.from(cmpSeries.current.entries()).forEach(([ct, s]) => {
      if (!compareTickers.includes(ct)) { chart.removeSeries(s); cmpSeries.current.delete(ct) }
    })

    compareTickers.forEach((ct, i) => {
      const bars = compareRaw[ct]
      if (!bars) return
      let s = cmpSeries.current.get(ct)
      if (!s) {
        s = chart.addSeries(LineSeries, { color: COMPARE_COLORS[i % 3], lineWidth: 2, crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: true })
        cmpSeries.current.set(ct, s)
      }
      const firstClose = bars[0]?.close ?? 1
      s.setData(compareMode === 'percent'
        ? bars.map(b => ({ time: b.time, value: ((b.close - firstClose) / firstClose) * 100 }))
        : bars.map(b => ({ time: b.time, value: b.close })))
    })

    // Normalise primary series in % mode
    if (areaSeries.current && rawBars.length) {
      const firstClose = rawBars[0].close ?? 1
      areaSeries.current.setData(
        compareMode === 'percent' && compareTickers.length > 0
          ? rawBars.map(b => ({ time: b.time, value: ((b.close - firstClose) / firstClose) * 100 }))
          : rawBars.map(b => ({ time: b.time, value: b.close }))
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareTickers, compareRaw, compareMode, rawBars])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const firstClose = rawBars.length ? rawBars[0].close : null
  const lastClose  = rawBars.length ? rawBars[rawBars.length - 1].close : null
  const _changePct  = firstClose && lastClose ? ((lastClose - firstClose) / firstClose) * 100 : null
  const isCompare  = compareTickers.length > 0

  const toggleMA = useCallback((key: MAKey) => {
    setActiveMA(prev => { const n = new Set(prev); if (n.has(key)) { n.delete(key) } else { n.add(key) } return n })
  }, [])

  const addCompareTicker = (raw: string) => {
    const ct = raw.trim().toUpperCase()
    if (ct && ct !== ticker.toUpperCase() && !compareTickers.includes(ct) && compareTickers.length < 3)
      setCompareTickers(prev => [...prev, ct])
    setCompareInput('')
  }
  const removeCompareTicker = (ct: string) => {
    setCompareTickers(prev => prev.filter(t => t !== ct))
    setCompareRaw(prev => { const n = { ...prev }; delete n[ct]; return n })
  }

  const levels: Record<string, number | null | undefined> = { triangulatedFairValue, analystTarget, userModelFairValue }
  const hasAnyLevel = VAL_LINES.some(l => (levels[l.key] ?? 0) > 0)

  // Active indicator chips (for display)
  const activeIndicators = [
    ...MA_INDICATORS.filter(ind => activeMA.has(ind.key)),
    ...(showBB ? [{ key: 'bb' as const, label: 'BB (20,2)', color: '#a78bfa' }] : []),
    ...(showSubPanel && subPanel === 'rsi' ? [{ key: 'rsi' as const, label: 'RSI (14)', color: '#8b5cf6' }] : []),
    ...(showSubPanel && subPanel === 'volume' ? [{ key: 'vol' as const, label: 'Volume', color: '#64748b' }] : []),
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl flex flex-col overflow-hidden" style={{ border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.05)' }}>

      {/* ── Row 1: Timeframe selector ── */}
      <div className="flex items-center gap-1 px-5 pt-4 pb-2 flex-wrap">
        {PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            aria-pressed={period === p}
            className={`rounded-xl px-3 py-1.5 text-[12px] font-[600] transition-colors min-h-[36px] ${period === p ? 'text-[#25310b]' : 'text-[#566174] border border-[#E5E5E5] bg-white hover:bg-[#F4F3EF] hover:border-[#CDD1C8]'}`}
            style={period === p ? { background: '#e8f0d2', border: '1px solid #c8dba0' } : undefined}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* ── Row 2: Compare + Indicators ── */}
      <div className="flex items-center gap-2 px-5 pb-2 flex-wrap">
        {/* SPY quick-compare toggle */}
        {ticker.toUpperCase() !== 'SPY' && (() => {
          const spyOn = compareTickers.includes('SPY')
          return (
            <button
              onClick={() => spyOn ? removeCompareTicker('SPY') : addCompareTicker('SPY')}
              aria-pressed={spyOn}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-[600] border transition-all min-h-[36px] ${spyOn ? 'bg-[#fff3e0] border-[#f97316] text-[#c2410c]' : 'border-[#E5E5E5] text-[#566174] hover:border-[#CDD1C8] hover:bg-[#F4F3EF]'}`}
            >
              {spyOn ? <>vs SPY <span className="opacity-60 ml-0.5">×</span></> : 'vs SPY'}
            </button>
          )
        })()}

        {/* Other compare tickers */}
        {compareTickers.filter(t => t !== 'SPY').map((ct) => {
          const i = compareTickers.indexOf(ct)
          return (
            <span key={ct} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-[600] border min-h-[36px]"
              style={{ background: COMPARE_COLORS[i % 3] + '22', color: COMPARE_COLORS[i % 3], borderColor: COMPARE_COLORS[i % 3] + '66' }}>
              {ct}
              <button onClick={() => removeCompareTicker(ct)} className="opacity-60 hover:opacity-100 ml-0.5" aria-label={`Remove ${ct} comparison`}>×</button>
            </span>
          )
        })}

        {/* Compare input */}
        {compareTickers.length < 3 && (
          <form onSubmit={e => { e.preventDefault(); addCompareTicker(compareInput) }}>
            <input ref={compareInputRef} type="text" value={compareInput}
              onChange={e => setCompareInput(e.target.value.toUpperCase())}
              onBlur={() => { if (compareInput.trim()) addCompareTicker(compareInput) }}
              placeholder="+ Compare" maxLength={10}
              aria-label="Add ticker to compare"
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-[12px] font-[600] border border-dashed border-[#CDD1C8] bg-white focus:outline-none focus:border-[#5F790B] w-24 min-h-[36px] placeholder:text-[#8A95A6] text-[#06101F]"
            />
          </form>
        )}

        {/* % / $ mode when comparing */}
        {isCompare && (
          <button onClick={() => setCompareMode(p => p === 'price' ? 'percent' : 'price')}
            className={`text-[12px] font-[600] px-3 py-1.5 rounded-lg border transition min-h-[36px] ${compareMode === 'percent' ? 'bg-olive-700 text-white border-olive-700' : 'border-[#E5E5E5] text-[#566174] hover:bg-[#F4F3EF]'}`}>
            {compareMode === 'percent' ? '% Return' : '$ Price'}
          </button>
        )}

        {/* Indicators dropdown — right-aligned, only in non-compare mode */}
        {!isCompare && (
          <div className="relative ml-auto" ref={indicatorsRef}>
            <button
              onClick={() => setIndicatorsOpen(v => !v)}
              aria-expanded={indicatorsOpen}
              aria-haspopup="menu"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-[600] border transition-all min-h-[36px] ${indicatorsOpen || activeIndicators.length > 0 ? 'border-[#c8dba0] text-[#3d5a06] bg-[#f1f7e5]' : 'border-[#E5E5E5] text-[#566174] hover:bg-[#F4F3EF]'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Indicators
              {activeIndicators.length > 0 && (
                <span className="bg-[#5F790B] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {activeIndicators.length}
                </span>
              )}
            </button>

            {indicatorsOpen && (
              <div
                role="menu"
                aria-label="Chart indicators"
                className="absolute right-0 top-full mt-1.5 z-30 bg-white border border-[#E5E5E5] rounded-xl shadow-lg py-1.5 min-w-[200px]"
              >
                <p className="px-3 py-1 text-[10px] font-[700] text-[#9B9B9B] uppercase tracking-wider">Moving Averages</p>
                {MA_INDICATORS.map(ind => {
                  const on = activeMA.has(ind.key)
                  return (
                    <button key={ind.key} role="menuitemcheckbox" aria-checked={on}
                      onClick={() => toggleMA(ind.key)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left hover:bg-[#F5F5F5] transition-colors min-h-[44px]"
                    >
                      <span className="w-3 h-3 rounded-full shrink-0 border-2 flex items-center justify-center"
                        style={{ borderColor: ind.color, background: on ? ind.color : 'transparent' }}>
                        {on && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className="flex-1" style={{ color: on ? ind.color : '#6B6B6B' }}>{ind.label}</span>
                    </button>
                  )
                })}

                <p className="px-3 pt-2 pb-1 text-[10px] font-[700] text-[#9B9B9B] uppercase tracking-wider">Bands</p>
                <button role="menuitemcheckbox" aria-checked={showBB}
                  onClick={() => setShowBB(v => !v)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left hover:bg-[#F5F5F5] transition-colors min-h-[44px]"
                >
                  <span className="w-3 h-3 rounded-full shrink-0 border-2 flex items-center justify-center"
                    style={{ borderColor: '#a78bfa', background: showBB ? '#a78bfa' : 'transparent' }}>
                    {showBB && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <span style={{ color: showBB ? '#a78bfa' : '#6B6B6B' }}>Bollinger Bands</span>
                </button>

                <p className="px-3 pt-2 pb-1 text-[10px] font-[700] text-[#9B9B9B] uppercase tracking-wider">Sub-panel</p>
                {(['volume', 'rsi'] as SubPanel[]).map(sp => {
                  const on = showSubPanel && subPanel === sp
                  const color = sp === 'rsi' ? '#8b5cf6' : '#64748b'
                  return (
                    <button key={sp} role="menuitemcheckbox" aria-checked={on}
                      onClick={() => { if (on) { setShowSubPanel(false) } else { setSubPanel(sp); setShowSubPanel(true) } }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left hover:bg-[#F5F5F5] transition-colors min-h-[44px]"
                    >
                      <span className="w-3 h-3 rounded-full shrink-0 border-2 flex items-center justify-center"
                        style={{ borderColor: color, background: on ? color : 'transparent' }}>
                        {on && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span style={{ color: on ? color : '#6B6B6B' }}>{sp === 'volume' ? 'Volume' : 'RSI (14)'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Row 3: Active indicator chips + valuation legend ── */}
      {(!isCompare && (activeIndicators.length > 0 || (hasAnyLevel))) && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pb-2">
          {/* Price chip — always present */}
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-[600] border border-[#d1d5db] bg-white text-[#374151]">
            <span className="w-2 h-2 rounded-full bg-[#10b981] shrink-0" />
            Price
          </span>

          {/* Active MA/BB/RSI/Volume chips */}
          {activeIndicators.map(ind => (
            <span key={ind.key}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-[600] border"
              style={{ borderColor: ind.color + '66', background: ind.color + '14', color: ind.color }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ind.color }} />
              {ind.label}
              <button
                onClick={() => {
                  if (ind.key === 'bb') setShowBB(false)
                  else if (ind.key === 'rsi') setShowSubPanel(false)
                  else if (ind.key === 'vol') setShowSubPanel(false)
                  else toggleMA(ind.key as MAKey)
                }}
                aria-label={`Remove ${ind.label}`}
                className="opacity-60 hover:opacity-100 ml-0.5 leading-none"
              >×</button>
            </span>
          ))}

          {/* Valuation line chips */}
          {hasAnyLevel && VAL_LINES.map(vl => {
            const v = levels[vl.key]
            if (!v) return null
            return (
              <span key={vl.key} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-[600] border"
                style={{ borderColor: vl.color + '55', background: vl.color + '12', color: vl.color }}>
                <span className="inline-block h-px w-4 border-t-2 border-dashed shrink-0" style={{ borderColor: vl.color }} />
                {vl.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Main chart — flex-1 with responsive min-height */}
      <div className="relative px-1 flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[#8A95A6] z-10">Loading…</div>
        )}
        <div
          ref={mainRef}
          className="w-full"
          style={{ height: 'clamp(320px, 42vw, 520px)' }}
        />
        <div ref={tooltipRef} className="pointer-events-none absolute z-20 hidden rounded-lg px-2.5 py-2 text-[11px]"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', minWidth: 120, lineHeight: 1.6 }} />
      </div>

      {/* RSI sub-panel */}
      {!isCompare && showSubPanel && (
        <div className="px-1 pb-3">
          <div
            ref={subRef}
            className="w-full"
            style={{ height: subPanel === 'rsi' ? 80 : 0, overflow: 'hidden' }}
          />
          <div className="flex items-center justify-center mt-0.5">
            <span className="text-[10px] text-[#8A95A6] font-medium tracking-wide">
              {subPanel === 'volume' ? 'VOLUME' : 'RSI (14)'}
            </span>
          </div>
        </div>
      )}

      {/* Keep subRef mounted when sub-panel is hidden so chart stays alive */}
      {(isCompare || !showSubPanel) && (
        <div ref={subRef} className="hidden" style={{ height: 0 }} />
      )}
    </div>
  )
}
