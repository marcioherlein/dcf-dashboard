import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — Intrinsico' }

const EFFECTIVE_DATE = 'June 1, 2025'

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">

        <div className="mb-10">
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to Intrinsico</Link>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none space-y-8 text-sm text-slate-600 leading-relaxed">

          {/* ── 1 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">1. Overview</h2>
            <p>
              Intrinsico (&quot;we&quot;, &quot;us&quot;) is committed to protecting your privacy. This policy
              explains what data we collect, how we use it, and your rights regarding it.
              We collect only what is necessary to provide the Service.
            </p>
          </section>

          {/* ── 2 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">2. Data We Collect</h2>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-slate-700">When you sign in with Google:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Your name and email address</li>
                  <li>Your Google profile picture</li>
                  <li>A unique identifier from Google to link your account</li>
                </ul>
                <p className="mt-1 text-slate-500">We do not access your Google contacts, Drive, Gmail, or any other Google service.</p>
              </div>
              <div>
                <p className="font-medium text-slate-700">When you use the Service:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Tickers you search and save to your watchlist</li>
                  <li>Valuation models and assumptions you create</li>
                  <li>Your newsletter subscription preference (if opted in)</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-slate-700">Automatically collected:</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>Basic usage analytics (page views, feature usage) — no personal identifiers</li>
                  <li>Server logs (IP address, browser type) for security and debugging — retained for 30 days</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ── 3 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">3. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To authenticate you and maintain your account</li>
              <li>To save your watchlist, valuations, and preferences</li>
              <li>To send you the weekly earnings digest, if you opted in</li>
              <li>To send transactional emails (e.g., welcome email)</li>
              <li>To improve the Service based on aggregate, anonymized usage patterns</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your data. We do not use your data for
              advertising. We do not share your data with third parties except as
              described in section 4.
            </p>
          </section>

          {/* ── 4 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">4. Third-Party Services</h2>
            <p>We use the following services to operate Intrinsico. Each has its own privacy policy.</p>
            <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Service</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Purpose</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Data shared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Google OAuth', 'Authentication', 'Name, email, profile picture'],
                    ['Supabase', 'Database & storage', 'Account data, saved valuations'],
                    ['Vercel', 'Hosting & infrastructure', 'Server logs (IP, requests)'],
                    ['Resend', 'Transactional email', 'Email address, name'],
                    ['Yahoo Finance', 'Market data (read only)', 'None — public data fetch'],
                  ].map(([service, purpose, data]) => (
                    <tr key={service} className="bg-white">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{service}</td>
                      <td className="px-4 py-2.5 text-slate-500">{purpose}</td>
                      <td className="px-4 py-2.5 text-slate-500">{data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 5 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">5. Email Communications</h2>
            <p>
              We send two types of emails:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Transactional</strong> — welcome emails and account-related
                notifications. These are sent to all users and cannot be opted out of
                while maintaining an active account.
              </li>
              <li>
                <strong>Weekly newsletter</strong> — earnings digest and market
                analysis. Sent only to users who explicitly opted in. You can
                unsubscribe at any time via the link in any newsletter email.
              </li>
            </ul>
          </section>

          {/* ── 6 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. If you
              request account deletion, we will permanently delete your personal data
              within 30 days, except where retention is required by law. Anonymized,
              aggregated analytics data may be retained indefinitely.
            </p>
          </section>

          {/* ── 7 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">7. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Access</strong> — request a copy of the data we hold about you</li>
              <li><strong>Rectification</strong> — correct inaccurate personal data</li>
              <li><strong>Erasure</strong> — request deletion of your account and data</li>
              <li><strong>Portability</strong> — receive your data in a machine-readable format</li>
              <li><strong>Opt out</strong> — unsubscribe from marketing emails at any time</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{' '}
              <a href="mailto:hello@intrinsico.capital" className="text-blue-600 hover:underline">
                hello@intrinsico.capital
              </a>.
              We will respond within 30 days.
            </p>
          </section>

          {/* ── 8 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">8. Cookies</h2>
            <p>
              We use only essential cookies required for authentication (session tokens
              via NextAuth). We do not use advertising cookies or third-party tracking
              cookies.
            </p>
          </section>

          {/* ── 9 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">9. Children&apos;s Privacy</h2>
            <p>
              The Service is not directed at children under 18. We do not knowingly
              collect data from anyone under 18. If you believe a minor has created an
              account, please contact us and we will delete it promptly.
            </p>
          </section>

          {/* ── 10 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this policy periodically. We will notify registered users
              by email of material changes. Continued use of the Service after changes
              constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* ── 11 ── */}
          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">11. Contact</h2>
            <p>
              Privacy questions or requests:{' '}
              <a href="mailto:hello@intrinsico.capital" className="text-blue-600 hover:underline">
                hello@intrinsico.capital
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 flex gap-6 text-sm text-slate-400">
          <Link href="/terms" className="hover:text-slate-600 transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-slate-600 transition-colors">Back to home</Link>
        </div>

      </div>
    </div>
  )
}
