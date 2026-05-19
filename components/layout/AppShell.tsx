import { Suspense } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#F8FAFB]">
      <Suspense fallback={
        <header className="fixed top-0 left-0 right-0 h-[52px] bg-white border-b border-slate-200 z-40" />
      }>
        <TopBar />
      </Suspense>
      {/*
        pt-[52px]: clears the fixed TopBar (52px).
        pb-safe-nav: on mobile, pads 4rem + env(safe-area-inset-bottom) so content
        clears the BottomNav even on iPhone home-indicator devices.
        lg:pb-0: on desktop there is no BottomNav.
      */}
      <div className="pt-[52px] pb-safe-nav lg:pb-0">
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
