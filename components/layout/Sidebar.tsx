'use client'
import { useRef } from 'react'
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
import { InsicLogoLockup } from '@/components/ui/InsicLogo'

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
  href, label, icon: Icon, active,
}: {
  href: string; label: string; icon: LucideIcon; active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-medium transition-colors duration-120',
        active
          ? 'bg-[#EDF3DD] text-[#06101F]'
          : 'text-[#566174] hover:bg-[#F6F9EC] hover:text-[#06101F]',
      )}
    >
      {/* Olive left indicator for active state */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-[#5F790B]" aria-hidden="true" />
      )}
      <Icon
        size={16}
        strokeWidth={active ? 2.2 : 1.7}
        aria-hidden="true"
        className={cn(
          'shrink-0 transition-colors duration-120',
          active
            ? 'text-[#5F790B]'
            : 'text-[#8A95A6] group-hover:text-[#5F790B]',
        )}
      />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A95A6]">
      {children}
    </p>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const reduced = useReducedMotion()
  const hasAnimated = useRef(false)

  const initials = session?.user?.name
    ?.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() ?? '?'

  return (
    <aside
      aria-label="Application sidebar"
      className="fixed left-0 top-0 bottom-0 w-[240px] z-30 hidden lg:flex flex-col border-r border-[#E3E1DA] bg-[#FAF9F6]"
    >
      {/* Logo lockup */}
      <div className="px-4 border-b border-[#E3E1DA]" style={{ height: '52px', display: 'flex', alignItems: 'center' }}>
        <Link href={session ? '/analyze' : '/'} className="flex items-center leading-none" aria-label="insic home">
          <InsicLogoLockup size="md" />
        </Link>
      </div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1 px-2.5 pt-4 pb-2 overflow-y-auto custom-scrollbar">

        <SectionLabel>Workspace</SectionLabel>
        <ul className="flex flex-col gap-0.5 mb-4 list-none p-0 m-0">
          {PRIMARY_NAV.map(({ href, label, icon, match }) => (
            <li key={href}>
              <NavItem
                href={href}
                label={label}
                icon={icon}
                active={match(pathname)}
              />
            </li>
          ))}
        </ul>

        <div className="mx-3 mb-3 border-t border-[#E3E1DA]" />

        <SectionLabel>Tools</SectionLabel>
        <ul className="flex flex-col gap-0.5 list-none p-0 m-0">
          {UTILITY_NAV.map(({ href, label, icon, match }) => (
            <li key={href}>
              <NavItem
                href={href}
                label={label}
                icon={icon}
                active={match(pathname)}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* User profile footer */}
      <motion.div
        className="px-3 py-3.5 border-t border-[#E3E1DA]"
        initial={reduced || hasAnimated.current ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        onAnimationComplete={() => { hasAnimated.current = true }}
        transition={{ delay: 0.1, duration: 0.24 }}
      >
        {session ? (
          <div className="flex items-center gap-2.5">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={32}
                height={32}
                className="rounded-full ring-2 ring-[#E3E1DA] shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#5F790B] flex items-center justify-center shrink-0" aria-hidden="true">
                <span className="text-[11px] font-bold text-white leading-none">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#06101F] truncate leading-tight">
                {session.user?.name ?? 'User'}
              </p>
              <button
                onClick={() => signOut()}
                className="min-h-[44px] flex items-center px-2 text-[11px] text-[#566174] hover:text-[#06101F] hover:bg-[#F4F3EF] rounded-[6px] transition-colors leading-tight"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#5F790B] hover:bg-[#536B08] active:bg-[#4A5E07] px-3 py-2.5 text-[12.5px] font-semibold text-white transition-colors"
          >
            Sign in
          </button>
        )}
      </motion.div>
    </aside>
  )
}
