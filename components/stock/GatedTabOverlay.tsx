'use client'
import { signIn } from 'next-auth/react'
import { Bookmark } from 'lucide-react'

interface Props {
  tabName: string
}

export default function GatedTabOverlay({ tabName: _tabName }: Props) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-[#BFD2A1] bg-[#F6FAEA] px-4 py-3.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <Bookmark size={14} className="text-[#5F790B] shrink-0" aria-hidden="true" />
        <p className="text-[13px] text-[#566174] leading-snug">
          <strong className="text-[#06101F] font-semibold">Save this analysis</strong> — sign in to track it in your Watchlist.
        </p>
      </div>
      <button
        onClick={() => signIn('google', { callbackUrl: typeof window !== 'undefined' ? window.location.href : '/' })}
        className="shrink-0 rounded-lg bg-[#4A6109] hover:bg-[#3E5206] text-white px-3.5 py-1.5 text-[12px] font-semibold transition-colors"
      >
        Sign in free
      </button>
    </div>
  )
}
