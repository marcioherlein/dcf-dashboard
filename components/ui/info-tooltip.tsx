'use client'
import { useState } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip'

interface Props {
  text: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: string
}

export function InfoTooltip({ text, side = 'top', maxWidth = '240px' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <TooltipProvider delay={150}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          onClick={() => setOpen(o => !o)}
          className="relative inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-[#8A95A6] border border-[#E3E1DA] cursor-default select-none hover:text-[#5F790B] hover:border-[#5F790B] transition-colors shrink-0 after:absolute after:inset-[-13px] after:content-['']"
          aria-label="More information"
        >
          i
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="bg-[#0A1424] border border-white/10 text-white shadow-xl"
        >
          <p className="text-[11px] leading-snug" style={{ maxWidth }}>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
