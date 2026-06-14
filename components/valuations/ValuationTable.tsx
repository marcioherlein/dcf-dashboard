'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { WatchlistEntry, ListTag } from '@/lib/simplifier/types'
import { Sparkline, SparklineSkeleton } from '@/components/ui/Sparkline'
import { ConfidenceRing } from './ConfidenceRing'
import { fmtPrice } from '@/lib/formatters'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SortKey =
  | 'ticker' | 'upsidePct' | 'overallScore' | 'updatedAt' | 'price' | 'fairValue'
  | 'peRatio' | 'pegRatio' | 'evToEbitda' | 'dividendYield'
  | 'return1y' | 'return3y' | 'return5y'
  | 'bearScenario' | 'baseScenario' | 'bullScenario'
  | 'piotroski'

// ── Optional column definitions ───────────────────────────────────────────────

export interface ColDef {
  id:       SortKey
  label:    string
  group:    'Valuation' | 'Returns' | 'Fundamentals' | 'Scenarios'
  format:   'pct' | 'multiple' | 'int' | 'price' | 'pct_return'
  hint?:    string
}

export const OPTIONAL_COLUMNS: ColDef[] = [
  { id: 'peRatio',      label: 'P/E (TTM)',   group: 'Fundamentals', format: 'multiple', hint: 'Trailing price-to-earnings ratio' },
  { id: 'pegRatio',     label: 'PEG',         group: 'Fundamentals', format: 'multiple', hint: 'P/E relative to earnings growth' },
  { id: 'evToEbitda',   label: 'EV/EBITDA',   group: 'Fundamentals', format: 'multiple', hint: 'Enterprise value to EBITDA' },
  { id: 'dividendYield',label: 'Div. Yield',  group: 'Fundamentals', format: 'pct',      hint: 'Trailing dividend yield' },
  { id: 'piotroski',    label: 'F-Score',     group: 'Fundamentals', format: 'int',      hint: 'Piotroski F-Score (0–9). 7+ = strong.' },
  { id: 'return1y',     label: 'Return 1Y',   group: 'Returns',      format: 'pct_return' },
  { id: 'return3y',     label: 'Return 3Y',   group: 'Returns',      format: 'pct_return' },
  { id: 'return5y',     label: 'Return 5Y',   group: 'Returns',      format: 'pct_return' },
  { id: 'bearScenario', label: 'Bear',        group: 'Scenarios',    format: 'price',    hint: 'Bear case fair value' },
  { id: 'baseScenario', label: 'Base',        group: 'Scenarios',    format: 'price',    hint: 'Base case fair value' },
  { id: 'bullScenario', label: 'Bull',        group: 'Scenarios',    format: 'price',    hint: 'Bull case fair value' },
]

const STORAGE_KEY = 'insic_valuation_cols_v1'
const DEFAULT_COLS: SortKey[] = []  // no extra columns by default

export function loadSavedCols(): SortKey[] {
  if (typeof window === 'undefined') return DEFAULT_COLS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_COLS
    return JSON.parse(raw) as SortKey[]
  } catch { return DEFAULT_COLS }
}

export function saveCols(cols: SortKey[]): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cols)) } catch { /* ignore */ }
}

