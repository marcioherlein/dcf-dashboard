'use client'
import { useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface Props {
  front?: React.ReactNode
  children?: React.ReactNode
  back: React.ReactNode
  className?: string
}

export default function FlipCard({ front, children, back, className }: Props) {
  const [flipped, setFlipped] = useState(false)
  const frontContent = front ?? children

  const btnBase =
    'absolute top-3 right-3 z-10 w-6 h-6 rounded-full border flex items-center justify-center transition-all shadow-sm text-[11px] font-bold leading-none'
  const btnClosed =
    'bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-slate-400 hover:text-blue-600'
  const btnOpen =
    'bg-blue-600 hover:bg-blue-700 border-blue-600 text-white'

  return (
    <div className={cn('relative', className)} style={{ perspective: '1200px' }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', duration: 0.52, bounce: 0.06 }}
        style={{ transformStyle: 'preserve-3d', position: 'relative' }}
      >
        {/* Front — in normal flow, sets container height */}
        <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }} className="relative">
          {frontContent}
          <button
            onClick={(e) => { e.stopPropagation(); setFlipped(true) }}
            aria-label="What does this mean?"
            className={cn(btnBase, btnClosed)}
          >
            ?
          </button>
        </div>

        {/* Back — same dimensions, solid white so front never bleeds through */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            inset: 0,
          }}
          className="rounded-xl"
        >
          <div className="h-full rounded-xl bg-white border border-blue-200 shadow-sm overflow-y-auto relative p-5">
            {back}
            {/* Same-position close button */}
            <button
              onClick={(e) => { e.stopPropagation(); setFlipped(false) }}
              aria-label="Close explanation"
              className={cn(btnBase, btnOpen)}
            >
              ✕
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
