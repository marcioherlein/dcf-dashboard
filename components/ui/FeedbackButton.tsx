'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare, X, Send } from 'lucide-react'
import { useSession } from 'next-auth/react'

export default function FeedbackButton() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  // Only show to logged-in users
  if (!session?.user) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setStatus('sending')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, page: pathname }),
      })
      if (res.ok) {
        setStatus('sent')
        setMessage('')
        setTimeout(() => { setOpen(false); setStatus('idle') }, 2000)
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => { setOpen(true); setStatus('idle') }}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex items-center gap-2 rounded-full bg-[#5F790B] hover:bg-[#526A08] active:scale-95 text-white text-[12px] font-semibold px-4 py-2.5 shadow-lg transition-all"
        aria-label="Send feedback"
      >
        <MessageSquare size={14} strokeWidth={2.5} />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#E5E5E5] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
              <div>
                <p className="text-[14px] font-semibold text-[#111111]">Share feedback</p>
                <p className="text-[11px] text-[#9B9B9B] mt-0.5">Private — only the insic team sees this</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#F4F3EF] text-[#9B9B9B] hover:text-[#111111] transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {status === 'sent' ? (
                <div className="py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#EEF4DD] flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-[#5F790B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="text-[14px] font-semibold text-[#111111]">Thanks for the feedback!</p>
                  <p className="text-[12px] text-[#9B9B9B] mt-1">We read every message.</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={message}
                    onChange={e => { setMessage(e.target.value); setStatus('idle') }}
                    placeholder="What's working well? What's confusing? What's missing?"
                    rows={4}
                    className="w-full px-3 py-2.5 text-[13px] text-[#111111] placeholder-[#C4C4C4] bg-[#F8F8F6] border border-[#E5E5E5] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#5F790B]/20 focus:border-[#5F790B] transition-colors"
                    autoFocus
                  />
                  {status === 'error' && (
                    <p className="text-[11px] text-red-500">Failed to send — please try again.</p>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[#9B9B9B]">
                      Sent as {session?.user?.email?.split('@')[0]}
                    </p>
                    <button
                      type="submit"
                      disabled={!message.trim() || status === 'sending'}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5F790B] hover:bg-[#526A08] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold transition-colors"
                    >
                      <Send size={12} strokeWidth={2.5} />
                      {status === 'sending' ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  )
}
