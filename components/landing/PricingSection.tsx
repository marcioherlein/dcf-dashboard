'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { signIn } from 'next-auth/react'

const FREE_ITEMS = [
  '5 valuations per day',
  'Access to key metrics',
  'Reverse DCF summary',
  'Watchlist & alerts',
  'Basic assumptions',
]

const PRO_ITEMS = [
  'Everything in Free',
  'Unlimited valuations',
  'Full valuation deep-dives',
  'Custom assumptions',
  'Export & portfolio tools',
  'Fair value email alerts',
  'Scenario builder',
  'Sensitivity table',
]

export default function PricingSection() {
  const router = useRouter()

  return (
    <section style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
      <div className="mx-auto max-w-[900px] px-6 py-24">
        {/* Heading */}
        <div className="text-center mb-12">
          <p
            className="font-bold uppercase mb-3"
            style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#2563EB' }}
          >
            Simple, transparent pricing
          </p>
          <h2
            style={{
              fontSize: 'clamp(30px, 3vw, 42px)',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              color: '#0F172A',
              marginBottom: '12px',
            }}
          >
            Start free. Upgrade when you&apos;re ready to scale.
          </h2>
          <p style={{ fontSize: '15px', color: '#64748B' }}>
            No credit card required. Cancel anytime.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Free */}
          <div
            className="rounded-[20px] bg-white border p-8"
            style={{
              borderColor: '#E6ECF5',
              boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.05)',
            }}
          >
            <div className="mb-6">
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>Free</p>
              <div className="flex items-baseline gap-1">
                <span style={{ fontSize: '36px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>$0</span>
                <span style={{ fontSize: '14px', color: '#94A3B8' }}>/mo</span>
              </div>
              <p style={{ fontSize: '14px', color: '#64748B', marginTop: '6px' }}>
                No account needed to start. Always free.
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              {FREE_ITEMS.map(item => (
                <li key={item} className="flex items-start gap-3 text-[14px] text-slate-600">
                  <Check size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => router.push('/stock/AAPL')}
              className="w-full rounded-xl py-3 text-[14px] font-semibold text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all"
            >
              Get started
            </button>
          </div>

          {/* Pro */}
          <div
            className="relative rounded-[20px] border p-8"
            style={{
              background: 'linear-gradient(160deg, #EFF6FF 0%, #F5F3FF 100%)',
              borderColor: '#BFDBFE',
              boxShadow: '0 1px 2px rgba(37,99,235,0.06), 0 12px 36px rgba(37,99,235,0.12)',
            }}
          >
            {/* Most popular badge */}
            <div
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[11px] font-bold text-white uppercase tracking-wider"
              style={{ background: '#2563EB', boxShadow: '0 4px 12px rgba(37,99,235,0.35)' }}
            >
              Most popular
            </div>

            <div className="mb-6">
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>Pro</p>
              <div className="flex items-baseline gap-1">
                <span style={{ fontSize: '36px', fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>$17</span>
                <span style={{ fontSize: '14px', color: '#94A3B8' }}>/mo</span>
              </div>
              <p style={{ fontSize: '14px', color: '#64748B', marginTop: '6px' }}>
                For investors who do serious research.
              </p>
            </div>

            <ul className="space-y-3 mb-8">
              {PRO_ITEMS.map(item => (
                <li key={item} className="flex items-start gap-3 text-[14px] text-slate-700">
                  <Check size={15} className="text-blue-500 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => signIn('google')}
              className="w-full rounded-xl py-3 text-[14px] font-semibold text-white transition-all hover:-translate-y-px active:translate-y-0"
              style={{
                background: '#2563EB',
                boxShadow: '0 6px 16px rgba(37,99,235,0.28)',
              }}
            >
              Start free trial
            </button>
          </div>
        </div>

        <p className="text-center mt-6 text-[12px] text-slate-400">
          Annual plan available at <Link href="/pricing" className="text-blue-600 hover:underline">$136/yr</Link> — save 33%.
        </p>
      </div>
    </section>
  )
}
