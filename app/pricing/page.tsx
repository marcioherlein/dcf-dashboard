'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { Check, X, Zap, Shield, TrendingUp, BarChart2, Bell, FileText, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const FREE_FEATURES = [
  { text: 'Unlimited stock analysis (any ticker)',       included: true  },
  { text: 'Full valuation summary — grade + fair value', included: true  },
  { text: 'Bear / Base / Bull fair value range',         included: true  },
  { text: 'CAGR / WACC / Terminal growth sliders',       included: true  },
  { text: 'Quality scores (Piotroski, Altman, Beneish)', included: true  },
  { text: 'Financial statements (income / BS / CF)',     included: true  },
  { text: 'News feed',                                   included: true  },
  { text: 'Save up to 3 analyses to Watchlist',          included: true  },
  { text: 'Sensitivity table (CAGR × WACC heat map)',    included: false },
  { text: 'Price vs fair value alerts',                  included: false },
  { text: 'Unlimited saved analyses',                    included: false },
  { text: 'PDF investment brief export',                 included: false },
  { text: 'Thesis Builder (investment questionnaire)',   included: false },
  { text: 'Portfolio fair value tracker',                included: false },
  { text: 'Bull / Base / Bear scenario comparison',      included: false },
]

const PRO_FEATURES = [
  { text: 'Everything in Free',                                         icon: Shield    },
  { text: 'Sensitivity table — see fair value at any CAGR × WACC',     icon: BarChart2 },
  { text: 'Price vs fair value email alerts',                           icon: Bell      },
  { text: 'Unlimited saved analyses to Watchlist',                      icon: TrendingUp},
  { text: 'PDF investment brief export',                                icon: FileText  },
  { text: 'Thesis Builder — structured investment questionnaire',       icon: Users     },
  { text: 'Portfolio fair value tracker',                               icon: TrendingUp},
  { text: 'Bull / Base / Bear scenario builder',                        icon: Zap       },
  { text: 'Weekly watchlist digest (email)',                            icon: Bell      },
  { text: 'Historical fair value — see how estimates have evolved',     icon: BarChart2 },
]

const COMPARISON_ROWS = [
  { label: 'Analyze NYSE & NASDAQ stocks',                free: true,  pro: true  },
  { label: 'Grade badge (A / B / C / D)',                free: true,  pro: true  },
  { label: 'Weighted consensus fair value',              free: true,  pro: true  },
  { label: 'Bear / Base / Bull fair value range bar',    free: true,  pro: true  },
  { label: 'CAGR / WACC / Terminal growth sliders',      free: true,  pro: true  },
  { label: 'Piotroski / Altman / Beneish / ROIC scores', free: true,  pro: true  },
  { label: 'Full 3-statement financials',                free: true,  pro: true  },
  { label: 'News feed',                                  free: true,  pro: true  },
  { label: 'Saved analyses to Watchlist',                free: '3',   pro: '∞'   },
  { label: 'Sensitivity table (CAGR × WACC heat map)',   free: false, pro: true  },
  { label: 'Price vs fair value email alerts',           free: false, pro: true  },
  { label: 'Thesis Builder (26-question questionnaire)', free: false, pro: true  },
  { label: 'PDF investment brief export',                free: false, pro: true  },
  { label: 'Portfolio fair value dashboard',             free: false, pro: true  },
  { label: 'Bull / Base / Bear scenario builder',        free: false, pro: true  },
  { label: 'Historical fair value tracking',             free: false, pro: true  },
  { label: 'Weekly watchlist digest (email)',            free: false, pro: true  },
  { label: 'Priority support',                           free: false, pro: true  },
]

