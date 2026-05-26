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

  return (
    <div className={cn('relative', className)} style={{ perspective: '1200px' }}>
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', duration: 0.52, bounce: 0.06 }}
        style={{ transformStyle: 'preserve-3d', position: 'relative' }}
      >
        {/* Front — stays in flow, sets the container height */}
        <div style={{ backfaceVisibility: 'hidden' }} className="relative">
          {frontContent}
          <button
            onClick={(e) => { e.stopPropagation(); setFlipped(true) }}
            aria-label="What does this mean?"
            className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-slate-100 hover:bg-blue-100 border border-slate-200 hover:border-blue-300 text-slate-400 hover:text-blue-600 transition-all flex items-center justify-center shadow-sm"
          >
            <span className="text-[11px] font-bold leading-none">?</span>
          </button>
        </div>

        {/* Back — absolutely fills the same space, scrollable if taller */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            inset: 0,
          }}
          className="rounded-xl overflow-y-auto"
        >
          <div className="h-full rounded-xl bg-slate-900 border border-slate-700 p-5 flex flex-col">
            {back}
            <button
              onClick={() => setFlipped(false)}
              className="mt-auto pt-4 text-[11px] text-slate-500 hover:text-slate-300 transition-colors text-left"
            >
              ← Got it, go back
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
