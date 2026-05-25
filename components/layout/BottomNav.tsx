'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  {
    href: '/markets',
    label: 'Markets',
    match: (p: string) => p.startsWith('/markets'),
    icon: (active: boolean) => (
      <svg className={cn('w-5 h-5', active ? 'text-blue-600' : 'text-slate-400')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/monitor?tab=portfolio',
    label: 'Portfolio',
    match: (p: string) => p.startsWith('/monitor'),
    icon: (active: boolean) => (
      <svg className={cn('w-5 h-5', active ? 'text-blue-600' : 'text-slate-400')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M16 5V3a1 1 0 00-1-1H9a1 1 0 00-1 1v2M12 12h.01" strokeLinecap="round" />
        <path d="M6 12h12M6 16h12" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/',
    label: 'Analyze',
    match: (p: string) => p === '/' || p.startsWith('/stock'),
    icon: (active: boolean) => (
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center -mt-4 ring-4 ring-white shadow-lg',
        active
          ? 'bg-gradient-to-br from-blue-500 to-blue-700'
          : 'bg-blue-600'
      )}>
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 114.5 4.5a7.5 7.5 0 0112.15 12.15z" />
        </svg>
      </div>
    ),
  },
  {
    href: '/valuations',
    label: 'Saved',
    match: (p: string) => p.startsWith('/valuations'),
    icon: (active: boolean) => (
      <svg className={cn('w-5 h-5', active ? 'text-blue-600' : 'text-slate-400')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
  },
  {
    href: '/ai-stack',
    label: 'AI',
    match: (p: string) => p.startsWith('/ai-stack'),
    icon: (active: boolean) => (
      <svg className={cn('w-5 h-5', active ? 'text-blue-600' : 'text-slate-400')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden glass-bottom-nav"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-end justify-around h-14">
        {NAV.map(({ href, label, match, icon }) => {
          const active = match(pathname)
          const isCenter = label === 'Analyze'
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 flex-1 py-1.5 transition-colors',
                isCenter ? 'pb-3' : ''
              )}
            >
              {icon(active)}
              {!isCenter && (
                <span className={cn(
                  'text-[9px] font-semibold uppercase tracking-wide',
                  active ? 'text-blue-600' : 'text-slate-400'
                )}>
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
