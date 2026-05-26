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
  Newspaper,
  Settings,
} from 'lucide-react'

const NAV_PRIMARY = [
  {
    href: '/',
    label: 'Analyze',
    icon: TrendingUp,
    match: (p: string) => p === '/' || p.startsWith('/stock'),
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
    href: '/news',
    label: 'News',
    icon: Newspaper,
    match: (p: string) => p.startsWith('/news'),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    match: (p: string) => p.startsWith('/settings'),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="fixed left-0 top-[52px] bottom-0 w-[220px] bg-white border-r border-slate-100 z-30 hidden lg:flex flex-col">
      {/* Primary nav */}
      <nav className="flex-1 px-3 pt-4 overflow-y-auto">
        <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Navigation
        </p>
        <div className="space-y-0.5">
          {NAV_PRIMARY.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                ].join(' ')}
              >
                <Icon size={15} className={active ? 'text-blue-500' : 'text-slate-400'} />
                {label}
              </Link>
            )
          })}
        </div>

        <div className="my-3 border-t border-slate-100" />

        <div className="space-y-0.5">
          {NAV_SECONDARY.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname)
            return (
              <Link
                key={href}
                href={href}
                className={[
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                ].join(' ')}
              >
                <Icon size={15} className={active ? 'text-blue-500' : 'text-slate-400'} />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Auth */}
      <div className="px-3 py-4 border-t border-slate-100">
        {session ? (
          <div className="flex items-center gap-2.5">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={28}
                height={28}
                className="rounded-full ring-2 ring-blue-100 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white leading-none">
                  {session.user?.name?.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-800 truncate">{session.user?.name ?? 'User'}</p>
              <button
                onClick={() => signOut()}
                className="text-[10px] text-slate-400 hover:text-slate-700 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-2 text-[12px] font-semibold text-white transition-colors"
          >
            Sign in with Google
          </button>
        )}
      </div>
    </aside>
  )
}
