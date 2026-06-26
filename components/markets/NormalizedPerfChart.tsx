'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Plus, X } from 'lucide-react'
import type { ChartPoint } from '@/app/api/markets/chart/route'

const PERIODS = ['5D', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y'] as const
type Period = typeof PERIODS[number]

const DEFAULT_SERIES = [
  { symbol: '^NDX',  label: 'Nasdaq 100', color: '#2563EB' },
  { symbol: '^GSPC', label: 'S&P 500',    color: '#111111' },
  { symbol: '^DJI',  label: 'Dow Jones',  color: '#B56A00' },
  { symbol: '^VIX',  label: 'CBOE VIX',   color: '#D83B3B' },
  { symbol: 'FXI',   label: 'China',      color: '#ef4444' },
]

const COLORS = ['#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#a855f7']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, allSeries }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white/97 border border-[#E5E5E5] rounded-xl shadow-lg px-3 py-2.5 text-xs min-w-[160px]">
      <div className="text-[#6B6B6B] font-mono mb-1.5 text-[10px]">{label}</div>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-[#6B6B6B]">{allSeries.find((s: { symbol: string }) => s.symbol === p.name)?.label ?? p.name}</span>
          </div>
          <span className={cn('font-mono font-bold', p.value >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
            {p.value >= 0 ? '+' : ''}{p.value?.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  )
}

export default function NormalizedPerfChart() {
  const [period, setPeriod] = useState<Period>('YTD')
  const [customSeries, setCustomSeries] = useState<{ symbol: string; label: string; color: string }[]>([])
  const [active, setActive] = useState<Set<string>>(new Set(DEFAULT_SERIES.map(s => s.symbol)))
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddInput, setShowAddInput] = useState(false)
  const [addValue, setAddValue] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  const allSeries = [...DEFAULT_SERIES, ...customSeries]

  const fetchData = useCallback(async (p: Period, symbols: string[]) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/markets/chart?symbols=${symbols.join(',')}&period=${p}`)
      const json = await res.json()
      setData(json.points ?? [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(period, allSeries.map(s => s.symbol))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customSeries])

  useEffect(() => {
    if (showAddInput) addInputRef.current?.focus()
  }, [showAddInput])

  const toggleSeries = (sym: string) => {
    setActive(prev => {
      const next = new Set(prev)
      if (next.has(sym)) { if (next.size > 1) next.delete(sym) }
      else next.add(sym)
      return next
    })
  }

  function addCustomSymbol() {
    const sym = addValue.trim().toUpperCase()
    if (!sym || allSeries.find(s => s.symbol === sym)) {
      setAddValue('')
      setShowAddInput(false)
      return
    }
    const color = COLORS[customSeries.length % COLORS.length]
    const newSeries = { symbol: sym, label: sym, color }
    setCustomSeries(prev => [...prev, newSeries])
    setActive(prev => new Set(Array.from(prev).concat(sym)))
    setAddValue('')
    setShowAddInput(false)
  }

  function removeCustomSymbol(sym: string) {
    setCustomSeries(prev => prev.filter(s => s.symbol !== sym))
    setActive(prev => { const n = new Set(prev); n.delete(sym); return n })
  }

  const displayData = data.length > 200
    ? data.filter((_, i) => i % Math.ceil(data.length / 200) === 0 || i === data.length - 1)
    : data

  const fmtDate = (d: string) => {
    if (!d) return ''
    const date = new Date(d)
    if (period === '5D') return date.toLocaleDateString('en-US', { weekday: 'short' })
    if (['1M', '3M'].includes(period)) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  }

  const lastPoint = displayData[displayData.length - 1]

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden flex flex-col flex-1">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#E5E5E5]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[#6B6B6B] shrink-0">Normalized Performance</span>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide ml-2">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2 py-0.5 h-7 flex items-center text-[11px] font-semibold rounded transition-colors',
                  period === p ? 'bg-olive-700 text-white' : 'text-[#6B6B6B] hover:text-[#111111] hover:bg-[#E3E1DA]'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {/* Series toggle chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
          {allSeries.map(s => {
            const val = lastPoint?.[s.symbol] as number | undefined
            const isOn = active.has(s.symbol)
            const isCustom = customSeries.find(c => c.symbol === s.symbol)
            const tooltipLabel = val != null ? `${s.label}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}%` : s.label
            return (
              <div key={s.symbol} className="relative group shrink-0">
                <button
                  onClick={() => toggleSeries(s.symbol)}
                  title={tooltipLabel}
                  aria-label={tooltipLabel}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 h-7 rounded-full text-[11px] font-semibold border transition-all whitespace-nowrap',
                    isOn
                      ? 'border-transparent text-white'
                      : 'border-[#E5E5E5] bg-transparent text-[#6B6B6B] opacity-50'
                  )}
                  style={isOn ? { background: s.color } : {}}
                >
                  <span>{s.label}</span>
                  {val != null && isOn && (
                    <span className="opacity-80 font-normal hidden sm:inline">
                      {val >= 0 ? '+' : ''}{val.toFixed(1)}%
                    </span>
                  )}
                </button>
                {isCustom && (
                  <button
                    onClick={() => removeCustomSymbol(s.symbol)}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#566174] text-white flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    <X size={8} />
                  </button>
                )}
              </div>
            )
          })}
          {/* Add symbol button */}
          {showAddInput ? (
            <form
              onSubmit={e => { e.preventDefault(); addCustomSymbol() }}
              className="flex items-center gap-1 shrink-0"
            >
              <input
                ref={addInputRef}
                value={addValue}
                onChange={e => setAddValue(e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="w-20 px-2 py-0.5 text-[16px] rounded-full border border-[#93B4F5] bg-white text-[#111111] outline-none focus:border-blue-500"
              />
              <button type="submit" className="text-[11px] font-semibold text-olive-700 hover:text-[#2563EB] py-1">Add</button>
              <button type="button" onClick={() => setShowAddInput(false)} className="text-[11px] text-[#6B6B6B] hover:text-[#6B6B6B] py-1">✕</button>
            </form>
          ) : (
            <button
              onClick={() => setShowAddInput(true)}
              className="flex items-center gap-1 px-2 py-0.5 h-7 rounded-full text-[11px] font-semibold border border-dashed border-[#E5E5E5] text-[#6B6B6B] hover:border-[#93B4F5] hover:text-[#2563EB] transition-colors"
            >
              <Plus size={10} /> Add
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 py-3 flex-1" style={{ minHeight: 'clamp(200px, 28vw, 260px)' }}>
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#8A95A6] motion-safe:animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtDate}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `${(v as number).toFixed(0)}%`}
                width={36}
              />
              <Tooltip content={(props) => <ChartTooltip {...props} allSeries={allSeries} />} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 2" />
              {allSeries.filter(s => active.has(s.symbol)).map(s => (
                <Line
                  key={s.symbol}
                  type="monotone"
                  dataKey={s.symbol}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
