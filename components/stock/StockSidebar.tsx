'use client'
import { useMemo } from 'react'
import OverviewSidebar from './sidebar/OverviewSidebar'
import ValuationSidebar from './sidebar/ValuationSidebar'
import FinancialsSidebar from './sidebar/FinancialsSidebar'
import { deriveFinancialInsightMetrics } from '@/lib/stock/deriveFinancialInsightMetrics'
import type { TabId } from './TabNav'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

interface Props {
  activeTab: TabId
  data: AnyData
  statementsData: AnyData
  onNavigateToFinancials?: (rowKey: string, statement: 'income' | 'balance' | 'cashflow') => void
  onNavigateToFinancialsSection?: (section: 'analysts' | 'snapshot' | 'ownership') => void
  activeValuationMethodId?: string | null
}

export default function StockSidebar({ activeTab, data, statementsData, activeValuationMethodId, onNavigateToFinancialsSection }: Props) {
  const derivedInsights = useMemo(() => {
    if (!data) return null
    return deriveFinancialInsightMetrics({
      statementsData,
      financialStatements: data.financialStatements,
      quote: data.quote,
      businessProfile: data.businessProfile,
      valuationMethods: data.valuationMethods,
      fxRate: data.providerStatus?.fx?.rate ?? 1,
    })
  }, [statementsData, data])

  if (!data) return null

  if (activeTab === 'overview') {
    return (
      <OverviewSidebar
        quote={data.quote}
        cagrAnalysis={data.cagrAnalysis}
        analystRecommendation={data.analystRecommendation ?? ''}
        wacc={data.wacc ?? null}
        fairValueData={data.fairValue ?? null}
        ownership={data.ownership}
        businessProfile={data.businessProfile}
        ticker={data.ticker}
        onViewAnalysts={() => onNavigateToFinancialsSection?.('analysts')}
        onViewSnapshot={() => onNavigateToFinancialsSection?.('snapshot')}
        onViewOwnership={() => onNavigateToFinancialsSection?.('ownership')}
      />
    )
  }

  if (activeTab === 'valuation') {
    return (
      <ValuationSidebar
        wacc={data.wacc}
        valuationMethods={data.valuationMethods}
        fairValue={data.fairValue}
        currentPrice={data.quote.price}
        currency={data.quote.currency ?? 'USD'}
        scenarios={data.scenarios}
        cagr={data.cagr}
        terminalG={data.terminalG}
        activeMethodId={activeValuationMethodId}
        derivedInsights={derivedInsights!}
        cagrAnalysis={data.cagrAnalysis}
        sector={data.quote?.sector ?? null}
      />
    )
  }

  if (activeTab === 'financials') {
    return (
      <FinancialsSidebar
        businessProfile={data.businessProfile}
        scores={data.scores}
        financialStatements={data.financialStatements}
        ownership={data.ownership}
      />
    )
  }

  // Risks tab: no sidebar (content is self-contained)
  return null
}
