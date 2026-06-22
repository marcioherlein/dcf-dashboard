'use client'
import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Bell, Settings, HelpCircle, PieChart, X, Globe, Bookmark, SlidersHorizontal, Lightbulb } from 'lucide-react'

const LEFT_NAV = [
  {
    href: '/markets',
    label: 'Markets',
    match: (p: string) => p.startsWith('/markets'),
    icon: (active: boolean) => (
      <Globe
        className={cn('w-5 h-5', active ? 'text-[#5F790B]' : 'text-[#9B9B9B]')}
        strokeWidth={active ? 2 : 1.5}
      />
    ),
  },
  {
    href: '/ideas',
    label: 'Ideas',
    match: (p: string) => p.startsWith('/ideas'),
    icon: (active: boolean) => (
      <Lightbulb
        className={cn('w-5 h-5', active ? 'text-[#5F790B]' : 'text-[#9B9B9B]')}
        strokeWidth={active ? 2 : 1.5}
      />
    ),
  },
]

const RIGHT_NAV = [
  {
    href: '/screener',
    label: 'Screener',
    match: (p: string) => p.startsWith('/screener'),
    icon: (active: boolean) => (
      <SlidersHorizontal
        className={cn('w-5 h-5', active ? 'text-[#5F790B]' : 'text-[#9B9B9B]')}
        strokeWidth={active ? 2 : 1.5}
      />
    ),
  },
  {
    href: '/etf',
    label: 'ETFs',
    match: (p: string) => p.startsWith('/etf'),
    icon: (active: boolean) => (
      <PieChart
        className={cn('w-5 h-5', active ? 'text-[#5F790B]' : 'text-[#9B9B9B]')}
        strokeWidth={active ? 2 : 1.5}
      />
    ),
  },
]

const MORE_ITEMS = [
  { href: '/valuations',             label: 'My Valuations', icon: Bookmark   },
  { href: '/ideas',                  label: 'Ideas',         icon: Lightbulb  },
  { href: '/markets',                label: 'Markets',       icon: Globe      },
  { href: '/etf',                    label: 'ETF Tracker',   icon: PieChart   },
  { href: '/alerts',                 label: 'Alerts',        icon: Bell       },
  { href: '/settings',               label: 'Settings',      icon: Settings   },
  { href: '/help',                   label: 'Help & Support', icon: HelpCircle },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  const isMoreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.href.split('?')[0]))
  const isCenterActive = pathname === '/' || pathname.startsWith('/stock') || pathname.startsWith('/analyze')

  // Close drawer on navigation
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Focus trap + Escape key handler (H5)
  useEffect(() => {
    if (!moreOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMoreOpen(false); return }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>('a, button, [tabindex]:not([tabindex="-1"])')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    // Focus first item on open
    const firstFocusable = drawerRef.current?.querySelector<HTMLElement>('a, button')
    firstFocusable?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [moreOpen])

  function NavItem({ href, label, match, icon }: { href: string; label: string; match: (p: string) => boolean; icon: (a: boolean) => ReactNode }) {
    const active = match(pathname)
    return (
      <Link
        href={href}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 active:scale-95 transition-transform min-w-[60px]"
        style={{ minHeight: '56px' }}
      >
        {icon(active)}
        <span className={cn(
          'text-[11px] font-medium',
          active ? 'text-[#5F790B]' : 'text-[#9B9B9B]',
        )}>
          {label}
        </span>
      </Link>
    )
  }

  return (
    <>
      {/* More drawer backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/15 lg:hidden"
          onClick={() => setMoreOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* More drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="More navigation options"
        className={cn(
          'fixed left-0 right-0 z-50 lg:hidden bg-white rounded-t-2xl shadow-xl border-t border-[#E5E5E5] transition-transform duration-200',
          moreOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
          <span className="text-sm font-semibold text-[#111111]">More</span>
          <button
            onClick={() => setMoreOpen(false)}
            className="text-[#9B9B9B] hover:text-[#6B6B6B] p-2 -mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-[#F5F5F5] transition-colors"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-3 py-2 space-y-0.5">
          {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href.split('?')[0])
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 min-h-[44px] rounded-xl text-[14px] font-medium transition-colors',
                  active ? 'bg-[#EEF2FA] text-[#111111]' : 'text-[#6B6B6B] hover:bg-[#F6FAEA]',
                )}
              >
                <Icon
                  size={18}
                  className={active ? 'text-[#5F790B]' : 'text-[#9B9B9B]'}
                  strokeWidth={active ? 2.2 : 1.8}
                />
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
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around min-h-[56px]">

          {LEFT_NAV.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}

          {/* Center: Analyze — olive accent FAB */}
          <Link
            href="/analyze"
            className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[60px] relative"
            style={{ minHeight: '56px' }}
          >
            <div className={cn(
              'w-11 h-11 rounded-full flex items-center justify-center ring-2 ring-white shadow-md -mt-4',
              isCenterActive
                ? 'bg-[#5F790B]'
                : 'bg-[#5F790B] opacity-90',
            )}>
              <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 114.5 4.5a7.5 7.5 0 0112.15 12.15z" />
              </svg>
            </div>
            <span className={cn(
              'text-[10px] font-medium',
              isCenterActive ? 'text-[#5F790B]' : 'text-[#9B9B9B]',
            )}>
              Analyze
            </span>
          </Link>

          {RIGHT_NAV.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 active:scale-95 transition-transform min-w-[60px]"
            style={{ minHeight: '56px' }}
          >
            <svg
              className={cn('w-5 h-5', isMoreActive || moreOpen ? 'text-[#5F790B]' : 'text-[#9B9B9B]')}
              fill="none" viewBox="0 0 24 24"
            >
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span className={cn(
              'text-[11px] font-medium',
              isMoreActive || moreOpen ? 'text-[#5F790B]' : 'text-[#9B9B9B]',
            )}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
