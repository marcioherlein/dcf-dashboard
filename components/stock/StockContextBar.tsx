'use client'
import { useEffect, useRef } from 'react'
import { useStockNav } from '@/contexts/StockNavContext'
import type { TabId } from './TabNav'

interface Props {
  ticker: string
  companyName: string
  price: number | null
  change: number | null
  changePct: number | null
  currency: string
  sector?: string
  industry?: string
  exchange?: string
  activeTab: TabId
  onChange: (tab: TabId) => void
}

export default function StockContextBar({
  ticker, companyName, price, changePct, currency, activeTab, onChange,
}: Props) {
  const { setStockNav, onTabChangeRef } = useStockNav()
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Keep onTabChangeRef pointing at the stock page's handler (always current, no re-render)
  onTabChangeRef.current = (tab: TabId) => onChangeRef.current(tab)

  useEffect(() => {
    setStockNav({ ticker, companyName, price, changePct, currency, activeTab })
  }, [ticker, companyName, price, changePct, currency, activeTab, setStockNav])

  useEffect(() => {
    return () => {
      setStockNav(null)
      onTabChangeRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStockNav])

  return null
}
