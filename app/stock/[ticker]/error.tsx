'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 bg-gray-50">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center max-w-md">
        <p className="text-sm font-semibold text-red-700">Something went wrong</p>
        <p className="mt-2 text-xs text-red-500">{error.message}</p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
