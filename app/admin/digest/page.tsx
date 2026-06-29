'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Clock, CheckCircle, Mail } from 'lucide-react'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? 'marciofabrizio@gmail.com')
  .split(',').map(e => e.trim())

interface StockSpotlight {
  ticker: string
  companyName: string
  fairValue: number
  upside: number
}

interface DigestDraft {
  subject: string
  openingParagraph: string
  marketSection: string
  macroNote: string
  status: 'draft' | 'approved' | 'sent'
  scheduledSendTime?: string | null
  stockSpotlights?: StockSpotlight[]
}

const INPUT_CLS =
  'w-full px-3 py-2.5 text-[16px] sm:text-sm bg-white border border-[#E5E5E5] rounded-lg text-[#111111] ' +
  'placeholder-[#C4C4C4] focus:outline-none focus:ring-2 focus:ring-[#5F790B]/20 ' +
  'focus:border-[#5F790B] transition-colors disabled:bg-[#FAFAFA] disabled:text-[#9B9B9B] disabled:cursor-not-allowed'

function StatusBadge({ status }: { status: DigestDraft['status'] }) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F0F0F0] text-[#6B6B6B] border border-[#E5E5E5]">
        <Mail size={11} />
        Sent
      </span>
    )
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]">
        <CheckCircle size={11} />
        Approved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F5F5F0] text-[#6B6B6B] border border-[#E5E5E5]">
      <Clock size={11} />
      Draft
    </span>
  )
}

function UpsidePill({ upside }: { upside: number }) {
  const isPositive = upside >= 0
  return (
    <span
      className={[
        'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums',
        isPositive
          ? 'bg-[#E8F7EF] text-[#11875D]'
          : 'bg-[#FCEAEA] text-[#D83B3B]',
      ].join(' ')}
    >
      {isPositive ? '+' : ''}{upside.toFixed(1)}%
    </span>
  )
}

