'use client'

import { useState } from 'react'
import type { AllAnswers, Answer, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import type { WatchlistEntry } from '@/lib/simplifier/types'
import SimplifierTabBar, { type TabId } from './SimplifierTabBar'
import TickerTab from './tabs/TickerTab'
import BusinessTab from './tabs/BusinessTab'
import MoatTab from './tabs/MoatTab'
import GrowthTab from './tabs/GrowthTab'
import ManagementTab from './tabs/ManagementTab'
import RiskTab from './tabs/RiskTab'
import ValuationTab from './tabs/ValuationTab'
import ScoreTab from './tabs/ScoreTab'

interface SimplifierTabsProps {
  ticker: string
  companyName: string
  sector: string
  industry: string
  country: string
  price: number | null
  upsidePct: number | null
  peRatio: number | null
  marketCap: number | null
  beta: number | null
  grossMargin: number | null
  fcfMargin: number | null
  description: string
  wikiBio: string | null
  data: FinancialsData
  autoMap: SimplifierAutoMap
  initialEntry: Pick<WatchlistEntry, 'answers' | 'notes'> | null
  onSave: (partial: Partial<WatchlistEntry>) => Promise<void>
}

export default function SimplifierTabs({
  ticker, companyName, sector, industry, country, price, upsidePct, peRatio,
  marketCap, beta, grossMargin, fcfMargin, description, wikiBio,
  data, autoMap, initialEntry, onSave,
}: SimplifierTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('ticker')
  const [answers, setAnswers]     = useState<AllAnswers>(initialEntry?.answers ?? {})
  const [notes, setNotes]         = useState<NoteMap>(initialEntry?.notes ?? {})
  const [saving, setSaving]       = useState(false)

  function handleChange(id: string, answer: Answer) {
    setAnswers(prev => ({ ...prev, [id]: answer }))
  }

  function handleNoteChange(id: string, note: string) {
    setNotes(prev => ({ ...prev, [id]: note }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ answers, notes })
    } finally {
      setSaving(false)
    }
  }

  const sharedProps = { companyName, data, answers, notes, autoMap, onChange: handleChange, onNoteChange: handleNoteChange }

  return (
    <div className="flex flex-col">
      <SimplifierTabBar activeTab={activeTab} answers={answers} onTabChange={setActiveTab} />

      <div className="p-4 sm:p-6">
        {activeTab === 'ticker' && (
          <TickerTab
            ticker={ticker}
            companyName={companyName}
            price={price}
            upsidePct={upsidePct}
            sector={sector}
            industry={industry}
            country={country}
            marketCap={marketCap}
            peRatio={peRatio}
            beta={beta}
            grossMargin={grossMargin}
            fcfMargin={fcfMargin}
            description={description}
            wikiBio={wikiBio}
          />
        )}
        {activeTab === 'business'   && <BusinessTab   {...sharedProps} />}
        {activeTab === 'moat'       && <MoatTab       {...sharedProps} />}
        {activeTab === 'growth'     && <GrowthTab     {...sharedProps} />}
        {activeTab === 'management' && <ManagementTab {...sharedProps} />}
        {activeTab === 'risk'       && <RiskTab       {...sharedProps} />}
        {activeTab === 'valuation'  && <ValuationTab  {...sharedProps} />}
        {activeTab === 'score' && (
          <ScoreTab
            ticker={ticker}
            companyName={companyName}
            answers={answers}
            onSave={handleSave}
            saving={saving}
          />
        )}
      </div>
    </div>
  )
}
