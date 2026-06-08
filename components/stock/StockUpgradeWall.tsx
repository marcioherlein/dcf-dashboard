'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Zap, Check } from 'lucide-react'

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
  viewCount: number
}

const LIMIT = 10

const PRO_HIGHLIGHTS = [
  'Unlimited analyses — no monthly cap',
  'Sensitivity table (CAGR × WACC heat map)',
  'Price vs fair value email alerts',
  'PDF investment brief export',
  'Portfolio fair value tracker',
  'Historical fair value tracking',
]

function fmt(n: number, currency: string) {
  return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ScenarioCell({ label, value, variant, locked }: { label: string; value: string; variant: 'bear' | 'base' | 'bull'; locked?: boolean }) {
  const styles = {
    bear: { cell: 'bg-[#FCEAEA] border-[#F0B8B8]', label: 'text-[#D83B3B]' },
    base: { cell: 'bg-[#F4F3EF] border-[#E3E1DA]', label: 'text-[#566174]' },
    bull: { cell: 'bg-[#E8F7EF] border-[#A3D9BE]',  label: 'text-[#11875D]' },
  }
  const s = styles[variant]
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-center ${s.cell}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${s.label}`}>{label}</p>
      <div className="flex items-center justify-center gap-1">
        {locked && <Lock size={9} className="text-[#8A95A6] shrink-0" aria-hidden="true" />}
        <p className={`text-[13px] font-bold tabular-nums ${locked ? 'text-[#8A95A6] select-none' : 'text-[#06101F]'}`}>
          {locked ? value.replace(/\d/g, '·') : value}
        </p>
      </div>
    </div>
  )
}

export default function StockUpgradeWall({ ticker, companyName, price, currency, fairValue, upsidePct, scenarios, viewCount }: Props) {
  const router = useRouter()
  const [upgrading, setUpgrading] = useState(false)
  const upside = upsidePct ?? 0
  const isUndervalued = upside > 0
  const used = Math.min(viewCount, LIMIT)

  async function handleUpgrade() {
    setUpgrading(true)
    try {
      const res = await fetch('/api/lemonsqueezy/checkout', { method: 'POST' })
      const json = await res.json()
      if (json.url) window.location.href = json.url
    } catch {
      setUpgrading(false)
    }
  }

  return (
    <div className="pt-6 pb-16 px-1 max-w-lg mx-auto flex flex-col gap-5">

      {/* Stock identity + teaser */}
      <div className="rounded-2xl border border-[#E3E1DA] bg-white overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>

        {/* Header — ink, no gradient, consistent with login wall */}
        <div className="bg-[#111111] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white/40 text-[11px] font-bold uppercase tracking-wider mb-0.5">{ticker}</p>
              <h2 className="text-white font-bold text-[18px] leading-tight truncate">{companyName}</h2>
              {price != null && (
                <p className="text-white/60 text-[14px] font-medium mt-0.5 tabular-nums">
                  {fmt(price, currency)}
                </p>
              )}
            </div>
            {upsidePct != null && (
              <div className="shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-bold bg-white/10 text-white/70 border border-white/15">
                {isUndervalued ? '+' : ''}{upside.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Fair value — blurred to signal unlock needed */}
          {fairValue != null && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[#F4F3EF] border border-[#E3E1DA] px-4 py-3">
              <div>
                <p className="text-[11px] text-[#566174] font-semibold">Fair Value</p>
                <p className="text-[17px] font-bold text-[#06101F] tabular-nums blur-[4px] select-none" aria-hidden="true">
                  {fmt(fairValue, currency)}
                </p>
              </div>
              {upsidePct != null && (
                <span className={`shrink-0 text-[13px] font-bold px-2.5 py-1 rounded-lg border blur-[4px] select-none ${
                  isUndervalued
                    ? 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]'
                    : 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
                }`} aria-hidden="true">
                  {isUndervalued ? '+' : ''}{upside.toFixed(1)}%
                </span>
              )}
            </div>
          )}

          {scenarios && (
            <div className="grid grid-cols-3 gap-2">
              <ScenarioCell label="Bear" value={fmt(scenarios.bear.fairValue, currency)} variant="bear" locked />
              <ScenarioCell label="Base" value={fmt(scenarios.base.fairValue, currency)} variant="base" locked />
              <ScenarioCell label="Bull" value={fmt(scenarios.bull.fairValue, currency)} variant="bull" locked />
            </div>
          )}
        </div>
      </div>

      {/* Limit reached + upgrade */}
      <div className="rounded-2xl border border-[#E3E1DA] bg-white overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>

        {/* Usage + limit message */}
        <div className="px-5 pt-5 pb-4 border-b border-[#E3E1DA]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#FFF4DA] flex items-center justify-center shrink-0">
              <Lock size={14} className="text-[#B56A00]" strokeWidth={2.5} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#06101F]">Free limit reached</h3>
              <p className="text-[12px] text-[#566174]">Resets next month, or upgrade for unlimited access</p>
            </div>
          </div>

          {/* Usage bar */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-[11px] font-medium">
              <span className="text-[#566174]">{used} of {LIMIT} free analyses used this month</span>
              <span className="text-[#B56A00] font-bold">Limit reached</span>
            </div>
            <div className="h-1.5 bg-[#F4F3EF] rounded-full overflow-hidden" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={LIMIT}>
              <div
                className="h-full bg-[#B56A00] rounded-full transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Upgrade CTA */}
          <button
            onClick={handleUpgrade}
            disabled={upgrading}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#5F790B] hover:bg-[#526A08] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed text-white font-semibold text-[14px] py-3.5 transition-all min-h-[48px]"
            style={{ boxShadow: '0 4px 12px rgba(95,121,11,0.25)' }}
          >
            {upgrading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Redirecting to checkout...
              </span>
            ) : (
              <>
                <Zap size={15} aria-hidden="true" />
                Upgrade to Pro — $19/mo
              </>
            )}
          </button>
          <p className="text-center text-[11px] text-[#8A95A6] mt-2.5">Cancel anytime. No contracts.</p>
        </div>

        {/* Pro highlights */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold text-[#5F790B] uppercase tracking-wide mb-3">Pro includes</p>
          <ul className="space-y-2">
            {PRO_HIGHLIGHTS.map(f => (
              <li key={f} className="flex items-start gap-2">
                <Check size={12} className="text-[#5F790B] shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden="true" />
                <span className="text-[12px] text-[#566174] leading-snug">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer links */}
        <div className="px-5 py-3 border-t border-[#E3E1DA] flex items-center justify-between gap-4">
          <a href="/pricing" className="text-[12px] text-[#5F790B] font-semibold hover:underline underline-offset-2">
            Full plan comparison →
          </a>
          <div className="flex items-center gap-3 text-[12px] text-[#8A95A6]">
            <button
              onClick={() => router.push('/redeem')}
              className="hover:text-[#566174] transition-colors min-h-[44px] flex items-center"
            >
              Have a promo code?
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => router.back()}
              className="hover:text-[#566174] transition-colors min-h-[44px] flex items-center"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
