'use client'
import { useRouter } from 'next/navigation'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'

const PayPalSubscribeButton = dynamic(
  () => import('@/components/payments/PayPalSubscribeButton'),
  { ssr: false, loading: () => <div className="h-12 rounded-xl bg-gray-100 animate-pulse" /> }
)
import { Check, X, ChevronDown, Zap, BarChart2, Bell, Users, TrendingUp, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InsicLogoLockup } from '@/components/ui/InsicLogo'

// ─── Plan definitions ──────────────────────────────────────────────────────

const FREE_FEATURES = [
  'Full access to every feature — nothing locked',
  'Valuation cockpit — all models, editable assumptions',
  'Conviction Score, Reverse DCF, Monte Carlo',
  'Full 3-statement financials, analyst estimates',
  'Markets page, ETF Tracker, Screener (20 results)',
  'ETF watchlist — track up to 5 ETFs',
  '5 stock analyses per month',
  '5 saved valuations',
]

const PRO_FEATURES = [
  { icon: Zap,        text: 'Unlimited stock analyses — no monthly cap' },
  { icon: TrendingUp, text: 'Unlimited saved analyses to Watchlist' },
  { icon: BarChart2,  text: 'Sensitivity table — fair value at every CAGR × WACC combination' },
  { icon: BarChart2,  text: 'Full screener — unlimited results + scatter chart view' },
  { icon: BarChart2,  text: 'Multi-ticker comparison with correlation & pairs signals' },
  { icon: TrendingUp, text: 'ETF Basket DCF — weighted fair value signal across all holdings' },
  { icon: TrendingUp, text: 'ETF metric history (P/E, P/B, yield, score over time)' },
  { icon: TrendingUp, text: 'Unlimited ETF watchlist + inline compare' },
  { icon: Users,      text: 'Quant Strategy Library — 5 academic factor strategies' },
  { icon: Bell,       text: 'Weekly watchlist digest (email)' },
  { icon: Shield,     text: 'Priority support' },
]

const COMPARISON_ROWS = [
  { label: 'Stocks per month',                                      browse: 'Any',  free: '5',   pro: '∞'   },
  { label: 'Saved analyses (Watchlist)',                             browse: false,  free: '5',   pro: '∞'   },
  { label: 'Price + chart (any NYSE/NASDAQ ticker)',                 browse: true,   free: true,  pro: true  },
  { label: 'Verdict badge (Undervalued / Fair Value / Overvalued)',  browse: 'Blurred fair value', free: true, pro: true },
  { label: 'Overview — chart, KPIs, peers, ETF exposure',           browse: false,  free: true,  pro: true  },
  { label: 'Conviction Score + 16-criterion checklist',             browse: false,  free: true,  pro: true  },
  { label: 'Reverse DCF — market-implied CAGR',                     browse: false,  free: true,  pro: true  },
  { label: 'Valuation cockpit — editable DCF assumptions',          browse: false,  free: true,  pro: true  },
  { label: 'Monte Carlo simulation',                                browse: false,  free: true,  pro: true  },
  { label: 'Full DCF model — year-by-year projections',             browse: false,  free: true,  pro: true  },
  { label: 'Financials (3-statement, analyst estimates)',            browse: false,  free: true,  pro: true  },
  { label: 'Markets page',                                          browse: false,  free: true,  pro: true  },
  { label: 'ETF Tracker — screener, theme grid, heatmap',           browse: false,  free: true,  pro: true  },
  { label: 'ETF detail page — profile, holdings, sector allocation', browse: false, free: true,  pro: true  },
  { label: 'ETF watchlist',                                         browse: false,  free: '5 ETFs', pro: '∞' },
  { label: 'ETF Basket DCF — weighted fair value across holdings',  browse: false,  free: false, pro: true  },
  { label: 'ETF metric history (P/E, P/B, yield, score over time)', browse: false,  free: false, pro: true  },
  { label: 'ETF inline compare (multi-select + side-by-side)',       browse: false,  free: false, pro: true  },
  { label: 'Screener — fundamental filters',                        browse: false,  free: '20 results', pro: '∞ + scatter' },
  { label: 'Sensitivity table (CAGR × WACC heat map)',              browse: false,  free: false, pro: true  },
  { label: 'Multi-ticker comparison + pairs signals',               browse: false,  free: false, pro: true  },
  { label: 'Quant Strategy Library (all 5 strategies)',             browse: false,  free: false, pro: true  },
  { label: 'Weekly watchlist digest (email)',                       browse: false,  free: false, pro: true  },
  { label: 'Priority support',                                      browse: false,  free: false, pro: true  },
]

