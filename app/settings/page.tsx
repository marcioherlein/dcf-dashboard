'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#E3E1DA] rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 bg-[#F0F1F6] border-b border-[#E3E1DA]">
        <h2 className="text-sm font-semibold text-[#06101F]">{title}</h2>
      </div>
      <div className="bg-white px-5 py-5 space-y-4">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [newsletter, setNewsletter] = useState(false)
  const [newsletterLoading, setNewsletterLoading] = useState(false)
  const [newsletterSaved, setNewsletterSaved] = useState(false)

  const [exportLoading, setExportLoading] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Load current newsletter preference
  useEffect(() => {
    if (!session?.user?.email) return
    fetch('/api/account/newsletter')
      .then(r => r.json())
      .then(d => { if (typeof d.newsletter_opt_in === 'boolean') setNewsletter(d.newsletter_opt_in) })
      .catch(() => {})
  }, [session?.user?.email])

  async function handleNewsletterToggle(value: boolean) {
    setNewsletterLoading(true)
    setNewsletterSaved(false)
    try {
      await fetch('/api/account/newsletter', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsletter_opt_in: value }),
      })
      setNewsletter(value)
      setNewsletterSaved(true)
      setTimeout(() => setNewsletterSaved(false), 2000)
    } finally {
      setNewsletterLoading(false)
    }
  }

  async function handleExport() {
    setExportLoading(true)
    try {
      const res = await fetch('/api/account/export')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'insic-data-export.json'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportLoading(false)
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== 'delete my account') return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setDeleteError(d.error ?? 'Something went wrong. Please try again.')
        return
      }
      await signOut({ callbackUrl: '/' })
    } catch {
      setDeleteError('Something went wrong. Please try again.')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-[#8A95A6]" size={24} />
      </div>
    )
  }

  if (!session) {
    router.replace('/')
    return null
  }

  const email = session.user?.email ?? ''
  const name = session.user?.name ?? ''

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#06101F]">Account Settings</h1>
        <p className="text-sm text-[#8A95A6] mt-0.5">Manage your account, data, and preferences.</p>
      </div>

      {/* Profile */}
      <Section title="Profile">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-[#8A95A6] uppercase tracking-wide">Name</p>
          <p className="text-sm text-[#06101F]">{name || '—'}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-[#8A95A6] uppercase tracking-wide">Email</p>
          <p className="text-sm text-[#06101F]">{email}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-[#8A95A6] uppercase tracking-wide">Sign-in method</p>
          <p className="text-sm text-[#06101F]">Google</p>
        </div>
      </Section>

      {/* Email preferences */}
      <Section title="Email Preferences">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#06101F]">Weekly earnings digest</p>
            <p className="text-xs text-[#8A95A6] mt-0.5 leading-relaxed">
              Market analysis and earnings highlights. You can unsubscribe at any time.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={newsletter}
            onClick={() => handleNewsletterToggle(!newsletter)}
            disabled={newsletterLoading}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
              transition-colors duration-200 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
              focus-visible:outline-[#5F790B] disabled:opacity-50
              ${newsletter ? 'bg-[#5F790B]' : 'bg-[#D1D5DB]'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
                transition duration-200 ease-in-out ${newsletter ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
        {newsletterSaved && (
          <p className="text-xs text-[#5F790B] font-medium">Saved.</p>
        )}
        <p className="text-xs text-[#8A95A6]">
          Transactional emails (account and subscription notifications) cannot be disabled while
          your account is active. See our{' '}
          <Link href="/privacy#email" className="underline underline-offset-2 hover:text-[#566174]">
            Privacy Policy
          </Link>.
        </p>
      </Section>

      {/* Subscription */}
      <Section title="Subscription">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#06101F] capitalize">
              {(session.user as { plan?: string }).plan ?? 'free'} plan
            </p>
            <p className="text-xs text-[#8A95A6] mt-0.5">
              {(session.user as { plan?: string }).plan === 'pro'
                ? 'Unlimited analyses and saves.'
                : '10 analyses and 10 saves per month.'}
            </p>
          </div>
          {(session.user as { plan?: string }).plan === 'pro' ? (
            <a
              href="https://www.paypal.com/myaccount/autopay"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#2563EB] hover:underline"
            >
              Manage billing →
            </a>
          ) : (
            <Link
              href="/pricing"
              className="text-xs font-semibold text-[#5F790B] hover:underline"
            >
              Upgrade to Pro →
            </Link>
          )}
        </div>
      </Section>

      {/* Data */}
      <Section title="Your Data">
        <div>
          <p className="text-sm font-medium text-[#06101F]">Export your data</p>
          <p className="text-xs text-[#8A95A6] mt-0.5 leading-relaxed">
            Download a JSON file containing your account information, saved valuations, and
            activity history. This fulfils your right to data portability under GDPR.
          </p>
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#E3E1DA] bg-white
              px-4 py-2 text-xs font-semibold text-[#06101F] hover:bg-[#F0F1F6] transition-colors
              disabled:opacity-50"
          >
            {exportLoading && <Loader2 size={12} className="animate-spin" />}
            Download data export
          </button>
        </div>
        <p className="text-xs text-[#8A95A6]">
          To request corrections or ask questions about your data, email{' '}
          <a href="mailto:hello@insic.app" className="underline underline-offset-2 hover:text-[#566174]">
            hello@insic.app
          </a>.
        </p>
      </Section>

      {/* Legal */}
      <Section title="Legal">
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/terms" target="_blank" className="text-[#2563EB] hover:underline">
            Terms of Service ↗
          </Link>
          <Link href="/privacy" target="_blank" className="text-[#2563EB] hover:underline">
            Privacy Policy ↗
          </Link>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone">
        <div>
          <p className="text-sm font-medium text-[#06101F]">Delete account</p>
          <p className="text-xs text-[#8A95A6] mt-0.5 leading-relaxed">
            Permanently deletes your account, all saved valuations, watchlist, and portfolio data.
            This cannot be undone. Your personal data will be removed within 30 days as required by
            our Privacy Policy.
          </p>
          {(session.user as { plan?: string }).plan === 'pro' && (
            <p className="text-xs text-[#B56A00] mt-1.5 font-medium">
              You have an active Pro subscription. Please cancel it via{' '}
              <a href="https://www.paypal.com/myaccount/autopay" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                billing settings
              </a>{' '}
              before deleting your account to avoid further charges.
            </p>
          )}
          <div className="mt-3 space-y-2">
            <label className="block text-xs text-[#566174]">
              Type <span className="font-mono font-semibold">delete my account</span> to confirm:
            </label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="delete my account"
              className="w-full rounded-lg border border-[#E3E1DA] px-3 py-2 text-sm text-[#06101F]
                placeholder:text-[#C2C7D0] focus:outline-none focus:ring-2 focus:ring-[#D83B3B]/30
                focus:border-[#D83B3B]"
            />
            {deleteError && (
              <p className="text-xs text-[#D83B3B] font-medium">{deleteError}</p>
            )}
            <button
              onClick={handleDelete}
              disabled={deleteConfirm !== 'delete my account' || deleteLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-[#F0B8B8] bg-[#FCEAEA]
                px-4 py-2 text-xs font-semibold text-[#D83B3B] hover:bg-[#F8D7D7] transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleteLoading && <Loader2 size={12} className="animate-spin" />}
              Permanently delete my account
            </button>
          </div>
        </div>
      </Section>
    </div>
  )
}
