'use client'

import { useState, useEffect, useMemo } from 'react'
import type { StrategyRow, UniverseCategory } from '@/lib/strategies/types'

// ─── Strategy definitions ─────────────────────────────────────────────────────

interface StrategyDef {
  id: string
  label: string
  shortLabel: string
  description: string
  formula: string
  signal: string
  source: string
}

const STRATEGIES: StrategyDef[] = [
  {
    id: 'momentum',
    label: 'Price Momentum (12-1)',
    shortLabel: 'Momentum',
    description:
      'Stocks with strong past performance tend to continue outperforming in the near future (Jegadeesh & Titman, 1993). The 12-1 variant measures the 12-month return skipping the most recent month to avoid short-term reversal noise.',
    formula: 'Momentum = P(1m ago) / P(13m ago) − 1',
    signal: 'Rank stocks by past 12-month return (skip last month). Buy top decile, sell/avoid bottom decile.',
    source: 'Jegadeesh & Titman (1993), Asness et al. (2014)',
  },
  {
    id: 'lowvol',
    label: 'Low Volatility Anomaly',
    shortLabel: 'Low Vol',
    description:
      'Empirically, low-volatility stocks produce higher risk-adjusted returns than high-volatility stocks — the opposite of what CAPM predicts (Blitz & van Vliet, 2007; Frazzini & Pedersen, 2014). This is attributed to leverage aversion and lottery-seeking behavior.',
    formula: 'Vol₂₅₂ = std(daily returns) × √252',
    signal: 'Buy lowest-volatility stocks. Avoid highest-volatility names. Holding period: 6–12 months.',
    source: 'Blitz & van Vliet (2007), Baker, Bradley & Wurgler (2011)',
  },
  {
    id: 'ma',
    label: 'Moving Average Signal',
    shortLabel: 'MA Signal',
    description:
      'When the 50-day SMA crosses above the 200-day SMA (Golden Cross), it signals bullish momentum. When it crosses below (Death Cross), it signals weakness. One of the most widely watched technical signals.',
    formula: 'Signal = 1 if SMA₅₀ > SMA₂₀₀  |  Spread = (SMA₅₀ − SMA₂₀₀) / SMA₂₀₀',
    signal: 'Buy when SMA₅₀ > SMA₂₀₀ (Golden Cross). Avoid / short when SMA₅₀ < SMA₂₀₀ (Death Cross).',
    source: 'Brock, Lakonishok & LeBaron (1992), Faber (2007)',
  },
  {
    id: 'meanrev',
    label: 'Mean Reversion',
    shortLabel: 'Mean Rev.',
    description:
      'Stocks that have fallen significantly relative to their peers in the past month tend to recover (Lo & MacKinlay, 1990). This contrarian strategy buys recent losers and sells recent winners within a peer group.',
    formula: 'z = (R₁ₘ − μ_universe) / σ_universe',
    signal: 'Buy stocks with the most negative z-score (oversold). Short most positive z-score (overbought). Hold ~1 month.',
    source: 'Lo & MacKinlay (1990), Lehmann (1990)',
  },
  {
    id: 'value',
    label: 'Value Composite',
    shortLabel: 'Value',
    description:
      'Cheap stocks by fundamental metrics (high Book/Price, Earnings/Price, Cash Flow/Price) outperform expensive ones over the long run (Fama & French, 1992; Asness, 2013). A composite rank across multiple metrics is more robust than any single ratio.',
    formula: 'Value Rank = avg_rank(P/E, P/B, P/S, EV/EBITDA) ← lower = cheaper',
    signal: 'Buy stocks with the lowest composite valuation rank (cheapest on fundamentals). Typical holding: 6–12 months.',
    source: 'Fama & French (1992), Asness, Moskowitz & Pedersen (2013)',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(v: number | null, decimals = 1): string {
  if (v === null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(decimals)}%`
}

function clr(val: number | null, good: 'high' | 'low'): string {
  if (val === null) return 'text-[#8A95A6]'
  const isGood = good === 'high' ? val > 0 : val < 0
  const isBad  = good === 'high' ? val < 0 : val > 0
  if (isGood) return 'text-[#11875D]'
  if (isBad)  return 'text-[#D83B3B]'
  return 'text-[#566174]'
}

function rankColor(rank: number | null, total: number): string {
  if (rank === null) return 'bg-[#F4F3EF] text-[#8A95A6]'
  const pct = rank / total
  if (pct <= 0.25) return 'bg-[#E8F7EF] text-[#11875D]'
  if (pct <= 0.50) return 'bg-sky-100 text-sky-800'
  if (pct <= 0.75) return 'bg-[#FFF4DA] text-[#B56A00]'
  return 'bg-[#FCEAEA] text-[#D83B3B]'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StrategyHeader({ def }: { def: StrategyDef }) {
  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl p-5 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-base font-bold text-[#06101F] mb-1">{def.label}</h2>
          <p className="text-[13px] text-[#566174] leading-relaxed mb-3">{def.description}</p>
          <div className="flex flex-wrap gap-3">
            <div className="bg-[#EAF1FF] border border-[#EAF1FF] rounded-lg px-3 py-2 flex-1 min-w-[240px]">
              <div className="text-[10px] font-semibold text-[#2563EB] uppercase tracking-wide mb-0.5">Formula</div>
              <code className="text-[12px] text-[#2563EB] font-mono">{def.formula}</code>
            </div>
            <div className="bg-[#F4F3EF] border border-[#E3E1DA] rounded-lg px-3 py-2 flex-1 min-w-[240px]">
              <div className="text-[10px] font-semibold text-[#566174] uppercase tracking-wide mb-0.5">Signal Rule</div>
              <p className="text-[12px] text-[#566174]">{def.signal}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-[#8A95A6] mt-3">Source: {def.source}</p>
    </div>
  )
}

function CategoryBadge({ category }: { category: StrategyRow['category'] }) {
  const styles: Record<string, string> = {
    'AI Stack': 'bg-[#EAF1FF] text-[#2563EB]',
    'CEDEAR':   'bg-violet-100 text-violet-700',
    'BYMA':     'bg-[#E8F7EF] text-[#11875D]',
  }
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${styles[category] ?? 'bg-[#F4F3EF] text-[#566174]'}`}>
      {category}
    </span>
  )
}

