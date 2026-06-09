'use client'
import { motion, useReducedMotion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import type { TabId } from '@/components/stock/TabNav'

interface Props {
  currentTab: TabId
  onNavigate: (tab: TabId) => void
}

const NEXT_TAB: Partial<Record<TabId, { tab: TabId; label: string; description: string }>> = {
  overview:   { tab: 'valuation',  label: 'Valuation',  description: 'Run the model — see what this stock is worth'         },
  valuation:  { tab: 'conviction', label: 'Conviction', description: 'Check the business — does quality support the price?'  },
  conviction: { tab: 'financials', label: 'Financials', description: 'See the numbers — revenue, margins, cash flow by year' },
  financials: { tab: 'news',       label: 'News',       description: 'Read the latest headlines for context'                 },
}

export default function NextTabBanner({ currentTab, onNavigate }: Props) {
  const reduced = useReducedMotion()
  const next = NEXT_TAB[currentTab]
  if (!next) return null

  return (
    <button
      onClick={() => onNavigate(next.tab)}
      className="group w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-[#F5F5F5] border-t border-[#E5E5E5] hover:bg-[#EEEFED] transition-colors text-left min-h-[52px]"
      aria-label={`Next: ${next.label} — ${next.description}`}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] font-bold text-[#9B9B9B] leading-none">
          NEXT
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-[#111111]">
            {next.label}
          </span>
          <span className="text-[12px] text-[#6B6B6B] truncate">
            — {next.description}
          </span>
        </div>
      </div>

      <motion.div
        className="shrink-0 text-[#5F790B]"
        animate={reduced ? {} : undefined}
        whileHover={reduced ? {} : { x: 4 }}
        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <ChevronRight size={18} strokeWidth={2.5} />
      </motion.div>
    </button>
  )
}
