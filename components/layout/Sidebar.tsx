'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import {
  TrendingUp, Bookmark, Briefcase, Globe,
  Bell, Settings, HelpCircle, PieChart, SlidersHorizontal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InsicLogo } from '@/components/ui/InsicLogo'

const PRIMARY_NAV: Array<{ href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }> = [
  { href: '/analyze',               label: 'Analyze',       icon: TrendingUp,        match: (p) => p === '/analyze' || p.startsWith('/stock') },
  { href: '/screener',              label: 'Screener',      icon: SlidersHorizontal, match: (p) => p.startsWith('/screener') },
  { href: '/valuations',            label: 'My Valuations', icon: Bookmark,          match: (p) => p.startsWith('/valuations') },
  { href: '/etf',                   label: 'ETF Tracker',   icon: PieChart,          match: (p) => p.startsWith('/etf') },
  { href: '/monitor?tab=portfolio', label: 'Portfolio',     icon: Briefcase,         match: (p) => p.startsWith('/monitor') },
  { href: '/markets',               label: 'Markets',       icon: Globe,             match: (p) => p.startsWith('/markets') },
]

const UTILITY_NAV: Array<{ href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }> = [
  { href: '/alerts',   label: 'Alerts',    icon: Bell,       match: (p) => p.startsWith('/alerts') },
  { href: '/settings', label: 'Settings',  icon: Settings,   match: (p) => p.startsWith('/settings') },
  { href: '/help',     label: 'Help',      icon: HelpCircle, match: (p) => p.startsWith('/help') },
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
      initial={reduced ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={href}
        className={cn(
          'group relative flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-medium transition-colors duration-120',
          active
            ? 'bg-[#EEF4DD] text-[#0A1424]'
            : 'text-[#536174] hover:bg-[#F1F5E8] hover:text-[#0A1424]',
        )}
      >
        {/* Olive left indicator for active state */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-[#5F790B]" />
        )}
        <Icon
          size={16}
          strokeWidth={active ? 2.2 : 1.7}
          className={cn(
            'shrink-0 transition-colors duration-120',
            active
              ? 'text-[#5F790B]'
              : 'text-[#8A96A8] group-hover:text-[#5F790B]',
          )}
        />
        <span className="truncate">{label}</span>
      </Link>
    </motion.div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A96A8]">
      {children}
    </p>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const reduced = useReducedMotion()

  const initials = session?.user?.name
    ?.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[220px] z-30 hidden lg:flex flex-col border-r border-[#E3E6E0]"
      style={{ background: '#FBFAF7' }}
    >
      {/* Logo lockup */}
      <div className="px-4 border-b border-[#E3E6E0]" style={{ height: '52px', display: 'flex', alignItems: 'center' }}>
        <Link href={session ? '/analyze' : '/'} className="flex items-center leading-none" aria-label="insic home">
          <InsicLogo variant="horizontal" className="h-7 w-auto block" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 pt-4 pb-2 overflow-y-auto custom-scrollbar">

        <SectionLabel>Workspace</SectionLabel>
        <div className="flex flex-col gap-0.5 mb-4">
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

        <div className="mx-3 mb-3 border-t border-[#E3E6E0]" />

        <SectionLabel>Account</SectionLabel>
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
        className="px-3 py-3.5 border-t border-[#E3E6E0]"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: (PRIMARY_NAV.length + UTILITY_NAV.length) * 0.025 + 0.06, duration: 0.24 }}
      >
        {session ? (
          <div className="flex items-center gap-2.5">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-[#E3E6E0] shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#5F790B] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white leading-none">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#0A1424] truncate leading-tight">
                {session.user?.name ?? 'User'}
              </p>
              <button
                onClick={() => signOut()}
                className="text-[11px] text-[#8A96A8] hover:text-[#536174] transition-colors leading-tight"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#5F790B] hover:bg-[#526A08] active:bg-[#4A5E07] px-3 py-2.5 text-[12.5px] font-semibold text-white transition-colors"
          >
            Sign in
          </button>
        )}
      </motion.div>
    </aside>
  )
}
