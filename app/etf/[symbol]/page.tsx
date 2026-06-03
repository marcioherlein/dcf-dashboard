'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ETFProfileCard } from '@/components/etf/ETFProfileCard'
import { ETFMetricsGrid } from '@/components/etf/ETFMetricsGrid'
import { ETFHoldingsTable } from '@/components/etf/ETFHoldingsTable'
import { ETFSectorAllocation } from '@/components/etf/ETFSectorAllocation'
import { ETFValuationHistory } from '@/components/etf/ETFValuationHistory'
import { ETFBasketDCF } from '@/components/etf/ETFBasketDCF'
import { saveETFEntry, deleteETFEntry, getETFEntry } from '@/lib/data/etfWatchlistStore'
import type { ETFProfileResponse } from '@/lib/data/etfTypes'

const PriceChart = dynamic(() => import('@/components/stock/PriceChart'), {
  ssr: false,
  loading: () => <div className="min-h-[200px] rounded-xl bg-slate-100 animate-pulse" />,
})

export default function ETFDetailPage() {
  const params = useParams()
  const symbol = (params?.symbol as string ?? '').toUpperCase()
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null

  const [profile, setProfile] = useState<ETFProfileResponse | null>(null)
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
      <div className="min-h-screen bg-[#F1F5F9] px-4 sm:px-8 py-4 sm:py-8">
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
      <div className="min-h-screen bg-[#F1F5F9] px-4 sm:px-8 py-4 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/etf" className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700 mb-6 min-h-[44px]">
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
    <div className="min-h-screen bg-[#F1F5F9]">
      <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-6xl mx-auto space-y-5">
        <Link href="/etf" className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700 min-h-[44px]">
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

        {/* Basket DCF Signal */}
        <ETFBasketDCF holdings={profile.holdings ?? []} />

        {/* Holdings + Sector side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <ETFHoldingsTable holdings={profile.holdings ?? []} />
          </div>
          <div className="lg:col-span-2">
            <ETFSectorAllocation sectorWeights={profile.sectorWeights ?? []} />
          </div>
        </div>

        {/* Value Score History */}
        <ETFValuationHistory ticker={symbol} />

        {/* Price chart */}
        <div className="glass-card-light rounded-2xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Price History</p>
          <div className="min-h-[200px] w-full">
            <PriceChart ticker={symbol} />
          </div>
        </div>
      </div>
    </div>
  )
}
