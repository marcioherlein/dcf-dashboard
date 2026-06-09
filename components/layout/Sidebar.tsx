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

type NavEntry = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }

const RESEARCH_NAV: NavEntry[] = [
  { href: '/analyze',               label: 'Analyze',       icon: TrendingUp,        match: (p) => p === '/analyze' || p.startsWith('/stock') },
  { href: '/screener',              label: 'Screener',      icon: SlidersHorizontal, match: (p) => p.startsWith('/screener') },
]

const TRACK_NAV: NavEntry[] = [
  { href: '/valuations',            label: 'My Valuations', icon: Bookmark,          match: (p) => p.startsWith('/valuations') },
  { href: '/monitor?tab=portfolio', label: 'Portfolio',     icon: Briefcase,         match: (p) => p.startsWith('/monitor') },
]

const MARKETS_NAV: NavEntry[] = [
  { href: '/markets',               label: 'Markets',       icon: Globe,             match: (p) => p.startsWith('/markets') },
  { href: '/etf',                   label: 'ETF Tracker',   icon: PieChart,          match: (p) => p.startsWith('/etf') },
]

const UTILITY_NAV: Array<{ href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }> = [
  { href: '/alerts',   label: 'Alerts',    icon: Bell,       match: (p) => p.startsWith('/alerts') },
  { href: '/settings', label: 'Settings',  icon: Settings,   match: (p) => p === '/settings' },
  { href: '/help',     label: 'Help',      icon: HelpCircle, match: (p) => p.startsWith('/help') },
]

const EASE = [0.16, 1, 0.3, 1] as const

function NavItem({
  href, label, icon: Icon, active, index, reduced,
}: {
  href: string; label: string; icon: LucideIcon; active: boolean; index: number; reduced: boolean | null
}) {
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: EASE, delay: index * 0.04 }}
    >
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex items-center gap-2.5 px-3 py-[8px] rounded-[10px] text-[13.5px] font-medium transition-all duration-150',
          active
            ? 'text-white'
            : 'text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.85)]',
        )}
      >
        {/* Glass active pill */}
        {active && (
          <motion.span
            layoutId="sidebar-active-pill"
            className="absolute inset-0 rounded-[10px]"
            style={{
              background: 'linear-gradient(135deg, rgba(124,154,25,0.28) 0%, rgba(95,121,11,0.18) 100%)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(124,154,25,0.30)',
              boxShadow: '0 2px 12px rgba(95,121,11,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}

        {/* Hover fill — subtle */}
        <span
          className={cn(
            'absolute inset-0 rounded-[10px] opacity-0 transition-opacity duration-150',
            !active && 'group-hover:opacity-100',
          )}
          style={{ background: 'rgba(255,255,255,0.05)' }}
          aria-hidden="true"
        />

        {/* Olive left pill — only when active */}
        {active && (
          <motion.span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 18, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.05 }}
            style={{ background: '#7C9A19' }}
            aria-hidden="true"
          />
        )}

        <Icon
          size={16}
          strokeWidth={active ? 2.2 : 1.7}
          aria-hidden="true"
          className={cn(
            'relative shrink-0 transition-colors duration-150',
            active ? 'text-[#7C9A19]' : 'text-[rgba(255,255,255,0.32)] group-hover:text-[rgba(255,255,255,0.7)]',
          )}
        />
        <span className="relative truncate">{label}</span>
      </Link>
    </motion.li>
  )
}

