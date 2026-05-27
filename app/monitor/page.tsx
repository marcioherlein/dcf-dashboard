'use client'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MarketMonitor from '@/components/home/MarketMonitor'
import Portfolio from '@/components/home/Portfolio'

const TABS = [
  { id: 'monitor',   label: 'Market Monitor', wip: false },
  { id: 'portfolio', label: 'Portfolio', wip: true },
]

function MonitorContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const tab          = searchParams.get('tab') ?? 'monitor'

  return (
    <div className="min-h-screen bg-[#F8FAFB]">
      {/* Tab bar */}
      <div className="sticky top-[52px] z-30 bg-white border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/monitor?tab=${t.id}`)}
                className={[
                  'relative flex items-center gap-2 px-4 sm:px-5 py-3 text-[13px] font-medium transition-colors whitespace-nowrap min-h-[44px]',
                  tab === t.id
                    ? 'text-blue-600'
                    : 'text-slate-500 hover:text-slate-800',
                ].join(' ')}
              >
                {t.label}
                {t.wip && (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full leading-none">
                    In Progress
                  </span>
                )}
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
        {tab === 'portfolio' && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
              <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <div>
                <p className="text-[13px] font-bold text-amber-800 uppercase tracking-wide">In Progress — Not Ready</p>
                <p className="text-[12px] text-amber-700 mt-0.5">This feature is still being built and is not yet functional.</p>
              </div>
            </div>
            <Portfolio />
          </div>
        )}
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
