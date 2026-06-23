'use client'
import { useEffect } from 'react'

export type TabId = 'overview' | 'valuation' | 'conviction' | 'financials' | 'news'

interface Props {
  activeTab: TabId
  onChange: (tab: TabId) => void
  isAuthed?: boolean
}

// Tab navigation is now embedded directly in TopBar's floating pill.
// This component only handles keyboard accessibility (scrolling active tab
// into view) and is otherwise a no-op render.
export default function TabNav({ activeTab, onChange: _onChange, isAuthed: _isAuthed = true }: Props) {
  useEffect(() => {
    const el = document.getElementById(`tab-${activeTab}`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [activeTab])

  return null
}
