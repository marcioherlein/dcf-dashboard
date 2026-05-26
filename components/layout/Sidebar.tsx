'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import {
  TrendingUp,
  Bookmark,
  Briefcase,
  Globe,
  Sparkles,
  Bell,
  Settings,
  HelpCircle,
  Star,
} from 'lucide-react'

const NAV_PRIMARY = [
  {
    href: '/analyze',
    label: 'Analyze',
    icon: TrendingUp,
    match: (p: string) => p === '/analyze' || p.startsWith('/stock'),
  },
  {
    href: '/valuations',
    label: 'My Valuations',
    icon: Bookmark,
    match: (p: string) => p.startsWith('/valuations'),
  },
  {
    href: '/monitor?tab=portfolio',
    label: 'Portfolio',
    icon: Briefcase,
    match: (p: string) => p.startsWith('/monitor'),
  },
  {
    href: '/markets',
    label: 'Markets',
    icon: Globe,
    match: (p: string) => p.startsWith('/markets'),
  },
  {
    href: '/ai-stack',
    label: 'AI Stack',
    icon: Sparkles,
    match: (p: string) => p.startsWith('/ai-stack'),
  },
]

const NAV_SECONDARY = [
  {
    href: '/watchlist',
    label: 'Watchlist',
    icon: Star,
    match: (p: string) => p.startsWith('/watchlist'),
  },
  {
    href: '/alerts',
    label: 'Alerts',
    icon: Bell,
    match: (p: string) => p.startsWith('/alerts'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (p: string) => p.startsWith('/settings'),
  },
  {
    href: '/help',
    label: 'Help & Support',
    icon: HelpCircle,
    match: (p: string) => p.startsWith('/help'),
  },
]

import type { LucideIcon } from 'lucide-react'

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
        active
          ? 'bg-white/15 text-white'
          : 'text-blue-100/70 hover:bg-white/10 hover:text-white',
      ].join(' ')}
    >
      <Icon size={15} className={active ? 'text-white' : 'text-blue-200/60'} />
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed left-0 top-[52px] bottom-0 w-[220px] bg-blue-800 z-30 hidden lg:flex flex-col">
      {/* Primary nav */}
      <nav className="flex-1 px-3 pt-4 overflow-y-auto">
        <div className="space-y-0.5">
          {NAV_PRIMARY.map(({ href, label, icon, match }) => (
            <NavItem key={href} href={href} label={label} icon={icon} active={match(pathname)} />
          ))}
        </div>

        <div className="my-3 border-t border-white/10" />

        <div className="space-y-0.5">
          {NAV_SECONDARY.map(({ href, label, icon, match }) => (
            <NavItem key={href} href={href} label={label} icon={icon} active={match(pathname)} />
          ))}
        </div>
      </nav>

      {/* Auth / user profile */}
      <div className="px-3 py-4 border-t border-white/10">
        {session ? (
          <div className="flex items-center gap-2.5">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={30}
                height={30}
                className="rounded-full ring-2 ring-white/20 shrink-0"
              />
            ) : (
              <div className="w-[30px] h-[30px] rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white leading-none">
                  {session.user?.name?.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white truncate">{session.user?.name ?? 'User'}</p>
              <button
                onClick={() => signOut()}
                className="text-[10px] text-blue-200/60 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-2 text-[12px] font-semibold text-white transition-colors"
          >
            Sign in
          </button>
        )}
      </div>
    </aside>
  )
}
