import { Suspense } from 'react'
import ETFCompareContent from './ETFCompareContent'

export default function ETFComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-[#F4F3EF] px-4 sm:px-8 py-8 max-w-6xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-[#E3E1DA] rounded motion-safe:animate-pulse" />
        <div className="h-64 bg-white rounded-2xl motion-safe:animate-pulse" />
      </div>
    }>
      <ETFCompareContent />
    </Suspense>
  )
}
