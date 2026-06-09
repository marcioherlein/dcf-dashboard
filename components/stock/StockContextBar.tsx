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
  onSave?: () => void
  onShare?: () => void
  nextEarningsDate?: string | null
  marketState?: string | null
  preMarketPrice?: number | null
  preMarketChangePct?: number | null
  postMarketPrice?: number | null
  postMarketChangePct?: number | null
}

export default function StockContextBar({
  ticker, companyName, price, changePct, currency, activeTab, onChange, onSave, onShare, nextEarningsDate,
  marketState, preMarketPrice, preMarketChangePct, postMarketPrice, postMarketChangePct,
}: Props) {
  const { setStockNav, onTabChangeRef, onSaveRef, onShareRef } = useStockNav()
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  onTabChangeRef.current = (tab: TabId) => onChangeRef.current(tab)
  onSaveRef.current = onSave ?? null
  onShareRef.current = onShare ?? null

  useEffect(() => {
    setStockNav({
      ticker, companyName, price, changePct, currency, activeTab, nextEarningsDate,
      marketState, preMarketPrice, preMarketChangePct, postMarketPrice, postMarketChangePct,
    })
  }, [ticker, companyName, price, changePct, currency, activeTab, nextEarningsDate,
      marketState, preMarketPrice, preMarketChangePct, postMarketPrice, postMarketChangePct,
      setStockNav])

  useEffect(() => {
    return () => {
      setStockNav(null)
      onTabChangeRef.current = null
      onSaveRef.current = null
      onShareRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStockNav])

  return null
}
