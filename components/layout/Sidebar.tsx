'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import {
  TrendingUp, Bookmark, Briefcase, Globe,
  Sparkles, Bell, Settings, HelpCircle, PieChart,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const PRIMARY_NAV: Array<{ href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }> = [
  { href: '/analyze',               label: 'Analyze',       icon: TrendingUp, match: (p) => p === '/analyze' || p.startsWith('/stock') },
  { href: '/valuations',            label: 'My Valuations', icon: Bookmark,   match: (p) => p.startsWith('/valuations') },
  { href: '/etf',                   label: 'ETF Tracker',   icon: PieChart,   match: (p) => p.startsWith('/etf') },
  { href: '/monitor?tab=portfolio', label: 'Portfolio',     icon: Briefcase,  match: (p) => p.startsWith('/monitor') },
  { href: '/markets',               label: 'Markets',       icon: Globe,      match: (p) => p.startsWith('/markets') },
]

const UTILITY_NAV: Array<{ href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }> = [
  { href: '/ai-stack', label: 'AI Stack',     icon: Sparkles,   match: (p) => p.startsWith('/ai-stack') },
  { href: '/alerts',   label: 'Alerts',       icon: Bell,       match: (p) => p.startsWith('/alerts') },
  { href: '/settings', label: 'Settings',     icon: Settings,   match: (p) => p.startsWith('/settings') },
  { href: '/help',     label: 'Help',         icon: HelpCircle, match: (p) => p.startsWith('/help') },
]

function NavItem({
  href, label, icon: Icon, active, index,
}: {
  href: string; label: string; icon: LucideIcon; active: boolean; index: number
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      custom={index}
      initial={reduced ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        delay: index * 0.03,
        duration: 0.24,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Link
        href={href}
        className={cn(
          'group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors duration-150',
          active
            ? 'bg-blue-50 text-[#1D4ED8] font-[600]'
            : 'text-slate-500 font-medium hover:bg-slate-100/80 hover:text-slate-900',
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-blue-600" />
        )}
        <Icon
          size={15}
          strokeWidth={active ? 2.3 : 1.8}
          className={cn(
            'shrink-0 transition-colors duration-150',
            active ? 'text-[#2563EB]' : 'text-slate-400 group-hover:text-slate-600',
          )}
        />
        <span className="truncate">{label}</span>
      </Link>
    </motion.div>
  )
}

function NavDivider() {
  return <div className="mx-3 border-t border-slate-100" />
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const reduced = useReducedMotion()

  const initials = session?.user?.name
    ?.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <aside className="fixed left-0 top-[52px] bottom-0 w-[220px] z-30 hidden lg:flex flex-col border-r border-slate-200/80"
      style={{ background: '#F8FAFC' }}
    >
      {/* Nav items */}
      <nav className="flex-1 px-2 pt-3 pb-2 overflow-y-auto custom-scrollbar">

        {/* Primary nav */}
        <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Workspace</p>
        <div className="flex flex-col gap-0.5">
          {PRIMARY_NAV.map(({ href, label, icon, match }, i) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={match(pathname)}
              index={i}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="my-3">
          <NavDivider />
        </div>

        {/* Utility nav */}
        <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Account</p>
        <div className="flex flex-col gap-0.5">
          {UTILITY_NAV.map(({ href, label, icon, match }, i) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={match(pathname)}
              index={PRIMARY_NAV.length + i + 1}
            />
          ))}
        </div>
      </nav>

      {/* User profile footer */}
      <motion.div
        className="px-3 py-4 border-t border-slate-200/60"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: (PRIMARY_NAV.length + UTILITY_NAV.length) * 0.03 + 0.06, duration: 0.28 }}
      >
        {session ? (
          <div className="flex items-center gap-2.5">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-slate-200/80 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white leading-none">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-[600] text-slate-800 truncate leading-tight">{session.user?.name ?? 'User'}</p>
              <button
                onClick={() => signOut()}
                className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors leading-tight"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] px-3 py-2.5 text-[12px] font-semibold text-white transition-colors"
          >
            Sign in
          </button>
        )}
      </motion.div>
    </aside>
  )
}
