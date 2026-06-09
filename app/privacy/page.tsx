import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — Insic' }

const EFFECTIVE_DATE = 'June 9, 2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#F4F3EF]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-24">

        <div className="mb-8">
          <Link href="/" className="inline-flex items-center min-h-[44px] text-sm text-[#2563EB] hover:underline">← Back to Insic</Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#06101F] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#8A95A6] mb-8 sm:mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none space-y-8 text-sm text-[#566174] leading-relaxed">

          {/* ── 1 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">1. Who We Are</h2>
            <p>
              Insic (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a stock valuation and financial analysis platform available
              at insic.app. We are the data controller responsible for your personal data collected through
              this Service.
            </p>
            <p className="mt-2">
              Contact for privacy matters:{' '}
              <a href="mailto:hello@insic.app" className="text-[#2563EB] hover:underline">hello@insic.app</a>
            </p>
          </section>

          {/* ── 2 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">2. Data We Collect</h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-[#566174]">Account data (when you sign in with Google):</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Your name and email address</li>
                  <li>Your Google profile picture URL</li>
                  <li>A unique identifier from Google to link your account</li>
                </ul>
                <p className="mt-1 text-[#566174]">
                  We do not access your Google contacts, Drive, Gmail, calendar, or any other Google service.
                </p>
              </div>
              <div>
                <p className="font-medium text-[#566174]">Usage data (when you use the Service):</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Tickers you search, view, and save to your watchlist</li>
                  <li>Valuation models, assumptions, and scenarios you create</li>
                  <li>Portfolio positions and holdings you track</li>
                  <li>Your subscription plan status (free or pro)</li>
                  <li>Your newsletter subscription preference (if opted in)</li>
                  <li>Timestamps such as account creation date and last activity</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-[#566174]">Payment data (if you subscribe to Pro):</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Subscription status and billing history (stored by our payment processor)</li>
                  <li>Your payment processor customer and subscription ID (stored by us)</li>
                  <li>We do not store credit card numbers or full payment details — these are handled exclusively by our payment processor</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-[#566174]">Automatically collected technical data:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Server logs including IP address and browser/device type — retained for 30 days for security and debugging</li>
                  <li>Session authentication tokens (essential cookies) — see section 8</li>
                  <li>Aggregate, anonymized usage analytics (page views, feature interactions) — no personal identifiers attached</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ── 3 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">3. Legal Basis for Processing (GDPR)</h2>
            <p>
              If you are located in the European Economic Area (EEA), United Kingdom, or Switzerland, we
              process your personal data on the following legal bases under the General Data Protection
              Regulation (GDPR) or equivalent applicable law:
            </p>
            <div className="mt-3 rounded-xl border border-[#E3E1DA] overflow-x-auto">
              <table className="w-full text-xs min-w-[420px]">
                <thead className="bg-[#F4F3EF]">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-[#566174]">Processing activity</th>
                    <th className="text-left px-4 py-2 font-semibold text-[#566174]">Legal basis (GDPR Art. 6)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Account creation and authentication', 'Contract performance (Art. 6(1)(b))'],
                    ['Saving valuations, watchlist, and portfolio', 'Contract performance (Art. 6(1)(b))'],
                    ['Processing subscription payments', 'Contract performance (Art. 6(1)(b))'],
                    ['Sending transactional emails', 'Contract performance (Art. 6(1)(b))'],
                    ['Sending marketing/newsletter emails', 'Consent (Art. 6(1)(a)) — opt-in only'],
                    ['Server logs for security and debugging', 'Legitimate interests (Art. 6(1)(f))'],
                    ['Aggregate analytics to improve the Service', 'Legitimate interests (Art. 6(1)(f))'],
                    ['Fraud prevention and legal compliance', 'Legal obligation / Legitimate interests (Art. 6(1)(c)/(f))'],
                  ].map(([activity, basis]) => (
                    <tr key={activity} className="bg-white">
                      <td className="px-4 py-2.5 text-[#566174]">{activity}</td>
                      <td className="px-4 py-2.5 text-[#566174]">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              Where we rely on legitimate interests, we have assessed that our interests are not overridden
              by your rights and freedoms. You may object to processing based on legitimate interests at
              any time (see section 7).
            </p>
          </section>

          {/* ── 4 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">4. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To create and maintain your account</li>
              <li>To authenticate you and manage your session</li>
              <li>To save and retrieve your valuations, watchlist, and portfolio</li>
              <li>To process and manage your subscription through LemonSqueezy</li>
              <li>To send you transactional emails (welcome, subscription confirmation, billing notifications)</li>
              <li>To send you the weekly earnings digest, if and only if you explicitly opted in</li>
              <li>To detect fraud and protect the security of the Service</li>
              <li>To improve the Service based on aggregate, anonymized usage patterns</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your data. We do not use your data for advertising targeting.
              We do not share your personal data with any third party except as described in section 5.
            </p>
          </section>

          {/* ── 5 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">5. Third-Party Services (Sub-Processors)</h2>
            <p>
              We use the following sub-processors to operate the Service. Each is bound by a data processing
              agreement and processes data only as instructed by us.
            </p>
            <div className="mt-3 rounded-xl border border-[#E3E1DA] overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead className="bg-[#F4F3EF]">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-[#566174]">Service</th>
                    <th className="text-left px-4 py-2 font-semibold text-[#566174]">Purpose</th>
                    <th className="text-left px-4 py-2 font-semibold text-[#566174]">Data shared</th>
                    <th className="text-left px-4 py-2 font-semibold text-[#566174]">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Google OAuth', 'Authentication', 'Name, email, profile picture', 'USA (SCCs)'],
                    ['Supabase', 'Database & storage', 'Account data, valuations, portfolio', 'USA/EU (SCCs)'],
                    ['Vercel', 'Hosting & infrastructure', 'Server logs, IP address', 'USA/EU (SCCs)'],
                    ['Resend', 'Transactional email', 'Email address, name', 'USA (SCCs)'],
                    ['Payment processor (TBD)', 'Payment processing', 'Email, name, subscription data', 'TBD'],
                    ['Yahoo Finance', 'Market data (read-only)', 'None — public data fetch only', 'USA'],
                    ['Financial Modeling Prep', 'Financial data (read-only)', 'None — public data fetch only', 'USA'],
                    ['FRED / Federal Reserve', 'Economic data (read-only)', 'None — public data fetch only', 'USA'],
                  ].map(([service, purpose, data, location]) => (
                    <tr key={service} className="bg-white">
                      <td className="px-4 py-2.5 font-medium text-[#566174]">{service}</td>
                      <td className="px-4 py-2.5 text-[#566174]">{purpose}</td>
                      <td className="px-4 py-2.5 text-[#566174]">{data}</td>
                      <td className="px-4 py-2.5 text-[#566174]">{location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              &quot;SCCs&quot; refers to Standard Contractual Clauses approved by the European Commission, which
              provide an appropriate safeguard for transfers of personal data to third countries (e.g.,
              the USA) under GDPR Chapter V.
            </p>
          </section>

          {/* ── 6 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">6. International Data Transfers</h2>
            <p>
              Our infrastructure and sub-processors are primarily located in the United States. If you are
              located in the EEA, UK, or Switzerland, your personal data will be transferred to and processed
              in the United States. We rely on Standard Contractual Clauses (SCCs) and, where applicable,
              the EU-U.S. Data Privacy Framework, as the legal mechanism for such transfers.
            </p>
            <p className="mt-2">
              You may request information about the specific safeguards in place by contacting us at{' '}
              <a href="mailto:hello@insic.app" className="text-[#2563EB] hover:underline">hello@insic.app</a>.
            </p>
          </section>

          {/* ── 7 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">7. Your Rights</h2>
            <p>
              Depending on your location, you may have the following rights regarding your personal data:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                <strong>Access (Art. 15 GDPR)</strong> — request a copy of the personal data we hold about you
              </li>
              <li>
                <strong>Rectification (Art. 16 GDPR)</strong> — correct inaccurate or incomplete personal data
              </li>
              <li>
                <strong>Erasure / Right to be Forgotten (Art. 17 GDPR)</strong> — request deletion of your
                personal data, subject to legal retention obligations
              </li>
              <li>
                <strong>Restriction of processing (Art. 18 GDPR)</strong> — request that we limit how we use
                your data in certain circumstances
              </li>
              <li>
                <strong>Data portability (Art. 20 GDPR)</strong> — receive your personal data in a structured,
                machine-readable format
              </li>
              <li>
                <strong>Object to processing (Art. 21 GDPR)</strong> — object to processing based on legitimate
                interests, including for marketing purposes
              </li>
              <li>
                <strong>Withdraw consent</strong> — where processing is based on your consent (e.g., newsletter),
                you may withdraw it at any time without affecting the lawfulness of prior processing
              </li>
              <li>
                <strong>Lodge a complaint</strong> — you have the right to lodge a complaint with your local
                data protection authority (e.g., the relevant EU supervisory authority, or the ICO in the UK)
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{' '}
              <a href="mailto:hello@insic.app" className="text-[#2563EB] hover:underline">
                hello@insic.app
              </a>.
              We will respond within 30 days (or within 1 month as required by GDPR). We may ask you to
              verify your identity before processing your request.
            </p>
          </section>

          {/* ── 8 ── */}
          <section id="cookies">
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">8. Cookies and Tracking</h2>
            <p>
              We use only <strong>strictly necessary cookies</strong> required to operate the Service.
              Specifically:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Session/authentication cookies</strong> (via NextAuth) — required to keep you signed
                in. Without these, the authenticated portions of the Service cannot function.
              </li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> use advertising cookies, cross-site tracking cookies, or
              third-party analytics cookies that track you across websites.
            </p>
            <p className="mt-2">
              Under GDPR, strictly necessary cookies do not require your consent as they are essential for
              the Service to function. By using the Service, you acknowledge their use. You can control or
              delete cookies through your browser settings, though doing so will prevent you from staying
              signed in.
            </p>
          </section>

          {/* ── 9 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">9. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to provide the
              Service. Specifically:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Account data</strong> — retained for the lifetime of your account</li>
              <li><strong>Server logs</strong> — retained for 30 days, then automatically deleted</li>
              <li><strong>Payment records</strong> — retained for 7 years to comply with financial record-keeping obligations</li>
              <li><strong>Anonymized analytics</strong> — retained indefinitely (no personal data is involved)</li>
            </ul>
            <p className="mt-2">
              If you request account deletion, we will permanently delete your personal data within 30 days,
              except where retention is required by applicable law (e.g., financial records).
            </p>
          </section>

          {/* ── 10 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">10. Email Communications</h2>
            <p>We send two types of emails:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Transactional</strong> — welcome emails, subscription confirmations, and
                account-related notifications. These are necessary for the Service to function and cannot
                be opted out of while maintaining an active account. Legal basis: contract performance.
              </li>
              <li>
                <strong>Marketing / Newsletter</strong> — earnings digest and market analysis content.
                Sent only to users who explicitly opted in. You can unsubscribe at any time via the
                unsubscribe link in any newsletter email or by contacting us. Legal basis: consent.
              </li>
            </ul>
          </section>

          {/* ── 11 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">11. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal data
              against unauthorized access, disclosure, alteration, and destruction. These include:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Encryption of data in transit (HTTPS/TLS)</li>
              <li>Encrypted storage via Supabase (PostgreSQL with row-level security)</li>
              <li>Authentication via Google OAuth (no passwords stored by us)</li>
              <li>Access controls limiting data access to authorized personnel only</li>
            </ul>
            <p className="mt-2">
              No method of transmission or storage is 100% secure. In the event of a personal data breach
              that poses a risk to your rights and freedoms, we will notify you and relevant authorities
              in accordance with applicable law (GDPR Art. 33/34 — within 72 hours of becoming aware).
            </p>
          </section>

          {/* ── 12 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">12. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed at children under 18 and we do not knowingly collect personal data
              from anyone under 18. If you believe a minor has created an account, please contact us at{' '}
              <a href="mailto:hello@insic.app" className="text-[#2563EB] hover:underline">hello@insic.app</a>{' '}
              and we will delete it promptly.
            </p>
          </section>

          {/* ── 13 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">13. Changes to This Policy</h2>
            <p>
              We may update this policy periodically. We will notify registered users by email of material
              changes at least 14 days before they take effect. The updated effective date will be posted at
              the top of this page. Your continued use of the Service after the effective date of changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* ── 14 ── */}
          <section>
            <h2 className="text-base sm:text-lg font-semibold text-[#06101F] mb-2 mt-6">14. Contact and Complaints</h2>
            <p>
              For any privacy questions, requests, or concerns, contact us at:{' '}
              <a href="mailto:hello@insic.app" className="text-[#2563EB] hover:underline">
                hello@insic.app
              </a>.
              We will respond within 30 days.
            </p>
            <p className="mt-2">
              If you are located in the EEA or UK and are not satisfied with our response, you have the right
              to lodge a complaint with your national data protection authority. A list of EU supervisory
              authorities is available at{' '}
              <a
                href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2563EB] hover:underline"
              >
                edpb.europa.eu
              </a>.
              UK residents may contact the ICO at{' '}
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2563EB] hover:underline"
              >
                ico.org.uk
              </a>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-[#E3E1DA] flex flex-wrap gap-4 text-sm text-[#8A95A6]">
          <Link href="/terms" className="hover:text-[#566174] transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-[#566174] transition-colors">Back to home</Link>
        </div>

      </div>
    </div>
  )
}
