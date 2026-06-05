'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 bg-[#F8F7F2]">
      <div className="rounded-2xl border border-[#F0B8B8] bg-[#FCEAEA] p-6 text-center max-w-md">
        <p className="text-sm font-semibold text-[#D83B3B]">Something went wrong loading this page</p>
        <p className="mt-2 text-xs text-[#536174]">Please try again. If the problem persists, the stock data may be temporarily unavailable.</p>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-2 text-[10px] text-[#8A96A8] font-mono break-all">{error.message}</p>
        )}
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-[#0A1424] hover:bg-[#111C2E] active:bg-[#1B2A3D] transition-colors px-4 py-2 text-xs font-medium text-white"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
