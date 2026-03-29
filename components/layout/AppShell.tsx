import { Suspense } from 'react'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={
        <aside className="fixed left-0 top-0 h-screen w-[220px] bg-primary z-40" />
      }>
        <Sidebar />
      </Suspense>
      <div className="ml-[220px] flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