const FAQS = [
  {
    q: 'Is the free plan really free forever?',
    a: 'Yes. The free plan is not a trial. You can analyze any stock, see fair values, quality scores, and financial statements at no cost forever. We only charge for features that save you meaningful time or add significant depth.',
  },
  {
    q: 'How accurate is the DCF model?',
    a: "The model is based on FCFF (unlevered free cash flow) with WACC computed from CAPM, plus four additional methods (Forward P/E, EV/EBITDA, Revenue Multiple, Scenario Blend). Fair value is a weighted consensus — not a prediction. It reflects what the business is worth if certain assumptions hold. Use it to stress-test your own view, not as a guarantee.",
  },
  {
    q: 'Where does the data come from?',
    a: 'Financial statements come from Yahoo Finance and Financial Modeling Prep. Risk-free rates from FRED (US Federal Reserve). Country risk premiums from Damodaran (NYU Stern). CAPM parameters are computed fresh for each analysis.',
  },
  {
    q: 'Can I cancel anytime?',
    a: "Yes. No contracts. Cancel in one click. Your data stays intact and you keep access until the end of your billing period, then you move to the free plan with no data loss.",
  },
  {
    q: 'What stocks are covered?',
    a: 'NYSE and NASDAQ-listed stocks are fully supported. Additional exchanges are on the roadmap.',
  },
]

