'use client'
import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InfoTooltipProps {
  content: string
  className?: string
}

export default function InfoTooltip({ content, className }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false)
  const [above, setAbove] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!visible || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setAbove(rect.bottom + 130 > window.innerHeight)
  }, [visible])

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        ref={ref}
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-slate-300 hover:text-slate-500 transition-colors focus:outline-none ml-1 shrink-0"
        aria-label="More information"
      >
        <Info size={12} />
      </button>
      {visible && (
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 z-50 w-64 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg text-[12px] text-slate-600 leading-relaxed pointer-events-none',
            above ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          {content}
          <div className={cn(
            'absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border bg-white border-slate-200',
            above ? 'top-full -mt-1.5 border-t-0 border-l-0' : 'bottom-full mb-[-5px] border-b-0 border-r-0'
          )} />
        </div>
      )}
    </span>
  )
}
