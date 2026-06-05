'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const FREE_FEATURES = [
  'Stock analysis (any ticker)',
  'Fair value summary',
  'Market-implied expectations',
  'Essential financials',
  '3 saved analyses',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Full valuation models (DCF, RDCF, Multiples)',
  'Sensitivity tables and scenarios',
  'Unlimited saved analyses',
  'PDF export',
  'Portfolio and watchlists',
  'Priority support',
]

// Four features that differentiate Pro — shown as a quick-diff strip on mobile
const PRO_DIFF = [
  'Sensitivity tables',
  'Unlimited saves',
  'PDF export',
  'Price alerts',
]

export default function PricingSection() {
  const [annual, setAnnual] = useState(true)

  const monthlyPrice  = 17
  const annualMonthly = 11.33
  const annualTotal   = 136

  return (
    <section id="pricing" className="overflow-x-hidden" style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E5E5' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 sm:py-20">

        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-[28px] sm:text-[36px] font-bold text-[#111111] leading-tight mb-3" style={{ letterSpacing: '-0.025em' }}>
            Simple pricing.<br />Everything you need.
          </h2>

          {/* Toggle */}
          <div className="inline-flex items-center gap-1 rounded-full bg-white border border-[#E5E5E5] p-1 mt-4" style={{ boxShadow: '0 2px 8px rgba(6,16,31,0.06)' }}>
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                'rounded-full px-5 py-2 text-[13.5px] font-semibold transition-colors min-h-[40px]',
                !annual ? 'bg-[#5F790B] text-white' : 'text-[#6B6B6B] hover:text-[#111111]',
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                'rounded-full px-5 py-2 text-[13.5px] font-semibold transition-colors flex items-center gap-2 min-h-[40px]',
                annual ? 'bg-[#5F790B] text-white' : 'text-[#6B6B6B] hover:text-[#111111]',
              )}
            >
              Annual
              <span className={cn(
                'text-[10px] font-bold rounded-full px-2 py-0.5',
                annual ? 'bg-white text-[#5F790B]' : 'bg-[#EEF4DD] text-[#5F790B]',
              )}>
                Save 33%
              </span>
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[680px] mx-auto">

          {/* Free */}
          <div className="rounded-[20px] border border-[#E5E5E5] bg-white p-6 flex flex-col" style={{ boxShadow: '0 4px 16px rgba(6,16,31,0.05)' }}>
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#9B9B9B] mb-3">Free</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[44px] font-bold text-[#111111] leading-none tabular-nums">$0</span>
              <span className="text-[13px] text-[#9B9B9B] font-medium">/month</span>
            </div>
            <p className="text-[12px] text-[#6B6B6B] mb-5">No credit card required. Free plan never expires.</p>
            <button
              onClick={() => signIn('google')}
              className="w-full rounded-[10px] border border-[#C8C8C8] py-3 text-[13.5px] font-semibold text-[#111111] hover:bg-[#F6FAEA] hover:border-[#5F790B] transition-colors mb-5 min-h-[48px]"
            >
              Get started for free
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
          <div className="rounded-[20px] border border-[#BFD2A1] bg-white p-6 flex flex-col relative" style={{ boxShadow: '0 4px 20px rgba(95,121,11,0.12)' }}>
            <div className="absolute top-4 right-4 rounded-full bg-[#5F790B] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">
              MOST POPULAR
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#5F790B] mb-3">Pro</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-[44px] font-bold text-[#111111] leading-none tabular-nums">
                ${annual ? annualMonthly.toFixed(2) : monthlyPrice}
              </span>
              <span className="text-[13px] text-[#9B9B9B] font-medium">/month</span>
            </div>
            {annual && (
              <p className="text-[12px] text-[#6B6B6B] mb-1">Billed as ${annualTotal}/year</p>
            )}
            <p className="text-[12px] text-[#6B6B6B] mb-5">For investors who want deeper research.</p>
            <button
              onClick={() => signIn('google')}
              className="w-full rounded-[10px] py-3 text-[13.5px] font-bold text-white transition-all hover:-translate-y-px active:scale-95 mb-5 min-h-[48px]"
              style={{ background: '#5F790B', boxShadow: '0 4px 12px rgba(95,121,11,0.22)' }}
            >
              Start Pro →
            </button>
            <p className="text-center text-[11px] text-[#9B9B9B] mb-4">Cancel anytime.</p>
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

        {/* Pro-only quick-diff strip — helps mobile users see what they get without scanning both cards */}
        <div className="mt-5 max-w-[680px] mx-auto rounded-[14px] border border-[#BFD2A1] bg-[#F6FAEA] px-5 py-3.5 flex flex-wrap items-center gap-3">
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