function formatColValue(val: number | null | undefined, format: ColDef['format']): string {
  if (val == null) return '—'
  switch (format) {
    case 'pct':        return (val * 100).toFixed(2) + '%'
    case 'pct_return': return (val >= 0 ? '+' : '') + (val * 100).toFixed(1) + '%'
    case 'multiple':   return val.toFixed(2) + '×'
    case 'int':        return String(Math.round(val))
    case 'price':      return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
}

function colValueClass(val: number | null | undefined, format: ColDef['format'], id: SortKey): string {
  if (val == null) return 'text-[#9B9B9B]'
  if (format === 'pct_return') return val >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'
  if (id === 'peRatio')     return val > 50 ? 'text-[#D83B3B]' : val < 15 ? 'text-[#11875D]' : 'text-[#111111]'
  if (id === 'pegRatio')    return val > 2   ? 'text-[#D83B3B]' : val < 1  ? 'text-[#11875D]' : 'text-[#111111]'
  if (id === 'piotroski')   return val >= 7  ? 'text-[#11875D]' : val <= 3  ? 'text-[#D83B3B]' : 'text-[#111111]'
  if (id === 'dividendYield') return val > 0 ? 'text-[#11875D]' : 'text-[#9B9B9B]'
  return 'text-[#111111]'
}

// ── Column Picker ─────────────────────────────────────────────────────────────

export function ColumnPicker({
  selected,
  onChange,
}: {
  selected: SortKey[]
  onChange: (cols: SortKey[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const toggle = (id: SortKey) => {
    const next = selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id]
    onChange(next)
    saveCols(next)
  }

  const groups = ['Fundamentals', 'Returns', 'Scenarios'] as const

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-all',
          selected.length > 0
            ? 'border-[#5F790B] text-[#5F790B] bg-[#F6FAEA]'
            : 'border-[#E5E5E5] text-[#6B6B6B] bg-white hover:border-[#BFD2A1] hover:text-[#5F790B]',
        )}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
        </svg>
        Columns
        {selected.length > 0 && (
          <span className="bg-[#5F790B] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {selected.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#E5E5E5] rounded-xl shadow-lg w-64 p-3">
          <p className="text-[10px] font-bold text-[#9B9B9B] uppercase tracking-wider mb-2">Add columns</p>
          {groups.map(group => (
            <div key={group} className="mb-3">
              <p className="text-[10px] font-semibold text-[#6B6B6B] mb-1.5">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {OPTIONAL_COLUMNS.filter(c => c.group === group).map(col => {
                  const active = selected.includes(col.id)
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggle(col.id)}
                      title={col.hint}
                      className={cn(
                        'px-2 py-1 rounded-md border text-[11px] font-semibold transition-all',
                        active
                          ? 'bg-[#5F790B] border-[#5F790B] text-white'
                          : 'bg-white border-[#E5E5E5] text-[#6B6B6B] hover:border-[#BFD2A1] hover:text-[#5F790B]',
                      )}
                    >
                      {col.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {selected.length > 0 && (
            <button
              onClick={() => { onChange([]); saveCols([]) }}
              className="text-[11px] text-[#D83B3B] hover:text-[#B02A2A] mt-1 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}


export interface ValuationTableProps {
  entries:        WatchlistEntry[]
  sparklines:     Record<string, number[] | null>
  groups:         string[]
  sortKey:        SortKey
  sortDir:        'asc' | 'desc'
  onSort:         (key: SortKey) => void
  onDelete:       (ticker: string) => void
  onTagUpdate:    (ticker: string, tag: ListTag) => void
  onGroupUpdate:  (ticker: string, groupName: string | null) => void
  onNoteSave:     (ticker: string, note: string) => Promise<void>
  selectedCols?:  SortKey[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const d  = Math.floor(ms / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7)   return `${d}d ago`
  if (d < 30)  return `${Math.floor(d / 7)}w ago`
  const m = Math.floor(d / 30)
  if (m === 1) return '1mo ago'
  if (m < 12)  return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function getVerdict(entry: WatchlistEntry): 'Undervalued' | 'Fair Value' | 'Overvalued' | 'Needs Review' {
  if (entry.snapshot.fairValue == null || entry.snapshot.upsidePct == null) return 'Needs Review'
  if (entry.snapshot.upsidePct > 0.15)  return 'Undervalued'
  if (entry.snapshot.upsidePct > -0.15) return 'Fair Value'
  return 'Overvalued'
}

function tagInfo(tag: ListTag): { label: string; cls: string; dot: string } | null {
  if (!tag) return null
  if (tag === 'buy')   return { label: 'High Conviction', cls: 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]',   dot: 'bg-olive-500' }
  if (tag === 'watch') return { label: 'Watch',            cls: 'bg-[#FFF4DA] text-[#B56A00] border-[#E5E5E5]', dot: 'bg-[#B56A00]' }
  if (tag === 'pass')  return { label: 'Avoid',            cls: 'bg-[#FCEAEA] text-[#D83B3B] border-[#E5E5E5]',       dot: 'bg-[#D83B3B]' }
  return null
}

function verdictInfo(verdict: ReturnType<typeof getVerdict>): { cls: string } {
  if (verdict === 'Undervalued')  return { cls: 'bg-[#E8F7EF] text-[#11875D] border-[#CDD1C8]' }
  if (verdict === 'Fair Value')   return { cls: 'bg-[#EAF1FF] text-[#2563EB] border-[#BFDBFE]' }
  if (verdict === 'Overvalued')   return { cls: 'bg-[#FCEAEA] text-[#D83B3B] border-[#E5E5E5]' }
  return { cls: 'bg-[#FFF4DA] text-[#B56A00] border-[#E5E5E5]' }
}

function nextTag(tag: ListTag): ListTag {
  if (tag === 'watch') return 'buy'
  if (tag === 'buy')   return 'pass'
  return 'watch'
}

// ── Ticker Avatar (replaces StockLogo) ────────────────────────────────────────

function TickerAvatar({ ticker }: { ticker: string }) {
  const colors = ['#5F790B','#2563EB','#B56A00','#11875D','#D83B3B','#6D28D9','#0891B2']
  const color = colors[ticker.charCodeAt(0) % colors.length]
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white text-[8px] font-bold"
      style={{ background: color }}
    >
      {ticker.slice(0, 2)}
    </div>
  )
}

// ── Expanded Note Panel ────────────────────────────────────────────────────────

function ExpandedNotePanel({ entry, onNoteSave, onClose }: {
  entry:       WatchlistEntry
  onNoteSave:  (ticker: string, note: string) => Promise<void>
  onClose:     () => void
}) {
  const thesis  = entry.notes?.['__thesis__'] ?? ''
  const [text,  setText]   = useState(thesis)
  const [saving, setSaving] = useState(false)
  const [edited, setEdited] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onNoteSave(entry.ticker, text)
    setSaving(false)
    setEdited(false)
  }

  return (
    <tr>
      <td colSpan={13} className="px-0 py-0 border-b border-[#93B4F5]">
        <div className="bg-[#F0F7FF] border-t border-[#93B4F5] px-5 py-3 flex gap-4 items-start">
          {/* Icon */}
          <div className="shrink-0 w-6 h-6 rounded-lg bg-[#EAF1FF] flex items-center justify-center mt-0.5">
            <svg className="w-3 h-3 text-olive-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-6 4h10M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
          </div>
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider mb-1">Analyst note</p>
            {text.trim() ? (
              <p className="text-[12px] text-[#111111] leading-relaxed mb-2">{text}</p>
            ) : (
              <p className="text-[12px] text-[#9B9B9B] italic mb-2">
                No note yet. Add one to remember your thesis.
              </p>
            )}
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setEdited(true) }}
              rows={2}
              placeholder="Write your thesis, key reasons, or what to watch for…"
              style={{ fontSize: '16px' }}
              className="w-full text-[12px] text-[#111111] bg-white border border-[#93B4F5] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#93B4F5] focus:ring-2 focus:ring-olive-100 resize-none placeholder-slate-300"
            />
            <div className="flex items-center gap-3 mt-1.5">
              {edited && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-[11px] font-semibold text-white bg-olive-700 hover:bg-olive-600 px-3 py-1 rounded-lg transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save note'}
                </button>
              )}
              <Link
                href={`/stock/${entry.ticker}`}
                className="text-[11px] font-semibold text-olive-700 hover:text-[#2563EB] transition-colors flex items-center gap-1"
              >
                View full analysis
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <button
                onClick={onClose}
                className="ml-auto text-[11px] text-[#9B9B9B] hover:text-[#6B6B6B] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Actions Menu ───────────────────────────────────────────────────────────────

function ActionsMenu({ entry, groups, onDelete, onTagUpdate, onGroupUpdate }: {
  entry:         WatchlistEntry
  groups:        string[]
  onDelete:      () => void
  onTagUpdate:   (tag: ListTag) => void
  onGroupUpdate: (groupName: string | null) => void
}) {
  const [open,     setOpen]     = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [newGroup, setNewGroup] = useState('')
  const [confirm,  setConfirm]  = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setMoveOpen(false); setConfirm(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const close = () => { setOpen(false); setMoveOpen(false); setNewGroup(''); setConfirm(false) }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((v) => !v); setMoveOpen(false) }}
        aria-label="Row actions"
        className="p-1.5 rounded-lg text-[#9B9B9B] hover:text-[#6B6B6B] hover:bg-[#E5E5E5] transition-colors [@media(hover:hover)]:sm:opacity-0 [@media(hover:hover)]:sm:group-hover:opacity-100"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3"  r="1.3" />
          <circle cx="8" cy="8"  r="1.3" />
          <circle cx="8" cy="13" r="1.3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-52 bg-white rounded-xl shadow-xl border border-[#E5E5E5] z-40 py-1 overflow-hidden">
          <Link
            href={`/stock/${entry.ticker}`}
            className="flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-[#111111] hover:bg-[#F5F5F5]"
            onClick={close}
          >
            <svg className="w-3.5 h-3.5 text-[#9B9B9B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open analysis
          </Link>

          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-[#111111] hover:bg-[#F5F5F5]"
            onClick={() => { onTagUpdate(nextTag(entry.listTag)); close() }}
          >
            <svg className="w-3.5 h-3.5 text-[#9B9B9B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Change tag
          </button>

          <button
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-[#111111] hover:bg-[#F5F5F5]"
            onClick={() => setMoveOpen((v) => !v)}
          >
            <svg className="w-3.5 h-3.5 text-[#9B9B9B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
            </svg>
            Move to group
            <svg className="w-3 h-3 ml-auto text-[#9B9B9B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {moveOpen && (
            <div className="border-t border-[#E5E5E5] bg-[#F5F5F5]/60 py-1">
              {groups.filter((g) => g !== entry.groupName).map((g) => (
                <button
                  key={g}
                  onClick={() => { onGroupUpdate(g); close() }}
                  className="w-full text-left px-5 py-1.5 text-[11px] text-[#6B6B6B] hover:bg-white transition-colors"
                >
                  {g}
                </button>
              ))}
              {entry.groupName && (
                <button
                  onClick={() => { onGroupUpdate(null); close() }}
                  className="w-full text-left px-5 py-1.5 text-[11px] text-[#D83B3B] hover:bg-white transition-colors"
                >
                  Remove from group
                </button>
              )}
              <div className="px-3 py-1.5 flex gap-1.5 items-center">
                <input
                  type="text"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newGroup.trim()) { onGroupUpdate(newGroup.trim()); close() }
                    if (e.key === 'Escape') setMoveOpen(false)
                  }}
                  placeholder="New group…"
                  className="flex-1 text-[11px] border border-[#E5E5E5] rounded-md px-2 py-1 outline-none focus:border-[#93B4F5] bg-white"
                  onClick={(e) => e.stopPropagation()}
                />
                {newGroup.trim() && (
                  <button
                    onClick={() => { onGroupUpdate(newGroup.trim()); close() }}
                    className="text-[11px] text-olive-700 font-semibold hover:text-[#2563EB]"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-[#E5E5E5] mt-1 pt-1">
            {confirm ? (
              <div className="px-3.5 py-2">
                <p className="text-[11px] text-[#6B6B6B] mb-2">Remove this analysis?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onDelete(); close() }}
                    className="flex-1 py-1 rounded-lg bg-[#D83B3B] text-white text-[11px] font-semibold hover:bg-[#D83B3B] transition-colors"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="flex-1 py-1 rounded-lg border border-[#E5E5E5] text-[11px] text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirm(true)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-[#D83B3B] hover:bg-[#FCEAEA]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Remove analysis
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sortable Header Cell ───────────────────────────────────────────────────────

function Th({ label, sortKey, current, dir, onSort, align = 'right' }: {
  label:    string
  sortKey:  SortKey
  current:  SortKey
  dir:      'asc' | 'desc'
  onSort:   (k: SortKey) => void
  align?:   'left' | 'right'
}) {
  const active = current === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={cn(
        'px-3 py-2 text-[10px] font-semibold text-[#6B6B6B] cursor-pointer select-none hover:text-[#6B6B6B] transition-colors whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' ? 'justify-end' : 'justify-start')}>
        {label}
        <svg className={cn('w-3 h-3 transition-opacity', active ? 'opacity-100 text-olive-700' : 'opacity-20')} fill="currentColor" viewBox="0 0 20 20">
          {active && dir === 'asc' ? (
            <path d="M10 6l-4 4h8l-4-4z" />
          ) : active && dir === 'desc' ? (
            <path d="M10 14l4-4H6l4 4z" />
          ) : (
            <path d="M10 6l-4 4h8l-4-4zM10 14l4-4H6l4 4z" />
          )}
        </svg>
      </span>
    </th>
  )
}

// ── Mobile Valuation Card ──────────────────────────────────────────────────────

function MobileValuationCard({ entry, sparklines, onDelete, onTagUpdate, onGroupUpdate, onNoteSave, groups }: {
  entry:         WatchlistEntry
  sparklines:    Record<string, number[] | null>
  groups:        string[]
  onDelete:      () => void
  onTagUpdate:   (tag: ListTag) => void
  onGroupUpdate: (groupName: string | null) => void
  onNoteSave:    (ticker: string, note: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const prices   = sparklines[entry.ticker]
  const _up      = prices && prices.length >= 2 ? prices[prices.length - 1] >= prices[0] : true
  const upside   = entry.snapshot.upsidePct
  const verdict  = getVerdict(entry)
  const vtInfo   = verdictInfo(verdict)
  const tInfo    = tagInfo(entry.listTag)

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
      <div className="px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <TickerAvatar ticker={entry.ticker} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link href={`/stock/${entry.ticker}`} className="text-[13px] font-semibold text-[#111111] font-mono hover:text-olive-700 transition-colors">
                  {entry.ticker}
                </Link>
                {tInfo && (
                  <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 border', tInfo.cls)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', tInfo.dot)} />
                    {tInfo.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6B6B6B] mt-0.5 truncate">{entry.companyName}</p>
            </div>
          </div>
          <ActionsMenu
            entry={entry}
            groups={groups}
            onDelete={onDelete}
            onTagUpdate={onTagUpdate}
            onGroupUpdate={onGroupUpdate}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div>
            <p className="text-[10px] text-[#6B6B6B] font-semibold mb-0.5">Price</p>
            <p className="text-[12px] font-medium text-[#111111] tabular-nums">{fmtPrice(entry.snapshot.price, 'USD')}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#6B6B6B] font-semibold mb-0.5">Fair Value</p>
            <p className="text-[12px] font-medium text-[#6B6B6B] tabular-nums">{fmtPrice(entry.snapshot.fairValue, 'USD')}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#6B6B6B] font-semibold mb-0.5">Upside</p>
            <p className={cn('text-[12px] font-semibold tabular-nums', upside == null ? 'text-[#9B9B9B]' : upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
              {upside != null ? `${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E3E1DA]">
          <span className={cn('text-[10px] font-semibold rounded-full px-1.5 py-0.5 border', vtInfo.cls)}>
            {verdict}
          </span>
          <span className="text-[11px] text-[#9B9B9B]">{relativeDate(entry.updatedAt)}</span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-semibold text-olive-700 hover:text-[#2563EB] transition-colors"
          >
            {expanded ? 'Hide note' : 'Show note'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-[#F0F7FF] border-t border-[#93B4F5] px-3 py-3">
          <NoteEditorMobile entry={entry} onNoteSave={onNoteSave} />
        </div>
      )}
    </div>
  )
}

function NoteEditorMobile({ entry, onNoteSave }: {
  entry: WatchlistEntry
  onNoteSave: (ticker: string, note: string) => Promise<void>
}) {
  const thesis = entry.notes?.['__thesis__'] ?? ''
  const [text, setText]    = useState(thesis)
  const [saving, setSaving] = useState(false)
  const [edited, setEdited] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onNoteSave(entry.ticker, text)
    setSaving(false)
    setEdited(false)
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider mb-1.5">Analyst note</p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setEdited(true) }}
        rows={3}
        placeholder="Write your thesis…"
        style={{ fontSize: '16px' }}
        className="w-full text-[12px] text-[#111111] bg-white border border-[#93B4F5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#93B4F5] resize-none placeholder-slate-300"
      />
      <div className="flex items-center gap-3 mt-1.5">
        {edited && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[11px] font-semibold text-white bg-olive-700 hover:bg-olive-600 px-3 py-1 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        )}
        <Link href={`/stock/${entry.ticker}`} className="text-[11px] font-semibold text-olive-700 hover:text-[#2563EB] transition-colors">
          View full analysis →
        </Link>
      </div>
    </div>
  )
}

// ── Main Table ─────────────────────────────────────────────────────────────────

export function ValuationTable({ entries, sparklines, groups, sortKey, sortDir, onSort, onDelete, onTagUpdate, onGroupUpdate, onNoteSave, selectedCols = [] }: ValuationTableProps) {
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null)
  const activeCols = OPTIONAL_COLUMNS.filter(c => selectedCols.includes(c.id))

  const handleSort = (key: SortKey) => { onSort(key) }

  const sorted = [...entries].sort((a, b) => {
    let va: string | number, vb: string | number
    const snap = (e: WatchlistEntry, k: SortKey): number => {
      switch (k) {
        case 'peRatio':      return e.snapshot.peRatio      ?? -Infinity
        case 'pegRatio':     return e.snapshot.pegRatio     ?? -Infinity
        case 'evToEbitda':   return e.snapshot.evToEbitda   ?? -Infinity
        case 'dividendYield':return e.snapshot.dividendYield ?? -Infinity
        case 'return1y':     return e.snapshot.return1y     ?? -Infinity
        case 'return3y':     return e.snapshot.return3y     ?? -Infinity
        case 'return5y':     return e.snapshot.return5y     ?? -Infinity
        case 'bearScenario': return e.snapshot.bearScenario ?? -Infinity
        case 'baseScenario': return e.snapshot.baseScenario ?? -Infinity
        case 'bullScenario': return e.snapshot.bullScenario ?? -Infinity
        case 'piotroski':    return e.snapshot.piotroski    ?? -Infinity
        default: return -Infinity
      }
    }
    switch (sortKey) {
      case 'ticker':       va = a.ticker;                            vb = b.ticker;                            break
      case 'upsidePct':    va = a.snapshot.upsidePct ?? -Infinity;   vb = b.snapshot.upsidePct ?? -Infinity;   break
      case 'overallScore': va = a.overallScore ?? -Infinity;         vb = b.overallScore ?? -Infinity;         break
      case 'price':        va = a.snapshot.price ?? -Infinity;       vb = b.snapshot.price ?? -Infinity;       break
      case 'fairValue':    va = a.snapshot.fairValue ?? -Infinity;   vb = b.snapshot.fairValue ?? -Infinity;   break
      case 'updatedAt':    va = a.updatedAt;                         vb = b.updatedAt;                         break
      default:             va = snap(a, sortKey);                    vb = snap(b, sortKey);                    break
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ?  1 : -1
    return 0
  })

  const toggleExpand = (ticker: string) => {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker))
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-xl p-8 text-center">
        <p className="text-[13px] text-[#6B6B6B] font-medium">No valuations match your filters.</p>
        <p className="text-[12px] text-[#9B9B9B] mt-1">Try clearing filters or switching tabs.</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="bg-[#F8F8F8] border-b border-[#E5E5E5]">
                {/* Checkbox column */}
                <th className="w-8 px-2 py-2">
                  <input type="checkbox" className="w-3 h-3 rounded accent-[#5F790B]" />
                </th>
                {/* Expand column */}
                <th className="w-8 px-2 py-2" />
                <Th label="Ticker & Company" sortKey="ticker"       current={sortKey} dir={sortDir} onSort={handleSort} align="left" />
                <th className="px-3 py-2 text-[10px] font-semibold text-[#6B6B6B] text-left whitespace-nowrap">Tag</th>
                <th className="px-3 py-2 text-[10px] font-semibold text-[#6B6B6B] text-center whitespace-nowrap">1M</th>
                <Th label="Price"      sortKey="price"        current={sortKey} dir={sortDir} onSort={handleSort} />
                <Th label="Fair Value" sortKey="fairValue"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <Th label="Upside"     sortKey="upsidePct"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-3 py-2 text-[10px] font-semibold text-[#6B6B6B] text-right whitespace-nowrap">Verdict</th>
                <Th label="Confidence" sortKey="overallScore" current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="hidden lg:table-cell px-3 py-2 text-[10px] font-semibold text-[#6B6B6B] text-right whitespace-nowrap">Since Save</th>
                {/* Dynamic optional columns */}
                {activeCols.map(col => (
                  <Th key={col.id} label={col.label} sortKey={col.id} current={sortKey} dir={sortDir} onSort={handleSort} />
                ))}
                <Th label="Updated"    sortKey="updatedAt"    current={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-2 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E1DA]">
              {sorted.map((entry) => {
                const prices      = sparklines[entry.ticker]
                const sparkLoading= !(entry.ticker in sparklines)
                const up          = prices && prices.length >= 2 ? prices[prices.length - 1] >= prices[0] : true
                const verdict     = getVerdict(entry)
                const vtInfo      = verdictInfo(verdict)
                const tInfo       = tagInfo(entry.listTag)
                const upside      = entry.snapshot.upsidePct
                const isExpanded  = expandedTicker === entry.ticker

                // Since Save: current sparkline price vs saved price
                const currentPrice = prices?.[prices.length - 1] ?? null
                const savedPrice   = entry.snapshot.price
                const priceDelta   = currentPrice != null && savedPrice != null && savedPrice > 0 && !sparkLoading
                  ? (currentPrice - savedPrice) / savedPrice
                  : null
                const towardFV = priceDelta != null && upside != null
                  ? (upside > 0 && priceDelta > 0) || (upside <= 0 && priceDelta < 0)
                  : null

                return (
                  <>
                    <tr
                      key={entry.ticker}
                      className={cn(
                        'group transition-colors cursor-default',
                        isExpanded ? 'bg-[#F8FBFF]' : 'hover:bg-[#F8F8F8]',
                      )}
                    >
                      {/* Checkbox */}
                      <td className="w-8 px-2 py-1.5">
                        <input type="checkbox" className="w-3 h-3 rounded accent-[#5F790B]" />
                      </td>

                      {/* Expand chevron */}
                      <td className="px-2 py-1.5 w-8">
                        <button
                          onClick={() => toggleExpand(entry.ticker)}
                          aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                          className="text-[#9B9B9B] hover:text-[#2563EB] transition-colors"
                        >
                          <svg
                            className={cn('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-90')}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>

                      {/* Ticker & Company */}
                      <td className="px-3 py-1.5 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <TickerAvatar ticker={entry.ticker} />
                          <div className="min-w-0">
                            <Link
                              href={`/stock/${entry.ticker}`}
                              className="text-[12px] font-semibold font-mono text-[#111111] hover:text-olive-700 transition-colors leading-tight block"
                            >
                              {entry.ticker}
                            </Link>
                            <p className="text-[11px] text-[#6B6B6B] mt-0 truncate max-w-[130px]">{entry.companyName}</p>
                          </div>
                        </div>
                      </td>

                      {/* Tag */}
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {tInfo ? (
                          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 border', tInfo.cls)}>
                            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', tInfo.dot)} />
                            {tInfo.label}
                          </span>
                        ) : (
                          <span className="text-[#9B9B9B] text-[11px]">—</span>
                        )}
                      </td>

                      {/* 1M Sparkline */}
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-center" style={{ minWidth: 80 }}>
                          {sparkLoading ? (
                            <SparklineSkeleton width={80} height={24} />
                          ) : prices && prices.length >= 2 ? (
                            <Sparkline prices={prices} up={up} width={80} height={24} />
                          ) : (
                            <span className="text-[#9B9B9B] text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <div>
                          <p className="text-[12px] font-medium text-[#111111] tabular-nums">
                            {fmtPrice(entry.snapshot.price, 'USD')}
                          </p>
                          {(() => {
                            const livePrice = prices?.[prices.length - 1] ?? null
                            const prevPrice  = prices?.[prices.length - 2] ?? null
                            if (livePrice != null && prevPrice != null && prevPrice > 0) {
                              const d = (livePrice - prevPrice) / prevPrice
                              return (
                                <p className={cn('text-[11px] tabular-nums font-semibold', d >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                                  {d >= 0 ? '+' : ''}{(d * 100).toFixed(2)}%
                                </p>
                              )
                            }
                            return null
                          })()}
                        </div>
                      </td>

                      {/* Fair Value */}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <p className="text-[12px] font-medium text-[#111111] tabular-nums">
                          {fmtPrice(entry.snapshot.fairValue, 'USD')}
                        </p>
                      </td>

                      {/* Upside */}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        {upside != null ? (
                          <p className={cn('text-[12px] font-semibold tabular-nums', upside >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                            {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
                          </p>
                        ) : (
                          <span className="text-[#9B9B9B] text-[12px]">—</span>
                        )}
                      </td>

                      {/* Verdict */}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <span className={cn('text-[10px] font-semibold rounded-full px-1.5 py-0.5 border whitespace-nowrap', vtInfo.cls)}>
                          {verdict}
                        </span>
                      </td>

                      {/* Confidence */}
                      <td className="px-3 py-1.5">
                        <div className="flex justify-center">
                          <ConfidenceRing score={entry.overallScore} size={24} />
                        </div>
                      </td>

                      {/* Since Save */}
                      <td className="hidden lg:table-cell px-3 py-1.5 text-right whitespace-nowrap">
                        {priceDelta != null ? (
                          <div>
                            <p className={cn('text-[12px] font-semibold tabular-nums', priceDelta >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
                              {priceDelta >= 0 ? '+' : ''}{(priceDelta * 100).toFixed(1)}%
                            </p>
                            {towardFV != null && (
                              <p className={cn('text-[10px] font-medium mt-0', towardFV ? 'text-[#11875D]' : 'text-[#9B9B9B]')}>
                                {towardFV ? 'Toward FV' : 'Away from FV'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#9B9B9B] text-[11px]">—</span>
                        )}
                      </td>

                      {/* Dynamic optional columns */}
                      {activeCols.map(col => {
                        const rawVal = entry.snapshot[col.id as keyof typeof entry.snapshot] as number | null | undefined
                        const val = typeof rawVal === 'number' ? rawVal : null
                        const text = formatColValue(val, col.format)
                        const cls  = colValueClass(val, col.format, col.id)
                        const isStale = entry.snapshot.metricsUpdatedAt == null
                        return (
                          <td key={col.id} className="px-3 py-1.5 text-right whitespace-nowrap" title={isStale && val == null ? 'Re-save this stock to populate this column' : undefined}>
                            <span className={cn('text-[12px] font-semibold tabular-nums', cls, isStale && val == null ? 'opacity-40' : '')}>
                              {text}
                            </span>
                          </td>
                        )
                      })}

                      {/* Updated */}
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <span
                          className="text-[11px] text-[#6B6B6B]"
                          title={new Date(entry.updatedAt).toLocaleString()}
                        >
                          {relativeDate(entry.updatedAt)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-1.5">
                        <ActionsMenu
                          entry={entry}
                          groups={groups}
                          onDelete={() => onDelete(entry.ticker)}
                          onTagUpdate={(tag) => onTagUpdate(entry.ticker, tag)}
                          onGroupUpdate={(g) => onGroupUpdate(entry.ticker, g)}
                        />
                      </td>
                    </tr>

                    {/* Expanded note panel */}
                    {isExpanded && (
                      <ExpandedNotePanel
                        key={`${entry.ticker}-note`}
                        entry={entry}
                        onNoteSave={onNoteSave}
                        onClose={() => setExpandedTicker(null)}
                      />
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {sorted.map((entry) => (
          <MobileValuationCard
            key={entry.ticker}
            entry={entry}
            sparklines={sparklines}
            groups={groups}
            onDelete={() => onDelete(entry.ticker)}
            onTagUpdate={(tag) => onTagUpdate(entry.ticker, tag)}
            onGroupUpdate={(g) => onGroupUpdate(entry.ticker, g)}
            onNoteSave={onNoteSave}
          />
        ))}
      </div>
    </>
  )
}