export default function PricingPage() {
  const [annual, setAnnual] = useState(true)

  const monthlyPrice  = 17
  const annualMonthly = 11.33
  const annualTotal   = 136

  return (
    <div className="min-h-screen" style={{ background: '#F8F7F2' }}>

      {/* Breadcrumb header */}
      <div className="bg-white border-b border-[#E3E6E0] px-6 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0 group" aria-label="insic home">
          <Image
            src="/logos/insic-header.png"
            alt="insic"
            width={72}
            height={24}
            className="h-6 w-auto object-contain"
          />
        </Link>
        <span className="text-[#B6BFCC]">·</span>
        <span className="text-[13px] text-[#8A96A8]">Pricing</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF4DD] border border-[#BFD2A1] px-4 py-1.5 text-[12px] font-semibold text-[#5F790B] mb-6">
            <Zap size={11} />
            Institutional-quality valuation tools for individual investors
          </div>
          <h1 className="text-[32px] sm:text-[40px] font-bold text-[#0A1424] tracking-tight leading-[1.1]">
            Invest with a process,{' '}
            <span className="text-[#5F790B]">not a story.</span>
          </h1>
          <p className="mt-4 text-[17px] text-[#536174] max-w-xl mx-auto leading-relaxed">
            Start free. Upgrade when you want more depth.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full bg-white border border-[#E3E6E0] p-1 shadow-card">
              <button
                onClick={() => setAnnual(false)}
                className={cn(
                  'rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-colors min-h-[44px]',
                  !annual
                    ? 'bg-[#0A1424] text-white'
                    : 'text-[#536174] hover:text-[#0A1424]',
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={cn(
                  'rounded-full px-5 py-2.5 text-[13.5px] font-semibold transition-colors flex items-center gap-2 min-h-[44px]',
                  annual
                    ? 'bg-[#0A1424] text-white'
                    : 'text-[#536174] hover:text-[#0A1424]',
                )}
              >
                Annual
                <span className={cn(
                  'text-[10px] font-bold rounded-full px-2 py-0.5',
                  annual
                    ? 'bg-[#5F790B] text-white'
                    : 'bg-[#EEF4DD] text-[#5F790B]',
                )}>
                  Save 33%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">

          {/* Free card */}
          <div className="rounded-[20px] bg-white border border-[#E3E6E0] p-8 flex flex-col shadow-card">
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A96A8] mb-3">Free</p>
              <div className="flex items-baseline gap-1">
                <span className="text-[48px] font-bold text-[#0A1424] leading-none tabular-nums">$0</span>
                <span className="text-[#8A96A8] text-[14px] font-medium">/ month</span>
              </div>
              <p className="text-[13px] text-[#536174] mt-2">No credit card. No time limit. Just analysis.</p>
            </div>

            <button
              onClick={() => signIn('google')}
              className="w-full rounded-[10px] border-2 border-[#CBD1C4] py-3.5 text-[13.5px] font-semibold text-[#0A1424] hover:border-[#5F790B] hover:bg-[#F6FAEA] transition-colors mb-8 min-h-[48px]"
            >
              Get started free →
            </button>

            <ul className="space-y-3 flex-1">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  {f.included
                    ? <Check size={15} className="text-[#11875D] shrink-0 mt-0.5" strokeWidth={2.5} />
                    : <X size={15} className="text-[#CBD1C4] shrink-0 mt-0.5" strokeWidth={2} />
                  }
                  <span className={cn(
                    'text-[13.5px] leading-snug',
                    f.included ? 'text-[#0A1424]' : 'text-[#B6BFCC]',
                  )}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro card — ink background with olive accents */}
          <div
            className="rounded-[20px] p-8 flex flex-col relative overflow-hidden"
            style={{ background: '#0A1424' }}
          >
            <div className="absolute top-5 right-5 rounded-full bg-[#5F790B] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1">
              Most Popular
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#EEF4DD] mb-3">Pro</p>
              {annual ? (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[48px] font-bold text-white leading-none tabular-nums">
                      ${annualMonthly.toFixed(2)}
                    </span>
                    <span className="text-[#8A96A8] text-[14px] font-medium">/ month</span>
                  </div>
                  <p className="text-[#8A96A8] text-[13px] mt-1">
                    Billed as ${annualTotal}/year · Save ${(monthlyPrice * 12 - annualTotal).toFixed(0)}/year
                  </p>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-[48px] font-bold text-white leading-none tabular-nums">${monthlyPrice}</span>
                  <span className="text-[#8A96A8] text-[14px] font-medium">/ month</span>
                </div>
              )}
              <p className="text-[#536174] text-[13px] mt-2">Cancel anytime. No contracts.</p>
            </div>

            <button
              onClick={() => signIn('google')}
              className="w-full rounded-[10px] bg-[#5F790B] hover:bg-[#526A08] active:bg-[#4A5E07] py-3.5 text-[13.5px] font-bold text-white transition-colors mb-3 min-h-[48px] shadow-sm"
            >
              Start Pro — {annual ? `$${annualTotal}/year` : `$${monthlyPrice}/month`} →
            </button>
            <p className="text-center text-[12px] text-[#536174] mb-6">
              Have a code?{' '}
              <a href="/redeem" className="text-[#EEF4DD] hover:underline font-semibold">Redeem it here</a>
            </p>

            <ul className="space-y-3 flex-1">
              {PRO_FEATURES.map((f, i) => {
                const Icon = f.icon
                return (
                  <li key={i} className="flex items-start gap-3">
                    <Icon size={14} className="text-[#7C9A19] shrink-0 mt-0.5" strokeWidth={2} />
                    <span className="text-[13.5px] text-[#B6BFCC] leading-snug">{f.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Data sources / trust bar */}
        <div className="rounded-[16px] bg-white border border-[#E3E6E0] px-6 sm:px-8 py-6 mb-16 text-center shadow-card">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A96A8] mb-4">Powered by public data</p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] font-medium text-[#536174]">
            <span>Yahoo Finance</span>
            <span className="hidden sm:inline text-[#E3E6E0]">·</span>
            <span>Financial Modeling Prep</span>
            <span className="hidden sm:inline text-[#E3E6E0]">·</span>
            <span>FRED (Federal Reserve)</span>
            <span className="hidden sm:inline text-[#E3E6E0]">·</span>
            <span>Damodaran (NYU Stern)</span>
          </div>
          <p className="mt-4 text-[11px] text-[#8A96A8] max-w-lg mx-auto leading-relaxed">
            Not financial advice. Fair value estimates are model outputs based on public data and stated assumptions — not guarantees of future returns.
          </p>
        </div>

        {/* Feature comparison table */}
        <div className="mb-16">
          <h2 className="text-[22px] sm:text-[26px] font-bold text-[#0A1424] text-center mb-8 tracking-tight">
            Full feature comparison
          </h2>

          {/* Mobile: card-per-tier */}
          <div className="sm:hidden space-y-4">
            {(['Free', 'Pro'] as const).map((tier) => (
              <div key={tier} className="rounded-[16px] bg-white border border-[#E3E6E0] overflow-hidden shadow-card">
                <div className="px-5 py-3 border-b border-[#E3E6E0] bg-[#FBFAF7]">
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-[0.08em]',
                    tier === 'Pro' ? 'text-[#5F790B]' : 'text-[#8A96A8]',
                  )}>{tier}</span>
                </div>
                <ul className="divide-y divide-[#F3F2EC]">
                  {COMPARISON_ROWS.map((row, i) => {
                    const val = tier === 'Free' ? row.free : row.pro
                    return (
                      <li key={i} className="flex items-center justify-between px-5 py-3 gap-3">
                        <span className="text-[13px] text-[#0A1424] leading-snug">{row.label}</span>
                        <span className="shrink-0">
                          {val === true  && <Check size={15} className="text-[#11875D]" strokeWidth={2.5} />}
                          {val === false && <X    size={15} className="text-[#CBD1C4]" strokeWidth={2} />}
                          {typeof val === 'string' && (
                            <span className={cn(
                              'text-[11px] font-bold rounded-full px-2 py-0.5',
                              tier === 'Pro'
                                ? 'text-[#5F790B] bg-[#EEF4DD]'
                                : 'text-[#536174] bg-[#F3F2EC]',
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

          {/* Desktop: comparison table */}
          <div className="hidden sm:block rounded-[16px] bg-white border border-[#E3E6E0] overflow-hidden shadow-card">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E3E6E0] bg-[#FBFAF7]">
                  <th className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A96A8] w-1/2">Feature</th>
                  <th className="text-center px-4 py-4 text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A96A8]">Free</th>
                  <th className="text-center px-4 py-4 text-[10px] font-bold uppercase tracking-[0.08em] text-[#5F790B]">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={i} className={cn(
                    'border-b border-[#F3F2EC] last:border-0',
                    i % 2 === 0 ? 'bg-white' : 'bg-[#FBFAF7]',
                  )}>
                    <td className="px-6 py-3 text-[#0A1424]">{row.label}</td>
                    <td className="px-4 py-3 text-center">
                      {row.free === true  && <Check size={15} className="text-[#11875D] mx-auto" strokeWidth={2.5} />}
                      {row.free === false && <X    size={15} className="text-[#CBD1C4] mx-auto" strokeWidth={2} />}
                      {typeof row.free === 'string' && (
                        <span className="text-[11px] font-bold text-[#536174] bg-[#F3F2EC] rounded-full px-2 py-0.5">{row.free}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.pro === true  && <Check size={15} className="text-[#11875D] mx-auto" strokeWidth={2.5} />}
                      {row.pro === false && <X    size={15} className="text-[#CBD1C4] mx-auto" strokeWidth={2} />}
                      {typeof row.pro === 'string' && (
                        <span className="text-[11px] font-bold text-[#5F790B] bg-[#EEF4DD] rounded-full px-2 py-0.5">{row.pro}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16">
          <h2 className="text-[22px] sm:text-[26px] font-bold text-[#0A1424] text-center mb-8 tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-3 max-w-2xl mx-auto">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="rounded-[20px] p-8 sm:p-10 text-center" style={{ background: '#0A1424' }}>
          <h2 className="text-[22px] sm:text-[26px] font-bold text-white mb-3 tracking-tight">
            Know what has to be true before you buy.
          </h2>
          <p className="text-[#8A96A8] mb-7 text-[14px]">
            A first-pass valuation in seconds. Go deeper when it matters.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/analyze"
              className="w-full sm:w-auto rounded-[10px] bg-[#5F790B] hover:bg-[#526A08] px-8 py-3.5 text-[13.5px] font-bold text-white transition-colors text-center"
            >
              Analyze a stock →
            </Link>
            <button
              onClick={() => signIn('google')}
              className="w-full sm:w-auto rounded-[10px] border border-[rgba(255,255,255,0.18)] text-white px-8 py-3.5 text-[13.5px] font-medium hover:bg-white/10 transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-[12px] bg-white border border-[#E3E6E0] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#FBFAF7] transition-colors min-h-[52px]"
      >
        <span className="text-[14px] font-semibold text-[#0A1424] text-balance">{q}</span>
        <span className={cn('text-[#8A96A8] transition-transform shrink-0 ml-4', open && 'rotate-180')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-5 pb-5 text-[13.5px] text-[#536174] leading-relaxed border-t border-[#E3E6E0]">
          <div className="pt-3">{a}</div>
        </div>
      )}
    </div>
  )
}
