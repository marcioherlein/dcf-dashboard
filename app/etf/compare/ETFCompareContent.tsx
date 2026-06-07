'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, X, Plus } from 'lucide-react'
import Link from 'next/link'
import { ETFComparisonTable } from '@/components/etf/ETFComparisonTable'
import { ETFComparisonChart } from '@/components/etf/ETFComparisonChart'
import type { ETFProfileResponse } from '@/lib/data/etfTypes'

export default function ETFCompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const symbolsParam = searchParams.get('symbols') ?? ''
  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 4)

  const [profiles, setProfiles] = useState<ETFProfileResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [addInput, setAddInput] = useState('')

  useEffect(() => {
    if (symbols.length === 0) return
    setLoading(true)
    Promise.allSettled(
      symbols.map((ticker) =>
        fetch(`/api/etf/profile?ticker=${encodeURIComponent(ticker)}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
      ),
    ).then((results) => {
      setProfiles(results.filter((r) => r.status === 'fulfilled' && r.value !== null).map((r) => (r as PromiseFulfilledResult<ETFProfileResponse>).value))
      setLoading(false)
    })
  }, [symbolsParam]) // eslint-disable-line react-hooks/exhaustive-deps

  function removeSymbol(ticker: string) {
    const next = symbols.filter((s) => s !== ticker)
    router.replace(next.length > 0 ? `/etf/compare?symbols=${next.join(',')}` : '/etf')
  }

  function addSymbol() {
    const t = addInput.trim().toUpperCase()
    if (!t || symbols.includes(t) || symbols.length >= 4) return
    const next = [...symbols, t]
    router.replace(`/etf/compare?symbols=${next.join(',')}`)
    setAddInput('')
  }

  // Find overlapping holdings across all profiles
  const holdingMap = new Map<string, number>()
  profiles.forEach((p) => {
    p.holdings.slice(0, 5).forEach((h) => {
      holdingMap.set(h.symbol, (holdingMap.get(h.symbol) ?? 0) + 1)
    })
  })
  const sharedHoldings = new Set(Array.from(holdingMap.entries()).filter(([, c]) => c > 1).map(([s]) => s))

  return (
    <div className="min-h-dvh bg-[#F4F3EF]">
      <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-6xl mx-auto space-y-6">

        {/* Back + title */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/etf" className="inline-flex items-center gap-1.5 text-[14px] text-[#566174] hover:text-[#566174] min-h-[44px]">
            <ArrowLeft size={14} /> ETF Tracker
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-[#06101F]" style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif' }}>
            Comparing {symbols.length} ETF{symbols.length !== 1 ? 's' : ''}
          </h1>

          {/* Symbol chips + add input */}
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {symbols.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card-light text-sm font-mono font-black text-[#06101F]">
                {t}
                <button onClick={() => removeSymbol(t)} aria-label={`Remove ${t}`} className="text-[#8A95A6] hover:text-[#566174] transition-colors">
                  <X size={12} />
                </button>
              </span>
            ))}
            {symbols.length < 4 && (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === 'Enter') addSymbol() }}
                  placeholder="Add ticker…"
                  className="px-3 py-1.5 rounded-full border border-[#E3E1DA] bg-white text-sm font-mono text-[#06101F] placeholder:text-[#8A95A6] focus:outline-none focus:ring-2 focus:ring-olive-700 w-28"
                />
                <button
                  onClick={addSymbol}
                  aria-label="Add ETF"
                  className="w-7 h-7 min-h-[44px] rounded-full bg-olive-700 text-white flex items-center justify-center hover:bg-olive-600 transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="h-64 glass-card-light rounded-xl motion-safe:animate-pulse" />
            <div className="h-72 glass-card-light rounded-xl motion-safe:animate-pulse" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="glass-card-light rounded-xl p-8 text-center">
            <p className="text-sm text-[#566174]">No ETF data found. Try a different ticker.</p>
          </div>
        ) : (
          <>
            {/* Metrics comparison table */}
            <section>
              <h2 className="text-base font-bold text-[#06101F] mb-3" style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif' }}>
                Metrics
              </h2>
              <ETFComparisonTable profiles={profiles} />
            </section>

            {/* Price performance chart */}
            <section>
              <h2 className="text-base font-bold text-[#06101F] mb-3" style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif' }}>
                Price Performance (normalized to 100)
              </h2>
              <div className="glass-card-light rounded-xl p-4">
                <ETFComparisonChart symbols={symbols} />
              </div>
            </section>

            {/* Top holdings side-by-side */}
            <section>
              <h2 className="text-base font-bold text-[#06101F] mb-3" style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif' }}>
                Top Holdings
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profiles.map((p) => (
                  <div key={p.ticker} className="glass-card-light rounded-xl p-4">
                    <p className="text-sm font-black font-mono text-[#06101F] mb-3">{p.ticker}</p>
                    <div className="space-y-1.5">
                      {p.holdings.slice(0, 5).map((h) => (
                        <div key={h.symbol} className="flex items-center justify-between gap-2">
                          <span className={`font-mono font-bold text-xs ${sharedHoldings.has(h.symbol) ? 'text-[#2563EB]' : 'text-[#566174]'}`}>
                            {h.symbol}
                          </span>
                          <span className="text-xs text-[#8A95A6] truncate flex-1 mx-2">{h.name}</span>
                          <span className="text-xs font-mono font-semibold text-[#566174] shrink-0">
                            {h.weight != null ? (h.weight * 100).toFixed(2) + '%' : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {sharedHoldings.size > 0 && (
                      <p className="text-[10px] text-[#2563EB] font-semibold mt-2">Blue = shared across ETFs</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