function RankBadge({ rank, total }: { rank: number | null; total: number }) {
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold ${rankColor(rank, total)}`}>
      {rank ?? '—'}
    </span>
  )
}

// Signal badge for MA
function MaSignalBadge({ signal }: { signal: 'golden' | 'death' | null }) {
  if (!signal) return <span className="text-[#8A95A6] text-[12px]">—</span>
  if (signal === 'golden')
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#E8F7EF] text-[#11875D] px-2 py-0.5 rounded-full">★ Golden</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#FCEAEA] text-[#D83B3B] px-2 py-0.5 rounded-full">✕ Death</span>
}

// ─── Per-strategy tables ──────────────────────────────────────────────────────

function MomentumTable({ rows }: { rows: StrategyRow[] }) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => (a.momentumRank ?? 99) - (b.momentumRank ?? 99)),
    [rows]
  )
  return (
    <table className="w-full text-[13px] min-w-[600px]">
      <thead>
        <tr className="border-b border-[#E3E1DA]">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Rank</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Sector</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">12-1 Return</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">1D Change</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Price</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const n = sorted.length
          const pct = (r.momentumRank ?? n) / n
          const signal = pct <= 0.33 ? 'BUY' : pct >= 0.67 ? 'AVOID' : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-[#E3E1DA] hover:bg-[#F4F3EF] transition-colors">
              <td className="py-2.5 px-3">
                <RankBadge rank={r.momentumRank} total={n} />
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#2563EB]">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-[#8A95A6] hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-[#566174]">{r.layer}</td>
              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${clr(r.momentum12_1, 'high')}`}>
                {fmtPct(r.momentum12_1)}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${clr(r.change1d, 'high')}`}>
                {fmtPct(r.change1d)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-[#566174]">
                {r.price !== null ? `$${r.price.toFixed(2)}` : '—'}
              </td>
              <td className="py-2.5 px-3 text-center">
                <SignalBadge signal={signal} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function LowVolTable({ rows }: { rows: StrategyRow[] }) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => (a.volRank ?? 99) - (b.volRank ?? 99)),
    [rows]
  )
  return (
    <table className="w-full text-[13px] min-w-[500px]">
      <thead>
        <tr className="border-b border-[#E3E1DA]">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Rank</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Sector</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Annualized Vol</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Price</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const n = sorted.length
          const pct = (r.volRank ?? n) / n
          const signal = pct <= 0.33 ? 'BUY' : pct >= 0.67 ? 'AVOID' : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-[#E3E1DA] hover:bg-[#F4F3EF]">
              <td className="py-2.5 px-3">
                <RankBadge rank={r.volRank} total={n} />
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#2563EB]">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-[#8A95A6] hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-[#566174]">{r.layer}</td>
              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${r.vol252 !== null ? (r.vol252 < 0.30 ? 'text-[#11875D]' : r.vol252 < 0.50 ? 'text-[#566174]' : 'text-[#D83B3B]') : 'text-[#8A95A6]'}`}>
                {fmtPct(r.vol252)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-[#566174]">
                {r.price !== null ? `$${r.price.toFixed(2)}` : '—'}
              </td>
              <td className="py-2.5 px-3 text-center">
                <SignalBadge signal={signal} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function MaTable({ rows }: { rows: StrategyRow[] }) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => {
      // Golden crosses first, then by spread descending
      const aScore = a.maSignal === 'golden' ? 1 : -1
      const bScore = b.maSignal === 'golden' ? 1 : -1
      if (aScore !== bScore) return bScore - aScore
      return (b.maSpread ?? -99) - (a.maSpread ?? -99)
    }),
    [rows]
  )
  return (
    <table className="w-full text-[13px] min-w-[520px]">
      <thead>
        <tr className="border-b border-[#E3E1DA]">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Sector</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">MA Cross</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">SMA50 vs SMA200</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Price</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const signal: 'BUY' | 'AVOID' | 'NEUTRAL' = r.maSignal === 'golden' ? 'BUY' : r.maSignal === 'death' ? 'AVOID' : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-[#E3E1DA] hover:bg-[#F4F3EF]">
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#2563EB]">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-[#8A95A6] hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-[#566174]">{r.layer}</td>
              <td className="py-2.5 px-3 text-center">
                <MaSignalBadge signal={r.maSignal} />
              </td>
              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${clr(r.maSpread, 'high')}`}>
                {fmtPct(r.maSpread)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-[#566174]">
                {r.price !== null ? `$${r.price.toFixed(2)}` : '—'}
              </td>
              <td className="py-2.5 px-3 text-center">
                <SignalBadge signal={signal} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function MeanRevTable({ rows }: { rows: StrategyRow[] }) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => (a.mrZscore ?? 0) - (b.mrZscore ?? 0)),
    [rows]
  )
  return (
    <table className="w-full text-[13px] min-w-[500px]">
      <thead>
        <tr className="border-b border-[#E3E1DA]">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Sector</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">1M Return</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Z-Score</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Price</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const z = r.mrZscore
          const signal: 'BUY' | 'AVOID' | 'NEUTRAL' = z !== null ? (z < -1 ? 'BUY' : z > 1 ? 'AVOID' : 'NEUTRAL') : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-[#E3E1DA] hover:bg-[#F4F3EF]">
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#2563EB]">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-[#8A95A6] hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-[#566174]">{r.layer}</td>
              <td className={`py-2.5 px-3 text-right font-mono ${clr(r.return1m, 'high')}`}>
                {fmtPct(r.return1m)}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${z !== null ? (z < -1 ? 'text-[#11875D]' : z > 1 ? 'text-[#D83B3B]' : 'text-[#566174]') : 'text-[#8A95A6]'}`}>
                {z !== null ? z.toFixed(2) : '—'}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-[#566174]">
                {r.price !== null ? `$${r.price.toFixed(2)}` : '—'}
              </td>
              <td className="py-2.5 px-3 text-center">
                <SignalBadge signal={signal} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ValueTable({ rows }: { rows: StrategyRow[] }) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => (a.valueRank ?? 99) - (b.valueRank ?? 99)),
    [rows]
  )
  return (
    <table className="w-full text-[13px] min-w-[640px]">
      <thead>
        <tr className="border-b border-[#E3E1DA]">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Rank</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Sector</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">P/E</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">P/B</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">P/S</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">EV/EBITDA</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-[#566174] uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const n = sorted.length
          const pct = (r.valueRank ?? n) / n
          const signal = pct <= 0.33 ? 'BUY' : pct >= 0.67 ? 'AVOID' : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-[#E3E1DA] hover:bg-[#F4F3EF]">
              <td className="py-2.5 px-3">
                <RankBadge rank={r.valueRank} total={n} />
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[#2563EB]">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-[#8A95A6] hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-[#566174]">{r.layer}</td>
              <td className={`py-2.5 px-3 text-right font-mono ${r.pe !== null ? (r.pe < 20 ? 'text-[#11875D]' : r.pe < 40 ? 'text-[#566174]' : 'text-[#D83B3B]') : 'text-[#8A95A6]'}`}>
                {r.pe !== null ? r.pe.toFixed(1) + 'x' : '—'}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${r.pb !== null ? (r.pb < 3 ? 'text-[#11875D]' : r.pb < 8 ? 'text-[#566174]' : 'text-[#D83B3B]') : 'text-[#8A95A6]'}`}>
                {r.pb !== null ? r.pb.toFixed(1) + 'x' : '—'}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${r.ps !== null ? (r.ps < 5 ? 'text-[#11875D]' : r.ps < 10 ? 'text-[#566174]' : 'text-[#D83B3B]') : 'text-[#8A95A6]'}`}>
                {r.ps !== null ? r.ps.toFixed(1) + 'x' : '—'}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${r.evEbitda !== null ? (r.evEbitda < 15 ? 'text-[#11875D]' : r.evEbitda < 25 ? 'text-[#566174]' : 'text-[#D83B3B]') : 'text-[#8A95A6]'}`}>
                {r.evEbitda !== null ? r.evEbitda.toFixed(1) + 'x' : '—'}
              </td>
              <td className="py-2.5 px-3 text-center">
                <SignalBadge signal={signal} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SignalBadge({ signal }: { signal: 'BUY' | 'AVOID' | 'NEUTRAL' }) {
  if (signal === 'BUY')
    return <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F7EF] text-[#11875D]">BUY</span>
  if (signal === 'AVOID')
    return <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FCEAEA] text-[#D83B3B]">AVOID</span>
  return <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F4F3EF] text-[#566174]">NEUTRAL</span>
}

// ─── Summary consensus bar ────────────────────────────────────────────────────

function ConsensusSummary({ rows }: { rows: StrategyRow[] }) {
  const n = rows.length
  if (!n) return null

  function getSignals(r: StrategyRow): ('BUY' | 'AVOID' | 'NEUTRAL')[] {
    const signals: ('BUY' | 'AVOID' | 'NEUTRAL')[] = []
    const total = n

    // Momentum
    if (r.momentumRank !== null) {
      const pct = r.momentumRank / total
      signals.push(pct <= 0.33 ? 'BUY' : pct >= 0.67 ? 'AVOID' : 'NEUTRAL')
    }
    // Low vol
    if (r.volRank !== null) {
      const pct = r.volRank / total
      signals.push(pct <= 0.33 ? 'BUY' : pct >= 0.67 ? 'AVOID' : 'NEUTRAL')
    }
    // MA
    if (r.maSignal) signals.push(r.maSignal === 'golden' ? 'BUY' : 'AVOID')
    // Mean rev
    if (r.mrZscore !== null) signals.push(r.mrZscore < -1 ? 'BUY' : r.mrZscore > 1 ? 'AVOID' : 'NEUTRAL')
    // Value
    if (r.valueRank !== null) {
      const pct = r.valueRank / total
      signals.push(pct <= 0.33 ? 'BUY' : pct >= 0.67 ? 'AVOID' : 'NEUTRAL')
    }
    return signals
  }

  const consensus = rows.map((r) => {
    const sigs = getSignals(r)
    const buys = sigs.filter(s => s === 'BUY').length
    const avoids = sigs.filter(s => s === 'AVOID').length
    const total = sigs.length || 1
    const score = (buys - avoids) / total
    return { ticker: r.ticker, name: r.name, layer: r.layer, buys, avoids, total, score }
  }).sort((a, b) => b.score - a.score)

  return (
    <div className="bg-white border border-[#E3E1DA] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#E3E1DA]">
        <h3 className="font-semibold text-[#06101F] text-[13px]">Cross-Strategy Consensus</h3>
        <p className="text-[11px] text-[#566174] mt-0.5">How many of the 5 strategies signal BUY vs AVOID for each stock</p>
      </div>
      <div className="divide-y divide-[#E3E1DA]">
        {consensus.map((c) => (
          <div key={c.ticker} className="flex items-center gap-3 px-4 py-2.5 min-h-[44px]">
            <span className="w-14 font-semibold text-[13px] text-[#2563EB] shrink-0">{c.ticker}</span>
            <span className="text-[11px] text-[#8A95A6] w-24 truncate hidden sm:block">{c.name}</span>
            <div className="flex items-center gap-1.5 flex-1">
              <div className="flex-1 h-2 bg-[#F4F3EF] rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-[#E8F7EF]0 transition-all"
                  style={{ width: `${(c.buys / c.total) * 100}%` }}
                />
                <div
                  className="h-full bg-[#D83B3B] transition-all"
                  style={{ width: `${(c.avoids / c.total) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-[#566174] shrink-0 hidden xs:block sm:w-28">
                {c.buys} buy · {c.avoids} avoid · {c.total - c.buys - c.avoids} neutral
              </span>
            </div>
            <div className="shrink-0">
              {c.score >= 0.4 && <span className="text-[11px] font-bold bg-[#E8F7EF] text-[#11875D] px-2 py-0.5 rounded-full">Strong Buy</span>}
              {c.score > 0 && c.score < 0.4 && <span className="text-[11px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">Buy Lean</span>}
              {c.score === 0 && <span className="text-[11px] font-bold bg-[#F4F3EF] text-[#566174] px-2 py-0.5 rounded-full">Mixed</span>}
              {c.score < 0 && c.score > -0.4 && <span className="text-[11px] font-bold bg-[#FFF4DA] text-[#B56A00] px-2 py-0.5 rounded-full">Avoid Lean</span>}
              {c.score <= -0.4 && <span className="text-[11px] font-bold bg-[#FCEAEA] text-[#D83B3B] px-2 py-0.5 rounded-full">Avoid</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StrategiesPage() {
  const [rows, setRows] = useState<StrategyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStrategy, setActiveStrategy] = useState<string>('consensus')
  const [activeCategory, setActiveCategory] = useState<UniverseCategory | 'All'>('All')

  const filteredRows = useMemo(() =>
    activeCategory === 'All' ? rows : rows.filter(r => r.category === activeCategory),
    [rows, activeCategory]
  )

  useEffect(() => {
    setLoading(true)
    fetch('/api/strategies')
      .then(r => r.json())
      .then((data: StrategyRow[]) => { setRows(data); setLoading(false) })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [])

  const activeDef = STRATEGIES.find(s => s.id === activeStrategy) ?? null

  return (
    <div className="min-h-dvh bg-[#F4F3EF]">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-[#06101F]">Quantitative Strategies</h1>
          <p className="text-[13px] text-[#566174] mt-0.5">
            Academic factor strategies from Kakushadze &amp; Serur (2018) — AI Stack · CEDEARs · BYMA · Daily price data
          </p>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto overscroll-x-contain">
          {(['All', 'AI Stack', 'CEDEAR', 'BYMA'] as const).map(cat => {
            const count = cat === 'All' ? rows.length : rows.filter(r => r.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={[
                  'px-3 py-1 rounded-full text-[12px] font-semibold border transition-colors shrink-0 min-h-[44px]',
                  activeCategory === cat
                    ? cat === 'All'     ? 'bg-slate-800 text-white border-slate-800'
                    : cat === 'AI Stack'? 'bg-blue-600 text-white border-blue-600'
                    : cat === 'CEDEAR'  ? 'bg-violet-600 text-white border-violet-600'
                    :                    'bg-[#11875D] text-white border-emerald-600'
                    : 'bg-white text-[#566174] border-[#E3E1DA] hover:border-[#8A95A6]',
                ].join(' ')}
              >
                {cat} <span className="opacity-70">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Strategy tabs */}
        <div className="flex gap-1 overflow-x-auto overscroll-x-contain mb-5 bg-white border border-[#E3E1DA] rounded-xl p-1">
          <TabBtn
            active={activeStrategy === 'consensus'}
            onClick={() => setActiveStrategy('consensus')}
            label="Consensus"
          />
          {STRATEGIES.map(s => (
            <TabBtn
              key={s.id}
              active={activeStrategy === s.id}
              onClick={() => setActiveStrategy(s.id)}
              label={s.shortLabel}
            />
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-[#8A95A6] text-sm">
            <div className="w-5 h-5 border-2 border-[#E3E1DA] border-t-blue-500 rounded-full animate-spin mr-3" />
            Fetching 14 months of price history for ~80 tickers…
          </div>
        )}

        {error && (
          <div className="bg-[#FCEAEA] border border-[#D83B3B]/30 rounded-xl px-4 py-3 text-sm text-[#D83B3B]">{error}</div>
        )}

        {!loading && !error && (
          <>
            {activeStrategy === 'consensus' ? (
              <ConsensusSummary rows={filteredRows} />
            ) : (
              <>
                {activeDef && <StrategyHeader def={activeDef} />}
                <div className="bg-white border border-[#E3E1DA] rounded-xl overflow-x-auto">
                  {activeStrategy === 'momentum' && <MomentumTable rows={filteredRows} />}
                  {activeStrategy === 'lowvol'   && <LowVolTable rows={filteredRows} />}
                  {activeStrategy === 'ma'       && <MaTable rows={filteredRows} />}
                  {activeStrategy === 'meanrev'  && <MeanRevTable rows={filteredRows} />}
                  {activeStrategy === 'value'    && <ValueTable rows={filteredRows} />}
                </div>
              </>
            )}
          </>
        )}

        {/* Paper attribution */}
        {!loading && (
          <p className="text-[11px] text-[#8A95A6] mt-6 text-center">
            Strategies from: Kakushadze &amp; Serur, &ldquo;151 Trading Strategies&rdquo; (SSRN 3247865, 2018) — Chapter 3: Stocks.
            Signals are illustrative and educational only. Not financial advice.
          </p>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors shrink-0 min-h-[44px]',
        active
          ? 'bg-blue-600 text-white'
          : 'text-[#566174] hover:text-[#06101F] hover:bg-[#F4F3EF]',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
