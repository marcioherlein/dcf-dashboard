'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 bg-white">
      <div className="rounded-2xl border border-[#F0B8B8] bg-[#FCEAEA] p-6 text-center max-w-md">
        <p className="text-sm font-semibold text-[#D83B3B]">Something went wrong loading this page</p>
        <p className="mt-2 text-xs text-[#6B6B6B]">Please try again. If the problem persists, the stock data may be temporarily unavailable.</p>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-2 text-[10px] text-[#6B6B6B] font-mono break-all">{error.message}</p>
        )}
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-ink-900 hover:bg-ink-800 active:bg-ink-700 transition-colors px-4 py-2 text-xs font-medium text-white"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
