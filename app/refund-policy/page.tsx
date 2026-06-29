import Link from 'next/link'

export const metadata = { title: 'Refund Policy — insic' }

const EFFECTIVE_DATE = 'June 29, 2026'

export default function RefundPolicyPage() {
  return (
    <div className="min-h-dvh bg-[#F0F1F6]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-24">

        <div className="mb-8">
          <Link href="/" className="inline-flex items-center min-h-[44px] text-sm text-[#2563EB] hover:underline">← Back to insic</Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#06101F] mb-2">Refund Policy</h1>
        <p className="text-sm text-[#8A95A6] mb-8 sm:mb-10">Effective date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none space-y-8 text-sm text-[#566174] leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">7-Day Money-Back Guarantee</h2>
            <p>
              If you subscribe to insic Pro and are not satisfied, you may request a full refund within 7 days of
              your first payment. No questions asked.
            </p>
            <p className="mt-3">
              To request a refund, email us at{' '}
              <a href="mailto:team@insic.app" className="text-[#2563EB] hover:underline">team@insic.app</a>{' '}
              from the email address associated with your account, with the subject line &quot;Refund Request.&quot;
              We will process your refund within 5 business days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">After the 7-Day Period</h2>
            <p>
              Refunds are not available after 7 days of the initial payment. Subscriptions cancelled after
              the 7-day window will remain active until the end of the current billing period, after which
              your account will revert to the free plan.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">Cancellation</h2>
            <p>
              You may cancel your subscription at any time from your account settings or by emailing{' '}
              <a href="mailto:team@insic.app" className="text-[#2563EB] hover:underline">team@insic.app</a>.
              Cancellation takes effect at the end of the current billing cycle. No partial refunds are issued
              for unused time after the 7-day window.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#06101F] mb-3">Contact</h2>
            <p>
              Questions about this policy? Contact us at{' '}
              <a href="mailto:team@insic.app" className="text-[#2563EB] hover:underline">team@insic.app</a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
