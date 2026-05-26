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
import type { LucideIcon } from 'lucide-react'

const NAV_ITEMS = [
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
    href: '/watchlist',
    label: 'Watchlist',
    icon: Star,
    match: (p: string) => p.startsWith('/watchlist'),
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

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      ].join(' ')}
    >
      <Icon
        size={15}
        strokeWidth={active ? 2.2 : 1.8}
        className={active ? 'text-white' : 'text-slate-400'}
      />
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const initials = session?.user?.name
    ?.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <aside className="fixed left-0 top-[52px] bottom-0 w-[220px] bg-white z-30 hidden lg:flex flex-col border-r border-slate-200">
      {/* Nav items */}
      <nav className="flex-1 px-2 pt-3 overflow-y-auto space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon, match }) => (
          <NavItem key={href} href={href} label={label} icon={icon} active={match(pathname)} />
        ))}
      </nav>

      {/* User profile footer */}
      <div className="px-3 py-4 border-t border-slate-100">
        {session ? (
          <div className="flex items-center gap-2.5">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={34}
                height={34}
                className="rounded-full ring-2 ring-slate-200 shrink-0"
              />
            ) : (
              <div className="w-[34px] h-[34px] rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-[12px] font-bold text-white leading-none">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-800 truncate leading-tight">{session.user?.name ?? 'User'}</p>
              <button
                onClick={() => signOut()}
                className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors leading-tight"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2.5 text-[12px] font-semibold text-white transition-colors"
          >
            Sign in
          </button>
        )}
      </div>
    </aside>
  )
}
