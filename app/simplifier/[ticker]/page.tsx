'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { buildAutoMap }      from '@/lib/simplifier/autoMapper'
import { getWatchlistEntry, saveWatchlistEntry } from '@/lib/simplifier/watchlistStore'
import { scoreAll, overallScore } from '@/lib/simplifier/scoring'
import type { WatchlistEntry, SimplifierAutoMap, FinancialSnapshot } from '@/lib/simplifier/types'
import type { FinancialsData }  from '@/lib/simplifier/autoMapper'
import SimplifierTabs from '@/components/simplifier/SimplifierTabs'

export default function SimplifierTickerPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const router     = useRouter()
  const { data: session } = useSession()
  const userEmail  = session?.user?.email ?? null

  const [data, setData]       = useState<FinancialsData & Record<string, unknown> | null>(null)
  const [autoMap, setAutoMap] = useState<SimplifierAutoMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [existing, setExisting] = useState<Pick<WatchlistEntry, 'answers' | 'notes' | 'listTag'> | null>(null)
  const [wikiBio, setWikiBio] = useState<string | null>(null)

  const upperTicker = ticker.toUpperCase()

  useEffect(() => {
    setLoading(true)
    setError('')

    // Load any previously saved entry from localStorage
    const saved = getWatchlistEntry(upperTicker)
    if (saved) setExisting({ answers: saved.answers, notes: saved.notes, listTag: saved.listTag })

    fetch(`/api/financials?ticker=${upperTicker}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return }
        setData(d)
        setAutoMap(buildAutoMap(d as FinancialsData))

        // Non-blocking Wikipedia bio (optional enrichment)
        const name = d.companyName ?? upperTicker
        const wikiTitle = encodeURIComponent(name.split(' ').slice(0, 3).join(' '))
        fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${wikiTitle}&prop=extracts&exintro=true&explaintext=true&format=json&origin=*`)
          .then((r) => r.json())
          .then((wiki) => {
            const pages = wiki?.query?.pages ?? {}
            const page  = Object.values(pages)[0] as { extract?: string } | undefined
            if (page?.extract) {
              const firstPara = page.extract.split('\n').find((l: string) => l.trim().length > 80)
              if (firstPara) setWikiBio(firstPara.slice(0, 400) + (firstPara.length > 400 ? '…' : ''))
            }
          })
          .catch(() => {})
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [upperTicker])

  async function handleSave(partial: Partial<WatchlistEntry>) {
    if (!data) return

    const phaseScores = partial.phaseScores ?? scoreAll(partial.answers ?? {})
    const overall     = partial.overallScore ?? overallScore(phaseScores)

    const snapshot: FinancialSnapshot = {
      grossMargin:  (data as any).businessProfile?.grossMargin ?? null,
      fcfMargin:    (data as any).businessProfile?.fcfMargin ?? null,
      moatScore:    (data as any).ratings?.moat?.score ?? null,
      roic:         (data as any).scores?.roic?.roic ?? null,
      cagr3y:       (data as any).cagrAnalysis?.historicalCagr3y ?? null,
      insiderPct:   (data as any).ownership?.insiderPct ?? null,
      beta:         (data as any).wacc?.inputs?.beta ?? null,
      upsidePct:    (data as any).fairValue?.upsidePct ?? null,
      price:        (data as any).quote?.price ?? null,
      marketCap:    (data as any).quote?.marketCap ?? null,
    }

    const entry: WatchlistEntry = {
      ticker:       upperTicker,
      companyName:  (data as any).companyName ?? upperTicker,
      updatedAt:    new Date().toISOString(),
      currentPhase: partial.currentPhase ?? 5,
      answers:      partial.answers ?? {},
      notes:        partial.notes ?? {},
      phaseScores,
      overallScore: overall,
      snapshot,
      listTag:      partial.listTag ?? null,
    }

    await saveWatchlistEntry(entry, userEmail)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F6F1] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#6B6A72] text-sm">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Loading {upperTicker}…
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F7F6F1] flex flex-col items-center justify-center gap-4">
        <p className="text-[#cf222e] text-sm">{error || 'Failed to load data'}</p>
        <button onClick={() => router.back()} className="text-[#1f6feb] text-sm hover:underline">Go back</button>
      </div>
    )
  }

  const companyName = (data as any).companyName ?? upperTicker
  const price       = (data as any).quote?.price ?? null
  const upsidePct   = (data as any).fairValue?.upsidePct ?? null
  const sector      = (data as any).quote?.sector ?? ''
  const industry    = (data as any).quote?.industry ?? ''
  const country     = (data as any).businessProfile?.country ?? ''
  const marketCap   = (data as any).quote?.marketCap ?? null
  const peRatio     = (data as any).quote?.peRatio ?? null
  const beta        = (data as any).wacc?.inputs?.beta ?? null
  const grossMargin = (data as any).businessProfile?.grossMargin ?? null
  const fcfMargin   = (data as any).businessProfile?.fcfMargin ?? null
  const description = (data as any).quote?.longBusinessSummary ?? ''

  return (
    <div className="min-h-screen bg-[#F7F6F1]">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#6B6A72] mb-5">
          <Link href="/simplifier" className="hover:text-[#1f6feb] transition-colors">Simplifier</Link>
          <span>/</span>
          <span className="text-[#2D2C31] font-mono font-semibold">{upperTicker}</span>
        </div>

        {/* Tab-based analysis */}
        <div className="rounded-2xl border border-[#E8E6E0] bg-white overflow-hidden shadow-sm">
          <SimplifierTabs
            ticker={upperTicker}
            companyName={companyName}
            sector={sector}
            industry={industry}
            country={country}
            price={price}
            upsidePct={upsidePct}
            peRatio={peRatio}
            marketCap={marketCap}
            beta={beta}
            grossMargin={grossMargin}
            fcfMargin={fcfMargin}
            description={description}
            wikiBio={wikiBio}
            data={data as FinancialsData}
            autoMap={autoMap}
            initialEntry={existing}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  )
}
