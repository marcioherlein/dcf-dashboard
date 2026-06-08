'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Axis field registry ──────────────────────────────────────────────────────

export type AxisField =
  | 'trailingPE'
  | 'beta'
  | 'marketCap'
  | 'price'
  | 'dividendYield'

export type BubbleSizeField = 'marketCap' | 'fixed' | 'beta'

export interface AxisConfig {
  xField: AxisField
  yField: AxisField
  zField: BubbleSizeField
}

export const AXIS_FIELD_LABELS: Record<AxisField, string> = {
  trailingPE:    'P/E ratio',
  beta:          'Beta',
  marketCap:     'Market cap',
  price:         'Price',
  dividendYield: 'Div. yield',
}

export const AXIS_FIELD_DESC: Record<AxisField, string> = {
  trailingPE:    'Trailing 12-month P/E',
  beta:          '3Y beta vs. S&P 500',
  marketCap:     'Total market capitalisation',
  price:         'Current price (USD)',
  dividendYield: 'Annual dividend yield (%)',
}

const BUBBLE_SIZE_LABELS: Record<BubbleSizeField, string> = {
  marketCap: 'Market cap',
  fixed:     'All equal',
  beta:      'Beta',
}

export const DEFAULT_AXIS_CONFIG: AxisConfig = {
  xField: 'trailingPE',
  yField: 'beta',
  zField: 'marketCap',
}

// ─── Single axis selector dropdown ───────────────────────────────────────────

interface AxisDropdownProps {
  label: string
  value: AxisField
  options: AxisField[]
  onChange: (f: AxisField) => void
  className?: string
}

function AxisDropdown({ label, value, options, onChange, className }: AxisDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 h-10 sm:h-9 px-3 border border-[#E5E5E5] rounded-lg bg-white hover:border-[#C8C8C8] transition-colors min-w-0 w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.3)] focus-visible:outline-none"
      >
        <span className="text-[11px] font-medium text-[#6B6B6B] shrink-0">{label}:</span>
        <span className="text-[12px] font-semibold text-[#111111] truncate flex-1 text-left">{AXIS_FIELD_LABELS[value]}</span>
        <ChevronDown size={12} className="text-[#6B6B6B] shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={`${label} field`}
          className="absolute top-full mt-1 left-0 min-w-[200px] bg-white border border-[#E5E5E5] rounded-xl shadow-lg z-30 py-1 overflow-hidden"
        >
          {options.map(f => (
            <button
              key={f}
              role="option"
              aria-selected={value === f}
              onClick={() => { onChange(f); setOpen(false) }}
              className={cn(
                'w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[#F5F5F5] transition-colors min-h-[44px]',
                value === f ? 'bg-[#F5F5F5]' : '',
              )}
            >
              <span className="w-4 shrink-0 pt-0.5">
                {value === f && <Check size={12} className="text-olive-700" />}
              </span>
              <div>
                <p className="text-[12px] font-semibold text-[#111111] leading-none">{AXIS_FIELD_LABELS[f]}</p>
                <p className="text-[10px] text-[#6B6B6B] mt-0.5">{AXIS_FIELD_DESC[f]}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Bubble size selector ─────────────────────────────────────────────────────

interface BubbleSizeDropdownProps {
  value: BubbleSizeField
  onChange: (f: BubbleSizeField) => void
  className?: string
}

function BubbleSizeDropdown({ value, onChange, className }: BubbleSizeDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options: BubbleSizeField[] = ['marketCap', 'beta', 'fixed']

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 h-10 sm:h-9 px-3 border border-[#E5E5E5] rounded-lg bg-white hover:border-[#C8C8C8] transition-colors min-w-0 w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-[rgba(95,121,11,0.3)] focus-visible:outline-none"
      >
        <span className="text-[11px] font-medium text-[#6B6B6B] shrink-0">Size:</span>
        <span className="text-[12px] font-semibold text-[#111111] truncate flex-1 text-left">{BUBBLE_SIZE_LABELS[value]}</span>
        <ChevronDown size={12} className="text-[#6B6B6B] shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Bubble size field"
          className="absolute top-full mt-1 left-0 min-w-[160px] bg-white border border-[#E5E5E5] rounded-xl shadow-lg z-30 py-1 overflow-hidden"
        >
          {options.map(f => (
            <button
              key={f}
              role="option"
              aria-selected={value === f}
              onClick={() => { onChange(f); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[#F5F5F5] transition-colors min-h-[44px]',
                value === f ? 'bg-[#F5F5F5]' : '',
              )}
            >
              <span className="w-4 shrink-0">
                {value === f && <Check size={12} className="text-olive-700" />}
              </span>
              <span className="text-[12px] font-semibold text-[#111111]">{BUBBLE_SIZE_LABELS[f]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main AxisPicker ──────────────────────────────────────────────────────────

interface AxisPickerProps {
  config: AxisConfig
  onChange: (config: AxisConfig) => void
  nullCounts?: Partial<Record<AxisField, number>>
  totalCount?: number
}

const ALL_FIELDS: AxisField[] = ['trailingPE', 'beta', 'marketCap', 'price', 'dividendYield']

export default function AxisPicker({ config, onChange, nullCounts, totalCount }: AxisPickerProps) {
  function setX(f: AxisField) {
    // Swap if same as Y
    if (f === config.yField) onChange({ ...config, xField: f, yField: config.xField })
    else onChange({ ...config, xField: f })
  }
  function setY(f: AxisField) {
    if (f === config.xField) onChange({ ...config, yField: f, xField: config.yField })
    else onChange({ ...config, yField: f })
  }
  function setZ(f: BubbleSizeField) {
    onChange({ ...config, zField: f })
  }

  const xNulls = nullCounts?.[config.xField] ?? 0
  const yNulls = nullCounts?.[config.yField] ?? 0
  const maxNulls = Math.max(xNulls, yNulls)
  const hasNullWarning = maxNulls > 0 && totalCount != null

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-sm px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <AxisDropdown label="X" value={config.xField} options={ALL_FIELDS} onChange={setX} className="flex-1 sm:flex-initial" />
          <AxisDropdown label="Y" value={config.yField} options={ALL_FIELDS} onChange={setY} className="flex-1 sm:flex-initial" />
          <BubbleSizeDropdown value={config.zField} onChange={setZ} className="flex-1 sm:flex-initial" />
        </div>

        {hasNullWarning && (
          <p className="text-[10px] text-[#9B9B9B] sm:ml-2">
            {maxNulls} stock{maxNulls !== 1 ? 's' : ''} hidden (missing data)
          </p>
        )}
      </div>
    </div>
  )
}
