'use client'

import {
  useState, useEffect, useCallback, useMemo, useRef, useId,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  X, Search, Lock, RefreshCw, RotateCcw, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import PeerValuationChartCore, {
  computeChartDomain, PeerChartLegend,
  type PlotPoint,
} from './PeerValuationChartCore'
import { CHART_COLORS } from '@/lib/chartColors'
import type { PeersResponse, PeerData } from '@/app/api/peers/route'
import type { QuotePeerData } from '@/app/api/stock-quote-peer/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type FetchState = PeerData | 'loading' | 'error'

interface SearchResult {
  symbol: string
  name: string
}

interface Props {
  open: boolean
  onClose: () => void
  anchorTicker: string
  initialData: PeersResponse | null
  isFinancialSector?: boolean
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExpandedPeerChartDialog({
  open,
  onClose,
  anchorTicker,
  initialData,
  isFinancialSector,
}: Props) {
  const reduced = useReducedMotion()
  const searchId = useId()

  // ── Company state ──────────────────────────────────────────────────────────
  // Ordered list: anchor always first, cannot be removed
  const [tickers, setTickers] = useState<string[]>(() => {
    if (!initialData) return [anchorTicker]
    return [anchorTicker, ...initialData.peers.map(p => p.ticker).slice(0, 9)]
  })

  // Per-ticker data cache — stable between open/close cycles
  const [cache, setCache] = useState<Map<string, FetchState>>(() => {
    const m = new Map<string, FetchState>()
    if (initialData) {
      m.set(anchorTicker, initialData.anchor)
      initialData.peers.forEach(p => m.set(p.ticker, p))
    }
    return m
  })

  // Sync with new initialData if it arrives after dialog mounts
  useEffect(() => {
    if (!initialData) return
    setCache(prev => {
      const next = new Map(prev)
      if (!next.has(anchorTicker)) next.set(anchorTicker, initialData.anchor)
      initialData.peers.forEach(p => {
        if (!next.has(p.ticker)) next.set(p.ticker, p)
      })
      return next
    })
  }, [initialData, anchorTicker])

  // ── Fetch helper for manually added tickers ────────────────────────────────
  const pendingRef = useRef(new Set<string>())

  const fetchTicker = useCallback(async (ticker: string) => {
    if (pendingRef.current.has(ticker)) return
    pendingRef.current.add(ticker)
    setCache(prev => new Map(prev).set(ticker, 'loading'))
    try {
      const res = await fetch(`/api/stock-quote-peer?ticker=${encodeURIComponent(ticker)}&relaxed=1`)
      if (res.status === 429) {
        setCache(prev => new Map(prev).set(ticker, 'error'))
        return
      }
      const data: QuotePeerData = await res.json()
      const peerData: PeerData = {
        ticker: data.ticker,
        name: data.name,
        forwardPE: data.forwardPE ?? 0,
        epsGrowth: data.epsGrowth ?? 0,
        marketCap: data.marketCap,
        sector: data.sector,
        analystCount: data.analystCount,
      }
      if (!data.hasEstimates) {
        setCache(prev => new Map(prev).set(ticker, 'error'))
      } else {
        setCache(prev => new Map(prev).set(ticker, peerData))
      }
    } catch {
      setCache(prev => new Map(prev).set(ticker, 'error'))
    } finally {
      pendingRef.current.delete(ticker)
    }
  }, [])

  // ── Add / remove ──────────────────────────────────────────────────────────
  const MAX_COMPANIES = 10

  function addTicker(symbol: string) {
    const upper = symbol.toUpperCase()
    if (tickers.includes(upper)) return
    if (tickers.length >= MAX_COMPANIES) return
    setTickers(prev => [...prev, upper])
    if (!cache.has(upper) || cache.get(upper) === 'error') {
      fetchTicker(upper)
    }
  }

  function removeTicker(ticker: string) {
    if (ticker === anchorTicker) return
    setTickers(prev => prev.filter(t => t !== ticker))
  }

  function resetToOriginal() {
    if (!initialData) return
    const origTickers = [anchorTicker, ...initialData.peers.map(p => p.ticker).slice(0, 9)]
    setTickers(origTickers)
    // Re-seed cache with original data
    setCache(prev => {
      const next = new Map(prev)
      next.set(anchorTicker, initialData.anchor)
      initialData.peers.forEach(p => next.set(p.ticker, p))
      return next
    })
  }

  // ── Color map: stable per ticker ──────────────────────────────────────────
  const colorMapRef = useRef(new Map<string, string>())
  // Anchor always gets slot 0
  if (!colorMapRef.current.has(anchorTicker)) {
    colorMapRef.current.set(anchorTicker, CHART_COLORS[0])
  }
  // Assign colors to new tickers from slot 1
  let colorIndex = 1
  for (const t of tickers) {
    if (t === anchorTicker) continue
    if (!colorMapRef.current.has(t)) {
      colorMapRef.current.set(t, CHART_COLORS[colorIndex % CHART_COLORS.length])
    }
    colorIndex++
  }

  // ── Derived plot points ───────────────────────────────────────────────────
  const points: PlotPoint[] = useMemo(() => {
    return tickers.map(ticker => {
      const entry = cache.get(ticker)
      const color = colorMapRef.current.get(ticker) ?? CHART_COLORS[1]
      if (entry === 'loading') {
        return { x: 0, y: 0, ticker, name: ticker, marketCap: null, analystCount: null, isAnchor: ticker === anchorTicker, color, isLoading: true }
      }
      if (entry === 'error' || entry == null) {
        return { x: 0, y: 0, ticker, name: ticker, marketCap: null, analystCount: null, isAnchor: ticker === anchorTicker, color, hasError: true }
      }
      return {
        x: entry.forwardPE,
        y: entry.epsGrowth * 100,
        ticker: entry.ticker,
        name: entry.name,
        marketCap: entry.marketCap,
        analystCount: entry.analystCount,
        isAnchor: ticker === anchorTicker,
        color,
      }
    }).filter(p => p.isLoading || p.hasError || (isFinite(p.x) && isFinite(p.y)))
  }, [tickers, cache, anchorTicker])

  const validPoints = useMemo(() => points.filter(p => !p.isLoading && !p.hasError), [points])
  const domain = useMemo(() => computeChartDomain(validPoints), [validPoints])

  // ── Selected bubble (mobile tap) ──────────────────────────────────────────
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const selectedPoint = useMemo(
    () => validPoints.find(p => p.ticker === selectedTicker) ?? null,
    [validPoints, selectedTicker],
  )

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debouncedQuery = useDebounce(searchQuery, 280)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 1) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setSearchLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.ok ? r.json() : [])
      .then((results: Array<{ symbol: string; longname?: string; shortname?: string }>) => {
        setSearchResults(results.slice(0, 8).map(r => ({
          symbol: r.symbol,
          name: r.longname ?? r.shortname ?? r.symbol,
        })))
        setShowDropdown(true)
      })
      .catch(() => { setSearchResults([]); setShowDropdown(false) })
      .finally(() => setSearchLoading(false))
  }, [debouncedQuery])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) { setSearchQuery(''); setShowDropdown(false); setSelectedTicker(null) }
  }, [open])

  // ── Keyboard: Escape closes ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // ── Panel expand state ────────────────────────────────────────────────────
  const [panelExpanded, setPanelExpanded] = useState(false)

  // ─────────────────────────────────────────────────────────────────────────

  if (!open) return null

  const atMax = tickers.length >= MAX_COMPANIES
  const isModified = initialData != null && (
    tickers.length !== initialData.peers.length + 1 ||
    tickers.some((t, i) => t !== [anchorTicker, ...initialData.peers.map(p => p.ticker)][i])
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel: bottom sheet on mobile, centered modal on sm+ */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Expanded peer comparison chart"
            className={cn(
              'fixed z-[61] bg-white flex flex-col',
              // Mobile: bottom sheet
              'inset-x-0 bottom-0 rounded-t-2xl max-h-[92dvh]',
              // sm+: centered modal
              'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
              'sm:rounded-xl sm:w-[min(96vw,1000px)] sm:max-h-[90dvh]',
              'shadow-2xl overflow-hidden',
            )}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 40 }}
            transition={{ duration: reduced ? 0.1 : 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* Drag indicator — mobile only */}
            <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-[#E5E5E5]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] shrink-0">
              <div>
                <p className="text-[14px] font-bold text-[#111111] leading-none">Peer Comparison</p>
                <p className="text-[11px] text-[#6B6B6B] mt-0.5">
                  Forward P/E vs NTM EPS growth
                  {isFinancialSector && <span className="text-[#B56A00] ml-1">· Financials — interpret with caution</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {isModified && (
                  <button
                    onClick={resetToOriginal}
                    className="flex items-center gap-1 text-[11px] text-[#6B6B6B] hover:text-olive-700 px-2 py-1 rounded-lg hover:bg-[#F5F5F5] transition-colors min-h-[36px]"
                    title="Reset to Yahoo peers"
                  >
                    <RotateCcw size={11} />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close expanded chart"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#6B6B6B] hover:text-[#111111] hover:bg-[#F5F5F5] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content: chart + panel */}
            <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

              {/* Chart area */}
              <div className="flex-1 min-h-0 flex flex-col p-4 overflow-y-auto">
                {/* Chart */}
                <div className="flex-1 min-h-[260px]">
                  {validPoints.length === 0 && !points.some(p => p.isLoading) ? (
                    <div className="h-full min-h-[260px] flex flex-col items-center justify-center gap-3 rounded-xl bg-[#F5F5F5] border border-dashed border-[#E5E5E5]">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E5E5] flex items-center justify-center">
                        <RefreshCw size={18} className="text-[#9B9B9B]" />
                      </div>
                      <p className="text-[13px] font-semibold text-[#111111]">No companies to compare</p>
                      <p className="text-[12px] text-[#6B6B6B]">Add tickers using the panel below</p>
                    </div>
                  ) : (
                    <PeerValuationChartCore
                      points={points}
                      domain={domain}
                      isFinancialSector={isFinancialSector}
                      expanded
                      onSelect={setSelectedTicker}
                      selectedTicker={selectedTicker}
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="mt-3 shrink-0">
                  <PeerChartLegend points={points} expanded />
                </div>

                {/* Mobile: selected bubble callout */}
                {selectedPoint && (
                  <div className="mt-3 bg-[#F5F5F5] rounded-xl p-3 flex items-start gap-3 sm:hidden shrink-0">
                    <span className="w-3 h-3 rounded-full mt-0.5 shrink-0" style={{ background: selectedPoint.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[#111111]">{selectedPoint.ticker}</p>
                      <p className="text-[11px] text-[#6B6B6B] truncate">{selectedPoint.name}</p>
                      <div className="flex gap-4 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-[#6B6B6B]">
                          P/E <span className="font-mono font-semibold text-[#111111]">{selectedPoint.x.toFixed(1)}×</span>
                        </span>
                        <span className="text-[11px] text-[#6B6B6B]">
                          EPS growth <span className="font-mono font-semibold text-[#111111]">{selectedPoint.y >= 0 ? '+' : ''}{selectedPoint.y.toFixed(1)}%</span>
                        </span>
                        {selectedPoint.x > 0 && selectedPoint.y > 0 && (
                          <span className="text-[11px] text-[#6B6B6B]">
                            PEG <span className={cn('font-mono font-semibold', (selectedPoint.x / selectedPoint.y) <= 1 ? 'text-[#11875D]' : (selectedPoint.x / selectedPoint.y) <= 2 ? 'text-[#B56A00]' : 'text-[#D83B3B]')}>
                              {(selectedPoint.x / selectedPoint.y).toFixed(2)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setSelectedTicker(null)} className="text-[#9B9B9B] hover:text-[#111111] p-1">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Edit panel: right sidebar on sm+, collapsible bottom on mobile */}
              <div className={cn(
                'border-[#E5E5E5] bg-white sm:border-l sm:w-64 sm:shrink-0 sm:flex sm:flex-col',
                // Mobile: collapsible panel at bottom
                'border-t',
                panelExpanded ? '' : '',
              )}>
                {/* Mobile panel toggle */}
                <button
                  onClick={() => setPanelExpanded(v => !v)}
                  className={cn(
                    'sm:hidden w-full flex items-center justify-between px-4 py-3 min-h-[48px]',
                    panelExpanded ? 'border-b border-[#E5E5E5]' : '',
                  )}
                >
                  <span className="text-[12px] font-semibold text-[#111111]">
                    Companies ({tickers.length})
                  </span>
                  <span className="text-[12px] font-medium text-olive-700">
                    {panelExpanded ? 'Done' : 'Edit'}
                  </span>
                </button>

                {/* Panel content */}
                <div className={cn(
                  'sm:flex sm:flex-col sm:flex-1 sm:overflow-hidden',
                  panelExpanded ? 'flex flex-col' : 'hidden sm:flex',
                )}>
                  {/* Panel header (desktop only) */}
                  <div className="hidden sm:flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5] shrink-0">
                    <span className="text-[12px] font-semibold text-[#111111]">Companies ({tickers.length})</span>
                    {isModified && (
                      <button
                        onClick={resetToOriginal}
                        className="flex items-center gap-1 text-[11px] text-[#6B6B6B] hover:text-olive-700 transition-colors"
                      >
                        <RotateCcw size={10} />
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Chip list */}
                  <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 sm:max-h-[280px]">
                    <AnimatePresence initial={false}>
                      {tickers.map(ticker => {
                        const entry = cache.get(ticker)
                        const color = colorMapRef.current.get(ticker) ?? CHART_COLORS[1]
                        const isAnchor = ticker === anchorTicker
                        const isLoading = entry === 'loading'
                        const hasError = entry === 'error' || (entry != null && typeof entry === 'object' && !('forwardPE' in entry))
                        const name = typeof entry === 'object' && entry !== null && 'name' in entry ? (entry as PeerData).name : ticker

                        return (
                          <motion.div
                            key={ticker}
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: reduced ? 0 : 0.15 }}
                            className={cn(
                              'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border min-h-[44px]',
                              isAnchor ? 'border-[#2563EB]/20 bg-[#EAF1FF]/40' : 'border-[#E5E5E5] bg-white',
                              hasError ? 'border-[#D83B3B]/20 bg-[#FCEAEA]/30' : '',
                            )}
                          >
                            {/* Color swatch */}
                            <span
                              className={cn('w-2.5 h-2.5 rounded-full shrink-0', isLoading ? 'animate-pulse' : '')}
                              style={{ background: color }}
                            />
                            {/* Ticker + name */}
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-semibold font-mono text-[#111111]">{ticker}</span>
                              {name !== ticker && (
                                <span className="text-[10px] text-[#6B6B6B] ml-1.5 truncate hidden sm:inline">{name}</span>
                              )}
                            </div>
                            {/* Status */}
                            {isLoading && <RefreshCw size={11} className="text-[#9B9B9B] animate-spin shrink-0" />}
                            {hasError && !isLoading && (
                              <span title="No forward estimates available" className="text-[#D83B3B] shrink-0">
                                <AlertCircle size={12} />
                              </span>
                            )}
                            {/* Remove / lock */}
                            {isAnchor ? (
                              <span className="text-[#9B9B9B] shrink-0 p-1" title="Anchor company cannot be removed">
                                <Lock size={11} />
                              </span>
                            ) : (
                              <button
                                onClick={() => removeTicker(ticker)}
                                aria-label={`Remove ${ticker}`}
                                className="shrink-0 w-[36px] h-[36px] flex items-center justify-center rounded-lg text-[#9B9B9B] hover:text-[#D83B3B] hover:bg-[#FCEAEA] transition-colors"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Search input */}
                  <div className="px-3 py-2 border-t border-[#E5E5E5] shrink-0" ref={searchRef}>
                    {atMax ? (
                      <p className="text-[11px] text-[#B56A00] py-2 text-center">
                        Maximum {MAX_COMPANIES} companies reached
                      </p>
                    ) : (
                      <div className="relative">
                        <div className="relative flex items-center">
                          <Search size={13} className="absolute left-3 text-[#9B9B9B] pointer-events-none" />
                          <input
                            ref={inputRef}
                            id={searchId}
                            type="text"
                            inputMode="text"
                            autoCapitalize="characters"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onFocus={() => searchQuery.length >= 1 && setShowDropdown(true)}
                            placeholder="Add company…"
                            className="w-full pl-8 pr-3 py-2 text-[16px] sm:text-[13px] bg-[#F5F5F5] focus:bg-white border border-transparent focus:border-[#5F790B] focus:ring-2 focus:ring-[rgba(95,121,11,0.15)] rounded-lg outline-none transition-all placeholder:text-[#9B9B9B] text-[#111111]"
                            style={{ fontSize: '16px' }}
                          />
                          {searchLoading && (
                            <RefreshCw size={12} className="absolute right-3 text-[#9B9B9B] animate-spin" />
                          )}
                        </div>

                        {/* Search dropdown — opens upward */}
                        <AnimatePresence>
                          {showDropdown && searchResults.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-[#E5E5E5] rounded-xl shadow-lg z-10 overflow-hidden max-h-[200px] overflow-y-auto"
                            >
                              {searchResults.map(r => {
                                const alreadyAdded = tickers.includes(r.symbol)
                                return (
                                  <button
                                    key={r.symbol}
                                    onMouseDown={() => {
                                      if (!alreadyAdded) {
                                        addTicker(r.symbol)
                                        setSearchQuery('')
                                        setShowDropdown(false)
                                      }
                                    }}
                                    disabled={alreadyAdded}
                                    className={cn(
                                      'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors min-h-[44px]',
                                      alreadyAdded
                                        ? 'opacity-50 cursor-not-allowed'
                                        : 'hover:bg-[#F5F5F5]',
                                    )}
                                  >
                                    <span className="text-[12px] font-semibold font-mono text-[#111111] w-12 shrink-0">{r.symbol}</span>
                                    <span className="text-[11px] text-[#6B6B6B] truncate flex-1">{r.name}</span>
                                    {alreadyAdded
                                      ? <span className="text-[10px] text-[#9B9B9B] shrink-0">Added</span>
                                      : <span className="text-olive-700 shrink-0 text-[11px] font-semibold">+ Add</span>
                                    }
                                  </button>
                                )
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
