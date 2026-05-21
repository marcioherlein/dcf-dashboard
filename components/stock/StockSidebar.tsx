'use client'
import OverviewSidebar from './sidebar/OverviewSidebar'
import ValuationSidebar from './sidebar/ValuationSidebar'
import FinancialsSidebar from './sidebar/FinancialsSidebar'
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
        wacc={data.wacc}
        analystRecommendation={data.analystRecommendation ?? ''}
        ratings={data.ratings}
        valuationMethods={data.valuationMethods}
        financialStatements={data.financialStatements}
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