export default function DigestPage() {
  const { data: session, status } = useSession()

  const [draft, setDraft] = useState<DigestDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [subject, setSubject] = useState('')
  const [openingParagraph, setOpeningParagraph] = useState('')
  const [marketSection, setMarketSection] = useState('')
  const [macroNote, setMacroNote] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState<string | null>(null)

  const [testEmail, setTestEmail] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  async function handleSendTest() {
    if (!testEmail.trim()) return
    setSendingTest(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/digest-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testEmail: testEmail.trim(), subject, openingParagraph, marketSection, macroNote }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Send failed')
      setTestResult(`✓ Sent to ${testEmail}`)
    } catch (err) {
      setTestResult(`✗ ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSendingTest(false)
    }
  }

  const isAdmin = ADMIN_EMAILS.includes(session?.user?.email ?? '')

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    fetch('/api/admin/digest-preview')
      .then(r => r.json())
      .then((data: DigestDraft) => {
        setDraft(data)
        setSubject(data.subject ?? '')
        setOpeningParagraph(data.openingParagraph ?? '')
        setMarketSection(data.marketSection ?? '')
        setMacroNote(data.macroNote ?? '')
        setLoading(false)
      })
      .catch(err => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load digest preview')
        setLoading(false)
      })
  }, [isAdmin])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/admin/digest-preview', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, openingParagraph, marketSection, macroNote }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setDraft(prev =>
        prev ? { ...prev, subject, openingParagraph, marketSection, macroNote, status: 'draft' } : prev
      )
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove() {
    const confirmed = window.confirm(
      'Send this digest now? This will email all subscribers immediately.'
    )
    if (!confirmed) return

    setApproving(true)
    setApproveError(null)
    try {
      const res = await fetch('/api/admin/digest-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, openingParagraph, marketSection, macroNote }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Send failed')
      }
      setDraft(prev => prev ? { ...prev, status: 'sent' } : prev)
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setApproving(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-4 w-4 rounded-full border-2 border-[#E5E5E5] border-t-[#5F790B] animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-sm font-medium text-[#111111]">Access denied</p>
        <p className="text-xs text-[#9B9B9B]">This page is restricted to admin accounts.</p>
      </div>
    )
  }

  const isSent = draft?.status === 'sent'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-base font-semibold text-[#111111] tracking-tight">Weekly Digest</h1>
          <p className="text-xs text-[#9B9B9B] mt-0.5">Review and send this week&apos;s subscriber email</p>
        </div>
        {draft && <StatusBadge status={draft.status} />}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-20 rounded-full bg-[#F0F0F0] animate-pulse" />
              <div className="h-10 rounded-lg bg-[#F0F0F0] animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Load error */}
      {!loading && loadError && (
        <div className="rounded-lg border border-[#F0B8B8] bg-[#FCEAEA] px-4 py-3 text-sm text-[#D83B3B]">
          {loadError}
        </div>
      )}

      {/* Main content */}
      {!loading && !loadError && draft && (
        <div className="space-y-6">

          {/* Meta bar */}
          {draft.scheduledSendTime && (
            <div className="flex items-center gap-2 text-xs text-[#6B6B6B] bg-[#FAFAFA] border border-[#E5E5E5] rounded-lg px-4 py-2.5">
              <Clock size={13} className="shrink-0 text-[#9B9B9B]" />
              <span>
                Auto-send:{' '}
                <span className="font-medium text-[#111111]">
                  {new Date(draft.scheduledSendTime).toLocaleString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })}
                </span>
                {draft.status === 'draft' && (
                  <span className="ml-1.5 text-[#B56A00] font-medium">(if not approved)</span>
                )}
              </span>
            </div>
          )}

          {/* Editable fields */}
          <div className="space-y-4">

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">Subject</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject line"
                disabled={isSent}
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">Opening paragraph</label>
              <textarea
                value={openingParagraph}
                onChange={e => setOpeningParagraph(e.target.value)}
                placeholder="Intro paragraph for subscribers…"
                rows={4}
                disabled={isSent}
                className={INPUT_CLS + ' resize-y'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">Market section</label>
              <textarea
                value={marketSection}
                onChange={e => setMarketSection(e.target.value)}
                placeholder="Market recap and key moves…"
                rows={5}
                disabled={isSent}
                className={INPUT_CLS + ' resize-y'}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">Macro note</label>
              <textarea
                value={macroNote}
                onChange={e => setMacroNote(e.target.value)}
                placeholder="Macro context or key theme…"
                rows={3}
                disabled={isSent}
                className={INPUT_CLS + ' resize-y'}
              />
            </div>

          </div>

          {/* Stock spotlights */}
          {draft.stockSpotlights && draft.stockSpotlights.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#111111] mb-3">Stock spotlights</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {draft.stockSpotlights.map(stock => (
                  <div
                    key={stock.ticker}
                    className="rounded-xl border border-[#E5E5E5] bg-white px-4 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[13px] font-bold text-[#111111] tracking-tight font-mono">
                          {stock.ticker}
                        </span>
                        <UpsidePill upside={stock.upside} />
                      </div>
                      <div className="text-xs text-[#6B6B6B] truncate">{stock.companyName}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[11px] text-[#9B9B9B] mb-0.5">Fair value</div>
                      <div className="text-[13px] font-semibold text-[#111111] tabular-nums">
                        ${stock.fairValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback banners */}
          {saveSuccess && (
            <div className="flex items-center gap-2.5 rounded-lg border border-[#A3D9BE] bg-[#E8F7EF] px-4 py-3 text-sm text-[#11875D]">
              <CheckCircle size={15} className="shrink-0" />
              Draft saved successfully.
            </div>
          )}

          {saveError && (
            <div className="rounded-lg border border-[#F0B8B8] bg-[#FCEAEA] px-4 py-3 text-sm text-[#D83B3B]">
              Save error: {saveError}
            </div>
          )}

          {approveError && (
            <div className="rounded-lg border border-[#F0B8B8] bg-[#FCEAEA] px-4 py-3 text-sm text-[#D83B3B]">
              Send error: {approveError}
            </div>
          )}

          {/* Test email */}
          {!isSent && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="email"
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
                placeholder="Send test to email…"
                className="flex-1 px-3 py-2 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#5F790B] bg-white"
              />
              <button
                onClick={handleSendTest}
                disabled={sendingTest || !testEmail.trim()}
                className="px-4 py-2 rounded-lg border border-[#E5E5E5] bg-white hover:border-[#5F790B] text-[#5F790B] text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {sendingTest ? 'Sending…' : 'Send test'}
              </button>
            </div>
          )}
          {testResult && (
            <p className={`text-sm ${testResult.startsWith('✓') ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
              {testResult}
            </p>
          )}

          {/* Action row */}
          {isSent ? (
            <p className="text-sm text-[#9B9B9B]">
              This digest has already been sent and can no longer be edited.
            </p>
          ) : (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || approving}
                className="px-5 py-2.5 rounded-lg border border-[#E5E5E5] bg-white hover:border-[#C8C8C8] text-[#111111] text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              <button
                onClick={handleApprove}
                disabled={saving || approving || !subject.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#5F790B] hover:bg-[#526A08] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Mail size={14} />
                {approving ? 'Sending…' : 'Approve & send'}
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
