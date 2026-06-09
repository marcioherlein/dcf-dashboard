'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const COOKIE_KEY = 'insic_cookie_notice_dismissed'

export default function CookieNotice() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    localStorage.setItem(COOKIE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="alertdialog"
      aria-label="Cookie notice"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg
                 bg-[#06101F] text-white rounded-2xl px-5 py-4 shadow-2xl
                 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <p className="text-xs text-white/80 leading-relaxed flex-1">
        We use only strictly necessary cookies to keep you signed in. No advertising
        or tracking cookies.{' '}
        <Link href="/privacy#cookies" className="underline underline-offset-2 hover:text-white">
          Learn more
        </Link>
      </p>
      <button
        onClick={dismiss}
        className="shrink-0 rounded-lg bg-white text-[#06101F] text-xs font-semibold
                   px-4 py-2 hover:bg-white/90 transition-colors cursor-pointer"
      >
        Got it
      </button>
    </div>
  )
}
