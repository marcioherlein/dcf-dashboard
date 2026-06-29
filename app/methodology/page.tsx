import Link from 'next/link'

export const metadata = {
  title: 'Methodology — insic',
  description: 'How insic calculates fair value — the four valuation models, blending logic, data sources, and known limitations.',
}

export default function MethodologyPage() {
  return (
    <div className="min-h-dvh bg-[#F0F1F6]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-24">

        <div className="mb-8">
          <Link href="/" className="inline-flex items-center min-h-[44px] text-sm text-[#2563EB] hover:underline">← Back to insic</Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#06101F] mb-2">How insic calculates fair value</h1>
        <p className="text-sm text-[#8A95A6] mb-10">A plain-English explanation of our valuation methodology, data sources, and limitations.</p>

        <div className="space-y-10 text-sm text-[#566174] leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">The short version</h2>
            <p>
              insic runs up to five valuation models on each stock and blends their outputs into a single fair value estimate.
              The blend weights depend on the company type — a high-growth tech company is weighted differently from a stable utility.
              The result is a range (Bear / Base / Bull scenarios) and a single blended number. It is a model output, not a prediction.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">The four core models</h2>
            <div className="space-y-5">

              <div className="rounded-xl border border-[#E3E1DA] bg-white p-5">
                <p className="font-semibold text-[#06101F] mb-1">1. Forward P/E (Earnings Multiple)</p>
                <p>
                  Projects revenue forward five years, applies the exit net margin, and discounts the resulting earnings per share
                  back to today using the cost of equity (Ke from CAPM). The exit P/E multiple is derived from sector peers.
                  Best suited for profitable, stable companies with predictable margins.
                </p>
              </div>

              <div className="rounded-xl border border-[#E3E1DA] bg-white p-5">
                <p className="font-semibold text-[#06101F] mb-1">2. EV/EBITDA Multiple</p>
                <p>
                  Values the business as a multiple of operating earnings (EBITDA), benchmarked against sector medians.
                  Enterprise value is converted to equity per share by subtracting net debt and dividing by shares outstanding.
                  Best suited for capital-intensive businesses where earnings multiples are less meaningful.
                </p>
              </div>

              <div className="rounded-xl border border-[#E3E1DA] bg-white p-5">
                <p className="font-semibold text-[#06101F] mb-1">3. Revenue Multiple</p>
                <p>
                  Projects five-year revenue at the estimated CAGR, applies an EV/Revenue exit multiple, and discounts
                  the equity value back. Best suited for pre-profit or high-growth companies where EBITDA and earnings
                  multiples are not yet meaningful.
                </p>
              </div>

              <div className="rounded-xl border border-[#E3E1DA] bg-white p-5">
                <p className="font-semibold text-[#06101F] mb-1">4. Core DCF (Discounted Cash Flow)</p>
                <p>
                  A full free-cash-flow model using a Damodaran-style four-model blend: two terminal value methods (Gordon
                  Growth Model and Exit Multiple) × two cash flow definitions (unlevered FCFF and levered FCFE). WACC is
                  computed from CAPM using a risk-free rate from FRED, an equity risk premium, and a country risk premium
                  from Damodaran&apos;s published tables. Year-by-year projections are visible in the Full DCF Table on
                  the Valuation tab.
                </p>
              </div>

              <div className="rounded-xl border border-[#E3E1DA] bg-white p-5">
                <p className="font-semibold text-[#06101F] mb-1">5. Earnings Power Value (EPV) — select company types</p>
                <p>
                  EPV = NOPAT ÷ WACC. A zero-growth floor — what the business earns today in steady state, with no credit
                  for future growth. For cyclical companies, EPV uses a five-year normalized EBIT rather than the current year.
                  Applied to standard, dividend-paying, utility, energy, and mining company types where earnings stability
                  makes this model meaningful.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">Blending logic</h2>
            <p className="mb-3">
              The models are not equally weighted. insic classifies each stock into one of eight company types
              (standard, growth, high-growth, startup, dividend, utility, energy, mining) and applies type-specific weights.
              For example, a growth-stage SaaS company receives higher weight on the Revenue Multiple and lower weight on the
              Core DCF, because its free cash flow projections are less reliable than its revenue trajectory.
            </p>
            <p>
              Models that lack sufficient data (e.g. no analyst forward earnings estimate means the Forward P/E cannot fire)
              are excluded from the blend. The blended fair value is the weighted average of whichever models produced
              a valid output. If only one model fires, the output is labeled as a single-model estimate, not a blend.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">Scenarios (Bear / Base / Bull)</h2>
            <p>
              All models are re-run three times at stressed and unstressed assumptions. The Bear case uses a WACC 2pp higher
              and a revenue CAGR 4pp lower than the base. The Bull case uses a WACC 2pp lower and a CAGR 4pp higher.
              The scenario range is displayed as a slider on the Valuation tab and in the Share Card.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">Data sources</h2>
            <div className="space-y-2">
              <div className="flex gap-3">
                <span className="font-medium text-[#06101F] shrink-0 w-44">Financial statements</span>
                <span>Financial Modeling Prep (FMP) — income statement, balance sheet, cash flow, analyst estimates</span>
              </div>
              <div className="flex gap-3">
                <span className="font-medium text-[#06101F] shrink-0 w-44">Stock prices</span>
                <span>Yahoo Finance — real-time quotes and historical price data</span>
              </div>
              <div className="flex gap-3">
                <span className="font-medium text-[#06101F] shrink-0 w-44">Risk-free rate</span>
                <span>FRED (Federal Reserve Economic Data) — 10-Year US Treasury yield</span>
              </div>
              <div className="flex gap-3">
                <span className="font-medium text-[#06101F] shrink-0 w-44">Country risk premia</span>
                <span>Damodaran (NYU Stern) — equity risk premiums and country risk adjustments</span>
              </div>
              <div className="flex gap-3">
                <span className="font-medium text-[#06101F] shrink-0 w-44">Sector multiples</span>
                <span>Computed from the FMP universe — median EV/EBITDA, P/E, and EV/Revenue by sector</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">Known limitations</h2>
            <ul className="space-y-2 list-disc list-inside marker:text-[#9B9B9B]">
              <li>Models rely on reported financial data, which may lag by one to four quarters depending on the filing date.</li>
              <li>Analyst forward estimates are not always available, which may disable the Forward P/E model.</li>
              <li>Companies in early-stage, loss-making, or unusual financial positions may produce unreliable outputs. The model attempts to detect and flag these cases.</li>
              <li>Fair value estimates are sensitive to WACC and growth rate assumptions. Small changes in these inputs can produce large changes in output — this is a property of DCF math, not a bug.</li>
              <li>insic does not model qualitative factors: management quality, competitive moat depth, regulatory risk, or macroeconomic shocks.</li>
              <li>This is not a stock recommendation. Fair value is an estimate of what a business might be worth — not a prediction of what its stock price will do.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">Disclaimer</h2>
            <p>
              insic is a financial analysis tool, not a registered investment adviser. Nothing on this platform constitutes
              investment advice, a solicitation to buy or sell securities, or a guarantee of future performance.
              All outputs are model estimates based on publicly available data. Use them to inform your own research —
              not as a substitute for it.
            </p>
          </section>

          <div className="border-t border-[#E3E1DA] pt-6 flex items-center gap-4 flex-wrap">
            <Link href="/pricing" className="text-[#2563EB] hover:underline text-sm">Pricing</Link>
            <Link href="/privacy" className="text-[#2563EB] hover:underline text-sm">Privacy Policy</Link>
            <Link href="/terms" className="text-[#2563EB] hover:underline text-sm">Terms of Service</Link>
            <Link href="/refund-policy" className="text-[#2563EB] hover:underline text-sm">Refund Policy</Link>
          </div>

        </div>
      </div>
    </div>
  )
}
