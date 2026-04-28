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
  if (val === null) return 'text-slate-400'
  const isGood = good === 'high' ? val > 0 : val < 0
  const isBad  = good === 'high' ? val < 0 : val > 0
  if (isGood) return 'text-emerald-600'
  if (isBad)  return 'text-red-500'
  return 'text-slate-600'
}

function rankColor(rank: number | null, total: number): string {
  if (rank === null) return 'bg-slate-100 text-slate-400'
  const pct = rank / total
  if (pct <= 0.25) return 'bg-emerald-100 text-emerald-800'
  if (pct <= 0.50) return 'bg-sky-100 text-sky-800'
  if (pct <= 0.75) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StrategyHeader({ def }: { def: StrategyDef }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-900 mb-1">{def.label}</h2>
          <p className="text-[13px] text-slate-600 leading-relaxed mb-3">{def.description}</p>
          <div className="flex flex-wrap gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex-1 min-w-[240px]">
              <div className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Formula</div>
              <code className="text-[12px] text-blue-900 font-mono">{def.formula}</code>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex-1 min-w-[240px]">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Signal Rule</div>
              <p className="text-[12px] text-slate-700">{def.signal}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-3">Source: {def.source}</p>
    </div>
  )
}

function CategoryBadge({ category }: { category: StrategyRow['category'] }) {
  const styles: Record<string, string> = {
    'AI Stack': 'bg-blue-100 text-blue-700',
    'CEDEAR':   'bg-violet-100 text-violet-700',
    'BYMA':     'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${styles[category] ?? 'bg-slate-100 text-slate-500'}`}>
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
  if (!signal) return <span className="text-slate-400 text-[12px]">—</span>
  if (signal === 'golden')
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">★ Golden</span>
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">✕ Death</span>
}

// ─── Per-strategy tables ──────────────────────────────────────────────────────

function MomentumTable({ rows }: { rows: StrategyRow[] }) {
  const sorted = useMemo(() =>
    [...rows].sort((a, b) => (a.momentumRank ?? 99) - (b.momentumRank ?? 99)),
    [rows]
  )
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Rank</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Sector</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">12-1 Return</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">1D Change</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Price</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const n = sorted.length
          const pct = (r.momentumRank ?? n) / n
          const signal = pct <= 0.33 ? 'BUY' : pct >= 0.67 ? 'AVOID' : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-2.5 px-3">
                <RankBadge rank={r.momentumRank} total={n} />
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-blue-700">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-slate-500">{r.layer}</td>
              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${clr(r.momentum12_1, 'high')}`}>
                {fmtPct(r.momentum12_1)}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${clr(r.change1d, 'high')}`}>
                {fmtPct(r.change1d)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
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
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Rank</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Sector</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Annualized Vol</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Price</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const n = sorted.length
          const pct = (r.volRank ?? n) / n
          const signal = pct <= 0.33 ? 'BUY' : pct >= 0.67 ? 'AVOID' : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2.5 px-3">
                <RankBadge rank={r.volRank} total={n} />
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-blue-700">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-slate-500">{r.layer}</td>
              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${r.vol252 !== null ? (r.vol252 < 0.30 ? 'text-emerald-600' : r.vol252 < 0.50 ? 'text-slate-700' : 'text-red-500') : 'text-slate-400'}`}>
                {fmtPct(r.vol252)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
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
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Sector</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">MA Cross</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">SMA50 vs SMA200</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Price</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const signal: 'BUY' | 'AVOID' | 'NEUTRAL' = r.maSignal === 'golden' ? 'BUY' : r.maSignal === 'death' ? 'AVOID' : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-blue-700">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-slate-500">{r.layer}</td>
              <td className="py-2.5 px-3 text-center">
                <MaSignalBadge signal={r.maSignal} />
              </td>
              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${clr(r.maSpread, 'high')}`}>
                {fmtPct(r.maSpread)}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
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
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Sector</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">1M Return</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Z-Score</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Price</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const z = r.mrZscore
          const signal: 'BUY' | 'AVOID' | 'NEUTRAL' = z !== null ? (z < -1 ? 'BUY' : z > 1 ? 'AVOID' : 'NEUTRAL') : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-blue-700">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-slate-500">{r.layer}</td>
              <td className={`py-2.5 px-3 text-right font-mono ${clr(r.return1m, 'high')}`}>
                {fmtPct(r.return1m)}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono font-semibold ${z !== null ? (z < -1 ? 'text-emerald-600' : z > 1 ? 'text-red-500' : 'text-slate-600') : 'text-slate-400'}`}>
                {z !== null ? z.toFixed(2) : '—'}
              </td>
              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
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
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Rank</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Ticker</th>
          <th className="text-left py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Sector</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">P/E</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">P/B</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">P/S</th>
          <th className="text-right py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">EV/EBITDA</th>
          <th className="text-center py-2 px-3 text-[11px] font-semibold text-slate-500 uppercase">Signal</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const n = sorted.length
          const pct = (r.valueRank ?? n) / n
          const signal = pct <= 0.33 ? 'BUY' : pct >= 0.67 ? 'AVOID' : 'NEUTRAL'
          return (
            <tr key={r.ticker} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-2.5 px-3">
                <RankBadge rank={r.valueRank} total={n} />
              </td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-blue-700">{r.ticker}</span>
                  <CategoryBadge category={r.category} />
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:block">{r.name}</span>
              </td>
              <td className="py-2.5 px-3 text-slate-500">{r.layer}</td>
              <td className={`py-2.5 px-3 text-right font-mono ${r.pe !== null ? (r.pe < 20 ? 'text-emerald-600' : r.pe < 40 ? 'text-slate-600' : 'text-red-500') : 'text-slate-400'}`}>
                {r.pe !== null ? r.pe.toFixed(1) + 'x' : '—'}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${r.pb !== null ? (r.pb < 3 ? 'text-emerald-600' : r.pb < 8 ? 'text-slate-600' : 'text-red-500') : 'text-slate-400'}`}>
                {r.pb !== null ? r.pb.toFixed(1) + 'x' : '—'}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${r.ps !== null ? (r.ps < 5 ? 'text-emerald-600' : r.ps < 10 ? 'text-slate-600' : 'text-red-500') : 'text-slate-400'}`}>
                {r.ps !== null ? r.ps.toFixed(1) + 'x' : '—'}
              </td>
              <td className={`py-2.5 px-3 text-right font-mono ${r.evEbitda !== null ? (r.evEbitda < 15 ? 'text-emerald-600' : r.evEbitda < 25 ? 'text-slate-600' : 'text-red-500') : 'text-slate-400'}`}>
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
    return <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">BUY</span>
  if (signal === 'AVOID')
    return <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">AVOID</span>
  return <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">NEUTRAL</span>
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
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 text-[13px]">Cross-Strategy Consensus</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">How many of the 5 strategies signal BUY vs AVOID for each stock</p>
      </div>
      <div className="divide-y divide-slate-100">
        {consensus.map((c) => (
          <div key={c.ticker} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-14 font-semibold text-[13px] text-blue-700 shrink-0">{c.ticker}</span>
            <span className="text-[11px] text-slate-400 w-28 truncate hidden sm:block">{c.name}</span>
            <div className="flex items-center gap-1.5 flex-1">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${(c.buys / c.total) * 100}%` }}
                />
                <div
                  className="h-full bg-red-400 transition-all"
                  style={{ width: `${(c.avoids / c.total) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-500 shrink-0 w-28">
                {c.buys} buy · {c.avoids} avoid · {c.total - c.buys - c.avoids} neutral
              </span>
            </div>
            <div className="shrink-0">
              {c.score >= 0.4 && <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Strong Buy</span>}
              {c.score > 0 && c.score < 0.4 && <span className="text-[11px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">Buy Lean</span>}
              {c.score === 0 && <span className="text-[11px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Mixed</span>}
              {c.score < 0 && c.score > -0.4 && <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Avoid Lean</span>}
              {c.score <= -0.4 && <span className="text-[11px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Avoid</span>}
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
    <div className="min-h-screen bg-slate-50 pt-[52px]">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-900">Quantitative Strategies</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Academic factor strategies from Kakushadze &amp; Serur (2018) — AI Stack · CEDEARs · BYMA · Daily price data
          </p>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['All', 'AI Stack', 'CEDEAR', 'BYMA'] as const).map(cat => {
            const count = cat === 'All' ? rows.length : rows.filter(r => r.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={[
                  'px-3 py-1 rounded-full text-[12px] font-semibold border transition-colors',
                  activeCategory === cat
                    ? cat === 'All'     ? 'bg-slate-800 text-white border-slate-800'
                    : cat === 'AI Stack'? 'bg-blue-600 text-white border-blue-600'
                    : cat === 'CEDEAR'  ? 'bg-violet-600 text-white border-violet-600'
                    :                    'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                ].join(' ')}
              >
                {cat} <span className="opacity-70">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Strategy tabs */}
        <div className="flex gap-1 flex-wrap mb-5 bg-white border border-slate-200 rounded-xl p-1">
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
          <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin mr-3" />
            Fetching 14 months of price history for ~80 tickers…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && (
          <>
            {activeStrategy === 'consensus' ? (
              <ConsensusSummary rows={filteredRows} />
            ) : (
              <>
                {activeDef && <StrategyHeader def={activeDef} />}
                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
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
          <p className="text-[11px] text-slate-400 mt-6 text-center">
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
        'px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
        active
          ? 'bg-blue-600 text-white'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
