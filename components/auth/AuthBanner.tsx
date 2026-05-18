'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useLoginGate } from './LoginGateProvider'
import { X } from 'lucide-react'

const SESSION_KEY = 'stock_page_views'

export default function AuthBanner() {
  const { data: session } = useSession()
  const { requireAuth } = useLoginGate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (session?.user) return
    try {
      const count = parseInt(sessionStorage.getItem(SESSION_KEY) ?? '0', 10) + 1
      sessionStorage.setItem(SESSION_KEY, String(count))
      if (count >= 2) setVisible(true)
    } catch {
      // sessionStorage unavailable (SSR, private mode edge case)
    }
  }, [session])

  if (!visible || session?.user) return null

  return (
    <div className="sticky top-[52px] z-10 flex items-center justify-between gap-4 bg-blue-600 px-4 py-2.5 text-sm text-white sm:px-6">
      <span className="leading-snug">
        <strong>Save this analysis</strong> — sign in free to keep your research in one place.
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => requireAuth('Save this analysis to your watchlist — sign in to unlock it.')}
          className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
        >
          Sign in free →
        </button>
        <button
          onClick={() => setVisible(false)}
          className="text-blue-200 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
