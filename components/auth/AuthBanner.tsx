'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLoginGate } from './LoginGateProvider'
import { X } from 'lucide-react'

const SESSION_KEY       = 'stock_page_views'
const DISMISSED_KEY     = 'stock_page_views_dismissed'

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
    } catch {
      // sessionStorage unavailable (SSR, private mode edge case)
    }
  }, [session])

  if (!visible || session?.user) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-4 bg-olive-700 px-4 py-2.5 pt-[calc(env(safe-area-inset-top,0px)+10px)] text-sm text-white sm:px-6">
      <span className="leading-snug">
        <strong>Save this analysis</strong> — sign in to keep your research in one place.
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => requireAuth({ intent: 'save_valuation' })}
          className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-olive-700 hover:bg-olive-50 transition-colors"
        >
          Save analysis →
        </button>
        <button
          onClick={() => {
            setVisible(false)
            try { sessionStorage.setItem(DISMISSED_KEY, '1') } catch {}
          }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/60 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
