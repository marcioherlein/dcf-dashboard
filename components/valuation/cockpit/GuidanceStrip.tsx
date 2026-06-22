'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    num: '1',
    title: 'Read the verdict first',
    body: 'The summary strip at top shows the blended fair value, upside, and model confidence — your starting point.',
  },
  {
    num: '2',
    title: 'Tune the assumptions',
    body: 'Adjust growth, margins, multiples, and WACC on the left. The fair value updates live as you move each input.',
  },
  {
    num: '3',
    title: 'Check the scenario range',
    body: 'Bear, base, and bull cases show how sensitive the estimate is to your assumptions. Wide spread means lower conviction.',
  },
  {
    num: '4',
    title: 'Examine the method evidence',
    body: "The charts below show each model's estimate. Large disagreement across models reduces confidence in the blend.",
  },
]

export default function GuidanceStrip() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      const seen = localStorage.getItem('insic_guidance_seen')
      if (!seen) setOpen(true)
    } catch {}
  }, [])

  function handleToggle() {
    setOpen(o => !o)
    try { localStorage.setItem('insic_guidance_seen', '1') } catch {}
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={handleToggle}
        className="w-full flex items-center gap-2 bg-white rounded-[14px] border border-[#E3E1DA] shadow-sm px-4 py-3 hover:bg-[#F5F5F5] transition-colors select-none flex-wrap text-left"
      >
        <span
          aria-hidden="true"
          className={cn(
            'text-[#6B6B6B] text-xs transition-transform duration-200',
            open ? 'rotate-90' : ''
          )}
        >▶</span>
        <span className="text-[12px] font-[650] text-[#6B6B6B]">How to read this valuation</span>
        <span className={cn('text-[11px] text-[#6B6B6B] transition-opacity duration-150', open ? 'opacity-0' : 'opacity-100')}>
          4-step guide ↓
        </span>
      </button>

      {/* Smooth expand using grid-template-rows trick */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="mt-2 bg-white rounded-[14px] border border-[#E3E1DA] shadow-sm px-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STEPS.map(s => (
                <div key={s.num} className="flex gap-3">
                  <div className="bg-[#2563EB] text-white text-[11px] font-[700] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    {s.num}
                  </div>
                  <div>
                    <p className="text-[13px] font-[650] text-[#111111]">{s.title}</p>
                    <p className="text-[12px] text-[#6B6B6B] mt-0.5 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