const FAQS = [
  {
    q: 'Is the free plan really free forever?',
    a: 'Yes. Free is not a trial. You get 5 full stock analyses per month — every feature unlocked, nothing hidden. The only limit is how many stocks you can analyze each month. Upgrade to Pro for unlimited analyses.',
  },
  {
    q: 'What happens when I hit the 5-stock limit?',
    a: 'You\'ll see an upgrade prompt. Stocks you\'ve already viewed this month remain fully accessible — the limit only applies to new tickers. The count resets at the start of each calendar month.',
  },
  {
    q: 'What ETF features are free vs. Pro?',
    a: 'The full ETF Tracker is free — screener, theme grid, heatmap, rankings, and the ETF detail page (profile, holdings, sector allocation). You can also save up to 5 ETFs to your watchlist for free. Pro unlocks: ETF Basket DCF (weighted fair value across holdings), metric history (P/E, P/B, yield trend over time), unlimited watchlist, and the inline compare panel.',
  },
  {
    q: 'How accurate is the DCF model?',
    a: 'The model blends FCFF DCF (WACC from CAPM + Damodaran country risk premia) with DDM, FCFE, and relative multiples. Fair value is a weighted consensus — not a prediction. Use it to stress-test your own thesis, not as a guarantee.',
  },
  {
    q: 'Where does the data come from?',
    a: 'Financial statements from Yahoo Finance and Financial Modeling Prep. Risk-free rates from FRED (Federal Reserve). Country risk premiums from Damodaran (NYU Stern). CAPM parameters computed fresh per analysis.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts. Cancel in one click from your billing portal. Access continues until the end of your billing period, then you drop to the free plan with all your saved data intact.',
  },
  {
    q: 'What stocks are covered?',
    a: 'NYSE and NASDAQ-listed stocks are fully supported. Additional exchanges are on the roadmap.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const isPro = (session?.user as { plan?: string } | undefined)?.plan === 'pro'

  return (
    <div className="min-h-dvh bg-white">

      {/* Nav — shared with landing page */}
      <div className="border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center shrink-0" aria-label="insic home">
            <InsicLogoLockup size="sm" />
          </Link>
          <span className="text-gray-300 hidden sm:block">·</span>
          <span className="text-[13px] text-gray-500 hidden sm:block">Pricing</span>
        </div>
        <div className="flex items-center gap-3">
          {!session && (
            <Link href="/analyze" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">
              Sign in
            </Link>
          )}
          <Link
            href="/analyze"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#526A08]"
            style={{ background: '#5F790B', minHeight: '36px' }}
          >
            {session ? 'Go to app' : 'Try free'}
          </Link>
          <Link href="/" className="text-[13px] text-gray-400 hover:text-gray-700 transition-colors hidden sm:block">
            ← Home
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

        {/* ── Hero ─────────────────────────────────────────────────── */}
        <div className="text-center space-y-4">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#5F790B]">
            Simple pricing
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight leading-[1.05]">
            Know what a business is worth.<br />
            <span className="text-[#5F790B]">Before you invest.</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Start free — no credit card. Upgrade when you need unlimited access.
          </p>
        </div>

        {/* ── Pricing cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Browse — no account */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 flex flex-col shadow-sm">
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-300 mb-4">Browse</p>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-5xl font-bold text-gray-900 tabular-nums">$0</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <p className="text-[13px] text-gray-400">No account needed</p>
            </div>

            <Link
              href="/analyze"
              className="w-full rounded-xl border-2 border-gray-200 py-3.5 text-[13.5px] font-semibold text-gray-500 hover:border-[#5F790B] hover:text-[#5F790B] transition-colors mb-8 min-h-[48px] flex items-center justify-center"
            >
              Explore the app →
            </Link>

            <ul className="space-y-3 flex-1">
              {[
                'Stock price + live chart (any ticker)',
                'Verdict badge — Undervalued / Fair Value / Overvalued',
                'Company description, sector, country',
                'Landing page, pricing, all public pages',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check size={15} className="text-gray-300 shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="text-[13.5px] text-gray-400 leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Free */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 flex flex-col shadow-sm relative">
            <div className="absolute top-5 left-5">
              <span className="rounded-full bg-[#EEF2FA] border border-[#BFD2A1] text-[#5F790B] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
                Free forever
              </span>
            </div>
            <div className="mb-8 mt-7">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">Free</p>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-5xl font-bold text-gray-900 tabular-nums">$0</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <p className="text-[13px] text-gray-500">5 stocks/month · 5 saves · No credit card</p>
            </div>

            <button
              onClick={() => !session && router.push('/auth/sign-in')}
              className={cn(
                'w-full rounded-xl border-2 py-3.5 text-[13.5px] font-semibold transition-colors mb-8 min-h-[48px]',
                session
                  ? 'border-gray-200 text-gray-400 cursor-default'
                  : 'border-gray-300 text-gray-700 hover:border-[#5F790B] hover:bg-[#F6FAEA]'
              )}
            >
              {session ? 'Current plan' : 'Get started free →'}
            </button>

            <ul className="space-y-3 flex-1">
              {FREE_FEATURES.map((text, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check size={15} className="text-[#11875D] shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="text-[13.5px] text-gray-700 leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div className="rounded-2xl bg-gray-950 p-8 flex flex-col relative overflow-hidden shadow-xl">
            {/* Subtle olive glow */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#5F790B] opacity-[0.06] blur-3xl pointer-events-none" />

            <div className="absolute top-5 right-5">
              <span className="rounded-full bg-[#5F790B] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1">
                Most popular
              </span>
            </div>

            <div className="mb-8 relative">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#5F790B] mb-4">Pro</p>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-5xl font-bold text-white tabular-nums">$19</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <p className="text-[13px] text-gray-400">Cancel anytime · No contracts</p>
            </div>

            {isPro ? (
              <div className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#5F790B]/20 border border-[#5F790B]/30 py-3.5 text-[13.5px] font-semibold text-[#7CA819] mb-8 min-h-[48px]">
                <Check size={15} strokeWidth={2.5} />
                You&apos;re on Pro
              </div>
            ) : (
              <div className="mb-8">
                <PayPalSubscribeButton
                  userEmail={session?.user?.email}
                  onSignInRequired={() => router.push('/auth/sign-in?callbackUrl=/pricing')}
                />
                <p className="text-center text-[11px] text-gray-500 mt-2">
                  Cancel anytime · No contracts ·{' '}
                  <a href="/refund-policy" className="underline hover:text-gray-400">Refund policy</a>
                </p>
                <p className="text-center text-[11px] text-gray-500 mt-1.5">
                  By subscribing you agree to our{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">Privacy Policy</a>.
                  Not financial advice.
                </p>
              </div>
            )}

            <ul className="space-y-3 flex-1 relative">
              {PRO_FEATURES.map(({ icon: Icon, text }, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Icon size={14} className="text-[#7C9A19] shrink-0 mt-0.5" strokeWidth={2} />
                  <span className="text-[13.5px] text-gray-300 leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Trust bar ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-8 py-6 text-center space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Powered by public data</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium text-gray-500">
            <span>Yahoo Finance</span>
            <span className="hidden sm:inline text-gray-300">·</span>
            <span>Financial Modeling Prep</span>
            <span className="hidden sm:inline text-gray-300">·</span>
            <span>FRED (Federal Reserve)</span>
            <span className="hidden sm:inline text-gray-300">·</span>
            <span>Damodaran (NYU Stern)</span>
          </div>
          <p className="text-[11px] text-gray-400 max-w-lg mx-auto leading-relaxed">
            Not financial advice. Fair value estimates are model outputs based on public data and stated assumptions — not guarantees of future returns.
          </p>
        </div>

        {/* ── Feature comparison ─────────────────────────────────── */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10 tracking-tight">
            Full feature comparison
          </h2>

          {/* Desktop table */}
          <div className="hidden sm:block rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 font-semibold text-gray-700 w-[40%]">Feature</th>
                  <th className="text-center px-4 py-4 font-semibold text-gray-400 w-[20%]">Browse</th>
                  <th className="text-center px-4 py-4 font-semibold text-gray-500 w-[20%]">Free</th>
                  <th className="text-center px-4 py-4 font-semibold text-[#5F790B] w-[20%]">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5 text-gray-700 text-[13.5px]">{row.label}</td>
                    <td className="px-4 py-3.5 text-center">
                      {row.browse === true  && <Check size={16} className="text-gray-300 mx-auto" strokeWidth={2.5} />}
                      {row.browse === false && <X    size={16} className="text-gray-200 mx-auto" strokeWidth={2} />}
                      {typeof row.browse === 'string' && (
                        <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{row.browse}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {row.free === true  && <Check size={16} className="text-[#11875D] mx-auto" strokeWidth={2.5} />}
                      {row.free === false && <X    size={16} className="text-gray-300 mx-auto" strokeWidth={2} />}
                      {typeof row.free === 'string' && (
                        <span className="text-[12px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">{row.free}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {row.pro === true  && <Check size={16} className="text-[#5F790B] mx-auto" strokeWidth={2.5} />}
                      {row.pro === false && <X    size={16} className="text-gray-300 mx-auto" strokeWidth={2} />}
                      {typeof row.pro === 'string' && (
                        <span className="text-[12px] font-semibold text-[#5F790B] bg-[#EEF2FA] rounded-full px-2.5 py-0.5">{row.pro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-4">
            {(['Browse', 'Free', 'Pro'] as const).map((tier) => (
              <div key={tier} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className={cn('px-5 py-3 border-b', tier === 'Pro' ? 'bg-gray-950 border-gray-800' : tier === 'Browse' ? 'bg-gray-50 border-gray-100' : 'bg-gray-50 border-gray-200')}>
                  <span className={cn('text-[11px] font-bold uppercase tracking-widest', tier === 'Pro' ? 'text-[#5F790B]' : tier === 'Browse' ? 'text-gray-300' : 'text-gray-400')}>{tier}</span>
                </div>
                <ul className="divide-y divide-gray-100">
                  {COMPARISON_ROWS.map((row, i) => {
                    const val = tier === 'Browse' ? row.browse : tier === 'Free' ? row.free : row.pro
                    return (
                      <li key={i} className="flex items-center justify-between px-5 py-3 gap-3">
                        <span className="text-[13px] text-gray-700 leading-snug">{row.label}</span>
                        <span className="shrink-0">
                          {val === true  && <Check size={15} className={tier === 'Browse' ? 'text-gray-300' : tier === 'Free' ? 'text-[#11875D]' : 'text-[#5F790B]'} strokeWidth={2.5} />}
                          {val === false && <X    size={15} className="text-gray-300" strokeWidth={2} />}
                          {typeof val === 'string' && (
                            <span className={cn(
                              'text-[11px] font-semibold rounded-full px-2 py-0.5',
                              tier === 'Pro' ? 'text-[#5F790B] bg-[#EEF2FA]' : tier === 'Browse' ? 'text-gray-400 bg-gray-100' : 'text-gray-500 bg-gray-100',
                            )}>{val}</span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8 tracking-tight">
            Frequently asked questions
          </h2>
          {FAQS.map((faq, i) => (
            <FAQItem key={i} q={faq.q} a={faq.a} />
          ))}
        </div>

        {/* ── Final CTA ──────────────────────────────────────────── */}
        <div className="rounded-2xl bg-gray-950 p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[#5F790B] opacity-[0.04] pointer-events-none" />
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight relative">
            Know what has to be true before you buy.
          </h2>
          <p className="text-gray-400 mb-8 text-[15px] relative">
            A first-pass valuation in seconds. Go deeper when it matters.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative">
            <Link
              href="/analyze"
              className="w-full sm:w-auto rounded-xl bg-[#5F790B] hover:bg-[#526A08] px-8 py-3.5 text-[13.5px] font-bold text-white transition-colors text-center min-h-[48px] flex items-center justify-center"
            >
              Analyze a stock →
            </Link>
            {!session && (
              <button
                onClick={() => router.push('/auth/sign-in')}
                className="w-full sm:w-auto rounded-xl border border-white/15 text-white px-8 py-3.5 text-[13.5px] font-medium hover:bg-white/10 transition-colors min-h-[48px]"
              >
                Sign in with Google
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors min-h-[52px] gap-4"
        aria-expanded={open}
      >
        <span className="text-[14px] font-semibold text-gray-900 text-balance">{q}</span>
        <ChevronDown
          size={16}
          className={cn('text-gray-400 shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-3 text-[13.5px] text-gray-500 leading-relaxed border-t border-gray-100">
          {a}
        </div>
      )}
    </div>
  )
}
