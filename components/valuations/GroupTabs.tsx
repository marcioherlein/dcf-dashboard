'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface GroupTabsProps {
  groups: string[]
  active: string | null
  counts: Record<string, number>
  totalCount: number
  onSelect: (group: string | null) => void
  onNewGroup: (name: string) => void
}

export function GroupTabs({ groups, active, counts, totalCount, onSelect, onNewGroup }: GroupTabsProps) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const submit = () => {
    const name = draft.trim()
    if (name) {
      onNewGroup(name)
      onSelect(name)
    }
    setDraft('')
    setAdding(false)
  }

  return (
    <div className="overflow-x-auto -webkit-overflow-scrolling-touch pb-1">
      <div className="flex items-center gap-1.5 min-w-max sm:flex-wrap sm:min-w-0">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
          active === null
            ? 'bg-slate-900 text-white'
            : 'bg-white border border-[#E3E1DA] text-[#566174] hover:bg-[#F4F3EF]',
        )}
      >
        All
        <span
          className={cn(
            'text-[11px] px-1.5 py-0.5 rounded-md font-semibold',
            active === null ? 'bg-white/20 text-white' : 'bg-[#E3E1DA] text-[#566174]',
          )}
        >
          {totalCount}
        </span>
      </button>

      {groups.map((group) => (
        <button
          key={group}
          onClick={() => onSelect(group)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
            active === group
              ? 'bg-slate-900 text-white'
              : 'bg-white border border-[#E3E1DA] text-[#566174] hover:bg-[#F4F3EF]',
          )}
        >
          {group}
          <span
            className={cn(
              'text-[11px] px-1.5 py-0.5 rounded-md font-semibold',
              active === group ? 'bg-white/20 text-white' : 'bg-[#E3E1DA] text-[#566174]',
            )}
          >
            {counts[group] ?? 0}
          </span>
        </button>
      ))}

      {adding ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') { setAdding(false); setDraft('') }
            }}
            placeholder="Group name…"
            className="px-3 py-1.5 text-[13px] border border-[#93B4F5] rounded-lg outline-none w-36 bg-white"
          />
          {draft.trim() && (
            <button
              onClick={submit}
              className="px-3 py-1.5 bg-olive-700 text-white text-[12px] font-semibold rounded-lg hover:bg-olive-600 transition-colors"
            >
              Add
            </button>
          )}
          <button
            onClick={() => { setAdding(false); setDraft('') }}
            className="px-2 py-1.5 text-[13px] text-[#8A95A6] hover:text-[#566174] transition-colors"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[#8A95A6] hover:text-[#566174] hover:bg-[#F4F3EF] border border-dashed border-[#CDD1C8] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New group
        </button>
      )}
      </div>
    </div>
  )
}
