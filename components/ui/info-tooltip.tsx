'use client'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip'

interface Props {
  text: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: string
}

export function InfoTooltip({ text, side = 'top', maxWidth = '220px' }: Props) {
  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] text-slate-500 border border-slate-700 cursor-default select-none hover:text-slate-300 hover:border-slate-500 transition-colors shrink-0"
          aria-label="More information"
        >
          i
        </TooltipTrigger>
        <TooltipContent side={side} className="bg-[#0d1b2e] border border-[rgba(59,130,246,0.25)] text-slate-200 shadow-xl">
          <p className="text-[11px] leading-snug" style={{ maxWidth }}>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
