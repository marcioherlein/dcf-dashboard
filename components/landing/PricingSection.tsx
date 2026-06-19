'use client'
import { signIn, useSession } from 'next-auth/react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import dynamic from 'next/dynamic'

const PayPalSubscribeButton = dynamic(
  () => import('@/components/payments/PayPalSubscribeButton'),
  { ssr: false, loading: () => <div className="h-12 rounded-xl bg-[#EEF2FA] animate-pulse" /> }
)

const FREE_FEATURES = [
  'Stock analysis (any ticker)',
  'Fair value summary',
  'Conviction Score',
  'Market-implied expectations',
  'Essential financials',
  '10 saved analyses',
]

const PRO_FEATURES = [
  'Everything in Free, unlimited',
  'Full valuation models (DCF, RDCF, Multiples)',
  'Sensitivity tables and scenarios',
  'Conviction Score history',
  'Screener (filters by fundamentals)',
  'ETF Tracker',
  'Unlimited saved analyses',
  'PDF export',
  'Portfolio and watchlists',
  'Priority support',
]

const PRO_DIFF = [
  'Conviction Score history',
  'Sensitivity tables',
  'Screener',
  'ETF Tracker',
]

export default function PricingSection() {
  const { data: session } = useSession()
  const isPro = (session?.user as { plan?: string } | undefined)?.plan === 'pro'
  const monthlyPrice = 19

  return (
    <section id="pricing" className="overflow-x-hidden" style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E5E5' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-[28px] sm:text-[36px] font-bold text-[#111111] leading-tight mb-3" style={{ letterSpacing: '-0.025em' }}>
            Simple pricing.<br />Start free, upgrade when you&apos;re ready.
          </h2>
          <p className="text-[15px] text-[#6B6B6B]">No credit card required to get started.</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[680px] lg:max-w-[860px] mx-auto">

          {/* Free */}
          <div className="rounded-2xl border border-[#E5E5E5] bg-white p-6 flex flex-col shadow-card relative">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#6B6B6B] mb-3">Free</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[44px] font-bold text-[#111111] leading-none tabular-nums">$0</span>
              <span className="text-[13px] text-[#6B6B6B] font-medium">/month</span>
            </div>
            <p className="text-[12px] text-[#6B6B6B] mb-5">Free plan, no card required, never expires.</p>
            <button
              onClick={() => signIn('google')}
              className="w-full rounded-md border border-[#C8C8C8] py-3 text-[13.5px] font-semibold text-[#111111] hover:bg-[#F6FAEA] hover:border-[#5F790B] transition-colors mb-5 min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-2"
            >
              Analyze for free
            </button>
            <ul className="space-y-2.5 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={14} className="text-[#5F790B] shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="text-[13px] text-[#111111] leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border-2 border-[#5F790B] bg-white p-6 flex flex-col relative" style={{ boxShadow: '0 4px 20px rgba(95,121,11,0.14)' }}>
            <div className="absolute top-4 right-4 rounded-full bg-[#5F790B] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
              Most popular
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#5F790B] mb-3">Pro</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[44px] font-bold text-[#111111] leading-none tabular-nums">${monthlyPrice}</span>
              <span className="text-[13px] text-[#6B6B6B] font-medium">/month</span>
            </div>
            <p className="text-[12px] text-[#6B6B6B] mb-5">Cancel anytime · No contracts.</p>

            {isPro ? (
              <div className="w-full flex items-center justify-center gap-2 rounded-md py-3 text-[13.5px] font-semibold text-[#5F790B] bg-[#EEF2FA] border border-[#BFD2A1] mb-5 min-h-[48px]">
                <Check size={14} strokeWidth={2.5} />
                You&apos;re on Pro
              </div>
            ) : (
              <div className="mb-5">
                <PayPalSubscribeButton
                  userEmail={session?.user?.email}
                  onSignInRequired={() => signIn('google', { callbackUrl: '/pricing' })}
                />
              </div>
            )}

            <ul className="space-y-2.5 flex-1">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={14} className="text-[#5F790B] shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="text-[13px] text-[#111111] leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Pro-only quick-diff strip */}
        <div className="mt-5 max-w-[680px] lg:max-w-[860px] mx-auto rounded-xl border border-[#BFD2A1] bg-[#F6FAEA] px-5 py-3.5 flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-bold text-[#5F790B] shrink-0">Pro adds:</span>
          {PRO_DIFF.map(f => (
            <span key={f} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#111111] bg-white border border-[#BFD2A1] rounded-full px-3 py-1">
              <Check size={11} className="text-[#5F790B] shrink-0" strokeWidth={2.5} />
              {f}
            </span>
          ))}
        </div>

        {/* Full comparison link */}
        <div className="text-center mt-5">
          <Link
            href="/pricing"
            className="text-[13px] font-medium text-[#5F790B] hover:text-[#526A08] hover:underline underline-offset-2 transition-colors"
          >
            See full feature comparison →
          </Link>
        </div>
      </div>
    </section>
  )
}
