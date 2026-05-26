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

const NAV_SECTIONS = [
  {
    label: 'RESEARCH',
    items: [
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
    ],
  },
  {
    label: 'PORTFOLIO',
    items: [
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
    ],
  },
  {
    label: 'MARKETS',
    items: [
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
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
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
    ],
  },
]

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors',
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
      ].join(' ')}
    >
      <Icon size={16} className={active ? 'text-white' : 'text-slate-500'} strokeWidth={active ? 2.2 : 1.8} />
      {label}
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 pt-5 pb-1 first:pt-2">
      {children}
    </p>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const initials = session?.user?.name
    ?.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <aside className="fixed left-0 top-[52px] bottom-0 w-[220px] bg-[#0D1B2E] z-30 hidden lg:flex flex-col border-r border-white/5">
      {/* Nav sections */}
      <nav className="flex-1 px-2 overflow-y-auto">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <SectionLabel>{label}</SectionLabel>
            <div className="space-y-0.5">
              {items.map(({ href, label: itemLabel, icon, match }) => (
                <NavItem key={href} href={href} label={itemLabel} icon={icon} active={match(pathname)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile footer */}
      <div className="px-3 py-4 border-t border-white/5">
        {session ? (
          <div className="flex items-center gap-2.5">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={34}
                height={34}
                className="rounded-full ring-2 ring-white/10 shrink-0"
              />
            ) : (
              <div className="w-[34px] h-[34px] rounded-full bg-blue-600/80 flex items-center justify-center shrink-0">
                <span className="text-[12px] font-bold text-white leading-none">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-200 truncate leading-tight">{session.user?.name ?? 'User'}</p>
              <button
                onClick={() => signOut()}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors leading-tight"
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
