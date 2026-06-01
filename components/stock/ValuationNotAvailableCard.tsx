'use client'

interface Props {
  vetoReasons: string[]
  ticker: string
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

export default function ValuationNotAvailableCard({ vetoReasons, ticker }: Props) {
  const bank = isBank(vetoReasons)
  const reit = isREIT(vetoReasons)
  const methods = reit ? REIT_METHODS : bank ? BANK_METHODS : null

  return (
    <div className="flex flex-col gap-4">
      {/* Veto notice */}
      <div className="rounded-[14px] border border-amber-200 bg-amber-50/60 px-5 py-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-base" aria-hidden="true">⚠</span>
          <p className="text-sm font-semibold text-amber-800">
            DCF valuation not available for {ticker}
          </p>
        </div>
        <ul className="space-y-1.5">
          {vetoReasons.map((r, i) => (
            <li key={i} className="text-xs text-amber-700 leading-relaxed">• {r}</li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500 border-t border-amber-100 pt-3">
          Discounted cash flow models assume free cash flow that can be attributed to equity holders.
          For banks, insurers, and financial intermediaries, regulatory capital requirements and the
          nature of the balance sheet make FCF-based DCF unreliable.
        </p>
      </div>

      {/* Alternative valuation methods */}
      {methods && (
        <div className="rounded-[14px] border border-[#E6ECF5] bg-white px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[13px] font-[700] text-[#0F172A] mb-1">
              Relevant valuation approaches for this sector
            </p>
            <p className="text-[12px] text-[#64748B] leading-relaxed">
              {reit
                ? 'Real estate investment trusts use non-GAAP cash flow metrics and yield-based models instead of DCF.'
                : 'Banks and financial intermediaries are valued on book value, returns on equity, and yield metrics.'}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {methods.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-[700] text-[#2563EB]">{i + 1}</span>
                </div>
                <div>
                  <p className="text-[13px] font-[650] text-[#0F172A]">{m.name}</p>
                  <p className="text-[12px] text-[#64748B] mt-0.5 leading-relaxed">{m.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Redirect to other tabs */}
      <div className="rounded-[14px] border border-[#E6ECF5] bg-[#F8FAFC] px-5 py-4">
        <p className="text-[12px] font-[650] text-[#475569] mb-2">Available on other tabs</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px] text-[#64748B]">
          <div className="flex items-start gap-2">
            <span className="text-[#2563EB] mt-0.5" aria-hidden="true">→</span>
            <div>
              <p className="font-[600] text-[#334155]">Overview</p>
              <p>Business quality, growth metrics, fundamentals grid, analyst consensus</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#2563EB] mt-0.5" aria-hidden="true">→</span>
            <div>
              <p className="font-[600] text-[#334155]">Financials</p>
              <p>Full income statement, balance sheet, cash flow, and quarterly data</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[#2563EB] mt-0.5" aria-hidden="true">→</span>
            <div>
              <p className="font-[600] text-[#334155]">Risks &amp; Signals</p>
              <p>Piotroski F-score, Altman Z-score, and financial health indicators</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
