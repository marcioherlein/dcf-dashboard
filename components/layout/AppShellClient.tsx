'use client'
import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import { StockNavProvider } from '@/contexts/StockNavContext'
import { TopBarTabsProvider } from '@/contexts/TopBarTabsContext'
import FeedbackButton from '@/components/ui/FeedbackButton'

function AppShellInner({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="pb-safe-nav lg:pb-6 lg:pl-[192px]"
      style={{ paddingTop: 'calc(52px + env(safe-area-inset-top, 0px))' }}
    >
      {children}
    </main>
  )
}

export default function AppShellClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/') {
    return <>{children}</>
  }

  return (
    <StockNavProvider>
      <TopBarTabsProvider>
      {/* min-h-dvh uses dynamic viewport height — avoids 100vh gap on iOS Safari */}
      <div className="min-h-dvh insic-bg" style={{ overflowX: 'hidden' }}>
        <Suspense fallback={<header className="fixed top-0 left-0 right-0 min-h-[52px] pt-safe glass-toolbar border-b z-40" />}>
          <TopBar />
        </Suspense>
        <Sidebar />
        <AppShellInner>{children}</AppShellInner>
        <BottomNav />
        <FeedbackButton />
      </div>
      </TopBarTabsProvider>
    </StockNavProvider>
  )
}
