'use client'

interface PeerComp {
  ticker: string
  evToRevenue: number | null
  priceToSales: number | null
}

interface Props {
  vetoReasons: string[]
  ticker: string
  currentPrice?: number | null
  analystTargetMean?: number | null
  analystTargetLow?: number | null
  analystTargetHigh?: number | null
  evToRevenue?: number | null
  priceToSales?: number | null
  priceToBook?: number | null
  trailingPE?: number | null
  multiplesBlendedFV?: number | null
  peerComps?: PeerComp[]
  currency?: string
}

const BANK_METHODS = [
  {
    name: 'Price / Tangible Book Value',
    why: 'For banks, TBV reflects the liquidation floor. P/TBV < 1 historically signals distress or deep value; P/TBV 1–2× is normal range.',
  },
  {
    name: 'Dividend Yield Model',
    why: 'Stable dividend payers can be valued via Gordon Growth: fair value = Dividend / (cost of equity − growth rate).',
  },
  {
    name: 'Return on Equity vs. Cost of Equity',
    why: 'A bank trading at P/B > 1 is justified only if ROE > cost of equity. Compare the two to judge premium.',
  },
  {
    name: 'Analyst consensus & target price',
    why: 'For financial stocks, sell-side analysts with sector expertise often provide the most grounded estimates. Check the Overview tab.',
  },
]

const REIT_METHODS = [
  {
    name: 'Price / FFO (Funds From Operations)',
    why: 'FFO strips out depreciation — the standard earnings measure for REITs. P/FFO of 15–20× is normal for large-cap REITs.',
  },
  {
    name: 'Cap Rate vs. WACC',
    why: 'If the portfolio\'s implied cap rate exceeds the WACC, the REIT is generating spread. Compression signals overvaluation.',
  },
  {
    name: 'Dividend Yield',
    why: 'REITs must distribute 90%+ of income. A yield significantly above peers often signals the market expects a cut.',
  },
]

function isBank(reasons: string[]): boolean {
  const text = reasons.join(' ').toLowerCase()
  return text.includes('bank') || text.includes('financ') || text.includes('insurance') || text.includes('lending')
}

function isREIT(reasons: string[]): boolean {
  const text = reasons.join(' ').toLowerCase()
  return text.includes('reit') || text.includes('real estate')
}

function isInsufficientHistory(reasons: string[]): boolean {
  return reasons.some(r => r.includes('Insufficient revenue history'))
}

function fmt(v: number, decimals = 1): string {
  return v.toFixed(decimals)
}

