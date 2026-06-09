'use client'
import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import { StockNavProvider } from '@/contexts/StockNavContext'
import FeedbackButton from '@/components/ui/FeedbackButton'
import RouteLoader from '@/components/ui/RouteLoader'

function AppShellInner({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="pb-safe-nav lg:pb-6 lg:pl-[240px]"
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
      <div className="min-h-dvh insic-bg">
        <Suspense fallback={<header className="fixed top-0 left-0 right-0 min-h-[52px] pt-safe glass-toolbar border-b z-40" />}>
          <TopBar />
        </Suspense>
        <Sidebar />
        <AppShellInner>{children}</AppShellInner>
        <BottomNav />
        <FeedbackButton />
        <RouteLoader />
      </div>
    </StockNavProvider>
  )
}
