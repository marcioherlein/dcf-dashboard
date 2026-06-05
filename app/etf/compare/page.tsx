import { Suspense } from 'react'
import ETFCompareContent from './ETFCompareContent'

export default function ETFComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-[#F1F5F9] px-4 sm:px-8 py-8 max-w-6xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="h-64 bg-white rounded-2xl animate-pulse" />
      </div>
    }>
      <ETFCompareContent />
    </Suspense>
  )
}
