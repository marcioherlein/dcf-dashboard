import Link from 'next/link'

export const metadata = { title: 'Terms of Service — Insic' }

const EFFECTIVE_DATE = 'June 1, 2025'

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[#F4F3EF]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-24">

        <div className="mb-8">
          <Link href="/" className="inline-flex items-center min-h-[44px] text-sm text-[#2563EB] hover:underline">← Back to Insic</Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#06101F] mb-2">Terms of Service</h1>
        <p className="text-sm text-[#8A95A6] mb-8 sm:mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none space-y-8 text-sm text-[#566174] leading-relaxed">

          {/* ── 1 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Insic (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;), you agree to be bound by
              these Terms of Service. If you do not agree, do not use the Service.
              We reserve the right to update these terms at any time; continued use
              after changes constitutes acceptance.
            </p>
          </section>

          {/* ── 2 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">2. Not Financial Advice</h2>
            <p className="font-medium text-[#566174]">
              Nothing on this platform constitutes financial, investment, legal, or tax
              advice of any kind.
            </p>
            <p className="mt-2">
              All content — including DCF models, fair value estimates, health scores,
              valuation multiples, scenario analyses, and any other outputs — is provided
              for <strong>informational and educational purposes only</strong>. These are
              model outputs based on publicly available data and mathematical assumptions.
              They are not recommendations to buy, sell, or hold any security.
            </p>
            <p className="mt-2">
              Financial models are inherently limited. Inputs may be inaccurate or
              outdated, assumptions may not reflect reality, and even well-constructed
              models frequently produce incorrect estimates. Past performance of any
              security does not guarantee future results.
            </p>
            <p className="mt-2">
              Always consult a qualified, licensed financial advisor before making any
              investment decision. You are solely responsible for your own investment
              decisions and their outcomes.
            </p>
          </section>

          {/* ── 3 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">3. Eligibility</h2>
            <p>
              You must be at least 18 years old to use the Service. By using it, you
              confirm that you meet this requirement.
            </p>
          </section>

          {/* ── 4 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">4. User Accounts</h2>
            <p>
              Accounts are created via Google OAuth. You are responsible for all activity
              that occurs under your account. We reserve the right to suspend or terminate
              accounts that violate these terms or are used for abuse.
            </p>
          </section>

          {/* ── 5 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Scrape, crawl, or systematically extract data from the platform</li>
              <li>Reverse engineer, decompile, or attempt to extract source code</li>
              <li>Resell, redistribute, or commercially exploit outputs without permission</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
            </ul>
          </section>

          {/* ── 6 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">6. Data Sources and Accuracy</h2>
            <p>
              Financial data is sourced from third parties including Yahoo Finance, FRED
              (Federal Reserve Economic Data), and Damodaran&apos;s publicly available research.
              We do not guarantee the accuracy, completeness, or timeliness of any data.
              Errors in source data will produce errors in model outputs.
            </p>
          </section>

          {/* ── 7 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">7. Intellectual Property</h2>
            <p>
              All content, design, code, and branding on the Service is the property of
              Insic and may not be copied, reproduced, or distributed without written
              permission, except for personal, non-commercial use.
            </p>
          </section>

          {/* ── 8 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, Insic and its operators shall
              not be liable for any direct, indirect, incidental, special, consequential,
              or punitive damages arising from your use of the Service, including but not
              limited to investment losses resulting from reliance on model outputs.
            </p>
            <p className="mt-2">
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any
              kind, either express or implied.
            </p>
          </section>

          {/* ── 9 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">9. Governing Law</h2>
            <p>
              These terms are governed by applicable law. Any disputes shall be resolved
              through good-faith negotiation before pursuing formal legal remedies.
            </p>
          </section>

          {/* ── 10 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">10. Contact</h2>
            <p>
              Questions about these terms? Reach us at{' '}
              <a href="mailto:hello@insic.app" className="text-[#2563EB] hover:underline">
                hello@insic.app
              </a>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-[#E3E1DA] flex flex-wrap gap-4 text-sm text-[#8A95A6]">
          <Link href="/privacy" className="hover:text-[#566174] transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-[#566174] transition-colors">Back to home</Link>
        </div>

      </div>
    </div>
  )
}
