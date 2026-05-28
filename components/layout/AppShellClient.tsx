'use client'
import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import { StockNavProvider, useStockNav } from '@/contexts/StockNavContext'
import { cn } from '@/lib/utils'

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { stockNav } = useStockNav()
  return (
    <div className={cn(
      stockNav ? 'pt-[88px] sm:pt-[52px]' : 'pt-[52px]',
      'pb-safe-nav lg:pb-6 lg:pl-[220px]'
    )}>
      {children}
    </div>
  )
}

export default function AppShellClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/') {
    return <>{children}</>
  }

  return (
    <StockNavProvider>
      <div className="min-h-dvh lqg-bg">
        <Suspense fallback={<header className="fixed top-0 left-0 right-0 h-[52px] glass-nav border-b z-40" />}>
          <TopBar />
        </Suspense>
        <Sidebar />
        <AppShellInner>{children}</AppShellInner>
        <BottomNav />
      </div>
    </StockNavProvider>
  )
}
