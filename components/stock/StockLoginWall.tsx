'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Lock } from 'lucide-react'
import { DEMO_TICKER } from '@/lib/constants'

interface Props {
  ticker: string
  companyName: string
  price: number | null
  currency: string
  fairValue: number | null
  upsidePct: number | null
  scenarios: {
    bull: { fairValue: number }
    base: { fairValue: number }
    bear: { fairValue: number }
  } | null
  grade: string | null
}

const FREE_FEATURES = [
  'Full DCF + 5 valuation methods',
  'Bear / Base / Bull scenarios',
  'Financial health scores (Piotroski, Altman, Beneish)',
  'Risk signals and insider data',
  'News and analyst sentiment',
  'Save up to 5 analyses',
]

const PRO_FEATURES = [
  'Unlimited saved analyses',
  'Sensitivity table (CAGR × WACC)',
  'Price vs fair value alerts',
  'PDF investment brief export',
  'Portfolio fair value tracker',
  'Historical fair value tracking',
]

function fmt(n: number, currency: string) {
  return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ScenarioCell({ label, value, variant }: { label: string; value: string; variant: 'bear' | 'base' | 'bull' }) {
  const styles = {
    bear: { cell: 'bg-[#FCEAEA] border-[#F0B8B8]', label: 'text-[#D83B3B]', value: 'text-[#8A95A6]' },
    base: { cell: 'bg-[#F0F1F6] border-[#E3E1DA]', label: 'text-[#566174]', value: 'text-[#8A95A6]' },
    bull: { cell: 'bg-[#E8F7EF] border-[#A3D9BE]',  label: 'text-[#11875D]', value: 'text-[#8A95A6]' },
  }
  const s = styles[variant]
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-center ${s.cell}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${s.label}`}>{label}</p>
      <div className="flex items-center justify-center gap-1">
        <Lock size={9} className="text-[#8A95A6] shrink-0" aria-hidden="true" />
        <p className={`text-[13px] font-bold tabular-nums select-none ${s.value}`}>{value}</p>
      </div>
    </div>
  )
}

export default function StockLoginWall({ ticker, companyName, price, currency, fairValue, upsidePct, scenarios }: Props) {
  const router = useRouter()
  const upside = upsidePct ?? 0
  const isUndervalued = upside > 0

  // Mask scenario values
  function masked(n: number) {
    return fmt(n, currency).replace(/\d/g, '·')
  }

  return (
    <div className="pt-6 pb-16 px-1 max-w-lg mx-auto flex flex-col gap-5">

      {/* Stock identity + teaser */}
      <div className="rounded-2xl border border-[#E3E1DA] bg-white overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>

        {/* Header — olive brand, no gradient */}
        <div className="bg-[#5F790B] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white/60 text-[11px] font-bold uppercase tracking-wider mb-0.5">{ticker}</p>
              <h2 className="text-white font-bold text-[18px] leading-tight truncate">{companyName}</h2>
              {price != null && (
                <p className="text-white/75 text-[14px] font-medium mt-0.5 tabular-nums">
                  {fmt(price, currency)}
                </p>
              )}
            </div>
            {fairValue != null && upsidePct != null && (
              <div className={`shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-bold border ${
                isUndervalued
                  ? 'bg-white/20 text-white border-white/30'
                  : 'bg-white/15 text-white/80 border-white/20'
              }`}>
                {isUndervalued ? '+' : ''}{upside.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Fair value row */}
          {fairValue != null && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F0F1F6] border border-[#E3E1DA] px-4 py-3">
              <div>
                <p className="text-[11px] text-[#566174] font-semibold">Fair Value</p>
                <p className="text-[17px] font-bold text-[#06101F] tabular-nums">{fmt(fairValue, currency)}</p>
              </div>
              {upsidePct != null && (
                <span className={`shrink-0 text-[13px] font-bold px-2.5 py-1 rounded-lg border ${
                  isUndervalued
                    ? 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]'
                    : 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
                }`}>
                  {isUndervalued ? '+' : ''}{upside.toFixed(1)}% {isUndervalued ? 'upside' : 'downside'}
                </span>
              )}
            </div>
          )}

          {/* Scenarios — masked */}
          {scenarios && (
            <div className="grid grid-cols-3 gap-2">
              <ScenarioCell label="Bear" value={masked(scenarios.bear.fairValue)} variant="bear" />
              <ScenarioCell label="Base" value={masked(scenarios.base.fairValue)} variant="base" />
              <ScenarioCell label="Bull" value={masked(scenarios.bull.fairValue)} variant="bull" />
            </div>
          )}
        </div>
      </div>

      {/* Sign in + plan comparison */}
      <div className="rounded-2xl border border-[#E3E1DA] bg-white overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>

        {/* CTA */}
        <div className="px-5 pt-5 pb-4 border-b border-[#E3E1DA]">
          <h3 className="text-[17px] font-bold text-[#06101F] mb-0.5">Sign in to analyze {ticker}</h3>
          <p className="text-[13px] text-[#566174] mb-4">
            Free account · 5 stocks/month · No credit card.{' '}
            <Link href={`/stock/${DEMO_TICKER}`} className="text-[#5F790B] font-semibold hover:underline underline-offset-2">
              Try the {DEMO_TICKER} demo →
            </Link>
          </p>

          <button
            onClick={() => router.push('/auth/sign-in?callbackUrl=' + encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '/'))}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#5F790B] hover:bg-[#526A08] active:scale-[0.99] text-white font-semibold text-[14px] py-3.5 transition-all min-h-[48px]"
            style={{ boxShadow: '0 4px 12px rgba(95,121,11,0.25)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
              <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
          <p className="text-center text-[11px] text-[#8A95A6] mt-2.5">Free forever — no credit card, no time limit</p>
        </div>

        {/* Plan comparison */}
        <div className="grid grid-cols-2 divide-x divide-[#E3E1DA]">

          {/* Free column */}
          <div className="px-4 py-4">
            <div className="mb-3">
              <p className="text-[12px] font-bold text-[#06101F]">Free</p>
              <p className="text-[20px] font-bold text-[#06101F] leading-none mt-0.5">$0<span className="text-[12px] font-medium text-[#8A95A6]">/mo</span></p>
            </div>
            <ul className="space-y-2">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <Check size={12} className="text-[#11875D] shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden="true" />
                  <span className="text-[11px] text-[#566174] leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro column */}
          <div className="px-4 py-4 bg-[#F6FAEA]">
            <div className="mb-3">
              <p className="text-[12px] font-bold text-[#5F790B]">Pro</p>
              <p className="text-[20px] font-bold text-[#06101F] leading-none mt-0.5">$17<span className="text-[12px] font-medium text-[#8A95A6]">/mo</span></p>
            </div>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check size={12} className="text-[#5F790B] shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden="true" />
                <span className="text-[11px] text-[#566174] leading-snug font-semibold">Everything in Free, plus:</span>
              </li>
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <Check size={12} className="text-[#5F790B] shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden="true" />
                  <span className="text-[11px] text-[#566174] leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom link */}
        <div className="px-5 py-3 border-t border-[#E3E1DA] text-center">
          <a href="/pricing" className="text-[12px] text-[#5F790B] font-semibold hover:underline underline-offset-2">
            See full plan comparison →
          </a>
        </div>
      </div>
    </div>
  )
}
