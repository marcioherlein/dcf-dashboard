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
import PhaseWizard from '@/components/simplifier/PhaseWizard'

export default function SimplifierTickerPage() {
  const { ticker } = useParams<{ ticker: string }>()
  const router     = useRouter()
  const { data: session } = useSession()
  const userEmail  = session?.user?.email ?? null

  const [data, setData]       = useState<FinancialsData & Record<string, unknown> | null>(null)
  const [autoMap, setAutoMap] = useState<SimplifierAutoMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [existing, setExisting] = useState<Pick<WatchlistEntry, 'answers' | 'notes'> | null>(null)
  const [wikiBio, setWikiBio] = useState<string | null>(null)

  const upperTicker = ticker.toUpperCase()

  useEffect(() => {
    setLoading(true)
    setError('')

    // Load any previously saved entry from localStorage
    const saved = getWatchlistEntry(upperTicker)
    if (saved) setExisting({ answers: saved.answers, notes: saved.notes })

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
      currentPhase: partial.currentPhase ?? 1,
      answers:      partial.answers ?? {},
      notes:        partial.notes ?? {},
      phaseScores,
      overallScore: overall,
      snapshot,
    }

    await saveWatchlistEntry(entry, userEmail)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="flex items-center gap-2 text-[#8b949e] text-sm">
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
      <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center gap-4">
        <p className="text-[#f85149] text-sm">{error || 'Failed to load data'}</p>
        <button onClick={() => router.back()} className="text-[#79c0ff] text-sm hover:underline">Go back</button>
      </div>
    )
  }

  const companyName  = (data as any).companyName ?? upperTicker
  const price        = (data as any).quote?.price ?? null
  const sector       = (data as any).quote?.sector ?? ''
  const upsidePct    = (data as any).fairValue?.upsidePct ?? null
  const moatScore    = (data as any).ratings?.moat?.score ?? null
  const grossMargin  = (data as any).businessProfile?.grossMargin ?? null
  const fcfMargin    = (data as any).businessProfile?.fcfMargin ?? null
  const cagr3y       = (data as any).cagrAnalysis?.historicalCagr3y ?? null
  const roic         = (data as any).scores?.roic?.roic ?? null
  const beta         = (data as any).wacc?.inputs?.beta ?? null
  const insiderPct   = (data as any).ownership?.insiderPct ?? null
  const altmanZone   = (data as any).scores?.altman?.zone ?? null
  const beneishFlag  = (data as any).scores?.beneish?.flag ?? null
  const piotroskiScore = (data as any).scores?.piotroski?.score ?? null

  const pct = (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : null

  const keyMetrics = [
    price != null        && { label: 'Price',       value: `$${price.toFixed(2)}` },
    upsidePct != null    && { label: 'Upside',      value: pct(upsidePct)! },
    moatScore != null    && { label: 'Moat',        value: `${moatScore.toFixed(1)}/5` },
    grossMargin != null  && { label: 'Gross Margin',value: pct(grossMargin)! },
    fcfMargin != null    && { label: 'FCF Margin',  value: pct(fcfMargin)! },
    cagr3y != null       && { label: '3Y CAGR',     value: pct(cagr3y)! },
    roic != null         && { label: 'ROIC',        value: pct(roic)! },
    beta != null         && { label: 'Beta',        value: beta.toFixed(2) },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="min-h-screen bg-[#080808] text-[#e6edf3]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#8b949e] mb-6">
          <Link href="/simplifier" className="hover:text-[#e6edf3] transition-colors">Simplifier</Link>
          <span>/</span>
          <span className="text-[#e6edf3] font-mono">{upperTicker}</span>
        </div>

        {/* Stock header */}
        <div className="rounded-xl border border-[#21262d] bg-[#0d1117] p-5 mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-[#e6edf3] text-xl font-semibold font-mono">{upperTicker}</h1>
              <p className="text-[#8b949e] text-sm mt-0.5">{companyName}</p>
              {sector && <p className="text-[#484f58] text-xs mt-1">{sector}</p>}
            </div>
            {price != null && (
              <div className="text-right">
                <p className="text-[#e6edf3] text-xl font-semibold font-mono">${price.toFixed(2)}</p>
                {upsidePct != null && (
                  <p className={`text-sm font-mono ${upsidePct >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                    {upsidePct >= 0 ? '+' : ''}{(upsidePct * 100).toFixed(1)}% upside
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Key metrics strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {keyMetrics.map((m) => (
              <div key={m.label} className="flex items-center gap-1">
                <span className="text-[#484f58] text-[11px]">{m.label}</span>
                <span className="text-[#8b949e] text-[11px] font-mono">{m.value}</span>
              </div>
            ))}
          </div>

          {/* Wikipedia bio — shown when available */}
          {wikiBio && (
            <p className="text-[#8b949e] text-xs leading-relaxed mt-3 pt-3 border-t border-[#21262d]">
              {wikiBio}
            </p>
          )}
        </div>

        {/* Wizard */}
        <PhaseWizard
          autoMap={autoMap}
          financialsMeta={{
            ticker: upperTicker,
            companyName,
            sector,
            grossMargin,
            fcfMargin,
            cagr3y,
            moatScore,
            roic,
            beta,
            upsidePct,
            insiderPct,
            altmanZone,
            beneishFlag,
            piotroskiScore,
          }}
          initialEntry={existing}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