function SectionLabel({ children, delay, reduced }: { children: React.ReactNode; delay: number; reduced: boolean | null }) {
  return (
    <motion.p
      className="px-3 mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[rgba(255,255,255,0.22)]"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE, delay }}
    >
      {children}
    </motion.p>
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
      className="fixed left-0 top-0 bottom-0 w-[240px] z-30 hidden lg:flex flex-col overflow-hidden"
      style={{
        /* Gradient: pure black top → very subtle warm olive tint at bottom */
        background: 'linear-gradient(180deg, #0A0A0A 0%, #0D0F0A 60%, #0F1108 100%)',
        /* Right-edge specular — mimics light catching glass */
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Specular highlight on right edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-px"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 40%, rgba(124,154,25,0.12) 100%)',
        }}
      />

      {/* Ambient olive glow — bottom corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-48"
        style={{
          background: 'radial-gradient(ellipse 180% 80% at 50% 120%, rgba(95,121,11,0.12) 0%, transparent 70%)',
        }}
      />

      {/* Logo lockup */}
      <motion.div
        className="relative px-4 flex items-center shrink-0"
        style={{ height: '52px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <Link href={session ? '/analyze' : '/'} className="flex items-center leading-none" aria-label="insic home">
          <InsicLogoLockup size="md" on="dark" />
        </Link>
      </motion.div>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="relative flex-1 px-2.5 pt-4 pb-2 overflow-y-auto custom-scrollbar">

        {/* Group 1 — Research */}
        <SectionLabel delay={0.05} reduced={reduced}>Research</SectionLabel>
        <ul className="flex flex-col gap-0.5 mb-3 list-none p-0 m-0">
          {RESEARCH_NAV.map(({ href, label, icon, match }, i) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={match(pathname)}
              index={i}
              reduced={reduced}
            />
          ))}
        </ul>

        <motion.div
          className="mx-3 mb-3"
          style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }}
          initial={reduced ? false : { scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.14 }}
          aria-hidden="true"
        />

        {/* Group 2 — Track */}
        <SectionLabel delay={0.16} reduced={reduced}>Track</SectionLabel>
        <ul className="flex flex-col gap-0.5 mb-3 list-none p-0 m-0">
          {TRACK_NAV.map(({ href, label, icon, match }, i) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={match(pathname)}
              index={RESEARCH_NAV.length + i}
              reduced={reduced}
            />
          ))}
        </ul>

        <motion.div
          className="mx-3 mb-3"
          style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }}
          initial={reduced ? false : { scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.22 }}
          aria-hidden="true"
        />

        {/* Group 3 — Markets */}
        <SectionLabel delay={0.24} reduced={reduced}>Markets</SectionLabel>
        <ul className="flex flex-col gap-0.5 mb-4 list-none p-0 m-0">
          {MARKETS_NAV.map(({ href, label, icon, match }, i) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={match(pathname)}
              index={RESEARCH_NAV.length + TRACK_NAV.length + i}
              reduced={reduced}
            />
          ))}
        </ul>

        <motion.div
          className="mx-3 mb-3"
          style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }}
          initial={reduced ? false : { scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.30 }}
          aria-hidden="true"
        />

        <SectionLabel delay={0.32} reduced={reduced}>Tools</SectionLabel>
        <ul className="flex flex-col gap-0.5 list-none p-0 m-0">
          {UTILITY_NAV.map(({ href, label, icon, match }, i) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={icon}
              active={match(pathname)}
              index={RESEARCH_NAV.length + TRACK_NAV.length + MARKETS_NAV.length + i}
              reduced={reduced}
            />
          ))}
        </ul>
      </nav>

      {/* User profile footer — glass surface */}
      <motion.div
        className="relative px-3 py-3.5 shrink-0"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
        initial={reduced || hasAnimated.current ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        onAnimationComplete={() => { hasAnimated.current = true }}
        transition={{ delay: 0.38, duration: 0.32, ease: EASE }}
      >
        {session ? (
          <div className="flex items-center gap-2.5">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? ''}
                width={32}
                height={32}
                className="rounded-full shrink-0"
                style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.12)' }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #7C9A19 0%, #5F790B 100%)' }}
                aria-hidden="true"
              >
                <span className="text-[11px] font-bold text-white leading-none">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
              <p className="text-[12px] font-semibold text-white truncate leading-tight">
                {session.user?.name ?? 'User'}
              </p>
              <button
                onClick={() => signOut()}
                className="shrink-0 text-[11px] text-[rgba(255,255,255,0.30)] hover:text-[#D83B3B] transition-colors leading-tight px-1 py-1 rounded min-h-[36px]"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] px-3 py-2.5 text-[12.5px] font-semibold text-white transition-all min-h-[44px]"
            style={{
              background: 'linear-gradient(135deg, rgba(124,154,25,0.35) 0%, rgba(95,121,11,0.25) 100%)',
              border: '1px solid rgba(124,154,25,0.35)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            Sign in
          </button>
        )}
      </motion.div>
    </aside>
  )
}