function fmtPrice(v: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function updownColor(pct: number): string {
  return pct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'
}

export default function ValuationNotAvailableCard({
  vetoReasons,
  ticker,
  currentPrice,
  analystTargetMean,
  analystTargetLow,
  analystTargetHigh,
  evToRevenue,
  priceToSales,
  priceToBook,
  trailingPE,
  multiplesBlendedFV,
  peerComps,
  currency = 'USD',
}: Props) {
  const bank = isBank(vetoReasons)
  const reit = isREIT(vetoReasons)
  const insufficientHistory = isInsufficientHistory(vetoReasons)

  const methods = reit ? REIT_METHODS : bank ? BANK_METHODS : null

  const disclaimer = bank || reit
    ? 'Discounted cash flow models assume free cash flow that can be attributed to equity holders. For banks, insurers, and financial intermediaries, regulatory capital requirements and the nature of the balance sheet make FCF-based DCF unreliable.'
    : insufficientHistory
      ? 'Projections require a meaningful historical baseline. As this company builds its public track record, data-driven DCF will become available.'
      : 'Discounted cash flow models require reliable revenue and free cash flow history to produce a meaningful output.'

  const sectionLabel = reit
    ? 'Real estate investment trusts use non-GAAP cash flow metrics and yield-based models instead of DCF.'
    : bank
      ? 'Banks and financial intermediaries are valued on book value, returns on equity, and yield metrics.'
      : null

  // Analyst target data
  const hasAnalystTarget = analystTargetMean != null && analystTargetMean > 0
  const analystUpsidePct = hasAnalystTarget && currentPrice && currentPrice > 0
    ? (analystTargetMean! - currentPrice) / currentPrice
    : null

  // Multiples-based FV
  const hasMultiplesFV = multiplesBlendedFV != null && multiplesBlendedFV > 0
  const multUpsidePct = hasMultiplesFV && currentPrice && currentPrice > 0
    ? (multiplesBlendedFV! - currentPrice) / currentPrice
    : null

  // Multiples cards data
  const multiples: { label: string; value: number; note?: string }[] = []
  if (evToRevenue != null) multiples.push({ label: 'EV / Revenue', value: evToRevenue })
  if (priceToSales != null) multiples.push({ label: 'P / S', value: priceToSales })
  if (priceToBook != null) multiples.push({ label: 'P / B', value: priceToBook })
  if (trailingPE != null && trailingPE > 0 && trailingPE < 500) multiples.push({ label: 'P / E', value: trailingPE })

  // Peer EV/Revenue
  const validPeers = (peerComps ?? []).filter(p => p.evToRevenue != null || p.priceToSales != null)

  return (
    <div className="flex flex-col gap-4">

      {/* ── Veto notice (compact) ── */}
      <div className="rounded-xl border border-[#F3D391] bg-[#FFF4DA]/60 px-5 py-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[#B56A00] text-base" aria-hidden="true">⚠</span>
          <p className="text-sm font-semibold text-[#854D0E]">DCF valuation not available for {ticker}</p>
        </div>
        <ul className="space-y-0.5">
          {vetoReasons.map((r, i) => (
            <li key={i} className="text-xs text-[#B56A00] leading-relaxed">• {r}</li>
          ))}
        </ul>
        <p className="text-[11px] text-[#566174] border-t border-amber-100 pt-2">{disclaimer}</p>
      </div>

      {/* ── Multiples-based estimate ── */}
      {(hasMultiplesFV || hasAnalystTarget) && (
        <div className="rounded-xl border border-[#E6ECF5] bg-white px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[13px] font-[700] text-[#06101F] mb-0.5">Market-based estimates</p>
            <p className="text-[12px] text-[#566174]">
              Without sufficient revenue history for DCF, comparable multiples and analyst consensus provide the best valuation anchors.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Multiples blended FV */}
            {hasMultiplesFV && currentPrice != null && currentPrice > 0 && (
              <div className="rounded-lg border border-[#E6ECF5] bg-[#F0F1F6] px-4 py-3 flex flex-col gap-1">
                <p className="text-[11px] text-[#566174] font-[500] uppercase tracking-wide">Multiples estimate</p>
                <p className="text-[22px] font-[750] text-[#06101F] leading-none">
                  {fmtPrice(multiplesBlendedFV!, currency)}
                </p>
                {multUpsidePct != null && (
                  <p className={`text-[12px] font-[600] ${updownColor(multUpsidePct)}`}>
                    {multUpsidePct >= 0 ? '+' : ''}{(multUpsidePct * 100).toFixed(1)}% vs current price
                  </p>
                )}
                <p className="text-[11px] text-[#8A95A6] mt-0.5">
                  Blended EV/Revenue, P/S, and P/B against sector peers
                </p>
              </div>
            )}

            {/* Analyst consensus */}
            {hasAnalystTarget && currentPrice != null && currentPrice > 0 && (
              <div className="rounded-lg border border-[#E6ECF5] bg-[#F0F1F6] px-4 py-3 flex flex-col gap-1">
                <p className="text-[11px] text-[#566174] font-[500] uppercase tracking-wide">Analyst consensus target</p>
                <p className="text-[22px] font-[750] text-[#06101F] leading-none">
                  {fmtPrice(analystTargetMean!, currency)}
                </p>
                {analystUpsidePct != null && (
                  <p className={`text-[12px] font-[600] ${updownColor(analystUpsidePct)}`}>
                    {analystUpsidePct >= 0 ? '+' : ''}{(analystUpsidePct * 100).toFixed(1)}% vs current price
                  </p>
                )}
                {analystTargetLow != null && analystTargetHigh != null && (
                  <p className="text-[11px] text-[#8A95A6] mt-0.5">
                    Range: {fmtPrice(analystTargetLow, currency)} – {fmtPrice(analystTargetHigh, currency)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Analyst target bar */}
          {hasAnalystTarget && currentPrice != null && analystTargetLow != null && analystTargetHigh != null && (
            (() => {
              const lo = Math.min(analystTargetLow, currentPrice) * 0.95
              const hi = Math.max(analystTargetHigh, currentPrice) * 1.05
              const range = hi - lo
              if (range <= 0) return null
              const pricePct = ((currentPrice - lo) / range) * 100
              const meanPct  = ((analystTargetMean! - lo) / range) * 100
              const lowPct   = ((analystTargetLow - lo) / range) * 100
              const highPct  = ((analystTargetHigh - lo) / range) * 100
              return (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[11px] text-[#566174] font-[500]">Analyst target range</p>
                  <div className="relative h-5 flex items-center">
                    {/* Track */}
                    <div className="absolute inset-0 h-1.5 top-1/2 -translate-y-1/2 rounded-full bg-[#E6ECF5]" />
                    {/* Range fill */}
                    <div
                      className="absolute h-1.5 top-1/2 -translate-y-1/2 rounded-full bg-[#EAF1FF]"
                      style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
                    />
                    {/* Low tick */}
                    <div className="absolute w-0.5 h-3 bg-[#93B4F5] top-1/2 -translate-y-1/2 rounded-full" style={{ left: `${lowPct}%` }} />
                    {/* High tick */}
                    <div className="absolute w-0.5 h-3 bg-[#93B4F5] top-1/2 -translate-y-1/2 rounded-full" style={{ left: `${highPct}%` }} />
                    {/* Mean dot */}
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-[#EAF1FF]0 border-2 border-white shadow-sm top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${meanPct}%` }} />
                    {/* Current price marker */}
                    <div className="absolute w-2.5 h-2.5 rounded-full bg-[#06101F] border-2 border-white shadow-sm top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pricePct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#8A95A6]">
                    <span>{fmtPrice(analystTargetLow, currency)}</span>
                    <span className="flex gap-3">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#06101F] inline-block" />Current</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#EAF1FF]0 inline-block" />Mean target</span>
                    </span>
                    <span>{fmtPrice(analystTargetHigh, currency)}</span>
                  </div>
                </div>
              )
            })()
          )}
        </div>
      )}

      {/* ── Current multiples ── */}
      {multiples.length > 0 && (
        <div className="rounded-xl border border-[#E6ECF5] bg-white px-5 py-4 flex flex-col gap-3">
          <div>
            <p className="text-[13px] font-[700] text-[#06101F] mb-0.5">Current trading multiples</p>
            <p className="text-[12px] text-[#566174]">How the market is pricing {ticker} today relative to its fundamentals.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {multiples.map(m => (
              <div key={m.label} className="rounded-md border border-[#E6ECF5] bg-[#F0F1F6] px-3 py-2.5 flex flex-col gap-0.5">
                <p className="text-[11px] text-[#566174] font-[500]">{m.label}</p>
                <p className="text-[17px] font-[700] text-[#06101F] leading-none">{fmt(m.value)}×</p>
              </div>
            ))}
          </div>

          {/* Peer comparison */}
          {validPeers.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <p className="text-[11px] text-[#566174] font-[500]">Peer EV/Revenue comparison</p>
              <div className="flex flex-wrap gap-2">
                {validPeers.slice(0, 6).map(p => (
                  <div key={p.ticker} className="rounded-sm border border-[#E6ECF5] bg-[#F0F1F6] px-2.5 py-1.5 flex items-center gap-1.5">
                    <span className="text-[11px] font-[650] text-[#566174]">{p.ticker}</span>
                    {p.evToRevenue != null && (
                      <span className="text-[11px] text-[#566174]">{fmt(p.evToRevenue)}×</span>
                    )}
                  </div>
                ))}
                {evToRevenue != null && (
                  <div className="rounded-sm border border-[#06101F] bg-[#06101F] px-2.5 py-1.5 flex items-center gap-1.5">
                    <span className="text-[11px] font-[650] text-white">{ticker}</span>
                    <span className="text-[11px] text-[#8A95A6]">{fmt(evToRevenue)}×</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Sector-specific guidance ── */}
      {methods && (
        <div className="rounded-xl border border-[#E6ECF5] bg-white px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[13px] font-[700] text-[#06101F] mb-1">
              {reit ? 'REIT valuation approaches' : bank ? 'Financial sector valuation approaches' : 'Relevant valuation approaches for this sector'}
            </p>
            {sectionLabel && (
              <p className="text-[12px] text-[#566174] leading-relaxed">{sectionLabel}</p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {methods.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-[700] text-[#2563EB]">{i + 1}</span>
                </div>
                <div>
                  <p className="text-[13px] font-[650] text-[#06101F]">{m.name}</p>
                  <p className="text-[12px] text-[#566174] mt-0.5 leading-relaxed">{m.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Redirect to other tabs ── */}
      <div className="rounded-xl border border-[#E6ECF5] bg-[#F0F1F6] px-5 py-4">
        <p className="text-[12px] font-[650] text-[#566174] mb-2">Available on other tabs</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] text-[#566174]">
          <div className="flex items-start gap-2">
            <span className="text-[#2563EB] mt-0.5" aria-hidden="true">→</span>
            <div>
              <p className="font-[600] text-[#566174]">Overview</p>
              <p>Business quality, growth metrics, fundamentals grid, analyst consensus</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#2563EB] mt-0.5" aria-hidden="true">→</span>
            <div>
              <p className="font-[600] text-[#566174]">Financials</p>
              <p>Full income statement, balance sheet, cash flow, and quarterly data</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#2563EB] mt-0.5" aria-hidden="true">→</span>
            <div>
              <p className="font-[600] text-[#566174]">Risks &amp; Signals</p>
              <p>Piotroski F-score, Altman Z-score, and financial health indicators</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
