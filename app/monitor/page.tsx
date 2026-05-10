'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MarketMonitor from '@/components/home/MarketMonitor'
import Portfolio from '@/components/home/Portfolio'

const TABS = [
  { id: 'monitor',   label: 'Market Monitor' },
  { id: 'portfolio', label: 'Portfolio' },
]

function MonitorContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const tab          = searchParams.get('tab') ?? 'monitor'

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Tab bar */}
      <div className="sticky top-[52px] z-30 bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/monitor?tab=${t.id}`)}
                className={[
                  'relative px-5 py-3 text-[13px] font-medium transition-colors whitespace-nowrap',
                  tab === t.id
                    ? 'text-blue-600'
                    : 'text-slate-500 hover:text-slate-800',
                ].join(' ')}
              >
                {t.label}
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main>
        {tab === 'monitor'   && <MarketMonitor />}
        {tab === 'portfolio' && <div className="mx-auto max-w-7xl px-6 py-8"><Portfolio /></div>}
      </main>
    </div>
  )
}

export default function MonitorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <MonitorContent />
    </Suspense>
  )
}
