'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sparkles, Bell, Settings, HelpCircle, PieChart, X, Globe, Bookmark, LayoutDashboard, SlidersHorizontal } from 'lucide-react'

/* ── Left-2 + Right-2 nav items (center Analyze is rendered separately) ── */
const LEFT_NAV = [
  {
    href: '/markets',
    label: 'Markets',
    match: (p: string) => p.startsWith('/markets'),
    icon: (active: boolean) => (
      <Globe className={cn('w-5 h-5', active ? 'text-blue-600' : 'text-slate-400')} strokeWidth={active ? 2 : 1.5} />
    ),
  },
  {
    href: '/screener',
    label: 'Screener',
    match: (p: string) => p.startsWith('/screener'),
    icon: (active: boolean) => (
      <SlidersHorizontal className={cn('w-5 h-5', active ? 'text-blue-600' : 'text-slate-400')} strokeWidth={active ? 2 : 1.5} />
    ),
  },
]

const RIGHT_NAV = [
  {
    href: '/etf',
    label: 'ETFs',
    match: (p: string) => p.startsWith('/etf'),
    icon: (active: boolean) => (
      <PieChart className={cn('w-5 h-5', active ? 'text-blue-600' : 'text-slate-400')} strokeWidth={active ? 2 : 1.5} />
    ),
  },
]

const MORE_ITEMS = [
  { href: '/valuations',            label: 'My Valuations',       icon: Bookmark        },
  { href: '/ai-stack',              label: 'AI Stack',            icon: Sparkles        },
  { href: '/monitor?tab=portfolio', label: 'Monitor / Portfolio', icon: LayoutDashboard },
  { href: '/alerts',                label: 'Alerts',              icon: Bell            },
  { href: '/settings',              label: 'Settings',            icon: Settings        },
  { href: '/help',                  label: 'Help & Support',      icon: HelpCircle      },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.href.split('?')[0]))
  const isCenterActive = pathname === '/' || pathname.startsWith('/stock') || pathname.startsWith('/analyze')

  function NavItem({ href, label, match, icon }: { href: string; label: string; match: (p: string) => boolean; icon: (a: boolean) => ReactNode }) {
    const active = match(pathname)
    return (
      <Link
        href={href}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 active:scale-95 transition-transform min-w-[60px]"
      >
        {icon(active)}
        <span className={cn(
          'text-[11px] font-medium',
          active ? 'text-blue-600' : 'text-slate-400'
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
            const active = pathname.startsWith(href.split('?')[0])
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
        <div className="flex items-end justify-around min-h-[56px]">

          {/* Left 2 */}
          {LEFT_NAV.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}

          {/* Center: Analyze */}
          <Link
            href="/analyze"
            className="flex flex-col items-center justify-end gap-1 flex-1 pb-2 active:scale-95 transition-transform min-w-[60px]"
          >
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center -mt-5 ring-4 ring-white shadow-lg',
              isCenterActive
                ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                : 'bg-blue-600'
            )}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 114.5 4.5a7.5 7.5 0 0112.15 12.15z" />
              </svg>
            </div>
            <span className={cn(
              'text-[10px] font-medium',
              isCenterActive ? 'text-blue-600' : 'text-slate-400'
            )}>
              Analyze
            </span>
          </Link>

          {/* Right: ETFs */}
          {RIGHT_NAV.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}

          {/* More button */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 active:scale-95 transition-transform min-w-[60px]',
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
              'text-[11px] font-medium',
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
