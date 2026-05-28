'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ETFProfileCard } from '@/components/etf/ETFProfileCard'
import { ETFMetricsGrid } from '@/components/etf/ETFMetricsGrid'
import { ETFHoldingsTable } from '@/components/etf/ETFHoldingsTable'
import { ETFSectorAllocation } from '@/components/etf/ETFSectorAllocation'
import PriceChart from '@/components/stock/PriceChart'
import { saveETFEntry, deleteETFEntry, getETFEntry } from '@/lib/data/etfWatchlistStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ETFProfile = any

export default function ETFDetailPage() {
  const params = useParams()
  const symbol = (params?.symbol as string ?? '').toUpperCase()
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null

  const [profile, setProfile] = useState<ETFProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isWatchlisted, setIsWatchlisted] = useState(false)

  useEffect(() => {
    if (symbol) setIsWatchlisted(getETFEntry(symbol) != null)
  }, [symbol])

  const fetchProfile = useCallback(async () => {
    if (!symbol) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/etf/profile?ticker=${encodeURIComponent(symbol)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setProfile(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ETF data')
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  async function handleWatchlist() {
    if (!profile) return
    if (isWatchlisted) {
      await deleteETFEntry(symbol, userEmail)
      setIsWatchlisted(false)
    } else {
      await saveETFEntry(
        {
          ticker: symbol,
          name: profile.name ?? null,
          valueScore: profile.valueScore ?? null,
          expenseRatio: profile.expenseRatio ?? null,
          yield: profile.yield ?? null,
          peRatio: profile.peRatio ?? null,
          pbRatio: profile.pbRatio ?? null,
          totalAssets: profile.aum ?? null,
          addedAt: new Date().toISOString(),
        },
        userEmail,
      )
      setIsWatchlisted(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-40 bg-white rounded-2xl border border-slate-200 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 bg-white rounded-xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#F8FAFB] px-4 sm:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/etf" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
            <ArrowLeft size={14} /> ETF Tracker
          </Link>
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <p className="text-sm text-slate-500">{error ?? 'ETF not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <div className="px-4 sm:px-8 py-8 max-w-6xl mx-auto space-y-5">
        <Link href="/etf" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> ETF Tracker
        </Link>

        {/* Profile card */}
        <ETFProfileCard
          profile={profile}
          isWatchlisted={isWatchlisted}
          onWatchlist={handleWatchlist}
        />

        {/* Metrics grid */}
        <ETFMetricsGrid metrics={profile} />

        {/* Holdings + Sector side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <ETFHoldingsTable holdings={profile.holdings ?? []} />
          </div>
          <div className="lg:col-span-2">
            <ETFSectorAllocation sectorWeights={profile.sectorWeights ?? []} />
          </div>
        </div>

        {/* Price chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-3">Price History</p>
          <p className="text-[11px] text-slate-400 mb-3">Tip: use the comparison input in the chart to overlay SPY, QQQ, or any ticker.</p>
          <PriceChart ticker={symbol} />
        </div>
      </div>
    </div>
  )
}
