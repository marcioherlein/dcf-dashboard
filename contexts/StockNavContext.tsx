'use client'
import { createContext, useContext, useState, useRef, type ReactNode } from 'react'
import type { TabId } from '@/components/stock/TabNav'

export interface StockNavState {
  ticker: string
  companyName: string
  price: number | null
  changePct: number | null
  currency: string
  activeTab: TabId
  nextEarningsDate?: string | null
  marketState?: string | null
  preMarketPrice?: number | null
  preMarketChangePct?: number | null
  postMarketPrice?: number | null
  postMarketChangePct?: number | null
}

interface StockNavContextValue {
  stockNav: StockNavState | null
  setStockNav: (nav: StockNavState | null) => void
  onTabChangeRef: React.MutableRefObject<((tab: TabId) => void) | null>
  onSaveRef: React.MutableRefObject<(() => void) | null>
  onShareRef: React.MutableRefObject<(() => void) | null>
}

const StockNavContext = createContext<StockNavContextValue>({
  stockNav: null,
  setStockNav: () => {},
  onTabChangeRef: { current: null },
  onSaveRef: { current: null },
  onShareRef: { current: null },
})

export function StockNavProvider({ children }: { children: ReactNode }) {
  const [stockNav, setStockNav] = useState<StockNavState | null>(null)
  const onTabChangeRef = useRef<((tab: TabId) => void) | null>(null)
  const onSaveRef = useRef<(() => void) | null>(null)
  const onShareRef = useRef<(() => void) | null>(null)

  return (
    <StockNavContext.Provider value={{ stockNav, setStockNav, onTabChangeRef, onSaveRef, onShareRef }}>
      {children}
    </StockNavContext.Provider>
  )
}

export function useStockNav() {
  return useContext(StockNavContext)
}
