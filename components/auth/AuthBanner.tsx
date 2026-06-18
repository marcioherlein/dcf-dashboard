'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLoginGate } from './LoginGateProvider'
import { X, Bookmark } from 'lucide-react'

const SESSION_KEY   = 'stock_page_views'
const DISMISSED_KEY = 'stock_page_views_dismissed'

export default function AuthBanner() {
  const { data: session } = useSession()
  const { requireAuth } = useLoginGate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (session?.user) return
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return
      const count = parseInt(sessionStorage.getItem(SESSION_KEY) ?? '0', 10) + 1
      sessionStorage.setItem(SESSION_KEY, String(count))
      if (count >= 2) setVisible(true)
    } catch {}
  }, [session])

  if (!visible || session?.user) return null

  return (
    <div
      role="banner"
      className="flex items-center justify-between gap-3 rounded-xl border border-[#BFD2A1] bg-[#F6FAEA] px-4 py-3 mb-2"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Bookmark size={14} className="text-[#5F790B] shrink-0" aria-hidden="true" />
        <p className="text-[13px] text-[#566174] leading-snug">
          <strong className="text-[#06101F] font-semibold">Save this analysis</strong> — sign in to keep your research in one place.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => requireAuth({ intent: 'save_valuation' })}
          className="rounded-lg bg-[#5F790B] hover:bg-[#526A08] text-white px-3 py-1.5 text-[12px] font-semibold transition-colors min-h-[36px]"
        >
          Sign in free
        </button>
        <button
          onClick={() => {
            setVisible(false)
            try { sessionStorage.setItem(DISMISSED_KEY, '1') } catch {}
          }}
          className="w-[36px] h-[36px] flex items-center justify-center rounded-lg text-[#8A95A6] hover:text-[#566174] hover:bg-[#EEF2FA] transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
