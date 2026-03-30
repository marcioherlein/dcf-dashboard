import { Suspense } from 'react'
import TopBar from './TopBar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080808]">
      <Suspense fallback={
        <header className="fixed top-0 left-0 right-0 h-12 bg-[#0a0a0a] border-b border-[#ff6600]/40 z-40" />
      }>
        <TopBar />
      </Suspense>
      <div className="pt-12">
        {children}
      </div>
    </div>
  )
}
