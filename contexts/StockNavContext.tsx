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
}

interface StockNavContextValue {
  stockNav: StockNavState | null
  setStockNav: (nav: StockNavState | null) => void
  onTabChangeRef: React.MutableRefObject<((tab: TabId) => void) | null>
  onSaveRef: React.MutableRefObject<(() => void) | null>
}

const StockNavContext = createContext<StockNavContextValue>({
  stockNav: null,
  setStockNav: () => {},
  onTabChangeRef: { current: null },
  onSaveRef: { current: null },
})

export function StockNavProvider({ children }: { children: ReactNode }) {
  const [stockNav, setStockNav] = useState<StockNavState | null>(null)
  const onTabChangeRef = useRef<((tab: TabId) => void) | null>(null)
  const onSaveRef = useRef<(() => void) | null>(null)

  return (
    <StockNavContext.Provider value={{ stockNav, setStockNav, onTabChangeRef, onSaveRef }}>
      {children}
    </StockNavContext.Provider>
  )
}

export function useStockNav() {
  return useContext(StockNavContext)
}
