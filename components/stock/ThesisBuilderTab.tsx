'use client'

import { useState, useEffect } from 'react'
import SimplifierTabs from '@/components/simplifier/SimplifierTabs'
import { buildAutoMap } from '@/lib/simplifier/autoMapper'
import { getWatchlistEntry, saveWatchlistEntry } from '@/lib/simplifier/watchlistStore'
import type { WatchlistEntry } from '@/lib/simplifier/types'
import { useSession } from 'next-auth/react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiData = any

interface Props {
  ticker: string
  data: ApiData
}

export default function ThesisBuilderTab({ ticker, data }: Props) {
  const { data: session } = useSession()
  const [initialEntry, setInitialEntry] = useState<Pick<WatchlistEntry, 'answers' | 'notes' | 'listTag'> | null>(null)

  useEffect(() => {
    const entry = getWatchlistEntry(ticker)
    if (entry) {
      setInitialEntry({ answers: entry.answers, notes: entry.notes, listTag: entry.listTag })
    } else {
      setInitialEntry(null)
    }
  }, [ticker])

  const autoMap = buildAutoMap(data)

  const handleSave = async (partial: Partial<WatchlistEntry>) => {
    const existing = getWatchlistEntry(ticker)
    const entry: WatchlistEntry = {
      ticker,
      companyName: data?.companyName ?? ticker,
      updatedAt: new Date().toISOString(),
      currentPhase: existing?.currentPhase ?? 1,
      answers: existing?.answers ?? {},
      notes: existing?.notes ?? {},
      phaseScores: existing?.phaseScores ?? {},
      overallScore: existing?.overallScore ?? null,
      snapshot: existing?.snapshot ?? {
        grossMargin:  data?.businessProfile?.grossMargin ?? null,
        fcfMargin:    data?.businessProfile?.fcfMargin   ?? null,
        moatScore:    data?.ratings?.moat?.score         ?? null,
        roic:         data?.scores?.roic?.roic           ?? null,
        cagr3y:       data?.cagrAnalysis?.historicalCagr3y ?? null,
        insiderPct:   data?.ownership?.insiderPct        ?? null,
        beta:         data?.wacc?.inputs?.beta           ?? null,
        fairValue:    data?.valuationMethods?.triangulatedFairValue ?? data?.fairValue?.fairValuePerShare ?? null,
        upsidePct:    data?.valuationMethods?.triangulatedUpsidePct ?? data?.fairValue?.upsidePct ?? null,
        price:        data?.quote?.price                 ?? null,
        marketCap:    data?.quote?.marketCap             ?? null,
      },
      listTag: existing?.listTag ?? null,
      ...partial,
    }
    await saveWatchlistEntry(entry, session?.user?.email ?? null)
    // Refresh local state so Save button stays in sync
    const updated = getWatchlistEntry(ticker)
    if (updated) {
      setInitialEntry({ answers: updated.answers, notes: updated.notes, listTag: updated.listTag })
    }
  }

  return (
    <div className="w-full min-w-0">
      <SimplifierTabs
        ticker={ticker}
        companyName={data?.companyName ?? ticker}
        sector={data?.quote?.sector ?? ''}
        industry={data?.businessProfile?.industry ?? ''}
        country={data?.businessProfile?.country ?? ''}
        price={data?.quote?.price ?? null}
        upsidePct={data?.valuationMethods?.triangulatedUpsidePct ?? data?.fairValue?.upsidePct ?? null}
        peRatio={data?.quote?.peRatio ?? null}
        marketCap={data?.quote?.marketCap ?? null}
        beta={data?.wacc?.inputs?.beta ?? null}
        grossMargin={data?.businessProfile?.grossMargin ?? null}
        fcfMargin={data?.businessProfile?.fcfMargin ?? null}
        description={data?.businessProfile?.description ?? ''}
        wikiBio={null}
        data={data}
        autoMap={autoMap}
        initialEntry={initialEntry}
        onSave={handleSave}
      />
    </div>
  )
}
