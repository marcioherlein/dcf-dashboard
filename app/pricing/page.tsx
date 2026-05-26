'use client'

import { useState } from 'react'
import Link from 'next/link'
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
    <div className="min-h-screen bg-[#F8FAFB]">

      {/* Nav back */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: '#0F2A5E' }}>
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <span className="font-bold text-slate-900 text-sm">intrinsico</span>
        </Link>
        <span className="text-slate-300">·</span>
        <span className="text-sm text-slate-500">Pricing</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 text-xs font-semibold text-blue-700 mb-6">
            <Zap size={12} />
            Institutional-quality valuation tools for individual investors
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
            Know if a stock is worth buying.<br />
            <span style={{ color: '#0F2A5E' }}>Understand exactly why.</span>
          </h1>
          <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
            Start free. Upgrade when you want more depth.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white border border-slate-200 p-1.5 shadow-sm">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-semibold transition-colors',
                !annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-semibold transition-colors flex items-center gap-2',
                annual ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              Annual
              <span className={cn(
                'text-[10px] font-bold rounded-full px-2 py-0.5',
                annual ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-700'
              )}>
                Save 33%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">

          {/* Free card */}
          <div className="rounded-2xl bg-white border border-slate-200 p-8 flex flex-col">
            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Free</div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold text-slate-900" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>$0</span>
                <span className="text-slate-400 text-sm font-medium">/ month</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">No credit card. No time limit. Just analysis.</p>
            </div>

            <button
              onClick={() => signIn('google')}
              className="w-full rounded-xl border-2 border-slate-900 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors mb-8"
            >
              Get started free →
            </button>

            <ul className="space-y-3 flex-1">
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-3">
                  {f.included
                    ? <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    : <X size={16} className="text-slate-200 shrink-0 mt-0.5" />
                  }
                  <span className={cn(
                    'text-sm leading-snug',
                    f.included ? 'text-slate-700' : 'text-slate-300'
                  )}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro card */}
          <div
            className="rounded-2xl p-8 flex flex-col relative overflow-hidden"
            style={{ background: '#0F2A5E' }}
          >
            {/* Popular badge */}
            <div className="absolute top-5 right-5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1">
              Most Popular
            </div>

            <div className="mb-6">
              <div className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-3">Pro</div>
              {annual ? (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold text-white" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
                      ${annualMonthly.toFixed(2)}
                    </span>
                    <span className="text-blue-300 text-sm font-medium">/ month</span>
                  </div>
                  <p className="text-blue-300 text-sm mt-1">
                    Billed as ${annualTotal}/year · Save ${(monthlyPrice * 12 - annualTotal).toFixed(0)}/year
                  </p>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold text-white" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
                    ${monthlyPrice}
                  </span>
                  <span className="text-blue-300 text-sm font-medium">/ month</span>
                </div>
              )}
              <p className="text-blue-200/70 text-sm mt-2">Cancel anytime. No contracts.</p>
            </div>

            <button
              onClick={() => signIn('google')}
              className="w-full rounded-xl bg-white py-3 text-sm font-bold text-[#0F2A5E] hover:bg-blue-50 transition-colors mb-8"
            >
              Start Pro — {annual ? `$${annualTotal}/year` : `$${monthlyPrice}/month`} →
            </button>

            <ul className="space-y-3 flex-1">
              {PRO_FEATURES.map((f, i) => {
                const Icon = f.icon
                return (
                  <li key={i} className="flex items-start gap-3">
                    <Icon size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-blue-100 leading-snug">{f.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Social proof / trust bar */}
        <div className="rounded-2xl bg-white border border-slate-200 px-8 py-6 mb-16 text-center">
          <p className="text-[12px] font-bold uppercase tracking-widest text-slate-400 mb-4">Powered by</p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm font-semibold text-slate-500">
            <span>Yahoo Finance</span>
            <span className="text-slate-200">·</span>
            <span>Financial Modeling Prep</span>
            <span className="text-slate-200">·</span>
            <span>FRED (Federal Reserve)</span>
            <span className="text-slate-200">·</span>
            <span>Damodaran (NYU Stern)</span>
          </div>
          <p className="mt-4 text-xs text-slate-400 max-w-lg mx-auto">
            This is not financial advice. Fair value estimates are model outputs based on public data and stated assumptions — not guarantees of future returns. Past model accuracy does not predict future results.
          </p>
        </div>

        {/* Feature comparison table */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
            Full feature comparison
          </h2>
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 w-1/2">Feature</th>
                  <th className="text-center px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Free</th>
                  <th className="text-center px-4 py-4 text-xs font-bold uppercase tracking-wider text-[#0F2A5E]">Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
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
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-6 py-3 text-slate-700">{row.label}</td>
                    <td className="px-4 py-3 text-center">
                      {row.free === true  && <Check size={16} className="text-emerald-500 mx-auto" />}
                      {row.free === false && <X    size={16} className="text-slate-200 mx-auto"   />}
                      {typeof row.free === 'string' && (
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">{row.free}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.pro === true  && <Check size={16} className="text-emerald-500 mx-auto" />}
                      {row.pro === false && <X    size={16} className="text-slate-200 mx-auto"   />}
                      {typeof row.pro === 'string' && (
                        <span className="text-xs font-bold text-[#0F2A5E] bg-blue-50 rounded-full px-2 py-0.5">{row.pro}</span>
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
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
            Frequently asked questions
          </h2>
          <div className="space-y-4 max-w-2xl mx-auto">
            {FAQS.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* CTA footer */}
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: '#0F2A5E' }}
        >
          <h2 className="text-2xl font-bold text-white mb-3" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
            Start analyzing. It&apos;s free.
          </h2>
          <p className="text-blue-300 mb-7 text-sm">
            No account required for your first analysis.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto rounded-xl bg-white px-8 py-3 text-sm font-bold text-[#0F2A5E] hover:bg-blue-50 transition-colors text-center"
            >
              Analyze a stock →
            </Link>
            <button
              onClick={() => signIn('google')}
              className="w-full sm:w-auto rounded-xl border border-white/30 text-white px-8 py-3 text-sm font-medium hover:bg-white/10 transition-colors"
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
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-800">{q}</span>
        <span className={cn('text-slate-400 transition-transform shrink-0 ml-4', open && 'rotate-180')}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
          <div className="pt-3">{a}</div>
        </div>
      )}
    </div>
  )
}
