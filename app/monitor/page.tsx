'use client'
import { Suspense } from 'react'
import MarketMonitor from '@/components/home/MarketMonitor'

export default function MonitorPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <div className="min-h-dvh bg-[#F8FAFB]">
        <main>
          <MarketMonitor />
        </main>
      </div>
    </Suspense>
  )
}
