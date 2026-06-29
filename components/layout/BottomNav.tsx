'use client'
import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  PieChart, X, Globe, Bookmark, SlidersHorizontal,
  Settings, TrendingUp, Search, Lightbulb,
} from 'lucide-react'

// ── Nav items ─────────────────────────────────────────────────────────────────
// 5 primary items: Markets · Valuations · Analyze (center FAB) · Ideas · Screener
// ETFs and Settings accessible via the swipe-up drawer

const NAV_ITEMS = [
  {
    href: '/markets',
    label: 'Markets',
    match: (p: string) => p.startsWith('/markets'),
    icon: (active: boolean) => (
      <Globe
        className={cn('w-[22px] h-[22px]', active ? 'text-[#7C9A19]' : 'text-[rgba(255,255,255,0.50)]')}
        strokeWidth={active ? 2.2 : 1.6}
      />
    ),
  },
  {
    href: '/valuations',
    label: 'Valuations',
    match: (p: string) => p.startsWith('/valuations'),
    icon: (active: boolean) => (
      <Bookmark
        className={cn('w-[22px] h-[22px]', active ? 'text-[#7C9A19]' : 'text-[rgba(255,255,255,0.50)]')}
        strokeWidth={active ? 2.2 : 1.6}
      />
    ),
  },
]

const NAV_ITEMS_RIGHT = [
  {
    href: '/ideas',
    label: 'Ideas',
    match: (p: string) => p.startsWith('/ideas'),
    icon: (active: boolean) => (
      <Lightbulb
        className={cn('w-[22px] h-[22px]', active ? 'text-[#7C9A19]' : 'text-[rgba(255,255,255,0.50)]')}
        strokeWidth={active ? 2.2 : 1.6}
      />
    ),
  },
  {
    href: '/screener',
    label: 'Screener',
    match: (p: string) => p.startsWith('/screener'),
    icon: (active: boolean) => (
      <SlidersHorizontal
        className={cn('w-[22px] h-[22px]', active ? 'text-[#7C9A19]' : 'text-[rgba(255,255,255,0.50)]')}
        strokeWidth={active ? 2.2 : 1.6}
      />
    ),
  },
]

const DRAWER_ITEMS = [
  { href: '/markets',    label: 'Markets',       icon: Globe           },
  { href: '/valuations', label: 'My Valuations',  icon: TrendingUp      },
  { href: '/ideas',      label: 'Ideas',          icon: Lightbulb       },
  { href: '/screener',   label: 'Screener',       icon: SlidersHorizontal },
  { href: '/etf',        label: 'ETF Tracker',    icon: PieChart        },
  { href: '/analyze',    label: 'Analyze',        icon: Search          },
  { href: '/settings',   label: 'Settings',       icon: Settings        },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  const isCenterActive = pathname === '/' || pathname.startsWith('/stock') || pathname.startsWith('/analyze')

  useEffect(() => { setDrawerOpen(false) }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDrawerOpen(false); return }
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>('a, button, [tabindex]:not([tabindex="-1"])')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen])

  function NavItem({ href, label, match, icon }: {
    href: string; label: string
    match: (p: string) => boolean
    icon: (a: boolean) => ReactNode
  }) {
    const active = match(pathname)
    return (
      <Link
        href={href}
        className="flex flex-col items-center justify-center gap-1 flex-1 active:scale-95 transition-transform"
        style={{ minHeight: '56px', paddingTop: 8, paddingBottom: 6 }}
      >
        {icon(active)}
        <span className={cn(
          'text-[10px] font-[600] leading-none',
          active ? 'text-[#7C9A19]' : 'text-[rgba(255,255,255,0.45)]',
        )}>
          {label}
        </span>
      </Link>
    )
  }

  return (
    <>
      {/* Drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!drawerOpen}
        className={cn(
          'fixed left-0 right-0 z-[9998] lg:hidden rounded-t-2xl shadow-2xl border-t transition-transform duration-200 ease-out',
          drawerOpen ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{
          /* sits just above the nav bar */
          bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(10,14,20,0.96)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderColor: 'rgba(255,255,255,0.10)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.08)]">
          <span className="text-[13px] font-[650] text-white">Navigation</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-[rgba(255,255,255,0.50)] hover:text-white p-2 -mr-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[rgba(255,255,255,0.08)] transition-colors"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-3 py-2 grid grid-cols-2 gap-1">
          {DRAWER_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href.split('?')[0])
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3.5 min-h-[52px] rounded-xl text-[14px] font-[500] transition-colors',
                  active
                    ? 'bg-[rgba(124,154,25,0.18)] text-white'
                    : 'text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.07)] hover:text-white',
                )}
              >
                <Icon
                  size={18}
                  className={active ? 'text-[#7C9A19]' : 'text-[rgba(255,255,255,0.45)]'}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {label}
              </Link>
            )
          })}
        </div>
        <div style={{ height: 8 }} />
      </div>

      {/* ── Bottom nav bar ─────────────────────────────────────────────────────
          Fixed to the real bottom of the visible viewport.
          - position: fixed; bottom: 0 → anchored to layout viewport (stable)
          - transform: translateZ(0) + will-change: transform → GPU layer,
            prevents iOS Safari from painting the bar at the wrong position
            during rubber-band scroll
          - paddingBottom: env(safe-area-inset-bottom) → clears iPhone home bar
          - No 100vh anywhere — height is intrinsic (content + padding)
      ──────────────────────────────────────────────────────────────────────── */}
      <nav
        className="fixed left-0 right-0 z-[9999] lg:hidden"
        style={{
          bottom: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'rgba(10,16,28,0.92)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          borderTop: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 -1px 0 rgba(255,255,255,0.04), 0 -8px 32px rgba(0,0,0,0.18)',
          /* GPU-composite the layer so iOS doesn't repaint during momentum scroll */
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          willChange: 'transform',
          /* Prevent backface flicker on some Android Chrome builds */
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <div className="flex items-stretch justify-around" style={{ minHeight: 56 }}>

          {NAV_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}

          {/* Center: Analyze — olive FAB */}
          <Link
            href="/analyze"
            className="flex flex-col items-center justify-center gap-1 flex-1 active:scale-95 transition-transform"
            style={{ minHeight: 56, paddingTop: 4, paddingBottom: 6 }}
          >
            <div
              className={cn(
                'w-11 h-11 rounded-full flex items-center justify-center shadow-lg -mt-3',
                isCenterActive ? 'bg-[#5F790B]' : 'bg-[#4a6009]',
              )}
              style={{
                boxShadow: '0 4px 20px rgba(95,121,11,0.45)',
                border: '2px solid rgba(255,255,255,0.13)',
              }}
            >
              <Search
                className={cn('w-[18px] h-[18px]', isCenterActive ? 'text-white' : 'text-[rgba(255,255,255,0.85)]')}
                strokeWidth={2.5}
              />
            </div>
            <span className={cn(
              'text-[10px] font-[600] leading-none',
              isCenterActive ? 'text-[#7C9A19]' : 'text-[rgba(255,255,255,0.45)]',
            )}>
              Analyze
            </span>
          </Link>

          {NAV_ITEMS_RIGHT.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}

        </div>
      </nav>
    </>
  )
}
