'use client'
import OverviewSidebar from './sidebar/OverviewSidebar'
import ValuationSidebar from './sidebar/ValuationSidebar'
import FinancialsSidebar from './sidebar/FinancialsSidebar'
import RisksSidebar from './sidebar/RisksSidebar'
import type { TabId } from './TabNav'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any

interface Props {
  activeTab: TabId
  data: AnyData
  statementsData: AnyData
}

export default function StockSidebar({ activeTab, data, statementsData: _statementsData }: Props) {
  if (!data) return null

  if (activeTab === 'overview') {
    return (
      <OverviewSidebar
        quote={data.quote}
        cagrAnalysis={data.cagrAnalysis}
        businessProfile={data.businessProfile}
        ownership={data.ownership}
        wacc={data.wacc}
        analystRecommendation={data.analystRecommendation ?? ''}
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

  if (activeTab === 'risks') {
    return (
      <RisksSidebar
        ratings={data.ratings}
        scores={data.scores}
        ownership={data.ownership}
      />
    )
  }

  return null
}
