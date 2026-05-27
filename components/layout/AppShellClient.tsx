'use client'
import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import { StockNavProvider } from '@/contexts/StockNavContext'

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
        <div className="pt-[52px] pb-safe-nav lg:pb-6 lg:pl-[220px]">
          {children}
        </div>
        <BottomNav />
      </div>
    </StockNavProvider>
  )
}
