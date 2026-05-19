import { Suspense } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      <Suspense fallback={
        <header className="fixed top-0 left-0 right-0 h-12 bg-white border-b border-slate-200 z-40" />
      }>
        <TopBar />
      </Suspense>
      {/* pb-16 on mobile to clear the bottom nav; no padding on lg+ */}
      <div className="pt-12 pb-16 lg:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
