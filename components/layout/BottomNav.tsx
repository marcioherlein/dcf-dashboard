'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sparkles, Bell, Settings, HelpCircle, PieChart, X } from 'lucide-react'

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
    href: '/analyze',
    label: 'Analyze',
    match: (p: string) => p.startsWith('/analyze') || p.startsWith('/stock'),
    icon: (active: boolean) => (
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center -mt-4 ring-4 ring-slate-100 shadow-lg',
        active ? 'bg-gradient-to-br from-blue-500 to-blue-700' : 'bg-blue-600'
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
    href: '/etf',
    label: 'ETF',
    match: (p: string) => p.startsWith('/etf'),
    icon: (active: boolean) => (
      <PieChart className={cn('w-5 h-5', active ? 'text-blue-600' : 'text-slate-400')} strokeWidth={active ? 2 : 1.5} />
    ),
  },
]

const MORE_ITEMS = [
  { href: '/ai-stack', label: 'AI Stack', icon: Sparkles },
  { href: '/alerts',   label: 'Alerts',   icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help',     label: 'Help & Support', icon: HelpCircle },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const isMoreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.href))

  return (
    <>
      {/* More drawer backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More drawer panel */}
      <div
        className={cn(
          'fixed left-0 right-0 z-50 lg:hidden bg-white rounded-t-2xl shadow-xl border-t border-slate-200 transition-transform duration-200',
          moreOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{
          bottom: 'calc(56px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">More</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1 -mr-1"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-3 py-2 space-y-0.5">
          {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors',
                  active ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon size={18} className={active ? 'text-blue-500' : 'text-slate-400'} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            )
          })}
        </div>
        <div className="h-2" />
      </div>

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden glass-bottom-nav"
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
                  'flex flex-col items-center gap-0.5 flex-1 py-2.5 transition-colors min-w-[44px]',
                  isCenter ? 'pb-4' : ''
                )}
              >
                {icon(active)}
                {!isCenter && (
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide',
                    active ? 'text-blue-600' : 'text-slate-400'
                  )}>
                    {label}
                  </span>
                )}
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'flex flex-col items-center gap-0.5 flex-1 py-2.5 transition-colors min-w-[44px]',
            )}
          >
            <svg
              className={cn('w-5 h-5', isMoreActive || moreOpen ? 'text-blue-600' : 'text-slate-400')}
              fill="none" viewBox="0 0 24 24"
            >
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span className={cn(
              'text-[10px] font-semibold uppercase tracking-wide',
              isMoreActive || moreOpen ? 'text-blue-600' : 'text-slate-400'
            )}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
