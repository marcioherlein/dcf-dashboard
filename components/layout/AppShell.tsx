import { Suspense } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lqg-bg">
      <Suspense fallback={
        <header className="fixed top-0 left-0 right-0 h-[52px] glass-nav border-b z-40" />
      }>
        <TopBar />
      </Suspense>
      <Sidebar />
      <div className="pt-[52px] pb-safe-nav lg:pb-0 lg:pl-[220px]">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
