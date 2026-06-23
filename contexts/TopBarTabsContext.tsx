'use client'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export interface TopBarTab {
  id: string
  label: string
  /** Optional badge (e.g. lock icon, PRO chip) rendered after the label */
  badge?: React.ReactNode
}

export interface TopBarTabsState {
  tabs: TopBarTab[]
  activeId: string
  onChange: (id: string) => void
}

interface TopBarTabsContextValue {
  tabsState: TopBarTabsState | null
  setTabsState: (state: TopBarTabsState | null) => void
}

const TopBarTabsContext = createContext<TopBarTabsContextValue>({
  tabsState: null,
  setTabsState: () => {},
})

export function TopBarTabsProvider({ children }: { children: ReactNode }) {
  const [tabsState, setTabsState] = useState<TopBarTabsState | null>(null)
  return (
    <TopBarTabsContext.Provider value={{ tabsState, setTabsState }}>
      {children}
    </TopBarTabsContext.Provider>
  )
}

export function useTopBarTabs() {
  return useContext(TopBarTabsContext)
}

/**
 * Call this hook from any page to push tab navigation into the TopBar.
 * Automatically cleans up when the page unmounts.
 *
 * @param tabs     Array of { id, label, badge? }
 * @param activeId Currently active tab id
 * @param onChange Callback when user clicks a tab
 */
export function useSetTopBarTabs(
  tabs: TopBarTab[],
  activeId: string,
  onChange: (id: string) => void,
) {
  const { setTabsState } = useTopBarTabs()
  // Use a ref for onChange to avoid re-registering on every render
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    setTabsState({
      tabs,
      activeId,
      onChange: (id: string) => onChangeRef.current(id),
    })
    return () => setTabsState(null)
    // Only re-register when tabs structure or activeId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map(t => t.id).join(','), activeId])
}
